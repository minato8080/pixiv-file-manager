use anyhow::Result;
use chrono::Utc;
use sqlx::{Pool, Sqlite, SqliteConnection};

use crate::{
    execute_queries,
    models::manage::{TagFixResult, TagFixRuleAction},
    util::ResultWithLocationExt,
};

pub async fn validate_and_insert_tag_fix_rule(
    pool: &Pool<Sqlite>,
    src_tag: &str,
    dst_tag: Option<&str>,
    action_type: TagFixRuleAction,
) -> Result<()> {
    if action_type == TagFixRuleAction::Add {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM TAG_FIX_RULES WHERE src_tag = ?1 AND action_type != 0",
        )
        .bind(src_tag)
        .fetch_one(pool)
        .await
        .with_location()?;

        if count > 0 {
            anyhow::bail!(
                "src_tag '{}' already has replace/delete rules, cannot add 'add' rule",
                src_tag
            );
        }
    } else {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM TAG_FIX_RULES WHERE src_tag = ?1 AND action_type = 0",
        )
        .bind(src_tag)
        .fetch_one(pool)
        .await
        .with_location()?;

        if count > 0 {
            anyhow::bail!(
                "src_tag '{}' already has 'add' rules, cannot add replace/delete rule",
                src_tag
            );
        }
    }

    let now = Utc::now().timestamp();

    sqlx::query(
        "INSERT INTO TAG_FIX_RULES (src_tag, dst_tag, action_type, created_at)
         VALUES (?1, ?2, ?3, ?4)",
    )
    .bind(src_tag)
    .bind(dst_tag)
    .bind(action_type as i64)
    .bind(now)
    .execute(pool)
    .await
    .with_location()?;

    Ok(())
}

pub async fn apply_tag_fix_rules(conn: &mut SqliteConnection) -> Result<TagFixResult> {
    let sql = include_str!("../sql/manage/apply_tag_fix_rules.sql");
    execute_queries(&mut *conn, sql).await.with_location()?;

    // カウンター取得
    let sql = include_str!("../sql/manage/get_tag_fix_counts.sql");
    let result: TagFixResult = sqlx::query_as(sql)
        .fetch_one(&mut *conn)
        .await
        .with_location()?;

    Ok(result)
}
