use std::path::Path;
use std::vec::Vec;
use tauri::State;
use walkdir::WalkDir;

use crate::models::fetch::{
    FileCounts, FileDetail, ProcessStats,
};
use crate::models::global::AppState;

use crate::models::fetch::FolderCount;
use crate::service::fetch::{extract_dir_detail, process_image_ids_detail};

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

#[tauri::command]
pub fn capture_illust_detail(
    state: State<'_, AppState>,
    window: tauri::Window,
    folders: Vec<String>,
) -> Result<ProcessStats, String> {
    let file_details: Vec<FileDetail> = folders
        .iter()
        .flat_map(|folder| extract_dir_detail(folder))
        .collect();
    // 画像IDを処理し、結果を返す
    match process_image_ids_detail(state, window, file_details) {
        Ok(stats) => Ok(stats),       // 成功時は ProcessStats を返す
        Err(e) => Err(e.to_string()), // 失敗時はエラーメッセージを文字列として返す
    }
}
