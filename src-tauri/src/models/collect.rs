use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use ts_rs::TS;

#[derive(Serialize, Deserialize, TS)]
#[ts(export)]
pub struct TagAssignment {
    pub id: Option<i32>,
    pub series: Option<String>,
    pub character: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS, FromRow)]
#[ts(export)]
pub struct CollectSummary {
    pub id: i32,
    pub series: Option<String>,
    pub character: Option<String>,
    pub before_count: i32,
    pub after_count: i32,
    pub collect_dir: Option<String>,
    pub unsave: bool,
}

#[derive(Debug)]
pub struct TempFile {
    pub illust_id: u32,
    pub suffix: u8,
    pub extension: String,
    pub save_dir: String,
    pub path: String,
}

#[derive(Serialize, Deserialize, Debug, TS, FromRow)]
#[ts(export)]
pub struct FileSummary {
    pub illust_id: u32,
    pub suffix: u8,
    pub path: String,
}

#[derive(FromRow)]
pub struct MoveIllustFiles {
    pub illust_id: i64,
    pub suffix: i32,
    pub extension: String,
    pub src_dir: String,
    pub dest_dir: String,
}
