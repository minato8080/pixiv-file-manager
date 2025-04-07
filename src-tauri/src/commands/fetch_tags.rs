use rusqlite::{params, Connection, Result};
use serde::Serialize;
use std::{collections::HashSet, time::Instant};
use std::path::Path;
use std::vec::Vec;
use std::fs;
use tauri::Emitter;

use crate::models::pixiv::{PixivApi, RealPixivApi};
use crate::constants::DB_PATH;

#[tauri::command]
pub fn process_capture_tags_info(
    window: tauri::Window,
    folders: Vec<String>,
) -> Result<ProcessStats, String> {
    let mut all_image_ids = Vec::new();
    for folder in folders {
        let image_ids = extract_image_ids(&folder);
        all_image_ids.extend(image_ids);
    }
    println!("Image IDs: {:?}", all_image_ids);
    // 画像IDを処理し、結果を返す
    match process_image_ids(window, &RealPixivApi, &all_image_ids) {
        Ok(stats) => Ok(stats),       // 成功時は ProcessStats を返す
        Err(e) => Err(e.to_string()), // 失敗時はエラーメッセージを文字列として返す
    }
}

fn extract_image_ids<P: AsRef<Path>>(folder: P) -> Vec<String> {
    let mut image_ids = HashSet::new();
    if let Ok(entries) = fs::read_dir(folder) {
        for entry in entries.flatten() {
            if let Some(filename) = entry.file_name().to_str() {
                if filename.ends_with(".jpg") || filename.ends_with(".png") {
                    if let Some(id) = filename.split('_').next() {
                        image_ids.insert(id.to_string());
                    }
                }
            }
        }
    }
    image_ids.into_iter().collect()
}

#[derive(Serialize)]
pub struct ProcessStats {
    total_files: usize,
    failed_files: usize,
    processing_time_ms: u128,
    failed_file_paths: Vec<String>,
}

fn process_image_ids(
    window: tauri::Window,
    api: &impl PixivApi,
    image_ids: &[String],
) -> Result<ProcessStats, Box<dyn std::error::Error>> {
    let start = Instant::now();
    // let current_dir = env::current_dir()?;
    // println!("Current directory: {:?}", current_dir);
    let conn = Connection::open(DB_PATH.clone())?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS TAG_INFO (id INTEGER PRIMARY KEY, tag TEXT)",
        [],
    )?;

    let mut success_count = 0;
    let mut fail_count = 0;
    let total = image_ids.len();

    for id in image_ids {
        if let Ok(tags) = api.fetch_tags(id.parse::<usize>().unwrap_or_default()) {
            for tag in tags {
                conn.execute(
                    "INSERT OR REPLACE INTO TAG_INFO (id, tag) VALUES (?1, ?2)",
                    params![id, tag],
                )?;
            }
            success_count += 1;
        } else {
            fail_count += 1;
        }

        // emit でフロントに通知（イベント名: tag-progress）
        if let Err(e) = window.emit(
            "tag-progress",
            serde_json::json!({
                "type": "progress",
                "success": success_count,
                "fail": fail_count,
                "current":success_count + fail_count,
                "total": total,
            }),
        ) {
            eprintln!("Failed to emit event: {}", e);
        }
        std::thread::sleep(std::time::Duration::from_secs(1));
    }
    let duration = start.elapsed();

    Ok(ProcessStats {
        total_files: total,
        failed_files: fail_count,
        processing_time_ms: duration.as_millis(),     // 処理時間を計測していないため、仮に0を設定
        failed_file_paths: vec![], // 失敗したファイルパスを追跡していないため、空のベクターを設定
    })
}
