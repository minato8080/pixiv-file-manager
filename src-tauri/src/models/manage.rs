use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Serialize, Deserialize, Clone, Copy, TS, PartialEq)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum TagFixRuleAction {
    Add,
    Replace,
    Delete,
}

#[derive(Debug)]
pub struct InvalidTagFixRuleAction(i64);

impl std::fmt::Display for InvalidTagFixRuleAction {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Invalid action_type value: {}", self.0)
    }
}

impl std::error::Error for InvalidTagFixRuleAction {}

impl TryFrom<i64> for TagFixRuleAction {
    type Error = InvalidTagFixRuleAction;

    fn try_from(v: i64) -> Result<Self, Self::Error> {
        match v {
            0 => Ok(TagFixRuleAction::Add),
            1 => Ok(TagFixRuleAction::Replace),
            2 => Ok(TagFixRuleAction::Delete),
            _ => Err(InvalidTagFixRuleAction(v)),
        }
    }
}

impl From<InvalidTagFixRuleAction> for rusqlite::Error {
    fn from(err: InvalidTagFixRuleAction) -> Self {
        rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Integer, Box::new(err))
    }
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
