use anyhow::{anyhow, Result};
use sqlx::{error::BoxDynError, sqlite::SqliteArguments, Arguments, SqlitePool};

use std::{collections::HashSet, fs, path::Path};

use crate::{
    execute_queries,
    models::{
        catalog::{AssociateCharacter, AssociateInfo, AssociateSaveDir, EditTag},
        common::BindValue,
    },
    service::common::{
        execute_multi_insert_query, execute_named_queries, hash_params, parse_file_info,
        remove_invalid_chars,
    },
    util::ResultWithLocationExt,
};

pub async fn process_move_files(
    pool: &SqlitePool,
    file_names: Vec<String>,
    target_folder: &str,
    move_linked_files: bool,
) -> Result<(), BoxDynError> {
    let mut tx = pool.begin().await.with_location()?;
    let mut updates = HashSet::new();
    // target_folderがない場合、作成
    if !Path::new(target_folder).exists() {
        fs::create_dir_all(target_folder).with_location()?;
    }

    // 更新用のデータを作成
    for file_name in &file_names {
        let file_info = parse_file_info(file_name.as_str()).with_location()?;

        let cnum: i32 =
            sqlx::query_scalar("SELECT cnum FROM ILLUST_INFO WHERE illust_id = ? AND suffix = ?")
                .bind(file_info.illust_id)
                .bind(file_info.suffix)
                .fetch_one(&mut *tx)
                .await
                .with_location()?;

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
        update_arguments.add(&target_folder)?;

        if let Some(ref cnum) = cnum_opt {
            update_sql.push_str(" WHERE illust_id = ? AND cnum = ?");
            update_arguments.add(&id)?;
            update_arguments.add(cnum)?;
        } else {
            // suffix指定
            update_sql.push_str(" WHERE illust_id = ? AND suffix = ?");
            update_arguments.add(&id)?;
            update_arguments.add(&suffix_opt)?;
        }

        // 実体ファイル情報を取得
        let mut select_sql = String::from(
            "SELECT (illust_id || '_p' || suffix || '.' || extension) as file_name, save_dir FROM ILLUST_INFO WHERE illust_id = ? AND ",
        );

        let mut select_arguments = SqliteArguments::default();
        select_arguments.add(&id)?;

        if let Some(ref cnum) = cnum_opt {
            select_sql.push_str("cnum = ?");
            select_arguments.add(cnum)?;
        } else if let Some(ref suffix) = suffix_opt {
            select_sql.push_str("suffix = ?");
            select_arguments.add(suffix)?;
        } else {
            return Err(anyhow!("Either suffix or cnum is required").into());
        }

        let file_names_to_update: Vec<(String, String)> =
            sqlx::query_as_with(&select_sql, select_arguments)
                .fetch_all(&mut *tx)
                .await
                .with_location()?;

        // ファイルを移動
        for (file_name, save_dir) in file_names_to_update {
            let source_path = std::path::Path::new(&save_dir).join(&file_name);
            let target_path = std::path::Path::new(target_folder).join(&file_name);
            if source_path == target_path {
                continue;
            }
            std::fs::rename(&source_path, &target_path).with_location()?;
        }

        // DBを更新
        sqlx::query_with(&update_sql, update_arguments)
            .execute(&mut *tx)
            .await
            .with_location()?;
    }
    tx.commit().await.with_location()?;

    Ok(())
}

pub async fn process_label_character_name(
    pool: &SqlitePool,
    file_names: &[String],
    character_name: Option<&str>,
    update_linked_files: bool,
    collect_dir: Option<&str>,
) -> Result<()> {
    let mut tx = pool.begin().await.with_location()?;

    // 一時テーブルを準備
    let sql = include_str!("../sql/catalog/prepare_tmp_label_target.sql");

    execute_queries(&mut *tx, sql).await.with_location()?;

    {
        // データを挿入
        let sql = include_str!("../sql/catalog/insert_tmp_label_target.sql");

        for file_name in file_names {
            let f = parse_file_info(file_name).with_location()?;
            execute_named_queries(
                &mut *tx,
                sql,
                &hash_params(&vec![
                    (":illust_id", f.illust_id.into()),
                    (":suffix", f.suffix.into()),
                ])
                .with_location()?,
            )
            .await
            .with_location()?;
        }
    }

    // charcter と cnumの更新
    let sql = if update_linked_files {
        include_str!("../sql/catalog/update_character_linked.sql")
    } else {
        concat!(
            include_str!("../sql/catalog/update_character_indivisual.sql"),
            include_str!("../sql/merge_cnum.sql"),
        )
    };

    execute_named_queries(
        &mut *tx,
        sql,
        &hash_params(&vec![(":character", character_name.into())]).with_location()?,
    )
    .await
    .with_location()?;

    // CHARACTER_INFOの更新
    if let Some(character) = character_name {
        let sql = include_str!("../sql/catalog/update_character_info.sql");

        execute_named_queries(
            &mut *tx,
            sql,
            &hash_params(&vec![
                (":character", character.into()),
                (":collect", collect_dir.into()),
            ])
            .with_location()?,
        )
        .await
        .with_location()?;
    }

    tx.commit().await.with_location()?;

    Ok(())
}

