use anyhow::Result;
use pixieve_rs::pixiv::client::PixivClient;
use pixieve_rs::pixiv::request_builder::PixivRequestBuilder;
use pixieve_rs::pixiv::result::illustration_proxy::IllustrationProxy;
use rayon::prelude::*;
use sqlx::{Acquire, Error, SqliteConnection, SqlitePool};
use std::fmt::Write;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Instant, UNIX_EPOCH};
use std::vec::Vec;
use tauri::Emitter;
use trash::delete;

use crate::execute_queries;
use crate::models::fetch::{FileDetail, ProcessStats, TagProgress};
use crate::service::common::{format_duration, parse_path_info, remove_invalid_chars, update_cnum};

async fn fetch_illustration_detail(
    pixiv_client: &PixivClient,
    illust_id: u32,
) -> Result<IllustrationProxy> {
    let pixiv_client = pixiv_client.clone();

    let illustration = tauri::async_runtime::spawn_blocking(move || {
        let request = PixivRequestBuilder::request_illustration(illust_id.try_into().unwrap());
        let response = pixiv_client.execute_with_auth(request)?;
        let illustration = response.json::<IllustrationProxy>()?;
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
                        eprintln!("ファイル情報の取得に失敗: {} (path: {:?})", e, path);
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
            eprintln!("タスクの実行に失敗: {:?}", e);
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

    let mut tx = pool.begin().await?;
    let conn = tx.acquire().await?;

    // ワークテーブルを準備
    let sql = include_str!("../sql/fetch/prepare_fetch_work.sql");
    execute_queries(&mut *conn, sql).await?;

    // フェッチなしでインサートするファイルを処理
    insert_illust_info_no_fetch(&mut *tx).await?;

    tx.commit().await?;

    // メイン処理
    let mut stats = core_fetch_illust_detail(pool, start, pixiv_client, window).await?;

    let mut tx = pool.begin().await?;

    // 重複ファイルを検知して削除
    let cnt = delete_duplicate_files(&mut *tx).await?;
    stats.duplicated_files = cnt;

    // 詳細を取得できたらMissingタグを削除
    delete_missing_tags(&mut *tx).await?;

    // 管理番号を更新
    update_cnum(&mut *tx).await?;

    tx.commit().await?;

    // 全体処理終了
    let duration = start.elapsed();
    stats.process_time = format_duration(duration.as_millis() as u64);

    // 処理結果を通知
    Ok(stats)
}

async fn core_fetch_illust_detail(
    pool: &SqlitePool,
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
        .fetch_one(pool)
        .await?;

    let interval = std::env::var("INTERVAL_MILL_SEC")
        .ok()
        .and_then(|val| val.parse::<u64>().ok())
        .unwrap_or(1000);
    let total_duration_ms = total * interval;

    // フェッチ対象を取得
    let tmp_fetch_ids: Vec<u32> = sqlx::query_scalar("SELECT illust_id FROM tmp_fetch_ids;")
        .fetch_all(pool)
        .await?;

    for fetch_id in tmp_fetch_ids {
        let mut tx = pool.begin().await?;
        // イラスト情報を登録
        let cnum = insert_illust_info(&mut *tx, fetch_id).await?;
        // フェッチ処理
        match fetch_illustration_detail(pixiv_client, fetch_id).await {
            Ok(resp) => {
                // 詳細情報を登録
                sqlx::query("INSERT OR REPLACE INTO ILLUST_DETAIL (illust_id, author_id, character, cnum) VALUES (?1, ?2, ?3, ?4)")
                .bind(resp.illust.id())
                .bind(resp.illust.user().id())
                .bind(None::<String>)
                .bind(cnum)
                .execute(&mut *tx).await?;

                // タグ情報を登録
                for tag in resp.illust.tags() {
                    sqlx::query("INSERT OR REPLACE INTO TAG_INFO (illust_id, cnum, tag) VALUES (?1, ?2, ?3)")
                    .bind(fetch_id)
                    .bind(cnum)
                    .bind(remove_invalid_chars(tag.name()))
                    .execute(&mut *tx).await?;
                }

                // 作者情報を登録
                sqlx::query("INSERT OR REPLACE INTO AUTHOR_INFO (author_id, author_name, author_account) VALUES (?1, ?2, ?3)",)
                        .bind(resp.illust.user().id())
                        .bind(resp.illust.user().name())
                        .bind(resp.illust.user().account())
                .execute(&mut *tx).await?;
                success_count += 1;
            }
            Err(err) => {
                fail_count += 1;
                // 失敗時はデフォルト値で詳細情報を登録
                sqlx::query(
                    "INSERT OR IGNORE INTO ILLUST_DETAIL (illust_id, author_id, character, cnum) VALUES (?1, 0, NULL, ?2)",
                )
                .bind(fetch_id).bind(cnum).execute(&mut *tx).await?;

                // 失敗時のタグ情報
                sqlx::query(
                    "INSERT OR IGNORE INTO TAG_INFO (illust_id, cnum, tag) VALUES (?1, ?2, 'Missing')",
                )
                .bind(fetch_id).bind(cnum).execute(&mut *tx).await?;

                // 失敗したIDを結果に追加
                failed_file_paths.push(format!("{}:{}", fetch_id, err))
            }
        }
        // 一件ずつコミット
        tx.commit().await?;

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
        window.emit("tag_progress", serde_json::json!(progress))?;

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
    let mut tx = pool.begin().await?;
    let conn = tx.acquire().await?;

    sqlx::query("DELETE FROM ILLUST_FETCH_WORK;")
        .execute(&mut *conn)
        .await?;

    let mut sql = String::new();
    sql.push_str("INSERT INTO ILLUST_FETCH_WORK (illust_id, suffix, extension, save_dir, created_time, file_size) VALUES ");

    for (i, file) in file_details.iter().enumerate() {
        if i != 0 {
            sql.push(',');
        }
        write!(
            sql,
            "({}, {}, '{}', '{}', {}, {})",
            file.illust_id,
            file.suffix,
            file.extension.replace("'", "''"),
            file.save_dir.replace("'", "''"),
            file.created_time,
            file.file_size
        )?;
    }

    execute_queries(&mut *conn, &sql).await?;
    tx.commit().await?;
    Ok(())
}

async fn insert_illust_info(conn: &mut SqliteConnection, illust_id: u32) -> Result<i64> {
    // 既存のILLUST_INFOからcnumを取得
    let sql = "SELECT cnum FROM ILLUST_INFO WHERE illust_id = ?1 ORDER BY cnum ASC LIMIT 1;";
    let cnum = match sqlx::query_scalar(sql)
        .bind(illust_id)
        .fetch_one(&mut *conn)
        .await
    {
        Ok(num) => num,
        Err(Error::RowNotFound) => 0,
        Err(e) => return Err(e.into()),
    };

    let sql = "INSERT OR IGNORE INTO ILLUST_INFO (
            illust_id, suffix, extension, save_dir, cnum
        )
        SELECT illust_id, suffix, extension, save_dir, ?1
        FROM tmp_insert_files
        WHERE illust_id = ?2;";

    sqlx::query(sql)
        .bind(cnum)
        .bind(illust_id)
        .execute(&mut *conn)
        .await?;

    Ok(cnum)
}

async fn insert_illust_info_no_fetch(conn: &mut SqliteConnection) -> Result<()> {
    let sql = include_str!("../sql/fetch/insert_illust_info_no_fetch.sql");

    execute_queries(&mut *conn, sql).await?;

    Ok(())
}

async fn delete_duplicate_files(conn: &mut SqliteConnection) -> Result<u32> {
    let sql = "SELECT file_path FROM tmp_delete_files;";

    let file_paths: Vec<String> = sqlx::query_scalar(sql).fetch_all(&mut *conn).await?;

    for file_path in file_paths {
        // ファイルを削除（ゴミ箱に移動
        let target = std::path::Path::new(&file_path);
        delete(target)?;
    }

    let cnt: u32 = sqlx::query_scalar("SELECT COUNT(*) FROM tmp_delete_files;")
        .fetch_one(&mut *conn)
        .await?;

    Ok(cnt)
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
    // 対象の TAG_INFO を削除
    sqlx::query(
        "DELETE FROM TAG_INFO
            WHERE tag = 'Missing'
            AND EXISTS (
                SELECT 1
                FROM ILLUST_DETAIL
                WHERE ILLUST_DETAIL.author_id <> 0
            );",
    )
    .execute(&mut *conn)
    .await?;

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
