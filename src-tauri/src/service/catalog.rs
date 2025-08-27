use anyhow::{anyhow, Result};
use rusqlite::{named_params, params, Connection};
use std::{
    collections::{HashMap, HashSet},
    fs,
    path::Path,
};

use crate::{
    models::catalog::{AssociateCharacter, AssociateInfo, AssociateSaveDir, EditTag},
    service::common::{execute_sqls, parse_file_info, remove_invalid_chars},
};

pub fn process_move_files(
    conn: &mut Connection,
    file_names: Vec<String>,
    target_folder: &str,
    move_linked_files: bool,
) -> Result<()> {
    let tx = conn.transaction()?;
    let mut updates = HashSet::new();
    // target_folderがない場合、作成
    if !Path::new(target_folder).exists() {
        fs::create_dir_all(target_folder)?;
    }

    // 更新用のデータを作成
    for file_name in &file_names {
        let file_info = parse_file_info(file_name.as_str())?;

        let cnum: i32 = tx.query_row(
            "SELECT cnum FROM ILLUST_INFO WHERE illust_id = ? AND suffix = ?",
            params![file_info.illust_id, file_info.suffix],
            |row| Ok(row.get(0)?),
        )?;

        if move_linked_files {
            updates.insert((file_info.illust_id, None, Some(cnum)));
        } else {
            updates.insert((file_info.illust_id, Some(file_info.suffix), None));
            // suffixで更新する
        }
    }

    // ILLUST_INFOを更新
    for (id, suffix_opt, cnum_opt) in updates {
        let mut update_sql = String::from("UPDATE ILLUST_INFO SET save_dir = ?");
        let mut param_vec: Vec<&dyn rusqlite::ToSql> = vec![&target_folder];

        if let Some(ref cnum) = cnum_opt {
            update_sql.push_str(" WHERE illust_id = ? AND cnum = ?");
            param_vec.push(&id);
            param_vec.push(cnum);
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

        if let Some(ref cnum) = cnum_opt {
            select_sql.push_str("cnum = ?");
            select_param_vec.push(cnum);
        } else if let Some(ref suffix) = suffix_opt {
            select_sql.push_str("suffix = ?");
            select_param_vec.push(suffix);
        } else {
            return Err(anyhow!("Either suffix or cnum is required"));
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
    tx.commit()?;

    Ok(())
}

pub fn process_label_character_name(
    conn: &mut Connection,
    file_names: &[String],
    character_name: Option<&str>,
    update_linked_files: bool,
    collect_dir: Option<&str>,
) -> Result<()> {
    let tx = conn.transaction()?;

    // 一時テーブルを準備
    let sql = include_str!("../sql/catalog/prepare_tmp_label_target.sql");
    tx.execute_batch(sql)?;

    {
        // データを挿入
        let sql = include_str!("../sql/catalog/insert_tmp_label_target.sql");
        let mut stmt = tx.prepare(sql)?;
        for file_name in file_names {
            let info = parse_file_info(file_name)?;
            stmt.execute(named_params! {
                ":illust_id": info.illust_id,
                ":suffix": info.suffix,
            })?;
        }
    }

    // charcter と cnumの更新
    let sql = if update_linked_files {
        include_str!("../sql/catalog/update_character_linked.sql").to_string()
    } else {
        include_str!("../sql/catalog/update_character_indivisual.sql").to_string()
            + include_str!("../sql/merge_cnum.sql")
    };
    let mut params: HashMap<&str, &dyn rusqlite::ToSql> = HashMap::new();
    params.insert(":character", &character_name);
    execute_sqls(&tx, &sql, &params)?;

    // CHARACTER_INFOの更新
    if let Some(character) = character_name {
        let sql = include_str!("../sql/catalog/update_character_info.sql");
        let mut params: HashMap<&str, &dyn rusqlite::ToSql> = HashMap::new();
        params.insert(":character", &character);
        params.insert(":collect", &collect_dir);
        execute_sqls(&tx, sql, &params)?;
    }
    tx.commit()?;

    Ok(())
}

pub fn process_add_remove_tags(
    edit_tags: Vec<EditTag>,
    update_linked_files: bool,
    conn: &mut Connection,
) -> Result<()> {
    let tx = conn.transaction()?;

    // 一時テーブル作成
    let init_sql = include_str!("../sql/catalog/prepare_tmp_edit_tags.sql");
    tx.execute_batch(&init_sql)?;

    // 全データを tmp_edit_tags に投入
    for edit in edit_tags {
        let file_info = parse_file_info(&edit.file_name)?;
        let cnum: i32 = tx.query_row(
            "SELECT cnum FROM ILLUST_INFO WHERE illust_id = ? AND suffix = ?",
            params![file_info.illust_id, file_info.suffix],
            |row| row.get(0),
        )?;

        for tag in &edit.tags {
            tx.execute(
                "INSERT INTO tmp_edit_tags (illust_id, suffix, cnum, tag) VALUES (?, ?, ?, ?)",
                params![
                    file_info.illust_id,
                    file_info.suffix,
                    cnum,
                    remove_invalid_chars(tag)
                ],
            )?;
        }
    }

    // 洗い替え
    let sql = if update_linked_files {
        include_str!("../sql/catalog/overwrite_tags_linked.sql").to_string()
    } else {
        include_str!("../sql/catalog/overwrite_tags_individual.sql").to_string()
            + include_str!("../sql/merge_cnum.sql")
    };
    tx.execute_batch(&sql)?;

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
    let init_sql = include_str!("../sql/catalog/prepare_tmp_edit_tags.sql");
    tx.execute_batch(&init_sql)?;

    // 全データを tmp_edit_tags に投入
    for file_name in file_names {
        let file_info = parse_file_info(&file_name)?;
        let cnum: i32 = tx.query_row(
            "SELECT cnum FROM ILLUST_INFO WHERE illust_id = ? AND suffix = ?",
            params![file_info.illust_id, file_info.suffix],
            |row| row.get(0),
        )?;

        for tag in &tags {
            tx.execute(
                "INSERT INTO tmp_edit_tags (illust_id, suffix, cnum, tag) VALUES (?, ?, ?, ?)",
                params![
                    file_info.illust_id,
                    file_info.suffix,
                    cnum,
                    remove_invalid_chars(tag)
                ],
            )?;
        }
    }

    // 洗い替え
    let sql = if update_linked_files {
        include_str!("../sql/catalog/overwrite_tags_linked.sql").to_string()
    } else {
        include_str!("../sql/catalog/overwrite_tags_individual.sql").to_string()
            + include_str!("../sql/merge_cnum.sql")
    };
    tx.execute_batch(&sql)?;

    tx.commit()?;
    Ok(())
}

pub fn process_get_associated_info(
    conn: &Connection,
    file_names: Vec<String>,
) -> Result<AssociateInfo> {
    if file_names.is_empty() {
        return Ok(AssociateInfo {
            characters: vec![],
            save_dirs: vec![],
        });
    }

    // ファイル名から (illust_id, suffix) を生成
    let values_placeholder: Vec<String> = file_names
        .iter()
        .map(|f| {
            let info = parse_file_info(f).unwrap();
            format!("({}, {})", info.illust_id, info.suffix)
        })
        .collect();
    let values_str = values_placeholder.join(", ");

    // SQL ファイルを読み込んで値を置換
    let sql_template = include_str!("../sql/catalog/get_associated_info.sql");
    let sql = sql_template.replace("{{VALUES_PLACEHOLDER}}", &values_str);
    conn.execute_batch(&sql)?;

    // 集計結果の取得
    let mut characters = vec![];
    let mut save_dirs = vec![];

    // character 集計
    let mut char_stmt = conn.prepare(
        "SELECT character, COUNT(DISTINCT key) AS count FROM tmp_associated_files GROUP BY character",
    )?;
    for row in char_stmt.query_map([], |row| {
        Ok(AssociateCharacter {
            character: row.get(0)?,
            count: row.get(1)?,
        })
    })? {
        characters.push(row?);
    }

    // save_dir 集計
    let mut dir_stmt = conn.prepare(
        "SELECT save_dir, COUNT(DISTINCT key) AS count FROM tmp_associated_files GROUP BY save_dir",
    )?;
    for row in dir_stmt.query_map([], |row| {
        Ok(AssociateSaveDir {
            save_dir: row.get(0)?,
            count: row.get(1)?,
        })
    })? {
        save_dirs.push(row?);
    }

    Ok(AssociateInfo {
        characters,
        save_dirs,
    })
}
