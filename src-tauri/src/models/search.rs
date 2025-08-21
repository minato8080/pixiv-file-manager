use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Serialize, Deserialize, Clone, TS)]
#[ts(export)]
pub struct SearchResult {
    pub id: u32,
    pub file_name: String,
    pub thumbnail_url: String,
    pub author_name: String,
    pub character: Option<String>,
    pub save_dir: String,
    pub update_time: String,
    pub tags: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, TS)]
#[ts(export)]
pub struct SearchHistory {
    pub tags: Vec<String>,
    pub character: Option<String>,
    pub author: Option<AuthorInfo>,
    pub timestamp: String,
    pub result_count: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone, TS)]
#[ts(export)]
pub struct TagInfo {
    pub tag: String,
    pub count: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone, TS)]
#[ts(export)]
pub struct AuthorInfo {
    pub author_id: u32,
    pub author_name: String,
    pub author_account: String,
    pub count: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone, TS)]
#[ts(export)]
pub struct CharacterInfo {
    pub character: String,
    pub count: Option<u32>,
}
