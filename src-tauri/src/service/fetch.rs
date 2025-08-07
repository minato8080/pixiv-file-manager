use pixieve_rs::pixiv::client::PixivClient;
use regex::Regex;
use rusqlite::{params, Connection, Result};
use std::fmt::Write;
use std::fs;
use std::path::Path;
use std::result::Result::Ok;
use std::time::Instant;
use std::vec::Vec;
use tauri::Emitter;
use trash::delete;

use crate::api::pixiv::fetch_detail;
use crate::models::fetch::{FileDetail, ProcessStats, TagProgress};
use crate::service::format_duration;

pub fn extract_dir_detail<P: AsRef<Path>>(folder: P) -> Vec<FileDetail> {
    let mut details = Vec::new();

    fn visit_dirs(dir: &Path, details: &mut Vec<FileDetail>) {
        let re = Regex::new(r"^(\d+)_p(\d+)\.(jpg|png)$").unwrap();
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    visit_dirs(&path, details);
                } else if let Some(file_name) = entry.file_name().to_str() {
                    if let Some(caps) = re.captures(file_name) {
                        let filename = caps.get(0).unwrap().as_str(); // 全体のマッチ
                        if let Some(id) = filename.split('_').next() {
                            let suffix = filename
                                .split("_p")
                                .nth(1)
                                .and_then(|s| s.split('.').next())
                                .unwrap_or("")
                                .to_string();
                            let extension = filename.split('.').last().unwrap_or("").to_string();
                            let save_dir = path
                                .parent()
                                .unwrap_or(Path::new(""))
                                .to_str()
                                .unwrap_or("")
                                .to_string();
                            let created_time = {
                                let metadata = fs::metadata(&path).unwrap();
                                let created_time = metadata.created().unwrap();
                                let duration_since_epoch =
                                    created_time.duration_since(std::time::UNIX_EPOCH).unwrap();
                                duration_since_epoch.as_secs() as i64
                            };
                            let file_size = {
                                let metadata = fs::metadata(&path).unwrap();
                                metadata.len() as i64
                            };
                            details.push(FileDetail {
                                id: id.parse::<u32>().unwrap_or_default(),
                                suffix: suffix.parse::<u8>().unwrap_or_default(),
                                extension,
                                save_dir,
                                created_time,
                                file_size,
                            });
                        }
                    }
                }
            }
        }
    }

    visit_dirs(folder.as_ref(), &mut details);
    details
}

fn remove_invalid_chars(path: &str) -> String {
    // Windowsでファイル名に使えない文字のリスト
    let invalid_chars = ['\\', '/', ':', '*', '?', '"', '<', '>', '|'];

    path.chars()
        .filter(|c| !invalid_chars.contains(c))
        .collect()
}