pub async fn process_edit_tags(
    pool: &SqlitePool,
    edit_tags: Vec<EditTag>,
    update_linked_files: bool,
) -> Result<()> {
    let mut tx = pool.begin().await.with_location()?;

    // 一時テーブル作成
    let init_sql = include_str!("../sql/catalog/prepare_tmp_edit_tags.sql");
    execute_queries(&mut *tx, &init_sql).await.with_location()?;

    // データ投入
    for edit in edit_tags {
        let file_info = parse_file_info(&edit.file_name).with_location()?;
        let cnum: i32 =
            sqlx::query_scalar("SELECT cnum FROM ILLUST_INFO WHERE illust_id = ? AND suffix = ?")
                .bind(file_info.illust_id)
                .bind(file_info.suffix)
                .fetch_one(&mut *tx)
                .await
                .with_location()?;

        for tag in edit.tags {
            sqlx::query(
                "INSERT INTO tmp_edit_tags (illust_id, suffix, cnum, tag) VALUES (?, ?, ?, ?)",
            )
            .bind(file_info.illust_id)
            .bind(file_info.suffix)
            .bind(cnum)
            .bind(remove_invalid_chars(&tag))
            .execute(&mut *tx)
            .await
            .with_location()?;
        }
    }

    // 洗い替え
    let sql = if update_linked_files {
        include_str!("../sql/catalog/overwrite_tags_linked.sql")
    } else {
        concat!(
            include_str!("../sql/catalog/overwrite_tags_individual.sql"),
            include_str!("../sql/merge_cnum.sql"),
        )
    };

    execute_queries(&mut *tx, &sql).await.with_location()?;

    tx.commit().await.with_location()?;
    Ok(())
}

pub async fn process_get_associated_info(
    pool: &SqlitePool,
    file_names: Vec<String>,
) -> Result<AssociateInfo> {
    let mut tx = pool.begin().await.with_location()?;

    if file_names.is_empty() {
        return Ok(AssociateInfo {
            characters: vec![],
            save_dirs: vec![],
        });
    }

    let rows: Vec<_> = file_names
        .iter()
        .map(|f| {
            let p = parse_file_info(f).with_location()?;
            Ok::<Vec<BindValue>, anyhow::Error>(vec![p.illust_id.into(), p.suffix.into()])
        })
        .collect::<Result<Vec<_>, _>>()?;

    // 一時テーブルを準備
    let sql = include_str!("../sql/catalog/prepare_tmp_target_files.sql");
    execute_multi_insert_query(&mut *tx, sql, &rows)
        .await
        .with_location()?;

    //
    let sql = include_str!("../sql/catalog/prepare_tmp_associated_files.sql");
    execute_queries(&mut *tx, &sql).await.with_location()?;
    // character 集計
    let sql = "SELECT character, COUNT(DISTINCT key) AS count FROM tmp_associated_files GROUP BY character";
    let characters: Vec<AssociateCharacter> = sqlx::query_as(sql)
        .fetch_all(&mut *tx)
        .await
        .with_location()?;

    // save_dir 集計
    let sql =
        "SELECT save_dir, COUNT(DISTINCT key) AS count FROM tmp_associated_files GROUP BY save_dir";
    let save_dirs: Vec<AssociateSaveDir> = sqlx::query_as(sql)
        .fetch_all(&mut *tx)
        .await
        .with_location()?;

    tx.commit().await.with_location()?;

    Ok(AssociateInfo {
        characters,
        save_dirs,
    })
}
