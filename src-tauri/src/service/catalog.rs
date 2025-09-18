use anyhow::{anyhow, Result};
use sqlx::{sqlite::SqliteArguments, Acquire, Arguments, SqlitePool};

use std::{collections::HashSet, fs, path::Path};

use crate::{ execute_queries, models::catalog::{AssociateCharacter, AssociateInfo, AssociateSaveDir, EditTag}, named_params, service::common::{execute_named_queries, parse_file_info, remove_invalid_chars}
};

pub async fn process_move_files(
    pool: &SqlitePool,
    file_names: Vec<String>,
    target_folder: &str,
    move_linked_files: bool,
) -> Result<()> {
    let mut tx = pool.begin().await?;
    let mut updates = HashSet::new();
    // target_folderがない場合、作成
    if !Path::new(target_folder).exists() {
        fs::create_dir_all(target_folder)?;
    }

    // 更新用のデータを作成
    for file_name in &file_names {
        let file_info = parse_file_info(file_name.as_str())?;

        let cnum: i32 =
            sqlx::query_scalar("SELECT cnum FROM ILLUST_INFO WHERE illust_id = ? AND suffix = ?")
                .bind(file_info.illust_id)
                .bind(file_info.suffix)
                .fetch_one(&mut *tx)
                .await?;

        if move_linked_files {
            updates.insert((file_info.illust_id, None, Some(cnum)));
        } else {
            updates.insert((file_info.illust_id, Some(file_info.suffix), None));
        }
    }

    // ILLUST_INFOを更新
    for (id, suffix_opt, cnum_opt) in updates {
        let mut update_sql = String::from("UPDATE ILLUST_INFO SET save_dir = ?");
        let mut update_arguments = SqliteArguments::default();
        update_arguments.add(&target_folder).map_err(|_|anyhow!("Failed to add argument"))?;

        if let Some(ref cnum) = cnum_opt {
            update_sql.push_str(" WHERE illust_id = ? AND cnum = ?");
            update_arguments.add(&id).map_err(|_|anyhow!("Failed to add argument"))?;
            update_arguments.add(cnum).map_err(|_|anyhow!("Failed to add argument"))?;
        } else {
            // suffix指定
            update_sql.push_str(" WHERE illust_id = ? AND suffix = ?");
            update_arguments.add(&id).map_err(|_|anyhow!("Failed to add argument"))?;
            update_arguments.add(&suffix_opt).map_err(|_|anyhow!("Failed to add argument"))?;
        }

        // 実体ファイル情報を取得
        let mut select_sql = String::from(
            "SELECT (illust_id || '_p' || suffix || '.' || extension) as file_name, save_dir FROM ILLUST_INFO WHERE illust_id = ? AND ",
        );

        let mut select_arguments = SqliteArguments::default();
        select_arguments.add(&id).map_err(|_|anyhow!("Failed to add argument"))?;

        if let Some(ref cnum) = cnum_opt {
            select_sql.push_str("cnum = ?");
            select_arguments.add(cnum).map_err(|_|anyhow!("Failed to add argument"))?;
        } else if let Some(ref suffix) = suffix_opt {
            select_sql.push_str("suffix = ?");
            select_arguments.add(suffix).map_err(|_|anyhow!("Failed to add argument"))?;
        } else {
            return Err(anyhow!("Either suffix or cnum is required"));
        }

        let file_names_to_update: Vec<(String, String)> =
            sqlx::query_as_with(&select_sql, select_arguments)
                .fetch_all(&mut *tx)
                .await?;

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
        sqlx::query_with(&update_sql, update_arguments)
            .execute(pool)
            .await?;
    }
    tx.commit().await?;

    Ok(())
}

pub async fn process_label_character_name(
    pool: &SqlitePool,
    file_names: &[String],
    character_name: Option<&str>,
    update_linked_files: bool,
    collect_dir: Option<&str>,
) -> Result<()> {
    let mut tx = pool.begin().await?;
    let conn = tx.acquire().await?;

    // 一時テーブルを準備
    let sql = include_str!("../sql/catalog/prepare_tmp_label_target.sql");
    execute_queries(&mut *conn, sql).await?;

    {
        // データを挿入
        let sql = include_str!("../sql/catalog/insert_tmp_label_target.sql");
        for file_name in file_names {
            let info = parse_file_info(file_name)?;
            execute_named_queries(&mut *tx,sql,&named_params!({
                ":illust_id"=> info.illust_id as i64,
                ":suffix"=> info.suffix as i64,
            })).await?;
        }
    }

    // charcter と cnumの更新
    let sql = if update_linked_files {
        include_str!("../sql/catalog/update_character_linked.sql").to_string()
    } else {
        include_str!("../sql/catalog/update_character_indivisual.sql").to_string()
            + include_str!("../sql/merge_cnum.sql")
    };
    execute_named_queries(&mut *tx, &sql, &named_params!({":character"=> character_name})).await?;

    // CHARACTER_INFOの更新
    if let Some(character) = character_name {
        let sql = include_str!("../sql/catalog/update_character_info.sql");
        execute_named_queries(&mut *tx, sql, &named_params!({
            ":character"=> character,
            ":collect"=> collect_dir
        })).await?;
    }
    tx.commit().await?;

    Ok(())
}

