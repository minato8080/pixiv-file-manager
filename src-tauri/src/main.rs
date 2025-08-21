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
    add_remove_tags, delete_files, get_associated_info, label_character_name, move_files,
    overwrite_tags,
};
use commands::collect::{
    assign_tag, delete_collect, delete_missing_illusts, get_available_unique_tags,
    get_related_tags, get_root, load_assignments, perform_collect, set_root, sync_db,
};
use commands::fetch::{capture_illust_detail, count_files_in_dir, recapture_illust_detail};
use commands::manage::{
    add_tag_fix_rule, delete_tag_fix_rule, execute_tag_fixes, get_tag_fix_rules,
    get_using_fix_rule_tags, update_tag_fix_rule,
};
use commands::search::{
    get_search_history, get_unique_authors, get_unique_characters, get_unique_tags,
    search_by_criteria, search_by_id,
};
use commands::settings::{get_environment_variables, save_environment_variables};
use models::common::AppState;
use rusqlite::{Connection, Result};
use std::sync::Mutex;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app: &mut tauri::App| {
            load_env_in_app_data_dir(app);

            let db_path = app.path().app_data_dir()?.join(format!(
                "{}.db",
                std::env::var("DB_NAME").unwrap_or_else(|_| "pixiv_def".to_string())
            ));

            let mut conn = match Connection::open(db_path) {
                Ok(c) => c,
                Err(err) => {
                    eprintln!("Failed to open database connection: {}", err);
                    std::process::exit(1);
                }
            };

            if let Err(e) = initialize_db(&mut conn) {
                eprintln!("Failed to initialize DB: {}", e);
                std::process::exit(1);
            }

            let app_pixiv_api = match create_api() {
                Ok(api) => Some(api),
                Err(e) => {
                    eprintln!("Failed to create API: {}", e);
                    None
                }
            };

            app.manage(AppState {
                db: Mutex::new(conn),
                app_pixiv_api,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // catalog
            delete_files,
            get_associated_info,
            label_character_name,
            move_files,
            add_remove_tags,
            overwrite_tags,
            // collect
            assign_tag,
            delete_collect,
            delete_missing_illusts,
            get_available_unique_tags,
            get_related_tags,
            get_root,
            load_assignments,
            perform_collect,
            set_root,
            sync_db,
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
            search_by_id,
            // settings
            get_environment_variables,
            save_environment_variables
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn initialize_db(conn: &mut Connection) -> Result<()> {
    // Initialize database
    let tx = conn.transaction()?;
    let sql = include_str!("./sql/initialize_db.sql");
    tx.execute_batch(sql)?;
    tx.commit()?;
    Ok(())
}

fn load_env_in_app_data_dir(app: &tauri::App) {
    match app.path().app_data_dir() {
        Ok(app_data_dir) => {
            let env_path = app_data_dir.join(".env");
            if dotenv::from_path(&env_path).is_err() {
                eprintln!("No .env file found at {:?}", env_path);
            }
        }
        Err(e) => {
            eprintln!("Failed to get app_data_dir: {}", e);
        }
    }
}
