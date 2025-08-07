#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod api;
mod commands;
mod constants;
mod models;
mod service;

use commands::catalog::{
    delete_files, edit_tags, get_associated_info, label_character_name, move_files,
};
use commands::collect::{assign_tag, get_root, load_assignments, set_root};
use rusqlite::{params, Connection, Result};
use std::sync::Mutex;
use tauri::Manager;

use commands::fetch::{capture_illust_detail, count_files_in_dir};
use commands::search::{
    get_search_history, get_unique_authors, get_unique_characters, get_unique_tags,
    search_by_criteria,
};
use constants::DB_NAME;
use models::global::AppState;

use crate::api::pixiv::create_api;
use crate::commands::collect::{delete_collect, get_related_tags, perform_collect};
use crate::commands::fetch::recapture_illust_detail;

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
                // Initialize database
                let tx = conn.transaction().map_err(|e| {
                    eprintln!("{}", e);
                    e.to_string()
                })?;
                initialize_db(&tx).unwrap();
            }

            app.manage(AppState {
                db: Mutex::new(conn),
                app_pixiv_api,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_unique_tags,
            search_by_criteria,
            get_search_history,
            capture_illust_detail,
            recapture_illust_detail,
            get_unique_characters,
            get_unique_authors,
            move_files,
            label_character_name,
            edit_tags,
            delete_files,
            count_files_in_dir,
            get_associated_info,
            load_assignments,
            get_related_tags,
            assign_tag,
            delete_collect,
            perform_collect,
            get_root,
            set_root,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn initialize_db(conn: &Connection) -> Result<()> {
    let sql = include_str!("./sql/initialize_db.sql");
    conn.execute_batch(sql)?;

    conn.execute(
        "INSERT OR IGNORE INTO AUTHOR_INFO (author_id, author_name, author_account) VALUES (?1, ?2, ?3)",
        params![0, "Missing", "Missing"],
    )?;

    Ok(())
}
