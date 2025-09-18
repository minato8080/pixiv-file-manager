use tauri::{command, Emitter, State};

use crate::{
    models::{
        common::AppState,
        manage::{ExecuteResult, TagFixRule, TagFixRuleAction, TagFixRuleRaw},
        search::TagInfo,
    },
    service::{
        common::log_error,
        manage::{apply_tag_fix_rules, validate_and_insert_tag_fix_rule},
    },
};

#[command]
pub async fn get_tag_fix_rules(state: State<'_, AppState>) -> Result<Vec<TagFixRule>, String> {
    let pool = &state.pool;

    let raw_rules: Vec<TagFixRuleRaw> = sqlx::query_as(
        "SELECT id, src_tag, dst_tag, action_type, created_at
             FROM TAG_FIX_RULES
             ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(log_error)?;

    let rules: Vec<TagFixRule> = raw_rules.into_iter().map(TagFixRule::from).collect();

    Ok(rules)
}

#[command]
pub async fn add_tag_fix_rule(
    src_tag: String,
    dst_tag: Option<String>,
    action_type: TagFixRuleAction,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let pool = &state.pool;
    let conn = &mut pool.acquire().await.map_err(|e| e.to_string())?;

    validate_and_insert_tag_fix_rule(&mut *conn, &src_tag, dst_tag.as_deref(), action_type)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn update_tag_fix_rule(
    id: i64,
    src_tag: String,
    dst_tag: Option<String>,
    action_type: TagFixRuleAction,
    state: State<'_, AppState>,
) -> Result<(), String> {
    sqlx::query(
        "UPDATE TAG_FIX_RULES
         SET src_tag = ?1, dst_tag = ?2, action_type = ?3
         WHERE id = ?4",
    )
    .bind(src_tag)
    .bind(dst_tag)
    .bind(action_type as i64)
    .bind(id)
    .execute(&state.pool)
    .await
    .map_err(log_error)?;
    Ok(())
}

#[command]
pub async fn delete_tag_fix_rule(id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let pool = &state.pool;
    sqlx::query("DELETE FROM TAG_FIX_RULES WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await
        .map_err(log_error)?;
    Ok(())
}

#[command]
pub async fn execute_tag_fixes(
    state: State<'_, AppState>,
    window: tauri::Window,
) -> Result<ExecuteResult, String> {
    let pool = &state.pool;
    let mut tx = pool.begin().await.map_err(log_error)?;
    let result = apply_tag_fix_rules(&mut tx)
        .await
        .map_err(log_error)?;
    tx.commit().await.map_err(log_error)?;
    // DB変更を通知
    window.emit("update_db", ()).unwrap();

    Ok(result)
}

#[command]
pub async fn get_using_fix_rule_tags(state: State<'_, AppState>) -> Result<Vec<TagInfo>, String> {
    let pool = &state.pool;

    let sql = include_str!("../sql/manage/get_using_fix_rule_tags.sql");

    let tags = sqlx::query_as::<_, TagInfo>(sql)
        .fetch_all(pool)
        .await
        .map_err(log_error)?;

    Ok(tags)
}
