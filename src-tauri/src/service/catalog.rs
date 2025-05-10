use std::{
    collections::{HashMap, HashSet},
    fs,
    path::Path,
};

use rusqlite::{params, Transaction};

const UPDATE_MODE_CONTROL: i32 = 0;
const UPDATE_MODE_SUFFIX: i32 = 1;
const UPDATE_MODE_INCREMENTAL: i32 = 2;

pub fn process_move_files(
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

pub fn create_base_set(
    tx: &rusqlite::Transaction,
    file_names: &[String],
    old_names: &mut HashSet<String>,
) -> Result<HashSet<(String, String, i64)>, String> {
    let mut base_set = HashSet::new();
    for file_name in file_names {
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
        base_set.insert((id, suffix, control_num));
        if let Some(character_name) = character {
            old_names.insert(character_name);
        }
    }
    Ok(base_set)
}

pub fn prepare_updates_set(
    tx: &rusqlite::Transaction,
    base_set: &HashSet<(String, String, i64)>,
    update_linked_files: bool,
) -> Result<HashSet<((String, Option<String>, i64), i32)>, String> {
    let mut updates_set = HashSet::new();
    for (id, suffix, control_num) in base_set.clone() {
        if update_linked_files {
            updates_set.insert(((id, None, control_num), UPDATE_MODE_CONTROL));
        } else {
            let total_control_count: usize = tx
                .query_row(
                    "SELECT COUNT(*) FROM ILLUST_INFO WHERE illust_id = ? AND control_num = ?",
                    params![id, control_num],
                    |row| row.get(0),
                )
                .map_err(|e| e.to_string())?;

            let updated_suffix_count = base_set
                .iter()
                .filter(|(i_id, _, i_control_num)| id == *i_id && control_num == *i_control_num)
                .count();

            let needs_increment = updated_suffix_count < total_control_count;
            if needs_increment {
                updates_set.insert(((id, Some(suffix), control_num), UPDATE_MODE_INCREMENTAL));
            } else {
                updates_set.insert(((id, Some(suffix), control_num), UPDATE_MODE_SUFFIX));
            }
        }
    }
    Ok(updates_set)
}

pub fn group_updates(
    updates_set: &HashSet<((String, Option<String>, i64), i32)>,
) -> HashMap<(String, i64, i32), Vec<Option<String>>> {
    let mut updates_map: HashMap<(String, i64, i32), Vec<Option<String>>> = HashMap::new();
    for ((id, suffix_opt, control_num), update_mode) in updates_set {
        updates_map
            .entry((id.clone(), *control_num, *update_mode))
            .or_default()
            .push(suffix_opt.clone());
    }
    updates_map
}

pub fn update_illust_info(
    tx: &rusqlite::Transaction,
    updates_map: &HashMap<(String, i64, i32), Vec<Option<String>>>,
    character_name: &str,
) -> Result<(), String> {
    for ((id, control_num, update_mode), suffixes) in updates_map {
        let mut update_sql = String::from("UPDATE ILLUST_INFO SET character = ?");
        let mut update_param_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(character_name)];
        let mut insert_sql = None;
        let mut insert_param_vec: Vec<&dyn rusqlite::ToSql> = vec![];
        match *update_mode {
            UPDATE_MODE_CONTROL => {
                update_sql.push_str(" WHERE illust_id = ? AND control_num = ?");
                update_param_vec.push(Box::new(id));
                update_param_vec.push(Box::new(control_num));
            }
            UPDATE_MODE_SUFFIX => {
                if !suffixes.is_empty() {
                    update_sql.push_str(" WHERE illust_id = ? AND suffix IN (");
                    update_sql.push_str(&vec!["?"; suffixes.len()].join(", "));
                    update_sql.push(')');
                    update_param_vec.push(Box::new(id));
                    for suffix in suffixes {
                        if let Some(suffix) = suffix {
                            update_param_vec.push(Box::new(suffix));
                        }
                    }
                } else {
                    return Err("Suffixes are missing for the update operation".to_string());
                }
            }
            UPDATE_MODE_INCREMENTAL => {
                update_sql.push_str(", control_num = (SELECT MAX(control_num) + 1 FROM ILLUST_INFO WHERE illust_id = ?)");
                update_param_vec.push(Box::new(id.clone()));
                if !suffixes.is_empty() {
                    update_sql.push_str(" WHERE illust_id = ? AND suffix IN (");
                    update_sql.push_str(&vec!["?"; suffixes.len()].join(", "));
                    update_sql.push(')');
                    update_param_vec.push(Box::new(id.clone()));
                    for suffix in suffixes.clone() {
                        if let Some(suffix) = suffix {
                            update_param_vec.push(Box::new(suffix));
                        }
                    }

                    insert_sql = Some(
                        "
                    INSERT INTO TAG_INFO (illust_id, control_num, tag)
                    SELECT t.illust_id, i.control_num, t.tag
                    FROM TAG_INFO t
                    JOIN ILLUST_INFO i
                        ON i.illust_id = t.illust_id
                        AND i.suffix = ?
                    WHERE t.illust_id = ?
                        AND t.control_num = ?;
                    ",
                    );
                    insert_param_vec.push(suffixes.get(0).unwrap_or(&None).as_ref().unwrap());
                    insert_param_vec.push(&id);
                    insert_param_vec.push(&control_num);
                } else {
                    return Err("Suffixes are missing for the update operation".to_string());
                }
            }
            _ => {
                return Err("An unknown update mode was encountered".to_string());
            }
        }

        tx.execute(
            &update_sql,
            rusqlite::params_from_iter(update_param_vec.iter().map(|b| b.as_ref())),
        )
        .map_err(|e| e.to_string())?;

        if let Some(ref insert_query) = insert_sql {
            tx.execute(insert_query, insert_param_vec.as_slice())
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

pub fn update_character_info(
    tx: &rusqlite::Transaction,
    character_name: &str,
    collect_dir: &Option<String>,
) -> Result<(), String> {
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
    Ok(())
}

pub fn delete_unused_character_info(
    tx: &rusqlite::Transaction,
    old_names: &HashSet<String>,
) -> Result<(), String> {
    tx.execute(
        "
        DELETE FROM CHARACTER_INFO
        WHERE character IN (SELECT value FROM json_each(?))
          AND NOT EXISTS (
            SELECT 1 FROM ILLUST_INFO
            WHERE ILLUST_INFO.character = CHARACTER_INFO.character
          )
        ",
        params![serde_json::to_string(old_names).map_err(|e| e.to_string())?],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
