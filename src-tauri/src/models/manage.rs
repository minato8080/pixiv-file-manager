use serde::{Deserialize, Serialize};
use sqlx::{sqlite::Sqlite, Decode, FromRow, Type};
use std::error::Error as StdError;
use ts_rs::TS;

use crate::service::common::format_unix_timestamp;

#[derive(Debug, Serialize, Deserialize, Clone, Copy, TS, PartialEq)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum TagFixRuleAction {
    Add,
    Replace,
    Delete,
}

impl Type<Sqlite> for TagFixRuleAction {
    fn type_info() -> <Sqlite as sqlx::Database>::TypeInfo {
        <i64 as Type<Sqlite>>::type_info()
    }
}

impl<'r> Decode<'r, Sqlite> for TagFixRuleAction {
    fn decode(
        value: <Sqlite as sqlx::Database>::ValueRef<'r>,
    ) -> Result<Self, Box<dyn StdError + Send + Sync + 'static>> {
        let raw_value = <i64 as Decode<Sqlite>>::decode(value)?;

        Ok(TagFixRuleAction::try_from(raw_value).map_err(sqlx::Error::from)?)
    }
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

impl From<InvalidTagFixRuleAction> for sqlx::Error {
    fn from(err: InvalidTagFixRuleAction) -> Self {
        sqlx::Error::Decode(Box::new(err))
    }
}

#[derive(Debug, Clone, FromRow)]
pub struct TagFixRuleRaw {
    pub id: i32,
    pub src_tag: String,
    pub dst_tag: Option<String>,
    pub action_type: TagFixRuleAction,
    pub created_at: i64,
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

impl From<TagFixRuleRaw> for TagFixRule {
    fn from(raw_rule: TagFixRuleRaw) -> Self {
        TagFixRule {
            id: raw_rule.id,
            src_tag: raw_rule.src_tag,
            dst_tag: raw_rule.dst_tag,
            action_type: raw_rule.action_type,
            created_at: format_unix_timestamp(raw_rule.created_at),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, TS, FromRow)]
#[ts(export)]
pub struct TagFixResult {
    pub added: i32,
    pub replaced: i32,
    pub deleted: i32,
    pub total_updated: i32,
}
