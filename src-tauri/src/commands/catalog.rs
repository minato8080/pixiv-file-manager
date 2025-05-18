use std::collections::HashSet;

use rusqlite::params;
use tauri::State;
use trash::delete;

use crate::{
    models::{
        catalog::{AssociateCharacter, AssociateInfo, AssociateSaveDir, EditTagReq},
        global::AppState,
    },
    service::catalog::{
        create_base_map, create_base_map_with_opt, delete_unused_character_info,
        prepare_id_tags_map, prepare_suffiexes_map, prepare_update_mode_map, process_edit_tags,
        process_move_files, update_character_info, update_illust_info,
    },
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

    let base_map = create_base_map(&tx, &file_names)?;
    let update_mode_map = prepare_update_mode_map(&tx, &base_map, update_linked_files)?;
    let suffixes_map = prepare_suffiexes_map(update_mode_map);

    let mut old_names = HashSet::new();
    for ((id, suffix, _), _) in base_map {
        let old_name: Option<String> = tx
            .query_row(
                "SELECT D.character FROM ILLUST_DETAIL D 
                INNER JOIN ILLUST_INFO I ON D.illust_id = I.illust_id 
                AND D.control_num = I.control_num 
                WHERE I.illust_id = ? AND I.suffix = ?",
                params![id, suffix],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        old_names.insert(old_name);
    }

    update_illust_info(&tx, &suffixes_map, character_name)?;
    update_character_info(&tx, character_name, &collect_dir)?;
    delete_unused_character_info(&tx, &old_names)?;

    if let Some(dir) = collect_dir {
        process_move_files(&tx, file_names, &dir, update_linked_files)?;
    }
    tx.commit().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn edit_tags(
    state: State<AppState>,
    edit_tag_req: EditTagReq,
    update_linked_files: bool,
) -> Result<(), String> {
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let file_names_with_opt: Vec<(String, Option<Vec<String>>)> = edit_tag_req
        .vec
        .into_iter()
        .map(|edit_tag| (edit_tag.file_name, edit_tag.individual_tags))
        .collect();
    let base_map = create_base_map_with_opt(&tx, file_names_with_opt)?;
    let id_tags_map = prepare_id_tags_map(
        &tx,
        base_map,
        update_linked_files,
        &edit_tag_req.overwrite_tags.clone(),
    )?;
    process_edit_tags(&tx, id_tags_map)?;

    tx.commit().map_err(|e| e.to_string())?;

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

        // control_numを取り出して0件の場合、TAG_INFOおよびILLUST_DETAILから削除する
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

        tx.execute(
            "
            DELETE FROM ILLUST_DETAIL
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
            "SELECT (I.illust_id || '_p' || I.suffix || '.' || I.extension) as key, D.character, I.save_dir
             FROM ILLUST_INFO I
             LEFT JOIN ILLUST_DETAIL D
             ON I.illust_id = D.illust_id AND I.control_num = D.control_num
             WHERE I.illust_id = ? AND I.control_num = ?",
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
