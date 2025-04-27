use rusqlite::{params, OptionalExtension, Result};
use std::fs;
use std::path::Path;
use std::time::Instant;
use std::vec::Vec;
use tauri::{Emitter, State};
use walkdir::WalkDir;

use crate::models::fetch::{DirDetail, FileCounts, FileDetail, IdInfo, ProcessStats, TagProgress};
use crate::models::global::AppState;
use crate::models::pixiv::{PixivApi, RealPixivApi};

use crate::models::fetch::FolderCount;

// Start of Selection
#[tauri::command]
pub fn count_files_in_dir(_state: State<AppState>, dir_paths: Vec<String>) -> FileCounts {
    let folder_counts: Vec<FolderCount> = dir_paths
        .iter()
        .map(|dir_path| {
            let path = Path::new(dir_path);
            let base_count = WalkDir::new(path)
                .max_depth(1)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().is_file())
                .count() as i32;

            let sub_dir_count = WalkDir::new(path)
                .min_depth(2)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().is_file())
                .count() as i32;

            FolderCount {
                base_count,
                sub_dir_count,
            }
        })
        .collect();

    let total_files = folder_counts
        .iter()
        .map(|fc| fc.base_count + fc.sub_dir_count)
        .sum();

    let interval = std::env::var("INTERVAL_MILL_SEC")
        .ok()
        .and_then(|val| val.parse::<i32>().ok())
        .unwrap_or(1000);

    let total_processing_time_secs = (interval + 200) * total_files / 1000;
    let hours = total_processing_time_secs / 3600;
    let minutes = (total_processing_time_secs % 3600) / 60;
    let seconds = total_processing_time_secs % 60;

    let processing_time = format!("{:02}:{:02}:{:02}", hours, minutes, seconds);

    FileCounts {
        folders: folder_counts,
        total: total_files,
        processing_time,
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
                            let update_time = {
                                let metadata = fs::metadata(&path).unwrap();
                                let modified_time = metadata.modified().unwrap();
                                let duration_since_epoch =
                                    modified_time.duration_since(std::time::UNIX_EPOCH).unwrap();
                                duration_since_epoch.as_secs() as i64
                            };
                            details.push(FileDetail {
                                id: id.parse::<u32>().unwrap_or_default(),
                                suffix: suffix.parse::<u8>().unwrap_or_default(),
                                save_path,
                                extension,
                                save_dir,
                                update_time,
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
            let mut target_file_detail = None;
            for file_detail in &dir_detail.file_details {
                if file_detail.id == id_info.id {
                    target_file_detail = Some(file_detail);
                    break;
                }
            }

            if let Some(file_detail) = target_file_detail {
                let mut stmt = conn.prepare("SELECT update_time FROM ILLUST_INFO WHERE illust_id = ?1 AND suffix = ?2 AND extension = ?3")?;
                let existing_time: Option<i64> = stmt
                    .query_row(
                        params![id_info.id, file_detail.suffix, file_detail.extension],
                        |row| row.get(0),
                    )
                    .optional()?; // ← rusqlite 0.27以降のAPIで Option を返せる

                if let Some(existing_time) = existing_time {
                    if existing_time == file_detail.update_time {
                        // 同じ更新時刻ならスキップ
                        println!("Skip: No update needed for {}", id_info.id);
                        let progress = TagProgress {
                            success: success_count,
                            fail: fail_count,
                            current: success_count + fail_count,
                            total,
                        };
                        if let Err(e) = window.emit("tag_progress", serde_json::json!(progress)) {
                            eprintln!("Failed to emit event: {}", e);
                        }
                        continue;
                    }
                }

                if let Ok(resp) = RealPixivApi::fetch_detail(&state, id_info.id) {
                    println!("{:?}", target_file_detail.unwrap());

                    conn.execute(
                        "INSERT INTO ILLUST_INFO (illust_id, suffix, extension, author_id, character, save_dir, control_num, update_time) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                        params![
                            resp.illust.id(),
                            file_detail.suffix,
                            file_detail.extension,
                            resp.illust.user().id(),
                            None::<String>,
                            file_detail.save_dir,
                            0,
                            file_detail.update_time,
                        ],
                    )?;

                    // TAG_INFOにタグをINSERT
                    for tag in resp.illust.tags() {
                        conn.execute(
                            "INSERT OR REPLACE INTO TAG_INFO (illust_id, control_num, tag) VALUES (?1, ?2, ?3)",
                            params![id_info.id, 0, tag.name()],
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

                let progress = TagProgress {
                    success: success_count,
                    fail: fail_count,
                    current: success_count + fail_count,
                    total,
                };
                if let Err(e) = window.emit("tag_progress", serde_json::json!(progress)) {
                    eprintln!("Failed to emit event: {}", e);
                }
                let interval = std::env::var("INTERVAL_MILL_SEC")
                    .ok()
                    .and_then(|val| val.parse::<u64>().ok())
                    .unwrap_or(1000);

                std::thread::sleep(std::time::Duration::from_millis(interval));
            }
        }
    }
    let duration = start.elapsed();
    window.emit("update_db", ()).unwrap();

    Ok(ProcessStats {
        total_files: total,
        failed_files: fail_count,
        processing_time_ms: duration.as_millis(),
        failed_file_paths,
    })
}
