use anyhow::{anyhow, Result};
use rusqlite::{params, Connection, Transaction};
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::Path,
};

use crate::{models::catalog::EditTag, service::common::parse_file_info};

const UPDATE_MODE_CONTROL: UpdateMode = 0;
const UPDATE_MODE_INCREMENT: UpdateMode = 1;

type Id = u32;
type Suffix = u8;
type ControlNum = i32;
type UpdateMode = i8;
type Dummy = String;
type BaseMap<O> = HashMap<(Id, Suffix, ControlNum), Option<O>>;
type UpdateModeMap = HashMap<(Id, Option<Suffix>, ControlNum), UpdateMode>;
type SuffixesMap = HashMap<(Id, ControlNum, UpdateMode), Vec<Option<Suffix>>>;

pub fn process_move_files(
    tx: &Transaction,
    file_names: Vec<String>,
    target_folder: &str,
    move_linked_files: bool,
) -> Result<()> {
    let mut updates = HashSet::new();
    // target_folderがない場合、作成
    if !Path::new(target_folder).exists() {
        fs::create_dir_all(target_folder)?;
    }

    // 更新用のデータを作成
    for file_name in &file_names {
        let file_info = parse_file_info(file_name.as_str())?;

        let control_num: ControlNum = tx.query_row(
            "SELECT control_num FROM ILLUST_INFO WHERE illust_id = ? AND suffix = ?",
            params![file_info.illust_id, file_info.suffix],
            |row| Ok(row.get(0)?),
        )?;

        if move_linked_files {
            updates.insert((file_info.illust_id, None, Some(control_num)));
        } else {
            updates.insert((file_info.illust_id, Some(file_info.suffix), None));
            // suffixで更新する
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
            return Err(anyhow!("Either suffix or control_num is required"));
        }

        let mut stmt = tx.prepare(&select_sql)?;
        let file_names_to_update: Vec<(String, String)> = stmt
            .query_map(select_param_vec.as_slice(), |row| {
                Ok((row.get(0)?, row.get(1)?))
            })?
            .collect::<Result<Vec<(String, String)>, _>>()?;

        // ファイルを移動
        for (file_name, save_dir) in file_names_to_update {
            let source_path = std::path::Path::new(&save_dir).join(&file_name);
            let target_path = std::path::Path::new(target_folder).join(&file_name);
            if source_path == target_path {
                continue;
            }
            std::fs::rename(&source_path, &target_path)?;
        }

        // DBを更新
        tx.execute(&update_sql, param_vec.as_slice())?;
    }
    Ok(())
}

pub fn create_base_map(
    tx: &rusqlite::Transaction,
    file_names: &Vec<String>,
) -> Result<BaseMap<String>> {
    let file_names_with_none: Vec<(String, _)> = file_names
        .iter()
        .map(|file_name| (file_name.clone(), None::<Dummy>))
        .collect();
    create_base_map_with_opt(tx, file_names_with_none)
}

pub fn create_base_map_with_opt<O>(
    tx: &rusqlite::Transaction,
    file_names: Vec<(String, Option<O>)>,
) -> Result<BaseMap<O>>
where
    O: Ord + Clone,
{
    let mut base_map = HashMap::new();
    for (file_name, options) in file_names {
        let file_info = parse_file_info(file_name.as_str())?;
        let control_num: ControlNum = tx.query_row(
            "SELECT control_num FROM ILLUST_INFO WHERE illust_id = ? AND suffix = ?",
            params![file_info.illust_id, file_info.suffix],
            |row| Ok(row.get(0)?),
        )?;
        base_map.insert(
            (file_info.illust_id, file_info.suffix, control_num),
            options,
        );
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
) -> Result<UpdateModeMap> {
    let mut updates_map: UpdateModeMap = HashMap::new();
    for ((id, suffix, control_num), _options) in base_map.clone() {
        if update_linked_files {
            updates_map.insert((id.clone(), None, control_num), UPDATE_MODE_CONTROL);
        } else {
            let total_control_count: u64 = tx.query_row(
                "SELECT COUNT(*) FROM ILLUST_INFO WHERE illust_id = ? AND control_num = ?",
                params![id, control_num],
                |row| row.get(0),
            )?;

            let update_control_count: u64 = base_map
                .iter()
                .filter(|((i_id, _, i_control_num), _)| {
                    id == *i_id && control_num == *i_control_num
                })
                .count()
                .try_into()
                .unwrap();

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
) -> Result<()> {
    // db_design.mdに基づき、ILLUST_DETAILテーブルを更新する形に修正
    for ((id, control_num, update_mode), suffixes) in suffixes_map {
        match *update_mode {
            UPDATE_MODE_CONTROL => {
                // control_num指定でILLUST_DETAILを更新
                tx.execute(
                    "UPDATE ILLUST_DETAIL SET character = ? WHERE illust_id = ? AND control_num = ?",
                    params![character_name, id, control_num])
                    ?;
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
                        ?;

                    // 元の管理番号からauthor_idをSELECTして使用
                    let author_id: i32 = tx
                        .query_row(
                            "SELECT author_id FROM ILLUST_DETAIL WHERE illust_id = ? AND control_num = ?",
                            params![id, control_num],
                            |row| row.get(0),
                        )
                        ?;

                    // control_numを新規発番し、ILLUST_DETAILにINSERT
                    tx.execute(
                        "INSERT INTO ILLUST_DETAIL (illust_id, control_num, author_id, character) VALUES (?, ?, ?, ?)",
                        params![id, next_control_num, author_id, character_name],
                    )
                    ?;

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
                    )?;

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
                    )?;
                } else {
                    return Err(anyhow!("Suffixes are missing for the update operation"));
                }
            }
            _ => {
                return Err(anyhow!("An unknown update mode was encountered"));
            }
        }
    }
    Ok(())
}

