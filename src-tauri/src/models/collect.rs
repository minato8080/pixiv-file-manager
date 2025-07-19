use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
pub struct TagAssignment {
    pub id: Option<i32>,
    pub series: String,
    pub character: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export)]
pub struct CollectSummary {
    pub id: i32,
    pub series: String,
    pub character: String,
    pub before_count: i32,
    pub after_count: i32,
    pub new_path: Option<String>,
    pub is_new: bool,
}
