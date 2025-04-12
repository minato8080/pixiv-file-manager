use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    pub id: i64,
    pub file_name: String,
    pub thumbnail_url: String,
    pub author: AuthorInfo,
    pub character: Option<String>,
    pub save_dir: String,
    pub update_time: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchHistoryItem {
    pub tags: Vec<String>,
    pub character: Option<String>,
    pub author: Option<AuthorInfo>,
    pub condition: String,
    pub timestamp: String,
    pub result_count: i32,
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuthorInfo {
    pub author_id: i32,
    pub author_name: String,
    pub author_account: String,
}