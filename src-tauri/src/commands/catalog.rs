use rusqlite::params;
use tauri::State;

use crate::models::global::AppState;

#[tauri::command]
pub fn move_files(
    state: State<AppState>,
    file_names: Vec<String>,
    target_folder: &str,
) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    for file_name in file_names {
        let parts: Vec<&str> = file_name.split("_p").collect();
        if parts.len() != 2 {
            return Err("Invalid file name format".to_string());
        }
        let id = parts[0];
        let suffix_and_extension: Vec<&str> = parts[1].split('.').collect();
        if suffix_and_extension.len() != 2 {
            return Err("Invalid file name format".to_string());
        }
        let suffix = suffix_and_extension[0];
        let extension = suffix_and_extension[1];

        let mut stmt = conn
            .prepare("SELECT save_dir FROM ILLUST_INFO WHERE illust_id = ? AND suffix = ? AND extension = ?")
            .map_err(|e| e.to_string())?;

        let file_info: Result<String, _> =
            stmt.query_row([id, suffix, extension], |row| Ok(row.get(0)?));

        match file_info {
            Ok(save_dir) => {
                let source_path = std::path::Path::new(&save_dir).join(&file_name);
                let target_path = std::path::Path::new(target_folder).join(&file_name);

                // ファイルを移動
                std::fs::rename(&source_path, &target_path).map_err(|e| e.to_string())?;

                // DBを更新
                conn.execute(
                    "UPDATE ILLUST_INFO SET save_dir = ? WHERE illust_id = ? AND suffix = ? AND extension = ?",
                    params![target_folder, id, suffix, extension],
                )
                .map_err(|e| e.to_string())?;
            }
            Err(e) => return Err(e.to_string()),
        }
    }
    Ok(())
}

#[tauri::command]
pub fn label_character_name(
    state: State<AppState>,
    file_names: Vec<String>,
    character_name: &str,
) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    for file_name in file_names {
        let parts: Vec<&str> = file_name.split("_p").collect();
        if parts.len() != 2 {
            return Err("Invalid file name format".to_string());
        }
        let id = parts[0];
        let suffix_and_extension: Vec<&str> = parts[1].split('.').collect();
        if suffix_and_extension.len() != 2 {
            return Err("Invalid file name format".to_string());
        }
        let suffix = suffix_and_extension[0];
        let extension = suffix_and_extension[1];

        // キャラ名を更新
        conn.execute(
            "UPDATE ILLUST_INFO SET character = ? WHERE illust_id = ? AND suffix = ? AND extension = ?",
            params![character_name, id, suffix, extension],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}