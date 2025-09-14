use std::path::Path;
use std::vec::Vec;
use tauri::{command, Emitter, State};
use walkdir::WalkDir;

use crate::models::common::AppState;
use crate::models::fetch::{FileCounts, FileDetail, ProcessStats};

use crate::models::fetch::FolderCount;
use crate::service::common::log_error;
use crate::service::fetch::{
    extract_dir_detail, extract_missing_files, prepare_illust_fetch_work,
    process_fetch_illust_detail,
};

#[command]
pub fn count_files_in_dir(
    state: State<'_, AppState>,
    folders: Vec<String>,
) -> Result<FileCounts, String> {
    let mut conn = state.db.lock().unwrap();

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

    // ファイル詳細に変換
    let file_details: Vec<FileDetail> = folders
        .iter()
        .flat_map(|folder| extract_dir_detail(folder))
        .collect();

    // ワークテーブルに保存
    prepare_illust_fetch_work(&mut conn, &file_details).map_err(|e| log_error(e.to_string()))?;

    let unique_count: u32 = conn
        .query_row(
            "SELECT COUNT(DISTINCT illust_id) FROM ILLUST_FETCH_WORK;",
            [],
            |row| row.get(0),
        )
        .map_err(|e| log_error(e.to_string()))?;

    let interval = std::env::var("INTERVAL_MILL_SEC")
        .ok()
        .and_then(|val| val.parse::<u32>().ok())
        .unwrap_or(1000);

    let estimate_process_time = (interval + 200) * unique_count / 1000;
    let hours = estimate_process_time / 3600;
    let minutes = (estimate_process_time % 3600) / 60;
    let seconds = estimate_process_time % 60;
    let formatted_process_time = format!("{:02}:{:02}:{:02}", hours, minutes, seconds);

    Ok(FileCounts {
        folders: folder_counts,
        total: total_files,
        process_time: formatted_process_time,
    })
}

#[command]
pub fn capture_illust_detail(
    state: State<'_, AppState>,
    window: tauri::Window,
) -> Result<ProcessStats, String> {
    let app_pixiv_api = match &state.app_pixiv_api {
        Some(api) => api.clone(),
        None => return Err("API is unavailable.".to_string()),
    };

    let mut conn = state.db.lock().unwrap();

    // 取得実行
    let result: ProcessStats =
        process_fetch_illust_detail(&mut conn, &app_pixiv_api, window.clone())
            .map_err(|e| log_error(e.to_string()))?;

    // DB変更を通知
    window.emit("update_db", ()).unwrap();

    Ok(result)
}

#[command]
pub fn recapture_illust_detail(
    state: State<'_, AppState>,
    window: tauri::Window,
) -> Result<ProcessStats, String> {
    let app_pixiv_api = match &state.app_pixiv_api {
        Some(api) => api.clone(),
        None => return Err("API is unavailable.".to_string()),
    };

    let mut conn = state.db.lock().unwrap();

    // 失敗ファイルを抽出
    let file_details = extract_missing_files(&conn).map_err(|e| log_error(e.to_string()))?;

    // ワークテーブルに保存
    prepare_illust_fetch_work(&mut conn, &file_details).map_err(|e| log_error(e.to_string()))?;

    // 再取得実行
    let result: ProcessStats =
        process_fetch_illust_detail(&mut conn, &app_pixiv_api, window.clone())
            .map_err(|e| log_error(e.to_string()))?;

    // DB変更を通知
    window.emit("update_db", ()).unwrap();

    Ok(result)
}