pub fn update_character_info(
    tx: &rusqlite::Transaction,
    character_name: &str,
    collect_dir: &Option<String>,
) -> Result<()> {
    if let Some(ref dir) = collect_dir {
        tx.execute(
            "INSERT OR REPLACE INTO CHARACTER_INFO (character, collect_dir) VALUES (?, ?)",
            params![character_name, dir],
        )?;
    } else {
        tx.execute(
            "INSERT INTO CHARACTER_INFO (character) SELECT ? WHERE NOT EXISTS (SELECT 1 FROM CHARACTER_INFO WHERE character = ?)",
            params![character_name, character_name],
        )?;
    }
    Ok(())
}

pub fn delete_unused_character_info(
    tx: &rusqlite::Transaction,
    old_names: &HashSet<Option<String>>,
) -> Result<()> {
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
        params![serde_json::to_string(old_names)?],
    )?;
    Ok(())
}

pub fn process_add_remove_tags(
    edit_tags: Vec<EditTag>,
    update_linked_files: bool,
    conn: &mut Connection,
) -> Result<()> {
    let tx = conn.transaction()?;

    // 一時テーブル作成
    let init_sql = include_str!("../sql/catalog/init_temp_edit_tags.sql");
    tx.execute_batch(&init_sql)?;

    // 全データを tmp_edit_tags に投入
    for edit in edit_tags {
        let file_info = parse_file_info(&edit.file_name)?;
        let control_num: i32 = tx.query_row(
            "SELECT control_num FROM ILLUST_INFO WHERE illust_id = ? AND suffix = ?",
            params![file_info.illust_id, file_info.suffix],
            |row| row.get(0),
        )?;

        for tag in edit.tags {
            tx.execute(
                "INSERT INTO tmp_edit_tags (illust_id, suffix, control_num, tag) VALUES (?, ?, ?, ?)",
                params![file_info.illust_id, file_info.suffix, control_num, tag],
            )?;
        }
    }

    // 洗い替え
    let overwrite_sql = if update_linked_files {
        include_str!("../sql/catalog/overwrite_tags_linked.sql")
    } else {
        include_str!("../sql/catalog/overwrite_tags_individual.sql")
    };
    tx.execute_batch(&overwrite_sql)?;

    tx.commit()?;
    Ok(())
}

pub fn process_overwrite_tags(
    file_names: Vec<String>,
    tags: Vec<String>,
    update_linked_files: bool,
    conn: &mut Connection,
) -> Result<()> {
    let tx = conn.transaction()?;

    // 一時テーブル作成
    let init_sql = include_str!("../sql/catalog/init_temp_edit_tags.sql");
    tx.execute_batch(&init_sql)?;

    // 全データを tmp_edit_tags に投入
    for file_name in file_names {
        let file_info = parse_file_info(&file_name)?;
        let control_num: i32 = tx.query_row(
            "SELECT control_num FROM ILLUST_INFO WHERE illust_id = ? AND suffix = ?",
            params![file_info.illust_id, file_info.suffix],
            |row| row.get(0),
        )?;

        for tag in &tags {
            tx.execute(
                "INSERT INTO tmp_edit_tags (illust_id, suffix, control_num, tag) VALUES (?, ?, ?, ?)",
                params![file_info.illust_id, file_info.suffix, control_num, tag],
            )?;
        }
    }

    // 洗い替え
    let overwrite_sql = if update_linked_files {
        include_str!("../sql/catalog/overwrite_tags_linked.sql")
    } else {
        include_str!("../sql/catalog/overwrite_tags_individual.sql")
    };
    tx.execute_batch(&overwrite_sql)?;

    tx.commit()?;
    Ok(())
}
