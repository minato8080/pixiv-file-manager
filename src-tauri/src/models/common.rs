use pixieve_rs::pixiv::client::PixivClient;
use rusqlite::Connection;
use serde::Serialize;
use std::sync::Mutex;
use ts_rs::TS;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub app_pixiv_api: Option<PixivClient>,
}

#[derive(Serialize, TS)]
#[ts(export)]
pub struct GeneralResponse {
    pub success: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug)]
pub struct FileInfo {
    pub illust_id: u32,
    pub suffix: u8,
    pub extension: String,
    pub save_dir: Option<String>,
}
