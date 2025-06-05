use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize)]
pub struct TagAssignment {
    pub series_tag: Option<String>,
    pub character_tag: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export)]
pub struct CollectSummary {
    pub id: u32,
    pub series_tag: Option<String>,
    pub character_tag: Option<String>,
    pub before_count: i32,
    pub after_count: i32,
    pub new_path: Option<String>,
    pub is_new: bool,
}

#[derive(Serialize, Deserialize)]
pub struct CollectStats {
    pub before_uncollected: i32,
    pub after_uncollected: i32,
    pub total_assigned: i32,
}