pub async fn process_add_remove_tags(
    edit_tags: Vec<EditTag>,
    update_linked_files: bool,
    pool: &SqlitePool,
) -> Result<()> {
    let mut tx = pool.begin().await?;
    let conn = tx.acquire().await?;

    // 一時テーブル作成
    let init_sql = include_str!("../sql/catalog/prepare_tmp_edit_tags.sql");
    execute_queries(&mut *conn, &init_sql).await?;

    // 全データを tmp_edit_tags に投入
    for edit in edit_tags {
        let file_info = parse_file_info(&edit.file_name)?;
        let cnum: i32 =
            sqlx::query_scalar("SELECT cnum FROM ILLUST_INFO WHERE illust_id = ? AND suffix = ?")
                .bind(file_info.illust_id)
                .bind(file_info.suffix)
                .fetch_one(&mut *conn)
                .await?;

        for tag in &edit.tags {
            sqlx::query(
                "INSERT INTO tmp_edit_tags (illust_id, suffix, cnum, tag) VALUES (?, ?, ?, ?)",
            )
            .bind(file_info.illust_id)
            .bind(file_info.suffix)
            .bind(cnum)
            .bind(remove_invalid_chars(tag))
            .execute(&mut *conn)
            .await?;
        }
    }

    // 洗い替え
    let sql = if update_linked_files {
        include_str!("../sql/catalog/overwrite_tags_linked.sql").to_string()
    } else {
        include_str!("../sql/catalog/overwrite_tags_individual.sql").to_string()
            + include_str!("../sql/merge_cnum.sql")
    };
    execute_queries(&mut *conn, &sql).await?;

    tx.commit().await?;
    Ok(())
}

pub async fn process_overwrite_tags(
    file_names: Vec<String>,
    tags: Vec<String>,
    update_linked_files: bool,
    pool: &SqlitePool,
) -> Result<()> {
    let mut tx = pool.begin().await?;
    let conn = tx.acquire().await?;

    // 一時テーブル作成
    let init_sql = include_str!("../sql/catalog/prepare_tmp_edit_tags.sql");
    execute_queries(&mut *conn, &init_sql).await?;

    // 全データを tmp_edit_tags に投入
    for file_name in file_names {
        let file_info = parse_file_info(&file_name)?;
        let cnum: i32 =
            sqlx::query_scalar("SELECT cnum FROM ILLUST_INFO WHERE illust_id = ? AND suffix = ?")
                .bind(file_info.illust_id)
                .bind(file_info.suffix)
                .fetch_one(&mut *conn)
                .await?;

        for tag in &tags {
            sqlx::query(
                "INSERT INTO tmp_edit_tags (illust_id, suffix, cnum, tag) VALUES (?, ?, ?, ?)",
            )
            .bind(file_info.illust_id)
            .bind(file_info.suffix)
            .bind(cnum)
            .bind(remove_invalid_chars(tag))
            .execute(&mut *conn)
            .await?;
        }
    }

    // 洗い替え
    let sql = if update_linked_files {
        include_str!("../sql/catalog/overwrite_tags_linked.sql").to_string()
    } else {
        include_str!("../sql/catalog/overwrite_tags_individual.sql").to_string()
            + include_str!("../sql/merge_cnum.sql")
    };
    execute_queries(&mut *conn, &sql).await?;

    tx.commit().await?;
    Ok(())
}

pub async fn process_get_associated_info(
    pool: &SqlitePool,
    file_names: Vec<String>,
) -> Result<AssociateInfo> {
    let mut conn = pool.acquire().await?;

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
    execute_queries(&mut *conn, &sql).await?;

    // character 集計
    let sql = 
        "SELECT character, COUNT(DISTINCT key) AS count FROM tmp_associated_files GROUP BY character";
    let characters: Vec<AssociateCharacter> = sqlx::query_as(sql).fetch_all(pool).await?;

    // save_dir 集計
    let sql = 
        "SELECT save_dir, COUNT(DISTINCT key) AS count FROM tmp_associated_files GROUP BY save_dir";
    let save_dirs: Vec<AssociateSaveDir> = sqlx::query_as(sql).fetch_all(pool).await?;

    Ok(AssociateInfo {
        characters,
        save_dirs,
    })
}
