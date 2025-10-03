use tauri::{command, Emitter, State};

use crate::constants;
use crate::models::collect::FileSummary;
use crate::models::search::TagInfo;
use crate::service::collect::{
    apply_file_moves, collect_character_info, collect_illust_detail, get_collect_summary,
    mark_illust_move_targets, prepare_collect_ui_work, process_sync_db, reflesh_collect_work,
};
use crate::util::log_error;
use crate::{
    models::{
        collect::{CollectSummary, TagAssignment},
        common::AppState,
    },
    service::collect::sort_collect_work,
};

#[command]
pub async fn get_related_tags(
    tag: &str,
    state: State<'_, AppState>,
) -> Result<Vec<TagInfo>, String> {
    let pool = &state.pool;

    let sql = include_str!("../sql/collect/get_related_tags.sql");

    let tags: Vec<TagInfo> = sqlx::query_as(sql)
        .bind(tag)
        .fetch_all(pool)
        .await
        .map_err(log_error)?;

    Ok(tags)
}

#[command]
pub async fn assign_collect(
    assignment: TagAssignment,
    state: State<'_, AppState>,
) -> Result<Vec<CollectSummary>, String> {
    // バリデーションチェック
    if assignment.series.is_none() && assignment.character.is_none() {
        return Err("シリーズまたはキャラクターが未指定です".to_string());
    }

    // 本処理
    let pool = &state.pool;
    let mut tx = pool.begin().await.map_err(log_error)?;

    // id指定時は洗い替え
    if let Some(id) = assignment.id {
        sqlx::query("DELETE FROM COLLECT_UI_WORK WHERE id = ?1")
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(log_error)?;
    }

    // root を取得（なければ None）
    let root: Option<String> = sqlx::query_scalar("SELECT value FROM COMMON_MST WHERE key = ?")
        .bind(constants::COLLECT_ROOT)
        .fetch_optional(&mut *tx)
        .await
        .map_err(log_error)?;

    let collect_dir = root.map(|r| {
        let mut parts = vec![r];

        if let Some(series) = assignment.series.clone() {
            parts.push(series);
        }

        if let Some(character) = assignment.character.clone() {
            parts.push(character);
        }

        parts.join("\\")
    });

    let entity_key = assignment
        .character
        .clone()
        .or(assignment.series.clone())
        .expect("Invalid assignment: expected exactly one of 'character' or 'series'");
    let collect_type = if assignment.character.is_none() { 1 } else { 2 };

    sqlx::query(
        "INSERT OR REPLACE INTO COLLECT_UI_WORK (
                id, entity_key, series, character, collect_dir, unsave, collect_type
            ) VALUES (0, ?1, ?2, ?3, ?4, 1, ?5)",
    )
    .bind(entity_key)
    .bind(assignment.series)
    .bind(assignment.character)
    .bind(collect_dir)
    .bind(collect_type)
    .execute(&mut *tx)
    .await
    .map_err(log_error)?;

    // ソートし直す
    sort_collect_work(&mut *tx).await.map_err(log_error)?;

    // after_countを計算
    reflesh_collect_work(&mut *tx).await.map_err(log_error)?;

    // コミット
    tx.commit().await.map_err(log_error)?;

    get_collect_summary(pool).await.map_err(|e| e.to_string())
}

#[command]
pub async fn remove_collect(
    assignment: TagAssignment,
    state: State<'_, AppState>,
) -> Result<Vec<CollectSummary>, String> {
    // バリデーションチェック
    if assignment.id.is_none() && assignment.series.is_none() && assignment.character.is_none() {
        return Err("IDまたはシリーズまたはキャラクターが未指定です".to_string());
    }

    let pool = &state.pool;
    let mut tx = pool.begin().await.map_err(log_error)?;

    let sql_template = "UPDATE COLLECT_UI_WORK SET collect_type = 3, unsave = 1, after_count = 0";

    if let Some(id) = assignment.id {
        // id指定時
        let sql = sql_template.to_owned() + " WHERE id = ?1";

        sqlx::query(&sql)
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(log_error)?;
    } else {
        // entity指定時
        let entity_key = assignment
            .character
            .clone()
            .or(assignment.series.clone())
            .expect("Invalid assignment: expected exactly one of 'character' or 'series'");

        let sql = sql_template.to_owned() + " WHERE entity_key = ?1";

        sqlx::query(&sql)
            .bind(entity_key)
            .execute(&mut *tx)
            .await
            .map_err(log_error)?;
    }

    // after_countを計算
    reflesh_collect_work(&mut *tx).await.map_err(log_error)?;

    // コミット
    tx.commit().await.map_err(log_error)?;

    get_collect_summary(pool).await.map_err(|e| e.to_string())
}

