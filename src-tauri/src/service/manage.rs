use crate::models::manage::{ExecuteResult, TagFixRuleAction};
use anyhow::{Context, Result};
use chrono::Utc;
use rusqlite::params;

pub fn validate_and_insert_tag_fix_rule(
    conn: &rusqlite::Connection,
    src_tag: &str,
    dst_tag: Option<&str>,
    action_type: TagFixRuleAction,
) -> Result<()> {
    if action_type == TagFixRuleAction::Add {
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM TAG_FIX_RULES WHERE src_tag = ?1 AND action_type != 0",
                params![src_tag],
                |row| row.get(0),
            )
            .context("Failed to query conflicting rules")?;

        if count > 0 {
            anyhow::bail!(
                "src_tag '{}' already has replace/delete rules, cannot add 'add' rule",
                src_tag
            );
        }
    } else {
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM TAG_FIX_RULES WHERE src_tag = ?1 AND action_type = 0",
                params![src_tag],
                |row| row.get(0),
            )
            .context("Failed to query conflicting rules")?;

        if count > 0 {
            anyhow::bail!(
                "src_tag '{}' already has 'add' rules, cannot add replace/delete rule",
                src_tag
            );
        }
    }

    let now = Utc::now().timestamp();

    conn.execute(
        "INSERT INTO TAG_FIX_RULES (src_tag, dst_tag, action_type, created_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![src_tag, dst_tag, action_type as i64, now],
    )
    .context("Failed to insert tag fix rule")?;

    Ok(())
}

pub fn apply_tag_fix_rules(conn: &rusqlite::Connection) -> Result<ExecuteResult> {
    let sql = include_str!("../sql/manage/apply_tag_fix_rules.sql");
    conn.execute_batch(sql)?;

    // カウンター取得
    let (replaced, deleted, added) = conn.query_row(
        "SELECT replaced, deleted, added FROM tag_fix_counts LIMIT 1",
        [],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    )?;

    Ok(ExecuteResult {
        replaced,
        deleted,
        added,
        total_updated: replaced + deleted + added,
    })
}
