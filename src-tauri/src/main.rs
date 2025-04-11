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
// use windows::Win32::System::Com::*;

use commands::fetch::process_capture_illust_detail;
use commands::search::{
    get_search_history, get_unique_tag_list, save_search_history, search_by_tags,
};
use constants::DB_PATH;
use models::global::AppState;
use models::pixiv::{PixivApi, RealPixivApi};

fn main() {
    // COMの初期化
    // unsafe {
    //     if let Err(e) = CoInitializeEx(None, COINIT_MULTITHREADED).ok() {
    //         eprintln!("COM initialization failed: {:?}", e);
    //         return;
    //     }
    // }

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
            search_by_tags,
            get_search_history,
            save_search_history,
            process_capture_illust_detail
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    // COMの終了処理
    // unsafe {
    //     CoUninitialize();
    // }
}
fn initialize_db(conn: &Connection) -> Result<()> {
    // テーブルが存在しない場合は作成
    conn.execute(
        "CREATE TABLE IF NOT EXISTS ID_DETAIL (
            id INTEGER NOT NULL,
            suffix INTEGER,
            extension TEXT NOT NULL,
            author_name TEXT NOT NULL,
            author_account TEXT NOT NULL,
            character TEXT,
            save_dir TEXT NOT NULL,
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
        "CREATE TABLE IF NOT EXISTS DB_INFO (
            update_time TEXT NOT NULL
        )",
        [],
    )?;

    Ok(())
}
