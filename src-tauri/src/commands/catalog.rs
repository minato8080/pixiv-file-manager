use tauri::{command, State};
use trash::delete;

use crate::{
    models::{
        catalog::{AssociateInfo, EditTag},
        common::AppState,
    },
    named_params,
    service::{
        catalog::{
            process_add_remove_tags, process_get_associated_info, process_label_character_name,
            process_move_files, process_overwrite_tags,
        },
        common::{execute_named_queries, log_error, parse_file_info},
    },
};

#[command]
pub async fn move_files(
    state: State<'_, AppState>,
    file_names: Vec<String>,
    target_folder: &str,
    move_linked_files: bool,
) -> Result<(), String> {
    let mut pool = &state.pool;
    process_move_files(&mut pool, file_names, target_folder, move_linked_files)
        .await
        .map_err(log_error)?;
    Ok(())
}

#[command]
pub async fn label_character_name(
    state: State<'_, AppState>,
    file_names: Vec<String>,
    character_name: Option<String>,
    update_linked_files: bool,
    collect_dir: Option<String>,
) -> Result<(), String> {
    let mut pool = &state.pool;
    process_label_character_name(
        &mut pool,
        &file_names,
        character_name.as_deref(),
        update_linked_files,
        collect_dir.as_deref(),
    )
    .await
    .map_err(log_error)?;

    // ファイル移動など副作用はコミット後に
    if let Some(dir) = collect_dir {
        process_move_files(&mut pool, file_names, &dir, update_linked_files)
            .await
            .map_err(log_error)?;
    }

    Ok(())
}

#[command]
pub async fn add_remove_tags(
    edit_tags: Vec<EditTag>,
    update_linked_files: bool,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut pool = &state.pool;
    process_add_remove_tags(edit_tags, update_linked_files, &mut pool)
        .await
        .map_err(log_error)?;
    Ok(())
}

#[command]
pub async fn overwrite_tags(
    file_names: Vec<String>,
    tags: Vec<String>,
    update_linked_files: bool,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut pool = &state.pool;
    process_overwrite_tags(file_names, tags, update_linked_files, &mut pool)
        .await
        .map_err(log_error)?;
    Ok(())
}

#[command]
pub async fn delete_files(
    state: State<'_, AppState>,
    file_names: Vec<String>,
) -> Result<(), String> {
    let pool = &state.pool;
    let mut tx = pool.begin().await.map_err(log_error)?;

    for file_name in file_names {
        let file_info = parse_file_info(file_name.as_str()).map_err(log_error)?;

        // 1. save_dir, cnum を取得
        let (save_dir, cnum): (String, i32) = sqlx::query_as(
            "SELECT save_dir, cnum FROM ILLUST_INFO WHERE illust_id = ? AND suffix = ?",
        )
        .bind(file_info.illust_id)
        .bind(file_info.suffix)
        .fetch_one(&mut *tx)
        .await
        .map_err(log_error)?;

        // 2. ファイル削除
        let source_path = std::path::Path::new(&save_dir).join(&file_name);
        delete(source_path).map_err(log_error)?;

        // 3. ILLUST_INFO の削除と TAG_INFO と ILLUST_DETAIL の後処理
        let delete_sql = include_str!("../sql/catalog/delete_file_registration.sql");

        execute_named_queries(
            &mut *tx,
            delete_sql,
            &named_params!( {
            ":illust_id"=> file_info.illust_id as i64,
            ":suffix"=> file_info.suffix as i64,
            ":cnum"=> cnum as i64 }),
        )
        .await
        .map_err(log_error)?;
    }

    tx.commit().await.map_err(log_error)?;
    Ok(())
}

#[command]
pub async fn get_associated_info(
    state: State<'_, AppState>,
    file_names: Vec<String>,
) -> Result<AssociateInfo, String> {
    let pool = &state.pool;
    Ok(process_get_associated_info(&pool, file_names)
        .await
        .map_err(|e| e.to_string())?)
}
