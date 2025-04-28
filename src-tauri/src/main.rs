#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod api;
mod commands;
mod constants;
mod models;

use commands::catalog::{delete_files, edit_tags, label_character_name, move_files};
use rusqlite::{Connection, Result};
use std::sync::Mutex;
use tauri::Manager;

use commands::fetch::{count_files_in_dir, process_capture_illust_detail};
use commands::search::{
    get_search_history, get_unique_authors, get_unique_characters, get_unique_tag_list,
    search_by_criteria,
};
use constants::DB_NAME;
use models::global::AppState;
use models::pixiv::{PixivApi, RealPixivApi};

fn main() {
    dotenv::dotenv().ok();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app: &mut tauri::App| {
            let db_path = app.path().app_data_dir().unwrap().join(format!(
                "{}.db",
                std::env::var("DB_NAME").unwrap_or_else(|_| DB_NAME.to_string())
            ));
            let conn = Connection::open(db_path).unwrap();
            let app_pixiv_api = RealPixivApi::create_api().unwrap();

            // Initialize database
            initialize_db(&conn).unwrap();

            app.manage(AppState {
                db: Mutex::new(conn),
                app_pixiv_api,
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
            move_files,
            label_character_name,
            edit_tags,
            delete_files,
            count_files_in_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn initialize_db(conn: &Connection) -> Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS ILLUST_INFO (
            illust_id INTEGER NOT NULL,
            suffix INTEGER NOT NULL,
            extension TEXT NOT NULL,
            author_id INTEGER NOT NULL,
            character TEXT,
            save_dir TEXT,
            control_num INTEGER NOT NULL,
            PRIMARY KEY (illust_id, suffix)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS ILLUST_INFO_WORK (
            illust_id INTEGER NOT NULL,
            suffix INTEGER NOT NULL,
            extension TEXT NOT NULL,
            save_dir TEXT NOT NULL,
            created_time INTEGER NOT NULL,
            file_size INTEGER NOT NULL,
            delete_flg INTEGER NOT NULL,
            insert_flg INTEGER NOT NULL,
            ignore_flg INTEGER NOT NULL,
            PRIMARY KEY (illust_id, suffix, extension, save_dir)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS TAG_INFO (
            illust_id INTEGER NOT NULL,
            control_num INTEGER NOT NULL,
            tag TEXT NOT NULL,
            PRIMARY KEY (illust_id, control_num, tag)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS CHARACTER_INFO (
            character TEXT NOT NULL,
            collect_dir TEXT,
            series TEXT,
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
            author_info TEXT,
            condition TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            result_count INTEGER NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS DB_INFO (
            root TEXT
        )",
        [],
    )?;

    Ok(())
}
