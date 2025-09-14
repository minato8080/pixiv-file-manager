use std::collections::HashMap;
use std::fs;
use tauri::command;

use crate::models::settings::EnvConfig;
use crate::service::common::log_error;
use crate::service::setting::{
    from_map, get_config_path, process_pixiv_authorization, to_env_string,
};

#[command]
pub fn get_environment_variables(app: tauri::AppHandle) -> Result<Option<EnvConfig>, String> {
    let config_path = get_config_path(&app)?;

    dotenvy::from_path_iter(&config_path)
        .ok()
        .map(|iter| {
            let map: HashMap<String, String> = iter.filter_map(|item| item.ok()).collect();
            from_map(map)
        })
        .transpose()
}

#[command]
pub fn save_environment_variables(
    config: EnvConfig,
    app: tauri::AppHandle,
) -> Result<bool, String> {
    let config_path = get_config_path(&app)?;
    let env_str = to_env_string(&config);

    fs::write(config_path, env_str).map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(true)
}

#[command]
pub async fn pixiv_authorization(app: tauri::AppHandle) -> Result<String, String> {
    let refresh_token = process_pixiv_authorization(app)
        .await
        .map_err(|e| log_error(e.to_string()))?;
    Ok(refresh_token)
}
