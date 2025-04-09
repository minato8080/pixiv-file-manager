use rusqlite::{params, Result};
use std::fs;
use std::path::Path;
use std::vec::Vec;
use std::time::Instant;
use tauri::{Emitter, State};

use crate::models::fetch::{DirDetail, FileDetail, IdInfo, ProcessStats};
use crate::models::global::AppState;
use crate::models::pixiv::{PixivApi, RealPixivApi};


#[tauri::command]
pub fn process_capture_tags_info(
    state: State<AppState>,
    window: tauri::Window,
    folders: Vec<String>,
) -> Result<ProcessStats, String> {
    let mut all_image_ids = Vec::new();
    for folder in folders {
        let image_detail = extract_dir_detail(&folder);
        all_image_ids.extend(image_detail.id_info);
    }
    println!("Image IDs: {:?}", all_image_ids);
    // 画像IDを処理し、結果を返す
    match process_image_ids(state, window, all_image_ids) {
        Ok(stats) => Ok(stats),       // 成功時は ProcessStats を返す
        Err(e) => Err(e.to_string()), // 失敗時はエラーメッセージを文字列として返す
    }
}

fn extract_dir_detail<P: AsRef<Path>>(folder: P) -> DirDetail {
    let mut ids = Vec::new();
    let mut details = Vec::new();

    fn visit_dirs(dir: &Path, ids: &mut Vec<IdInfo>, details: &mut Vec<FileDetail>) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    visit_dirs(&path, ids, details);
                } else if let Some(filename) = entry.file_name().to_str() {
                    if filename.ends_with(".jpg") || filename.ends_with(".png") {
                        if let Some(id) = filename.split('_').next() {
                            let suffix = filename.to_string();
                            let extension = filename.split('.').last().unwrap_or("").to_string();
                            let save_path = path.to_str().unwrap_or("").to_string();
                            ids.push(IdInfo {
                                id: id.to_string(),
                                save_dir: save_path.clone(),
                                save_path: filename.to_string(),
                            });
                            details.push(FileDetail {
                                id: id.to_string(),
                                suffix,
                                save_path,
                                extension,
                            });
                        }
                    }
                }
            }
        }
    }

    visit_dirs(folder.as_ref(), &mut ids, &mut details);
    DirDetail {
        id_info: ids,
        file_details: details,
    }
}

fn process_image_ids(
    state: State<AppState>,
    window: tauri::Window,
    vec_id_info: Vec<IdInfo>,
) -> Result<ProcessStats, Box<dyn std::error::Error>> {
    let start = Instant::now();
    let conn = state.db.lock().unwrap();

    let mut success_count = 0;
    let mut fail_count = 0;
    let total = vec_id_info.len();

    for id_info in vec_id_info {
        if let Ok(tags) = RealPixivApi::fetch_tags(&state, id_info.id.parse::<usize>().unwrap_or_default())
        {
            for tag in tags {
                conn.execute(
                    "INSERT OR REPLACE INTO TAG_INFO (id, tag) VALUES (?1, ?2)",
                    params![id_info.id, tag],
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
        processing_time_ms: duration.as_millis(), // 処理時間を計測していないため、仮に0を設定
        failed_file_paths: vec![], // 失敗したファイルパスを追跡していないため、空のベクターを設定
    })
}

#[tauri::command]
pub fn process_capture_illust_detail(
    state: State<AppState>,
    window: tauri::Window,
    folders: Vec<String>,
) -> Result<ProcessStats, String> {
    let mut image_details: Vec<DirDetail> = Vec::new();
    for folder in folders {
        let image_ids = extract_dir_detail(&folder);
        image_details.push(image_ids);
    }
    println!("Image IDs: {:?}", image_details);
    // 画像IDを処理し、結果を返す
    match process_image_ids_detail(state, window, image_details) {
        Ok(stats) => Ok(stats),       // 成功時は ProcessStats を返す
        Err(e) => Err(e.to_string()), // 失敗時はエラーメッセージを文字列として返す
    }
}

fn process_image_ids_detail(
    state: State<AppState>,
    window: tauri::Window,
    dir_details: Vec<DirDetail>,
) -> Result<ProcessStats, Box<dyn std::error::Error>> {
    let start = Instant::now();
    let conn = state.db.lock().unwrap();

    let mut success_count = 0;
    let mut fail_count = 0;
    let total: usize = dir_details.iter().map(|d| d.id_info.len()).sum();
    let mut failed_file_paths = Vec::new();

    for dir_detail in &dir_details {
        for id_info in &dir_detail.id_info {
            if let Ok(resp) =
                RealPixivApi::fetch_detail(&state, id_info.id.parse::<usize>().unwrap_or_default())
            {
                // ID_DETAILにデータをINSERT
                conn.execute(
                "INSERT OR REPLACE INTO ID_DETAIL (id, suffix, author_name, author_account, character, save_dir) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![resp.id, None::<i64>, resp.user.name, resp.user.account, None::<String>, id_info.save_dir],
            )?;

                // TAG_INFOにタグをINSERT
                for tag in resp.tags {
                    conn.execute(
                        "INSERT OR REPLACE INTO TAG_INFO (id, tag) VALUES (?1, ?2)",
                        params![id_info.id, tag.name],
                    )?;
                }

                success_count += 1;
            } else {
                fail_count += 1;
                failed_file_paths.push(id_info.save_path.clone());
            }

            // emit でフロントに通知（イベント名: tag-progress）
            if let Err(e) = window.emit(
                "tag-progress",
                serde_json::json!({
                    "type": "progress",
                    "success": success_count,
                    "fail": fail_count,
                    "current": success_count + fail_count,
                    "total": total,
                }),
            ) {
                eprintln!("Failed to emit event: {}", e);
            }
            std::thread::sleep(std::time::Duration::from_secs(1));
        }
    }
    let duration = start.elapsed();

    Ok(ProcessStats {
        total_files: total,
        failed_files: fail_count,
        processing_time_ms: duration.as_millis(),
        failed_file_paths,
    })
}
