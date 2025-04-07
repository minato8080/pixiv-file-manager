#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
mod models;
mod constants;

use crate::commands::search::{
    get_all_tags, get_search_history, save_search_history, search_by_tags,
};
use crate::commands::fetch_tags::process_capture_tags_info;
use crate::models::global::AppState;
use rusqlite::{Connection, Result};
use std::sync::Mutex;
use tauri::Manager;
use crate::constants::DB_PATH;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app: &mut tauri::App| {
            // DB_PATH = app.path().app_data_dir().unwrap().join("pixiv.db");
            // let db_path = DB_PATH;

            // Create directory if it doesn't exist
            if let Some(parent) = DB_PATH.parent() {
                std::fs::create_dir_all(parent).unwrap();
            }

            let conn = Connection::open(DB_PATH.clone()).unwrap();

            // Initialize database
            initialize_db(&conn).unwrap();

            app.manage(AppState {
                db: Mutex::new(conn),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_all_tags,
            search_by_tags,
            get_search_history,
            save_search_history,
            process_capture_tags_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
fn initialize_db(conn: &Connection) -> Result<()> {
    // テーブルが存在しない場合は作成
    conn.execute(
        "CREATE TABLE IF NOT EXISTS ID_DETAIL (
            id INTEGER PRIMARY KEY,
            suffix INTEGER,
            author TEXT,
            character TEXT,
            save_dir TEXT
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS TAG_INFO (
            id INTEGER PRIMARY KEY,
            tag TEXT NOT NULL UNIQUE
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS DB_INFO (
            update_time TEXT
        )",
        [],
    )?;

    Ok(())
}
