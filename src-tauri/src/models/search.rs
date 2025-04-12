use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    pub id: i64,
    pub file_name: String,
    pub thumbnail_url: String,
    pub author: String,
    pub character: Option<String>,
    pub save_dir: String,
    pub update_time: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchHistoryItem {
    pub id: i64,
    pub tags: Vec<TagInfo>,
    pub condition: String,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TagInfo {
    pub id: i64,
    pub tag: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GetUniqueTagListResp {
    pub tag: String,
    pub count: i32,
}