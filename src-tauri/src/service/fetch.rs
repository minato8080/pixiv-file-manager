use anyhow::Result;
use pixieve_rs::pixiv::client::PixivClient;
use pixieve_rs::pixiv::request_builder::PixivRequestBuilder;
use pixieve_rs::pixiv::result::illustration_proxy::IllustrationProxy;
use rayon::prelude::*;
use serde_json;
use sqlx::{Acquire, SqliteConnection, SqlitePool};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Instant, UNIX_EPOCH};
use std::vec::Vec;
use tauri::Emitter;

use crate::execute_queries;
use crate::models::fetch::{DeleteFileRow, FileDetail, ProcessStats, TagProgress};
use crate::service::common::{
    execute_multi_insert_query, format_duration, parse_path_info, remove_invalid_chars, update_cnum,
};
use crate::util::log_error;
use crate::util::ResultWithLocationExt;

async fn fetch_illustration_detail(
    pixiv_client: &PixivClient,
    illust_id: u32,
) -> Result<IllustrationProxy> {
    let pixiv_client = pixiv_client.clone();

    let illustration = tauri::async_runtime::spawn_blocking(move || {
        let request = PixivRequestBuilder::request_illustration(illust_id.try_into().unwrap());
        let response = pixiv_client.execute_with_auth(request).with_location()?;
        let illustration = response.json::<IllustrationProxy>().with_location()?;
        anyhow::Ok(illustration)
    })
    .await??;

    Ok(illustration)
}

pub async fn extract_dir_detail<P: AsRef<Path>>(folder: P) -> Vec<FileDetail> {
    let folder_path = folder.as_ref().to_owned();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let mut all_file_paths: Vec<PathBuf> = Vec::new();

        for entry in walkdir::WalkDir::new(&folder_path)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path().to_owned();
            if path.is_file() {
                all_file_paths.push(path);
            }
        }

        all_file_paths
            .into_par_iter()
            .filter_map(|path| {
                let file_info = match parse_path_info(&path) {
                    Ok(info) => info,
                    Err(e) => {
                        log_error(format!(
                            "ファイル情報の取得に失敗: {} (path: {:?})",
                            e, path
                        ));
                        return None;
                    }
                };

                let (created_time, file_size) = get_file_metadata(&path);

                Some(FileDetail {
                    illust_id: file_info.illust_id as u32,
                    suffix: file_info.suffix as u8,
                    extension: file_info.extension,
                    save_dir: file_info.save_dir.unwrap_or_default(),
                    created_time,
                    file_size,
                })
            })
            .collect::<Vec<FileDetail>>()
    })
    .await;

    match result {
        Ok(details) => details,
        Err(e) => {
            log_error(format!("タスクの実行に失敗: {:?}", e));
            Vec::new()
        }
    }
}

pub async fn process_fetch_illust_detail(
    pool: &SqlitePool,
    pixiv_client: &PixivClient,
    window: tauri::Window,
) -> Result<ProcessStats> {
    let start = Instant::now();

    let mut conn = pool.acquire().await.with_location()?;

    // ワークテーブルを準備
    let sql = include_str!("../sql/fetch/prepare_fetch_work.sql");
    execute_queries(&mut *conn, sql).await.with_location()?;

    let mut tx = conn.begin().await.with_location()?;

    // フェッチなしでインサートするファイルを処理
    insert_illust_info_no_fetch(&mut *tx).await?;

    tx.commit().await.with_location()?;

    // メイン処理
    let mut stats = core_fetch_illust_detail(&mut *conn, start, pixiv_client, window).await?;

    let mut tx = conn.begin().await.with_location()?;

    // 重複ファイルを検知して削除
    let cnt = delete_duplicate_files(&mut *tx).await?;
    stats.duplicated_files = cnt;

    // 詳細を取得できたらMissingタグを削除
    delete_missing_tags(&mut *tx).await?;

    // 管理番号を更新
    update_cnum(&mut *tx).await.with_location()?;

    tx.commit().await.with_location()?;

    // 全体処理終了
    let duration = start.elapsed();
    stats.process_time = format_duration(duration.as_millis() as u64);

    // 処理結果を通知
    Ok(stats)
}

