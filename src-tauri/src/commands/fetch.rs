use std::collections::HashSet;
use std::path::Path;
use std::vec::Vec;
use tauri::State;
use walkdir::WalkDir;

use crate::models::fetch::{FileCounts, FileDetail, ProcessStats};
use crate::models::global::AppState;

use crate::models::fetch::FolderCount;
use crate::service::fetch::{
    delete_missing_tags, extract_dir_detail, extract_missing_files, fetch_illust_detail,
};

#[tauri::command]
pub fn count_files_in_dir(folders: Vec<String>) -> FileCounts {
    // フォルダ数
    let folder_counts: Vec<FolderCount> = folders
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

    // ファイル数
    let total_files = folder_counts
        .iter()
        .map(|fc| fc.base_count + fc.sub_dir_count)
        .sum();

    // idを抜き出して処理時間を予測
    let file_details: Vec<FileDetail> = folders
        .iter()
        .flat_map(|folder| extract_dir_detail(folder))
        .collect();
    let unique_ids: HashSet<u32> = file_details.iter().map(|f| f.id).collect();
    let unique_count = unique_ids.len();

    let interval = std::env::var("INTERVAL_MILL_SEC")
        .ok()
        .and_then(|val| val.parse::<u32>().ok())
        .unwrap_or(1000);

    let estimate_process_time = (interval + 200) * unique_count as u32 / 1000;
    let hours = estimate_process_time / 3600;
    let minutes = (estimate_process_time % 3600) / 60;
    let seconds = estimate_process_time % 60;

    let process_time = format!("{:02}:{:02}:{:02}", hours, minutes, seconds);

    FileCounts {
        folders: folder_counts,
        total: total_files,
        process_time,
    }
}

#[tauri::command]
pub fn capture_illust_detail(
    state: State<'_, AppState>,
    window: tauri::Window,
    folders: Vec<String>,
) -> Result<ProcessStats, String> {
    let mut conn = state.db.lock().unwrap();

    // 対象を取得
    let file_details: Vec<FileDetail> = folders
        .iter()
        .flat_map(|folder| extract_dir_detail(folder))
        .collect();

    // 再取得実行
    if let Some(app_pixiv_api) = &state.app_pixiv_api {
        let result = fetch_illust_detail(&mut conn, app_pixiv_api, window, file_details)
            .map_err(|e| e.to_string())?;

        // 削除を実行
        delete_missing_tags(&conn).map_err(|e| e.to_string())?;
        return Ok(result);
    } else {
        return Err("API is unavailable.".to_string());
    }
}

#[tauri::command]
pub fn recapture_illust_detail(
    state: State<'_, AppState>,
    window: tauri::Window,
) -> Result<ProcessStats, String> {
    let mut conn = state.db.lock().unwrap();

    // 失敗ファイルを抽出
    let file_details = extract_missing_files(&conn).map_err(|e| e.to_string())?;

    // 再取得実行
    if let Some(app_pixiv_api) = &state.app_pixiv_api {
        let result = fetch_illust_detail(&mut conn, app_pixiv_api, window, file_details)
            .map_err(|e| e.to_string())?;

        // 取得できたレコードのMissingタグ削除を実行
        delete_missing_tags(&conn).map_err(|e| e.to_string())?;
        Ok(result)
    } else {
        return Err("Pixiv API is unavailable.".to_string());
    }
}
