use rusqlite::params;
use tauri::{command, Emitter, State};

use crate::{
    models::{
        common::AppState,
        manage::{ExecuteResult, TagFixRule, TagFixRuleAction},
        search::TagInfo,
    },
    service::{
        common::{format_unix_timestamp, log_error},
        manage::{apply_tag_fix_rules, validate_and_insert_tag_fix_rule},
    },
};

#[command]
pub fn get_tag_fix_rules(state: State<AppState>) -> Result<Vec<TagFixRule>, String> {
    let conn = state.db.lock().unwrap();
    let mut stmt = conn
        .prepare(
            "SELECT id, src_tag, dst_tag, action_type, created_at
             FROM TAG_FIX_RULES
             ORDER BY created_at DESC",
        )
        .map_err(|e| log_error(e.to_string()))?;
    let rules = stmt
        .query_map([], |row| {
            Ok(TagFixRule {
                id: row.get(0)?,
                src_tag: row.get(1)?,
                dst_tag: row.get(2)?,
                action_type: row.get::<_, i64>(3)?.try_into()?,
                created_at: format_unix_timestamp(row.get(4)?),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| log_error(e.to_string()))?;
    Ok(rules)
}

#[command]
pub fn add_tag_fix_rule(
    src_tag: String,
    dst_tag: Option<String>,
    action_type: TagFixRuleAction,
    state: State<AppState>,
) -> Result<(), String> {
    let conn = state.db.lock().unwrap();

    validate_and_insert_tag_fix_rule(&conn, &src_tag, dst_tag.as_deref(), action_type)
        .map_err(|e| e.to_string())
}

#[command]
pub fn update_tag_fix_rule(
    id: i64,
    src_tag: String,
    dst_tag: Option<String>,
    action_type: TagFixRuleAction,
    state: State<AppState>,
) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    conn.execute(
        "UPDATE TAG_FIX_RULES
         SET src_tag = ?1, dst_tag = ?2, action_type = ?3
         WHERE id = ?4",
        params![src_tag, dst_tag, action_type as i64, id],
    )
    .map_err(|e| log_error(e.to_string()))?;
    Ok(())
}

#[command]
pub fn delete_tag_fix_rule(id: i64, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    conn.execute("DELETE FROM TAG_FIX_RULES WHERE id = ?1", params![id])
        .map_err(|e| log_error(e.to_string()))?;
    Ok(())
}

#[command]
pub fn execute_tag_fixes(
    state: State<AppState>,
    window: tauri::Window,
) -> Result<ExecuteResult, String> {
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction().map_err(|e| log_error(e.to_string()))?;
    let result = apply_tag_fix_rules(&tx).map_err(|e| log_error(e.to_string()))?;
    tx.commit().map_err(|e| log_error(e.to_string()))?;
    // DB変更を通知
    window.emit("update_db", ()).unwrap();

    Ok(result)
}

#[command]
pub fn get_using_fix_rule_tags(state: State<AppState>) -> Result<Vec<TagInfo>, String> {
    let conn = state.db.lock().unwrap();

    let sql = include_str!("../sql/manage/get_using_fix_rule_tags.sql");
    let mut stmt = conn.prepare(sql).map_err(|e| log_error(e.to_string()))?;

    let iter = stmt
        .query_map([], |row| {
            Ok(TagInfo {
                tag: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| log_error(e.to_string()))?;

    let tags = iter.into_iter().filter_map(|tag| tag.ok()).collect();

    Ok(tags)
}
