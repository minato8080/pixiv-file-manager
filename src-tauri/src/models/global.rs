use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TagInfo {
    pub id: i64,
    pub tag: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GetUniqueTagListResp {
    pub tag: String,
}

pub struct AppState {
    pub db: Mutex<Connection>,
}
