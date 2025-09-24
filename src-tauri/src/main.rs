#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod api;
mod commands;
mod constants;
mod errors;
mod models;
mod service;
mod util;

use anyhow::{anyhow, Result};
use models::common::AppState;
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;

use crate::api::pixiv::RealPixivClientProvider;
use crate::commands::{catalog::*, collect::*, fetch::*, manage::*, search::*, settings::*};
use crate::service::common::execute_queries;
use crate::util::log_error;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(setup)
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
            init_pixiv_client,
            // manage
            get_tag_fix_rules,
            add_tag_fix_rule,
            update_tag_fix_rule,
            delete_tag_fix_rule,
            execute_tag_fixes,
            get_using_fix_rule_tags,
            // serch
            filter_dropdowns,
            get_unique_authors,
            get_unique_characters,
            get_unique_tags,
            search_by_criteria,
            search_by_id,
            // settings
            get_environment_variables,
            save_environment_variables,
            pixiv_authorization,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup<'a>(app: &'a mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    load_env(app);

    init_logger(app);

    let handle = app.handle().clone();

    if let Err(e) = tauri::async_runtime::block_on(init_app_state(handle)) {
        log_error(anyhow!("Failed to init app state: {}", e));
        std::process::exit(1);
    };

    Ok(())
}

fn load_env(app: &tauri::App) {
    match app.path().app_data_dir() {
        Ok(app_data_dir) => {
            let env_path = app_data_dir.join(".env");
            if dotenv::from_path(&env_path).is_err() {
                log_error(anyhow!("No .env file found at {:?}", env_path));
            }
        }
        Err(e) => {
            log_error(anyhow!("Failed to get app_data_dir: {}", e));
        }
    }
}

fn init_logger(app: &tauri::App) {
    let log_dir: PathBuf = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::current_dir().unwrap());
    std::fs::create_dir_all(&log_dir).ok();

    let log_file = log_dir.join("app.log");

    fern::Dispatch::new()
        .format(|out, msg, record| {
            out.finish(format_args!(
                "[{}][{}] {}",
                chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
                record.level(),
                msg
            ))
        })
        .level(log::LevelFilter::Error)
        .chain(fern::log_file(log_file).unwrap())
        .apply()
        .unwrap();
}

async fn init_app_state(app: tauri::AppHandle) -> Result<()> {
    let db_path = app.path().app_data_dir().unwrap().join(format!(
        "{}.db",
        std::env::var("DB_NAME").unwrap_or_else(|_| "pixiv_def".to_string())
    ));

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_path.to_string_lossy().to_string())
        .await?;

    init_db(&pool)
        .await
        .map_err(|e| anyhow!("Failed to initialize DB: {}", e))?;

    app.manage(AppState {
        pool,
        pixiv_client_provider: Arc::new(RealPixivClientProvider::new()),
    });

    Ok(())
}

async fn init_db(pool: &SqlitePool) -> Result<()> {
    let mut tx = pool.begin().await?;

    let sql = include_str!("./sql/initialize_db.sql");

    execute_queries(&mut tx, sql).await?;

    tx.commit().await?;

    Ok(())
}
