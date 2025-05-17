use std::{
    collections::{HashMap, HashSet},
    fs,
    path::Path,
};

use rusqlite::{params, Transaction};

const UPDATE_MODE_CONTROL: UpdateMode = 0;
const UPDATE_MODE_INCREMENT: UpdateMode = 1;

type Id = i32;
type Suffix = i32;
type ControlNum = i32;
type UpdateMode = i8;
type Tag = String;
type Dummy = String;
type BaseMap<O> = HashMap<(Id, Suffix, ControlNum), Option<O>>;
type UpdateModeMap = HashMap<(Id, Option<Suffix>, ControlNum), UpdateMode>;
type SuffixesMap = HashMap<(Id, ControlNum, UpdateMode), Vec<Option<Suffix>>>;
type IdTagsMap = HashMap<(Id, Option<Vec<Tag>>), Vec<(Suffix, ControlNum)>>;

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

        let control_num: ControlNum = tx
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

pub fn create_base_map(
    tx: &rusqlite::Transaction,
    file_names: &Vec<String>,
) -> Result<BaseMap<String>, Dummy> {
    let file_names_with_none: Vec<(String, _)> = file_names
        .iter()
        .map(|file_name| (file_name.clone(), None::<Dummy>))
        .collect();
    create_base_map_with_opt(tx, file_names_with_none)
}

pub fn create_base_map_with_opt<O>(
    tx: &rusqlite::Transaction,
    file_names: Vec<(String, Option<O>)>,
) -> Result<BaseMap<O>, String>
where
    O: Ord + Clone,
{
    let mut base_map = HashMap::new();
    for (file_name, options) in file_names {
        let parts: Vec<&str> = file_name.split("_p").collect();
        if parts.len() != 2 {
            return Err("Invalid file name format".to_string());
        }
        let id = parts[0]
            .parse::<i32>()
            .map_err(|_| "Invalid id format".to_string())?;
        let suffix_and_ext: Vec<&str> = parts[1].split('.').collect();
        if suffix_and_ext.len() != 2 {
            return Err("Invalid file name format".to_string());
        }
        let suffix = suffix_and_ext[0]
            .parse::<i32>()
            .map_err(|_| "Invalid suffix format".to_string())?;
        let control_num: ControlNum = tx
            .query_row(
                "SELECT control_num FROM ILLUST_INFO WHERE illust_id = ? AND suffix = ?",
                params![id, suffix],
                |row| Ok(row.get(0)?),
            )
            .map_err(|e| e.to_string())?;
        base_map.insert((id, suffix, control_num), options);
    }
    // base_mapのOption<O>をソートして再格納する
    // O: Ord + Clone なので、Option<O>もsort可能
    let mut options_vec: Vec<Option<O>> = base_map.values().cloned().collect();
    // Noneは最後に来るようにOption<O>でソート
    options_vec.sort_by(|a, b| match (a, b) {
        (Some(a_val), Some(b_val)) => a_val.cmp(b_val),
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, None) => std::cmp::Ordering::Equal,
    });
    // base_mapのキーを取得して、ソート済みの値で再格納
    let keys: Vec<_> = base_map.keys().cloned().collect();
    for (key, opt) in keys.into_iter().zip(options_vec.into_iter()) {
        base_map.insert(key, opt);
    }
    Ok(base_map)
}

pub fn prepare_update_mode_map(
    tx: &rusqlite::Transaction,
    base_map: &BaseMap<String>,
    update_linked_files: bool,
) -> Result<UpdateModeMap, String> {
    let mut updates_map: UpdateModeMap = HashMap::new();
    for ((id, suffix, control_num), _options) in base_map.clone() {
        if update_linked_files {
            updates_map.insert((id.clone(), None, control_num), UPDATE_MODE_CONTROL);
        } else {
            let total_control_count: usize = tx
                .query_row(
                    "SELECT COUNT(*) FROM ILLUST_INFO WHERE illust_id = ? AND control_num = ?",
                    params![id, control_num],
                    |row| row.get(0),
                )
                .map_err(|e| e.to_string())?;

            let update_control_count = base_map
                .iter()
                .filter(|((i_id, _, i_control_num), _)| {
                    id == *i_id && control_num == *i_control_num
                })
                .count();

            let needs_increment = update_control_count < total_control_count;
            if needs_increment {
                updates_map.insert((id, Some(suffix), control_num), UPDATE_MODE_INCREMENT);
            } else {
                updates_map.insert((id, Some(suffix), control_num), UPDATE_MODE_CONTROL);
            }
        }
    }
    Ok(updates_map)
}

pub fn prepare_suffiexes_map(updates_map: UpdateModeMap) -> SuffixesMap {
    let mut grouped_map: SuffixesMap = HashMap::new();
    for ((id, suffix_opt, control_num), update_mode) in updates_map {
        grouped_map
            .entry((id, control_num, update_mode))
            .or_default()
            .push(suffix_opt);
    }

    let result = grouped_map
        .into_iter()
        .map(|(k, v)| (k, v))
        .collect::<HashMap<_, Vec<_>>>();
    result
}

