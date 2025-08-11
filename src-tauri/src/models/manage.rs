use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Serialize, Deserialize, Clone, Copy, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum TagFixRuleAction {
    Add,
    Replace,
    Delete,
}

#[derive(Debug, Serialize, Deserialize, Clone, TS)]
#[ts(export)]
pub struct TagFixRule {
    pub id: i32,
    pub src_tag: String,
    pub dst_tag: Option<String>,
    pub action_type: TagFixRuleAction,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, TS)]
#[ts(export)]
pub struct ExecuteResult {
    pub added: i32,
    pub replaced: i32,
    pub deleted: i32,
    pub total_updated: i32,
}
