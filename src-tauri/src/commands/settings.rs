use serde::{de::DeserializeOwned, Serialize};
use serde_json::Value;
use std::{collections::HashMap, fs, path::PathBuf};
use tauri::{command, Manager};

use crate::models::settings::EnvConfig;

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

fn get_config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| e.to_string())
        .map(|p| p.join(".env"))
}

fn from_map<T: DeserializeOwned>(map: HashMap<String, String>) -> Result<T, String> {
    serde_json::from_value(serde_json::to_value(map).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())
}

fn to_env_string<T: Serialize>(cfg: &T) -> String {
    match serde_json::to_value(cfg) {
        Ok(Value::Object(map)) => map
            .into_iter()
            .map(|(k, v)| {
                let val_str = v.as_str().map_or_else(|| v.to_string(), |s| s.to_string());
                format!("{}={}", k.to_uppercase(), val_str)
            })
            .collect::<Vec<_>>()
            .join("\n"),
        _ => String::new(),
    }
}
