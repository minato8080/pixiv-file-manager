use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Serialize, Deserialize, Clone, TS)]
#[ts(export)]
pub struct SearchResult {
    pub id: u32,
    pub file_name: String,
    pub thumbnail_url: String,
    pub author: AuthorInfo,
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
    pub condition: String,
    pub timestamp: String,
    pub result_count: u8,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TagInfo {
    pub id: u32,
    pub tag: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, TS)]
#[ts(export)]
pub struct UniqueTagList {
    pub tag: String,
    pub count: u8,
}

#[derive(Debug, Serialize, Deserialize, Clone, TS)]
#[ts(export)]
pub struct AuthorInfo {
    pub author_id: u32,
    pub author_name: String,
    pub author_account: String,
    pub count: Option<u8>,
}

#[derive(Debug, Serialize, Deserialize, Clone, TS)]
#[ts(export)]
pub struct CharacterInfo {
    pub character: String,
    pub count: Option<u8>,
}
