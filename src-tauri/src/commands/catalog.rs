use std::{collections::HashSet, fs, path::Path};

use rusqlite::{params, Transaction};
use tauri::State;
use trash::delete;

use crate::models::{
    catalog::{AssociateCharacter, AssociateInfo, AssociateSaveDir, EditTagReq},
    global::AppState,
};

#[tauri::command]
pub fn move_files(
    state: State<AppState>,
    file_names: Vec<String>,
    target_folder: &str,
    move_linked_files: bool,
) -> Result<(), String> {
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    process_move_files(&tx, file_names, target_folder, move_linked_files)?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

fn process_move_files(
    tx: &Transaction,
    file_names: Vec<String>,
    target_folder: &str,
    move_linked_files: bool,
) -> Result<(), String> {
    let mut updates = HashSet::new();
    // target_folderがない場合、作成
    if !Path::new(target_folder).exists() {
        fs::create_dir_all(target_folder).map_err(|e| e.to_string())?;
    }

    // 更新用のデータを作成
    for file_name in &file_names {
        let parts: Vec<&str> = file_name.split("_p").collect();
        if parts.len() != 2 {
            return Err("Invalid file name format".to_string());
        }
        let id = parts[0].to_string();
        let suffix_and_ext: Vec<&str> = parts[1].split('.').collect();
        if suffix_and_ext.len() != 2 {
            return Err("Invalid file name format".to_string());
        }
        let suffix = suffix_and_ext[0].to_string();

        let control_num: i64 = tx
            .query_row(
                "SELECT control_num FROM ILLUST_INFO WHERE illust_id = ? AND suffix = ?",
                params![id, suffix],
                |row| Ok(row.get(0)?),
            )
            .map_err(|e| e.to_string())?;

        if move_linked_files {
            updates.insert((id, None, Some(control_num)));
        } else {
            updates.insert((id, Some(suffix), None)); // suffixで更新する
        }
    }

    // ILLUST_INFOを更新
    for (id, suffix_opt, control_num_opt) in updates {
        let mut update_sql = String::from("UPDATE ILLUST_INFO SET save_dir = ?");
        let mut param_vec: Vec<&dyn rusqlite::ToSql> = vec![&target_folder];

        if let Some(ref control_num) = control_num_opt {
            update_sql.push_str(" WHERE illust_id = ? AND control_num = ?");
            param_vec.push(&id);
            param_vec.push(control_num);
        } else {
            // suffix指定
            update_sql.push_str(" WHERE illust_id = ? AND suffix = ?");
            param_vec.push(&id);
            param_vec.push(&suffix_opt);
        }

        // 実体ファイル情報を取得
        let mut select_sql = String::from(
            "SELECT (illust_id || '_p' || suffix || '.' || extension) as file_name, save_dir FROM ILLUST_INFO WHERE illust_id = ? AND ",
        );

        let mut select_param_vec: Vec<&dyn rusqlite::ToSql> = Vec::new();
        select_param_vec.push(&id);

        if let Some(ref control_num) = control_num_opt {
            select_sql.push_str("control_num = ?");
            select_param_vec.push(control_num);
        } else if let Some(ref suffix) = suffix_opt {
            select_sql.push_str("suffix = ?");
            select_param_vec.push(suffix);
        } else {
            return Err("Either suffix or control_num is required".to_string());
        }

        let mut stmt = tx.prepare(&select_sql).map_err(|e| e.to_string())?;
        let file_names_to_update: Vec<(String, String)> = stmt
            .query_map(select_param_vec.as_slice(), |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<(String, String)>, _>>()
            .map_err(|e| e.to_string())?;

        // ファイルを移動
        for (file_name, save_dir) in file_names_to_update {
            let source_path = std::path::Path::new(&save_dir).join(&file_name);
            let target_path = std::path::Path::new(target_folder).join(&file_name);
            if source_path == target_path {
                continue;
            }
            std::fs::rename(&source_path, &target_path).map_err(|e| e.to_string())?;
        }

        // DBを更新
        tx.execute(&update_sql, param_vec.as_slice())
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn label_character_name(
    state: State<AppState>,
    file_names: Vec<String>,
    character_name: &str,
    update_linked_files: bool,
    collect_dir: Option<String>,
) -> Result<(), String> {
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let mut updates = HashSet::new();
    let mut old_names = HashSet::new();

    // 更新用のデータを作成
    for file_name in &file_names {
        let parts: Vec<&str> = file_name.split("_p").collect();
        if parts.len() != 2 {
            return Err("Invalid file name format".to_string());
        }
        let id = parts[0].to_string();
        let suffix_and_ext: Vec<&str> = parts[1].split('.').collect();
        if suffix_and_ext.len() != 2 {
            return Err("Invalid file name format".to_string());
        }
        let suffix = suffix_and_ext[0].to_string();

        let (control_num, character): (i64, Option<String>) = tx
            .query_row(
                "SELECT control_num, character FROM ILLUST_INFO WHERE illust_id = ? AND suffix = ?",
                params![id, suffix],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|e| e.to_string())?;

        if update_linked_files {
            updates.insert((id, None, Some(control_num)));
        } else {
            updates.insert((id, Some(suffix), None)); // suffixで更新する
        }

        if let Some(character_name) = character {
            old_names.insert(character_name);
        }
    }

    // ILLUST_INFOを更新
    for (id, suffix_opt, control_num_opt) in updates {
        let mut sql = String::from("UPDATE ILLUST_INFO SET character = ?");
        let mut param_vec: Vec<&dyn rusqlite::ToSql> = vec![&character_name];

        if let Some(ref control_num) = control_num_opt {
            sql.push_str(" WHERE illust_id = ? AND control_num = ?");
            param_vec.push(&id);
            param_vec.push(control_num);
        } else if let Some(ref suffix) = suffix_opt {
            sql.push_str(" WHERE illust_id = ? AND suffix = ?");
            param_vec.push(&id);
            param_vec.push(suffix);
        } else {
            return Err("Suffix is missing for the update operation".to_string());
        }

        tx.execute(&sql, param_vec.as_slice())
            .map_err(|e| e.to_string())?;
    }

    // CHARACTER_INFOの更新
    if let Some(ref dir) = collect_dir {
        tx.execute(
            "INSERT OR REPLACE INTO CHARACTER_INFO (character, collect_dir) VALUES (?, ?)",
            params![character_name, dir],
        )
        .map_err(|e| e.to_string())?;
    } else {
        tx.execute(
            "INSERT INTO CHARACTER_INFO (character) SELECT ? WHERE NOT EXISTS (SELECT 1 FROM CHARACTER_INFO WHERE character = ?)",
            params![character_name, character_name],
        ).map_err(|e| e.to_string())?;
    }

    // 名前がない場合は削除する
    tx.execute(
        "
        DELETE FROM CHARACTER_INFO
        WHERE character IN (SELECT value FROM json_each(?))
          AND NOT EXISTS (
            SELECT 1 FROM ILLUST_INFO
            WHERE ILLUST_INFO.character = CHARACTER_INFO.character
          )
        ",
        params![serde_json::to_string(&old_names).map_err(|e| e.to_string())?],
    )
    .map_err(|e| e.to_string())?;

    // ファイル移動
    if let Some(dir) = collect_dir {
        process_move_files(&tx, file_names, &dir, update_linked_files)?;
    }
    tx.commit().map_err(|e| e.to_string())?;

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
        tx.execute(
            "
            DELETE FROM TAG_INFO
            WHERE illust_id = ? AND control_num = ?
            AND NOT EXISTS (
                SELECT 1
                FROM ILLUST_INFO
                WHERE illust_id = ? AND control_num = ?
            )
            ",
            params![id, control_num, id, control_num],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_associated_info(
    state: State<AppState>,
    file_names: Vec<String>,
) -> Result<AssociateInfo, String> {
    let conn = state.db.lock().unwrap();
    let mut all_entries = Vec::new();

    for file_name in &file_names {
        let parts: Vec<&str> = file_name.split("_p").collect();
        if parts.len() != 2 {
            return Err(format!("Invalid file name format: {}", file_name));
        }
        let illust_id = parts[0];
        let suffix = parts[1]
            .split('.')
            .next()
            .ok_or_else(|| format!("Invalid file name format: {}", file_name))?;

        // control_num の取得
        let control_num: i64 = conn
            .query_row(
                "SELECT control_num FROM ILLUST_INFO WHERE illust_id = ? AND suffix = ?",
                params![illust_id, suffix],
                |row| row.get(0),
            )
            .map_err(|e| {
                format!(
                    "Failed to get control_num for {}_{}: {}",
                    illust_id, suffix, e
                )
            })?;

        // 同じ control_num を持つレコードを取得
        let mut stmt = conn.prepare(
            "SELECT (illust_id || '_p' || suffix || '.' || extension) as key, character, save_dir FROM ILLUST_INFO WHERE illust_id = ? AND control_num = ?",
        ).map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(params![illust_id, control_num], |row| {
                let key: String = row.get(0)?;
                let character: Option<String> = row.get(1)?;
                let save_dir: String = row.get(2)?;
                Ok((key, character, save_dir))
            })
            .map_err(|e| e.to_string())?;

        for row in rows {
            all_entries.push(row.map_err(|e| e.to_string())?);
        }
    }

    // character/save_dir のカウント用マップ
    use std::collections::{HashMap, HashSet};

    let mut character_counts: HashMap<String, HashSet<String>> = HashMap::new();
    let mut save_dir_counts: HashMap<String, HashSet<String>> = HashMap::new();

    for (key, character_opt, save_dir_str) in all_entries {
        let character = character_opt.unwrap_or("None".to_string());

        // characterごとに key をセット
        character_counts
            .entry(character)
            .or_default()
            .insert(key.clone());

        // save_dirごとに key をセット
        save_dir_counts
            .entry(save_dir_str)
            .or_default()
            .insert(key.clone());
    }

    let source_keys: HashSet<String> = file_names.into_iter().collect();
    // 減算処理：source_keys に含まれるものを削除
    for set in character_counts.values_mut() {
        set.retain(|key| !source_keys.contains(key));
    }
    for set in save_dir_counts.values_mut() {
        set.retain(|key| !source_keys.contains(key));
    }

    // count = 出現したユニークな (illust_id, suffix) の組数
    let characters = character_counts
        .into_iter()
        .map(|(character, set)| AssociateCharacter {
            character,
            count: set.len() as i32,
        })
        .collect();

    let save_dirs = save_dir_counts
        .into_iter()
        .map(|(save_dir, set)| AssociateSaveDir {
            save_dir,
            count: set.len() as i32,
        })
        .collect();

    Ok(AssociateInfo {
        characters,
        save_dirs,
    })
}