pub fn update_illust_info(
    tx: &rusqlite::Transaction,
    suffixes_map: &SuffixesMap,
    character_name: &str,
) -> Result<(), String> {
    for ((id, control_num, update_mode), suffixes) in suffixes_map {
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
            UPDATE_MODE_INCREMENT => {
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

pub fn prepare_id_tags_map(
    tx: &rusqlite::Transaction,
    base_map: BaseMap<Vec<String>>,
    update_linked_files: bool,
    overwrite_tags_opt: &Option<Vec<Tag>>,
) -> Result<IdTagsMap, String> {
    let mut id_tags_map: IdTagsMap = HashMap::new();
    for ((id, suffix, control_num), tags_opt) in base_map {
        if update_linked_files {
            // update_linked_filesがtrueなら、同じillust_idの全suffixをILLUST_INFOから取得して全て追加する
            let mut stmt = tx
                .prepare("SELECT suffix FROM ILLUST_INFO WHERE illust_id = ? AND control_num = ?")
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map(params![&id, control_num], |row| row.get(0))
                .map_err(|e| e.to_string())?;

            for row in rows {
                let suffix = row.map_err(|e| e.to_string())?;
                let target_tags: Option<Vec<String>> =
                    if let Some(ref overwrite_tags) = *overwrite_tags_opt {
                        Some(overwrite_tags.clone())
                    } else {
                        tags_opt.clone()
                    };
                id_tags_map
                    .entry((id.clone(), target_tags))
                    .or_insert_with(Vec::new)
                    .push((suffix, control_num))
            }
            continue;
        } else {
            let target: Option<Vec<String>> = if let Some(ref overwrite_tags) = *overwrite_tags_opt
            {
                Some(overwrite_tags.clone())
            } else {
                tags_opt.clone()
            };
            id_tags_map
                .entry((id.clone(), target))
                .or_insert_with(Vec::new)
                .push((suffix, control_num));
        }
    }
    Ok(id_tags_map)
}

pub fn process_edit_tags(tx: &rusqlite::Transaction, id_tags_map: IdTagsMap) -> Result<(), String> {
    // idとtagsの一対一で処理
    for ((id, tags_opt), suffixes_and_control_num) in id_tags_map {
        // stuffixes_and_control_numのcontrol_numが単一ならそのまま、複数ならdbから最新を取得してインクリメント
        let unique_control_nums: std::collections::HashSet<i32> = suffixes_and_control_num
            .iter()
            .map(|(_, control_num)| *control_num)
            .collect();
        let next_control_num = if unique_control_nums.len() == 1 {
            // control_numが全て同じならそのまま使う
            *unique_control_nums.iter().next().unwrap()
        } else {
            // 複数ある場合はDBから最新のcontrol_numを取得し、インクリメント
            let max_control_num: i32 = tx
                .query_row(
                    "SELECT MAX(control_num) FROM ILLUST_INFO WHERE illust_id = ?",
                    params![&id],
                    |row| row.get::<_, Option<i32>>(0),
                )
                .map_err(|e| e.to_string())?
                .unwrap_or(0);
            max_control_num + 1
        };

        // suffixes_and_control_numを使ってsuffixのIN句でupdateする
        let suffixes: Vec<i32> = suffixes_and_control_num
            .iter()
            .map(|(suffix, _)| suffix.clone())
            .collect();
        if !suffixes.is_empty() {
            let in_clause = suffixes.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
            let mut params_vec: Vec<&dyn rusqlite::ToSql> = Vec::new();
            params_vec.push(&next_control_num);
            params_vec.push(&id);
            for suffix in &suffixes {
                params_vec.push(suffix);
            }
            let sql = format!(
                "UPDATE ILLUST_INFO SET control_num = ? WHERE illust_id = ? AND suffix IN ({})",
                in_clause
            );
            tx.execute(&sql, params_vec.as_slice())
                .map_err(|e| e.to_string())?;

            // unique_control_numsをループして、ILLUST_INFOに登録が0ならTAG_INFOからDELETE
            for control_num in unique_control_nums {
                let count: i32 = tx
                    .query_row(
                        "SELECT COUNT(*) FROM ILLUST_INFO WHERE illust_id = ? AND control_num = ?",
                        params![&id, &control_num],
                        |row| row.get(0),
                    )
                    .map_err(|e| e.to_string())?;
                if count == 0 || (control_num == next_control_num && count == suffixes.len() as i32)
                {
                    tx.execute(
                        "DELETE FROM TAG_INFO WHERE illust_id = ? AND control_num = ?",
                        params![&id, &control_num],
                    )
                    .map_err(|e| e.to_string())?;
                }
            }
        }
        // 新しいタグを挿入
        if let Some(tags) = tags_opt {
            for tag in tags {
                tx.execute(
                    "INSERT OR IGNORE INTO TAG_INFO (illust_id, control_num, tag) VALUES (?, ?, ?)",
                    params![id, next_control_num, tag],
                )
                .map_err(|e| e.to_string())?;
            }
        };
    }
    Ok(())
}
