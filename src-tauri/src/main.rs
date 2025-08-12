#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod api;
mod commands;
mod constants;
mod models;
mod service;

use api::pixiv::create_api;
use commands::catalog::{
    delete_files, edit_tags, get_associated_info, label_character_name, move_files,
};
use commands::collect::{
    assign_tag, delete_collect, get_available_unique_tags, get_related_tags, get_root,
    load_assignments, perform_collect, set_root,
};
use commands::fetch::{capture_illust_detail, count_files_in_dir, recapture_illust_detail};
use commands::manage::{
    add_tag_fix_rule, delete_tag_fix_rule, execute_tag_fixes, get_tag_fix_rules,
    update_tag_fix_rule,
};
use commands::search::{
    get_search_history, get_unique_authors, get_unique_characters, get_unique_tags,
    search_by_criteria,
};
use constants::DB_NAME;
use models::common::AppState;
use rusqlite::{params, Connection, Result};
use std::sync::Mutex;
use tauri::Manager;

use crate::commands::manage::get_using_fix_rule_tags;

fn main() {
    dotenv::dotenv().ok();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app: &mut tauri::App| {
            let db_path = app.path().app_data_dir().unwrap().join(format!(
                "{}.db",
                std::env::var("DB_NAME").unwrap_or_else(|_| DB_NAME.to_string())
            ));
            let mut conn = Connection::open(db_path).unwrap_or_else(|err| {
                eprintln!("Failed to open database connection: {}", err);
                std::process::exit(1);
            });
            let app_pixiv_api = create_api().ok();

            {
                initialize_db(&mut conn).unwrap_or_else(|e| {
                    eprintln!("{}", e);
                    std::process::exit(1);
                });
            }

            app.manage(AppState {
                db: Mutex::new(conn),
                app_pixiv_api,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // catalog
            delete_files,
            edit_tags,
            get_associated_info,
            label_character_name,
            move_files,
            // collect
            assign_tag,
            delete_collect,
            get_available_unique_tags,
            get_related_tags,
            get_root,
            load_assignments,
            perform_collect,
            set_root,
            // fetch
            capture_illust_detail,
            count_files_in_dir,
            recapture_illust_detail,
            // manage
            get_tag_fix_rules,
            add_tag_fix_rule,
            update_tag_fix_rule,
            delete_tag_fix_rule,
            execute_tag_fixes,
            get_using_fix_rule_tags,
            // serch
            get_search_history,
            get_unique_authors,
            get_unique_characters,
            get_unique_tags,
            search_by_criteria,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn initialize_db(conn: &mut Connection) -> Result<()> {
    // Initialize database
    let tx = conn.transaction()?;
    let sql = include_str!("./sql/initialize_db.sql");
    tx.execute_batch(sql)?;

    tx.execute(
        "INSERT OR IGNORE INTO AUTHOR_INFO (author_id, author_name, author_account) VALUES (?1, ?2, ?3)",
        params![0, "Missing", "Missing"],
    )?;

    tx.commit()?;
    Ok(())
}
