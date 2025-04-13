use rusqlite::{params, Result};
use std::fs;
use std::path::Path;
use std::time::Instant;
use std::vec::Vec;
use tauri::{Emitter, State};

use crate::models::fetch::{DirDetail, FileDetail, IdInfo, ProcessStats};
use crate::models::global::AppState;
use crate::models::pixiv::{PixivApi, RealPixivApi};

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
                            let suffix = filename
                                .split("_p")
                                .nth(1)
                                .and_then(|s| s.split('.').next())
                                .unwrap_or("")
                                .to_string();
                            println!("{}", suffix);
                            let extension = filename.split('.').last().unwrap_or("").to_string();
                            let save_path = path.to_str().unwrap_or("").to_string();
                            let save_dir = path
                                .parent()
                                .unwrap_or(Path::new(""))
                                .to_str()
                                .unwrap_or("")
                                .to_string();
                            ids.push(IdInfo {
                                id: id.parse::<u32>().unwrap_or_default(),
                                save_path: save_path.clone(),
                            });
                            details.push(FileDetail {
                                id: id.parse::<u32>().unwrap_or_default(),
                                suffix: suffix.parse::<u8>().unwrap_or_default(),
                                save_path,
                                extension,
                                save_dir,
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

#[tauri::command]
pub fn process_capture_illust_detail(
    state: State<'_, AppState>,
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
                RealPixivApi::fetch_detail(&state, id_info.id)
            {
                let mut target_file_detail = None;
                // ID_DETAILにデータをINSERT
                for file_detail in &dir_detail.file_details {
                    if file_detail.id == id_info.id {
                        target_file_detail = Some(file_detail);
                        break;
                    }
                }
                println!("{:?}", target_file_detail.unwrap());
                if let Some(file_detail) = target_file_detail {
                    conn.execute(
                        "INSERT OR REPLACE INTO ID_DETAIL (id, suffix, extension, author_id, character, save_dir) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                        params![
                            resp.illust.id(),
                            file_detail.suffix,
                            file_detail.extension,
                            resp.illust.user().id(),
                            None::<String>,
                            file_detail.save_dir
                        ],
                    )?;
                }

                // TAG_INFOにタグをINSERT
                for tag in resp.illust.tags() {
                    conn.execute(
                        "INSERT OR REPLACE INTO TAG_INFO (id, tag) VALUES (?1, ?2)",
                        params![id_info.id, tag.name()],
                    )?;
                }

                // AUTHOR_INFOテーブルに著者情報をINSERT
                conn.execute(
                    "INSERT OR REPLACE INTO AUTHOR_INFO (author_id, author_name, author_account) VALUES (?1, ?2, ?3)",
                    params![
                        resp.illust.user().id(),
                        resp.illust.user().name(),
                        resp.illust.user().account()
                    ],
                )?;

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