async fn core_fetch_illust_detail(
    conn: &mut SqliteConnection,
    start: Instant,
    pixiv_client: &PixivClient,
    window: tauri::Window,
) -> Result<ProcessStats> {
    // 結果用の集計情報
    let mut success_count = 0;
    let mut fail_count = 0;
    let mut failed_file_paths = Vec::new();

    // フェッチ回数
    let total: u64 = sqlx::query_scalar("SELECT COUNT(*) FROM tmp_fetch_ids;")
        .fetch_one(&mut *conn)
        .await
        .with_location()?;

    let interval = std::env::var("INTERVAL_MILL_SEC")
        .ok()
        .and_then(|val| val.parse::<u64>().ok())
        .unwrap_or(1000);
    let total_duration_ms = total * interval;

    // フェッチ対象を取得
    let tmp_fetch_ids: Vec<u32> = sqlx::query_scalar("SELECT illust_id FROM tmp_fetch_ids;")
        .fetch_all(&mut *conn)
        .await
        .with_location()?;

    for fetch_id in tmp_fetch_ids {
        let mut tx = conn.begin().await.with_location()?;
        // イラスト情報を登録
        let cnum = insert_illust_info(&mut *tx, fetch_id).await?;
        // フェッチ処理
        match fetch_illustration_detail(pixiv_client, fetch_id).await {
            Ok(resp) => {
                // 詳細情報を登録
                sqlx::query("INSERT OR REPLACE INTO ILLUST_DETAIL (illust_id, author_id, character, cnum, created_at) VALUES (?, ?, NULL, ?, strftime('%s', ?))")
                .bind(resp.illust.id())
                .bind(resp.illust.user().id())
                .bind(cnum)
                .bind(resp.illust.create_date())
                .execute(&mut *tx).await.with_location()?;

                // タグ情報を登録
                for tag in resp.illust.tags() {
                    sqlx::query("INSERT OR REPLACE INTO TAG_INFO (illust_id, cnum, tag) VALUES (?1, ?2, ?3)")
                    .bind(fetch_id)
                    .bind(cnum)
                    .bind(remove_invalid_chars(tag.name()))
                    .execute(&mut *tx).await.with_location()?;
                }

                // 作者情報を登録
                sqlx::query("INSERT OR REPLACE INTO AUTHOR_INFO (author_id, author_name, author_account) VALUES (?1, ?2, ?3)",)
                        .bind(resp.illust.user().id())
                        .bind(resp.illust.user().name())
                        .bind(resp.illust.user().account())
                .execute(&mut *tx).await.with_location()?;
                success_count += 1;
            }
            Err(err) => {
                fail_count += 1;
                // 失敗時はデフォルト値で詳細情報を登録
                sqlx::query(
                    "INSERT OR IGNORE INTO ILLUST_DETAIL (illust_id, author_id, character, cnum) VALUES (?1, 0, NULL, ?2)",
                )
                .bind(fetch_id).bind(cnum).execute(&mut *tx).await.with_location()?;

                // 失敗時のタグ情報
                sqlx::query(
                    "INSERT OR IGNORE INTO TAG_INFO (illust_id, cnum, tag) VALUES (?1, ?2, 'Missing')",
                )
                .bind(fetch_id).bind(cnum).execute(&mut *tx).await.with_location()?;

                // 失敗したIDを結果に追加
                failed_file_paths.push(format!("{}:{}", fetch_id, err))
            }
        }
        // 一件ずつコミット
        tx.commit().await.with_location()?;

        // 処理状況を通知
        let elapsed = start.elapsed().as_millis() as u64;
        let remaining = total_duration_ms.saturating_sub(elapsed);
        let progress = TagProgress {
            success: success_count,
            fail: fail_count,
            current: success_count + fail_count,
            total: total as u32,
            elapsed_time: format_duration(elapsed),
            remaining_time: format_duration(remaining),
        };
        window
            .emit("tag_progress", serde_json::json!(progress))
            .with_location()?;

        // ボットアクセスなのでインターバルを挟む
        std::thread::sleep(std::time::Duration::from_millis(interval));
    }

    // 処理終了
    let duration = start.elapsed();

    Ok(ProcessStats {
        total_ids: success_count + fail_count,
        successed_ids: success_count,
        failed_ids: fail_count,
        duplicated_files: 0,
        process_time: format_duration(duration.as_millis() as u64),
        failed_file_paths,
    })
}

