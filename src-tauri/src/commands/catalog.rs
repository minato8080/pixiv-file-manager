use rusqlite::params;
use tauri::{command, State};
use trash::delete;

use crate::{
    models::{
        catalog::{AssociateInfo, EditTag},
        common::AppState,
    },
    service::{
        catalog::{
            process_add_remove_tags, process_get_associated_info, process_label_character_name,
            process_move_files, process_overwrite_tags,
        },
        common::parse_file_info,
    },
};

#[command]
pub fn move_files(
    state: State<AppState>,
    file_names: Vec<String>,
    target_folder: &str,
    move_linked_files: bool,
) -> Result<(), String> {
    let mut conn = state.db.lock().unwrap();
    process_move_files(&mut conn, file_names, target_folder, move_linked_files)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub fn label_character_name(
    state: State<AppState>,
    file_names: Vec<String>,
    character_name: Option<String>,
    update_linked_files: bool,
    collect_dir: Option<String>,
) -> Result<(), String> {
    let mut conn = state.db.lock().unwrap();
    process_label_character_name(
        &mut conn,
        &file_names,
        character_name.as_deref(),
        update_linked_files,
        collect_dir.as_deref(),
    )
    .map_err(|e| e.to_string())?;

    // ファイル移動など副作用はコミット後に
    if let Some(dir) = collect_dir {
        process_move_files(&mut conn, file_names, &dir, update_linked_files)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[command]
pub fn add_remove_tags(
    edit_tags: Vec<EditTag>,
    update_linked_files: bool,
    state: State<AppState>,
) -> Result<(), String> {
    let mut conn = state.db.lock().unwrap();
    process_add_remove_tags(edit_tags, update_linked_files, &mut conn)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub fn overwrite_tags(
    file_names: Vec<String>,
    tags: Vec<String>,
    update_linked_files: bool,
    state: State<AppState>,
) -> Result<(), String> {
    let mut conn = state.db.lock().unwrap();
    process_overwrite_tags(file_names, tags, update_linked_files, &mut conn)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub fn delete_files(state: State<AppState>, file_names: Vec<String>) -> Result<(), String> {
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let delete_sql = include_str!("../sql/catalog/delete_file_registration.sql");

    for file_name in file_names {
        let file_info = parse_file_info(file_name.as_str()).map_err(|e| e.to_string())?;

        // 1. save_dir, cnum を取得
        let (save_dir, cnum): (String, i32) = tx
            .query_row(
                "SELECT save_dir, cnum FROM ILLUST_INFO WHERE illust_id = ? AND suffix = ?",
                params![file_info.illust_id, file_info.suffix],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|e| e.to_string())?;

        // 2. ファイル削除
        let source_path = std::path::Path::new(&save_dir).join(&file_name);
        delete(source_path).map_err(|e| e.to_string())?;

        // 3. ILLUST_INFO の削除と TAG_INFO と ILLUST_DETAIL の後処理
        tx.execute_batch(
            &delete_sql
                .replace(":illust_id", &file_info.illust_id.to_string())
                .replace(":suffix", &file_info.suffix.to_string())
                .replace(":cnum", &cnum.to_string()),
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub fn get_associated_info(
    state: State<AppState>,
    file_names: Vec<String>,
) -> Result<AssociateInfo, String> {
    let conn = state.db.lock().unwrap();
    Ok(process_get_associated_info(&conn, file_names).map_err(|e| e.to_string())?)
}
