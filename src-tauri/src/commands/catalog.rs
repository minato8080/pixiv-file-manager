use rusqlite::params;
use tauri::State;
use trash::delete;

use crate::models::{catalog::EditTagReq, global::AppState};

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

#[tauri::command]
pub fn edit_tags(state: State<AppState>, edit_tag_req: Vec<EditTagReq>) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    for edit_tag in edit_tag_req {
        let parts: Vec<&str> = edit_tag.file_name.split("_p").collect();
        if parts.len() != 2 {
            return Err("Invalid file name format".to_string());
        }
        let id = parts[0];
        let suffix_and_extension: Vec<&str> = parts[1].split('.').collect();
        if suffix_and_extension.len() != 2 {
            return Err("Invalid file name format".to_string());
        }
        let _suffix = suffix_and_extension[0];
        let _extension = suffix_and_extension[1];

        // 既存のタグを削除
        conn.execute("DELETE FROM TAG_INFO WHERE illust_id = ?", params![id])
            .map_err(|e| e.to_string())?;

        // 新しいタグを挿入
        for tag in &edit_tag.tags {
            conn.execute(
                "INSERT INTO TAG_INFO (illust_id, tag) VALUES (?, ?)",
                params![id, tag],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn delete_files(state: State<AppState>, file_names: Vec<String>) -> Result<(), String> {
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;

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

        let (save_dir, control_num): (String, i32) = tx
            .query_row(
                "SELECT save_dir, control_num FROM ILLUST_INFO WHERE illust_id = ? AND suffix = ?",
                params![id, suffix],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|e| e.to_string())?;

        // ファイルを削除（ゴミ箱に移動）
        let source_path = std::path::Path::new(&save_dir).join(&file_name);
        delete(source_path).map_err(|e| e.to_string())?;

        // ILLUST_INFOテーブルからレコードを削除
        tx.execute(
            "DELETE FROM ILLUST_INFO WHERE illust_id = ? AND suffix = ?",
            params![id, suffix],
        )
        .map_err(|e| e.to_string())?;

        // control_numを取り出して0件の場合、TAG_INFOから削除する
        let count: i32 = tx
            .query_row(
                "SELECT COUNT(*) FROM ILLUST_INFO WHERE illust_id = ? AND control_num = ?",
                params![id, control_num],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        if count == 0 {
            tx.execute(
                "DELETE FROM TAG_INFO WHERE illust_id = ? AND control_num = ?",
                params![id, control_num],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}