pub async fn prepare_illust_fetch_work(
    pool: &SqlitePool,
    file_details: &[FileDetail],
) -> Result<()> {
    let mut tx = pool.begin().await.with_location()?;
    let conn = tx.acquire().await.with_location()?;

    sqlx::query("DELETE FROM ILLUST_FETCH_WORK;")
        .execute(&mut *conn)
        .await
        .with_location()?;

    let rows: Vec<_> = file_details
        .iter()
        .map(|f| {
            vec![
                f.illust_id.into(),
                f.suffix.into(),
                f.extension.clone().into(),
                f.save_dir.clone().into(),
                f.created_time.into(),
                f.file_size.into(),
            ]
        })
        .collect();

    execute_multi_insert_query(&mut *conn,
        "INSERT INTO ILLUST_FETCH_WORK (illust_id, suffix, extension, save_dir, created_time, file_size)
        VALUES [(?, ?, ?, ?, ?, ?)]",
        &rows,
    ).await.with_location()?;

    tx.commit().await.with_location()?;

    Ok(())
}

async fn insert_illust_info(conn: &mut SqliteConnection, illust_id: u32) -> Result<i64> {
    let cnum = sqlx::query_scalar(
        "SELECT COALESCE(MIN(cnum), 0) AS cnum FROM ILLUST_INFO WHERE illust_id = ?1",
    )
    .bind(illust_id)
    .fetch_one(&mut *conn)
    .await
    .with_location()?;

    let sql = include_str!("../sql/fetch/insert_illust_info.sql");
    sqlx::query(sql)
        .bind(cnum)
        .bind(illust_id)
        .execute(&mut *conn)
        .await
        .with_location()?;

    Ok(cnum)
}

async fn insert_illust_info_no_fetch(conn: &mut SqliteConnection) -> Result<()> {
    let sql = include_str!("../sql/fetch/insert_illust_info_no_fetch.sql");

    execute_queries(&mut *conn, sql).await.with_location()?;

    Ok(())
}

pub async fn delete_duplicate_files(conn: &mut SqliteConnection) -> anyhow::Result<u32> {
    let rows: Vec<DeleteFileRow> = sqlx::query_as(
        "SELECT file_path, keep_file_path, illust_id, suffix, extension, save_dir
                          FROM tmp_delete_files",
    )
    .fetch_all(&mut *conn)
    .await
    .with_location()?;

    let mut deleted = 0;

    for row in rows {
        // 優先ファイルが無い場合 → DB 更新
        if let Some(ref keep) = row.keep_file_path {
            if !std::path::Path::new(keep).exists() {
                sqlx::query(
                    "UPDATE ILLUST_INFO
                        SET save_dir = ?, extension = ?
                      WHERE illust_id = ? AND suffix = ?",
                )
                .bind(&row.save_dir)
                .bind(&row.extension)
                .bind(row.illust_id)
                .bind(row.suffix)
                .execute(&mut *conn)
                .await
                .with_location()?;
                continue;
            }
        }

        // 削除対象のファイルが存在するなら削除
        let target = std::path::Path::new(&row.file_path);
        if target.exists() {
            trash::delete(target).with_location()?;
            deleted += 1;
        }
    }

    Ok(deleted)
}

pub async fn extract_missing_files(pool: &SqlitePool) -> Result<Vec<FileDetail>> {
    let sql = include_str!("../sql/fetch/extract_missing_files.sql");

    let result = sqlx::query_as::<_, FileDetail>(sql)
        .fetch_all(pool)
        .await?
        .into_iter()
        .map(|mut r| {
            let file_path = format!(
                "{}/{}_p{}.{}",
                r.save_dir, r.illust_id, r.suffix, r.extension
            );
            let path = Path::new(&file_path);
            let (created_time, file_size) = get_file_metadata(path);
            r.created_time = created_time;
            r.file_size = file_size;
            r
        })
        .collect();

    Ok(result)
}

async fn delete_missing_tags(conn: &mut SqliteConnection) -> Result<()> {
    let sql = include_str!("../sql/fetch/delete_missing_tags.sql");

    sqlx::query(sql).execute(&mut *conn).await.with_location()?;

    Ok(())
}

fn get_file_metadata(path: &Path) -> (i64, i64) {
    let metadata = match fs::metadata(path) {
        Ok(m) => m,
        Err(_) => return (0, 0),
    };

    let created_time = metadata
        .created()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|dur| dur.as_secs() as i64)
        .unwrap_or(0);

    let file_size = metadata.len() as i64;

    (created_time, file_size)
}
