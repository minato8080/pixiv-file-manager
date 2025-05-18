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
    // db_design.mdに基づき、ILLUST_DETAILテーブルを更新する形に修正
    for ((id, control_num, update_mode), suffixes) in suffixes_map {
        match *update_mode {
            UPDATE_MODE_CONTROL => {
                // control_num指定でILLUST_DETAILを更新
                tx.execute(
                    "UPDATE ILLUST_DETAIL SET character = ? WHERE illust_id = ? AND control_num = ?",
                    params![character_name, id, control_num])
                    .map_err(|e| e.to_string())?;
            }
            UPDATE_MODE_INCREMENT => {
                // suffixesが空でないことを確認
                if !suffixes.is_empty() {
                    // 次の管理番号
                    let next_control_num: i32 = tx
                        .query_row(
                            "SELECT IFNULL(MAX(control_num), 0) + 1 FROM ILLUST_INFO WHERE illust_id = ?",
                            params![&id],
                            |row| row.get(0),
                        )
                        .map_err(|e| e.to_string())?;

                    // 元の管理番号からauthor_idをSELECTして使用
                    let author_id: i32 = tx
                        .query_row(
                            "SELECT author_id FROM ILLUST_DETAIL WHERE illust_id = ? AND control_num = ?",
                            params![id, control_num],
                            |row| row.get(0),
                        )
                        .map_err(|e| e.to_string())?;

                    // control_numを新規発番し、ILLUST_DETAILにINSERT
                    tx.execute(
                        "INSERT INTO ILLUST_DETAIL (illust_id, control_num, author_id, character) VALUES (?, ?, ?, ?)",
                        params![id, next_control_num, author_id, character_name],
                    )
                    .map_err(|e| e.to_string())?;

                    // ILLUST_INFOの該当suffixのcontrol_numを新しいものに更新
                    let mut update_info_sql = String::from("UPDATE ILLUST_INFO SET control_num = ? WHERE illust_id = ? AND suffix IN (");
                    update_info_sql.push_str(&vec!["?"; suffixes.len()].join(", "));
                    update_info_sql.push(')');
                    let mut update_info_params: Vec<Box<dyn rusqlite::ToSql>> =
                        vec![Box::new(next_control_num), Box::new(id)];
                    for suffix in suffixes.iter() {
                        if let Some(suffix) = suffix {
                            update_info_params.push(Box::new(suffix));
                        }
                    }
                    tx.execute(
                        &update_info_sql,
                        rusqlite::params_from_iter(update_info_params.iter().map(|b| b.as_ref())),
                    )
                    .map_err(|e| e.to_string())?;

                    // TAG_INFOも新しいcontrol_numで複製
                    let insert_tags_sql = "
                        INSERT INTO TAG_INFO (illust_id, control_num, tag)
                        SELECT illust_id, ? as control_num, tag
                        FROM TAG_INFO
                        WHERE illust_id = ? AND control_num = ?
                        ";
                    let mut insert_tags_param_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![];
                    insert_tags_param_vec.push(Box::new(next_control_num));
                    insert_tags_param_vec.push(Box::new(id));
                    insert_tags_param_vec.push(Box::new(control_num));
                    tx.execute(
                        insert_tags_sql,
                        rusqlite::params_from_iter(
                            insert_tags_param_vec.iter().map(|b| b.as_ref()),
                        ),
                    )
                    .map_err(|e| e.to_string())?;
                } else {
                    return Err("Suffixes are missing for the update operation".to_string());
                }
            }
            _ => {
                return Err("An unknown update mode was encountered".to_string());
            }
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
    old_names: &HashSet<Option<String>>,
) -> Result<(), String> {
    // old_namesの中身がNoneしかないならリターン
    if old_names.iter().all(|name| name.is_none()) {
        return Ok(());
    }
    tx.execute(
        "
        DELETE FROM CHARACTER_INFO
        WHERE character IN (SELECT value FROM json_each(?))
          AND NOT EXISTS (
            SELECT 1 FROM ILLUST_DETAIL
            WHERE ILLUST_DETAIL.character = CHARACTER_INFO.character
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
        // 管理番号のセット
        let unique_control_nums: std::collections::HashSet<i32> = suffixes_and_control_num
            .iter()
            .map(|(_, control_num)| *control_num)
            .collect();

        // suffixの配列
        let suffixes: Vec<i32> = suffixes_and_control_num
            .iter()
            .map(|(suffix, _)| suffix.clone())
            .collect();

        // 管理番号変更フラグ
        let is_change_control_num = if unique_control_nums.len() == 1 {
            // 一個目の管理番号
            let first_control_num = *unique_control_nums.iter().next().unwrap();
            // 一個目の管理番号でカウント
            let count: i32 = tx
                .query_row(
                    "SELECT COUNT(*) FROM ILLUST_INFO WHERE illust_id = ? AND control_num = ?",
                    params![&id, first_control_num],
                    |row| row.get(0),
                )
                .map_err(|e| e.to_string())?;
            // 全件更新なら未変更
            count != suffixes.len() as i32
        }
        // それ以外は変更
        else {
            true
        };

        // 次の管理番号
        // 管理番号が未変更ならそのまま
        let next_control_num = if !is_change_control_num {
            *unique_control_nums.iter().next().unwrap()
        }
        // そうでないなら最新を取得してインクリメント
        else {
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

        // suffixのIN句で管理番号をupdateする
        let in_clause = suffixes.iter().map(|_| "?").collect::<Vec<_>>().join(", ");

        let mut params_vec: Vec<&dyn rusqlite::ToSql> = Vec::new();
        params_vec.push(&next_control_num);
        params_vec.push(&id);
        for suffix in &suffixes {
            params_vec.push(suffix);
        }

        tx.execute(
            &format!(
                "UPDATE ILLUST_INFO SET control_num = ? WHERE illust_id = ? AND suffix IN ({})",
                in_clause
            ),
            params_vec.as_slice(),
        )
        .map_err(|e| e.to_string())?;

        // 管理番号を変更してるならILLUST_DETAILを複製
        if is_change_control_num {
            let some_control_num = unique_control_nums.iter().next().unwrap();
            tx.execute(
                "
                INSERT OR IGNORE INTO ILLUST_DETAIL (illust_id, control_num, author_id, character)
                SELECT illust_id, ? as control_num, author_id, character
                FROM ILLUST_DETAIL WHERE illust_id = ? AND control_num = ?
                ",
                params![&next_control_num, &id, &some_control_num],
            )
            .map_err(|e| e.to_string())?;
        }

        // 関連テーブルの更新
        for control_num in unique_control_nums {
            // 旧番でカウント
            let count: i32 = tx
                .query_row(
                    "SELECT COUNT(*) FROM ILLUST_INFO WHERE illust_id = ? AND control_num = ?",
                    params![&id, &control_num],
                    |row| row.get(0),
                )
                .map_err(|e| e.to_string())?;

            // カウントが0なら削除
            // 洗い替えの場合も削除
            if count == 0 || is_change_control_num {
                // TAG_INFOからDELETE
                tx.execute(
                    "DELETE FROM TAG_INFO WHERE illust_id = ? AND control_num = ?",
                    params![&id, &control_num],
                )
                .map_err(|e| e.to_string())?;
            }

            // カウントが0なら削除
            if count == 0 {
                // ILLUST_DETAILを削除
                tx.execute(
                    "DELETE ILLUST_DETAIL WHERE illust_id = ? AND control_num = ?",
                    params![&next_control_num, &id, &control_num],
                )
                .map_err(|e| e.to_string())?;
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