#[command]
pub async fn load_assignments(state: State<'_, AppState>) -> Result<Vec<CollectSummary>, String> {
    let pool = &state.pool;
    let mut tx = pool.begin().await.map_err(log_error)?;

    // COLLECT_UI_WORKを準備
    prepare_collect_ui_work(&mut *tx).await.map_err(log_error)?;

    // after_countを計算
    reflesh_collect_work(&mut *tx).await.map_err(log_error)?;

    tx.commit().await.map_err(log_error)?;

    // 結果を返却
    get_collect_summary(pool).await.map_err(|e| e.to_string())
}

#[command]
pub async fn perform_collect(
    state: State<'_, AppState>,
    window: tauri::Window,
) -> Result<Vec<CollectSummary>, String> {
    let pool = &state.pool;
    let mut tx = pool.begin().await.map_err(log_error)?;

    // COLLECT_UI_WORKから、unsave = false のレコードをすべて削除する
    sqlx::query("DELETE FROM COLLECT_UI_WORK WHERE unsave = false")
        .execute(&mut *tx)
        .await
        .map_err(log_error)?;

    collect_character_info(&mut *tx).await.map_err(log_error)?;

    collect_illust_detail(&mut *tx).await.map_err(log_error)?;

    let moves = mark_illust_move_targets(&mut *tx)
        .await
        .map_err(log_error)?;

    tx.commit().await.map_err(log_error)?;

    apply_file_moves(moves);

    let mut tx = pool.begin().await.map_err(log_error)?;

    // COLLECT_UI_WORKを準備
    prepare_collect_ui_work(&mut *tx).await.map_err(log_error)?;

    // after_countを計算
    reflesh_collect_work(&mut *tx).await.map_err(log_error)?;

    tx.commit().await.map_err(log_error)?;

    // DB変更を通知
    window.emit("update_db", ()).unwrap();

    // 結果を返却
    get_collect_summary(pool).await.map_err(|e| e.to_string())
}

#[command]
pub async fn set_root(root: String, state: State<'_, AppState>) -> Result<(), String> {
    let pool = &state.pool;

    sqlx::query("INSERT OR REPLACE INTO COMMON_MST (key, value) VALUES (?, ?)")
        .bind(constants::COLLECT_ROOT)
        .bind(root.clone())
        .execute(pool)
        .await
        .map_err(log_error)?;

    Ok(())
}

#[command]
pub async fn get_root(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let pool = &state.pool;

    let root_path = sqlx::query_scalar("SELECT value FROM COMMON_MST WHERE key = ?")
        .bind(constants::COLLECT_ROOT)
        .fetch_optional(pool)
        .await
        .map_err(log_error)?;

    Ok(root_path)
}

#[command]
pub async fn get_available_unique_tags(state: State<'_, AppState>) -> Result<Vec<TagInfo>, String> {
    let pool = &state.pool;

    let sql = include_str!("../sql/collect/get_available_unique_tags.sql");

    let tags = sqlx::query_as::<_, TagInfo>(sql)
        .fetch_all(pool)
        .await
        .map_err(log_error)?;

    Ok(tags)
}

#[command]
pub async fn sync_db(root: String, state: State<'_, AppState>) -> Result<Vec<FileSummary>, String> {
    let mut pool = &state.pool;
    let res = process_sync_db(root, &mut pool).await.map_err(log_error)?;

    Ok(res)
}

#[command]
pub async fn delete_missing_illusts(
    items: Vec<FileSummary>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let pool = &state.pool;
    let mut tx = pool.begin().await.map_err(log_error)?;

    // 1. ILLUST_INFO から削除
    for item in &items {
        sqlx::query("DELETE FROM ILLUST_INFO WHERE illust_id = ? AND suffix = ?")
            .bind(item.illust_id)
            .bind(item.suffix)
            .execute(&mut *tx)
            .await
            .map_err(log_error)?;
    }

    // 2. 孤立した ILLUST_DETAIL を削除
    sqlx::query(
        "DELETE FROM ILLUST_DETAIL
        WHERE NOT EXISTS (
            SELECT 1 FROM ILLUST_INFO I
            WHERE I.cnum = ILLUST_DETAIL.cnum
        );",
    )
    .execute(&mut *tx)
    .await
    .map_err(log_error)?;

    tx.commit().await.map_err(log_error)?;
    Ok(())
}
