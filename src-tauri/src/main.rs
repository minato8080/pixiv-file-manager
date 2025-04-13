#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod api;
mod commands;
mod constants;
mod models;

use rusqlite::{Connection, Result};
use std::sync::Mutex;
use tauri::Manager;

use commands::fetch::process_capture_illust_detail;
use commands::search::{
    get_search_history, get_unique_authors, get_unique_characters, get_unique_tag_list,
    search_by_criteria,
};
use constants::DB_NAME;
use models::global::AppState;
use models::pixiv::{PixivApi, RealPixivApi};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app: &mut tauri::App| {
            let db_path = app.path().app_data_dir().unwrap().join(DB_NAME);
            let conn = Connection::open(db_path).unwrap();
            let app_pixiv_api = RealPixivApi::create_api().unwrap();

            // Initialize database
            initialize_db(&conn).unwrap();

            app.manage(AppState {
                db: Mutex::new(conn),
                app_pixiv_api: app_pixiv_api,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_unique_tag_list,
            search_by_criteria,
            get_search_history,
            process_capture_illust_detail,
            get_unique_characters,
            get_unique_authors,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
fn initialize_db(conn: &Connection) -> Result<()> {
    // テーブルが存在しない場合は作成
    conn.execute(
        "CREATE TABLE IF NOT EXISTS ID_DETAIL (
            id INTEGER NOT NULL,
            suffix INTEGER,
            extension TEXT NOT NULL,
            author_id INTEGER NOT NULL,
            character TEXT,
            save_dir TEXT,
            PRIMARY KEY (id, suffix)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS TAG_INFO (
            id INTEGER NOT NULL,
            tag TEXT NOT NULL,
            PRIMARY KEY (id, tag)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS CHARACTER_INFO (
            character TEXT NOT NULL,
            save_dir TEXT,
            PRIMARY KEY (character)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS AUTHOR_INFO (
            author_id INTEGER NOT NULL,
            author_name TEXT NOT NULL,
            author_account TEXT NOT NULL,
            PRIMARY KEY (author_id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS SEARCH_HISTORY (
            tags TEXT NOT NULL,
            character TEXT,
            author TEXT,
            condition TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            result_count INTEGER NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS DB_INFO (
            update_time TEXT NOT NULL
        )",
        [],
    )?;

    Ok(())
}