pub fn fetch_illust_detail(
    conn: &mut Connection,
    app_pixiv_api: &PixivClient,
    window: tauri::Window,
) -> Result<ProcessStats, anyhow::Error> {
    let start = Instant::now();

    // 結果用の集計情報
    let mut success_count = 0;
    let mut fail_count = 0;
    let mut failed_file_paths = Vec::new();

    // ワークテーブルを準備
    let sql = include_str!("../sql/fetch/create_fetch_work.sql");
    conn.execute_batch(sql)?;

    // フェッチなしでインサートするファイルを処理
    insert_illust_info_no_fetch(conn)?;

    // フェッチ回数
    let total: u64 = conn.query_row("SELECT COUNT(*) FROM fetch_ids;", [], |row| row.get(0))?;

    let interval = std::env::var("INTERVAL_MILL_SEC")
        .ok()
        .and_then(|val| val.parse::<u64>().ok())
        .unwrap_or(1000);
    let total_duration_ms = total * interval;

    // フェッチ対象を取得
    let fetch_ids: Vec<u32> = conn
        .prepare("SELECT illust_id FROM fetch_ids;")?
        .query_map([], |row| row.get(0))?
        .collect::<Result<_, _>>()?;

    for fetch_id in fetch_ids {
        let tx = conn.transaction()?;
        // イラスト情報を登録
        let control_num = insert_illust_info(&tx, fetch_id)?;
        // フェッチ処理
        match fetch_detail(app_pixiv_api, fetch_id) {
            Ok(resp) => {
                // 詳細情報を登録
                tx.execute(
                    "INSERT OR REPLACE INTO ILLUST_DETAIL (illust_id, author_id, character, control_num) VALUES (?1, ?2, ?3, ?4)",
                    params![
                    resp.illust.id(),
                    resp.illust.user().id(),
                        None::<String>,
                        control_num,
                    ],
                )?;

                // タグ情報を登録
                for tag in resp.illust.tags() {
                    tx.execute("INSERT OR REPLACE INTO TAG_INFO (illust_id, control_num, tag) VALUES (?1, ?2, ?3)",
                    params![fetch_id, control_num, remove_invalid_chars(tag.name())],
                )?;
                }

                // 作者情報を登録
                tx.execute("INSERT OR REPLACE INTO AUTHOR_INFO (author_id, author_name, author_account) VALUES (?1, ?2, ?3)",
                    params![
                        resp.illust.user().id(),
                        resp.illust.user().name(),
                        resp.illust.user().account()
                    ],
                )?;
                success_count += 1;
            }
            Err(err) => {
                fail_count += 1;
                // 失敗時はデフォルト値で詳細情報を登録
                tx.execute(
                    "INSERT OR IGNORE INTO ILLUST_DETAIL (illust_id, author_id, character, control_num) VALUES (?1, 0, NULL, ?2)",
                    params![fetch_id, control_num],
                )?;

                // 失敗時のタグ情報
                tx.execute(
                    "INSERT OR IGNORE INTO TAG_INFO (illust_id, control_num, tag) VALUES (?1, ?2, 'Missing')",
                    params![fetch_id, control_num],
                )?;

                // 失敗したIDを結果に追加
                failed_file_paths.push(format!("{}:{}", fetch_id, err))
            }
        } // 一件ずつコミット
        tx.commit()?;

        let elapsed = start.elapsed().as_millis() as u64;
        let remaining = total_duration_ms.saturating_sub(elapsed);

        // 処理状況を通知
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

    // 重複ファイルを検知して削除
    delete_duplicate_files(&conn)?;

    // ワークテーブルをクリア
    conn.execute("DELETE FROM ILLUST_FETCH_WORK", ())?;

    // 処理終了
    let duration = start.elapsed();
    window.emit("update_db", ()).unwrap();

    // 処理結果を通知
    Ok(ProcessStats {
        total_files: success_count + fail_count,
        failed_files: fail_count,
        process_time: format_duration(duration.as_millis() as u64),
        failed_file_paths,
    })
}

pub fn prepare_illust_fetch_work(
    conn: &mut Connection,
    file_details: &[FileDetail],
) -> Result<(), anyhow::Error> {
    let tx = conn.transaction()?;

    tx.execute("DELETE FROM ILLUST_FETCH_WORK;", [])?;

    let mut sql = String::new();
    sql.push_str("INSERT INTO ILLUST_FETCH_WORK (illust_id, suffix, extension, save_dir, created_time, file_size) VALUES ");

    for (i, file) in file_details.iter().enumerate() {
        if i != 0 {
            sql.push(',');
        }
        write!(
            sql,
            "({}, {}, '{}', '{}', {}, {})",
            file.id,
            file.suffix,
            file.extension.replace("'", "''"),
            file.save_dir.replace("'", "''"),
            file.created_time,
            file.file_size
        )?;
    }

    tx.execute_batch(&sql)?;
    tx.commit()?;
    Ok(())
}

fn insert_illust_info(conn: &Connection, illust_id: u32) -> Result<i64, anyhow::Error> {
    // 既存のILLUST_INFOからcontrol_numを取得
    let control_num = match conn.prepare(
        "SELECT control_num FROM ILLUST_INFO WHERE illust_id = ?1 ORDER BY control_num ASC LIMIT 1;"
    )?.query_row(params![illust_id], |row| row.get::<_, i64>(0)) {
        Ok(num) => num,
        Err(rusqlite::Error::QueryReturnedNoRows) => 0,
        Err(e) => return Err(e.into()), // 他のエラーはそのまま返す
    };

    conn.prepare(
        "INSERT OR IGNORE INTO ILLUST_INFO (
            illust_id, suffix, extension, save_dir, control_num
        )
        SELECT illust_id, suffix, extension, save_dir, ?1
        FROM insert_files
        WHERE illust_id = ?2;",
    )?
    .execute(params![control_num, illust_id])?;

    Ok(control_num)
}

fn insert_illust_info_no_fetch(conn: &Connection) -> Result<(), anyhow::Error> {
    let sql = include_str!("../sql/fetch/insert_illust_info_no_fetch.sql");
    conn.execute_batch(sql)?;

    Ok(())
}

fn delete_duplicate_files(conn: &Connection) -> Result<(), anyhow::Error> {
    let mut stmt = conn.prepare("SELECT file_path FROM delete_files;")?;
    let delete_iter = stmt.query_map([], |row| {
        let file_path: String = row.get(0)?;
        Ok(file_path)
    })?;

    for entry in delete_iter {
        let file_path = entry?;
        // ファイルを削除（ゴミ箱に移動
        let target = std::path::Path::new(&file_path);
        delete(target)?;
    }

    Ok(())
}

pub fn extract_missing_files(conn: &Connection) -> Result<Vec<FileDetail>> {
    // author_id = 0 のイラスト情報を取得
    let mut stmt =
        conn.prepare("SELECT illust_id, control_num FROM ILLUST_DETAIL WHERE author_id = 0")?;

    let failed_records = stmt
        .query_map([], |row| Ok((row.get::<_, i32>(0)?, row.get::<_, i32>(1)?)))?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();

    if failed_records.is_empty() {
        return Ok(vec![]);
    }

    // ILLUST_INFO をもとに FileDetail を復元
    let mut file_details: Vec<FileDetail> = vec![];

    let mut info_stmt = conn.prepare(
        "SELECT suffix, extension, save_dir 
         FROM ILLUST_INFO 
         WHERE illust_id = ?",
    )?;

    for (illust_id, _control_num) in &failed_records {
        let rows = info_stmt.query_map([illust_id], |row| {
            Ok(FileDetail {
                id: *illust_id as u32,
                suffix: row.get::<_, i64>(0)? as u8,
                extension: row.get::<_, String>(1)?,
                save_dir: row.get::<_, String>(2)?,
                created_time: 0,
                file_size: 0,
            })
        })?;

        for detail in rows.filter_map(Result::ok) {
            file_details.push(detail);
        }
    }

    Ok(file_details)
}

pub fn delete_missing_tags(conn: &Connection) -> Result<()> {
    // 対象の TAG_INFO を削除
    conn.execute(
        "DELETE FROM TAG_INFO
            WHERE tag = 'Missing'
            AND EXISTS (
                SELECT 1
                FROM ILLUST_DETAIL
                WHERE ILLUST_DETAIL.author_id <> 0
            );",
        [],
    )?;

    Ok(())
}
