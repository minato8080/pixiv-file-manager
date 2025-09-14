use rusqlite::{params, OptionalExtension};
use tauri::{command, Emitter, State};

use crate::constants;
use crate::models::collect::FileSummary;
use crate::models::search::TagInfo;
use crate::service::collect::{
    collect_character_info, collect_illust_detail, get_collect_summary, move_illust_files,
    prepare_collect_ui_work, process_sync_db, reflesh_collect_work,
};
use crate::service::common::log_error;
use crate::{
    models::{
        collect::{CollectSummary, TagAssignment},
        common::{AppState, GeneralResponse},
    },
    service::collect::sort_collect_work,
};

#[command]
pub fn get_related_tags(tag: &str, state: State<AppState>) -> Result<Vec<TagInfo>, String> {
    let conn = state.db.lock().unwrap();
    let sql = include_str!("../sql/collect/get_related_tags.sql");
    let mut stmt = conn.prepare(sql).map_err(|e| log_error(e.to_string()))?;

    let tags = stmt
        .query_map([tag], |row| {
            Ok(TagInfo {
                tag: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<TagInfo>, _>>()
        .map_err(|e| log_error(e.to_string()))?;

    Ok(tags)
}

#[command]
pub fn assign_tag(
    assignment: TagAssignment,
    state: State<AppState>,
) -> Result<Vec<CollectSummary>, String> {
    // バリデーションチェック
    if assignment.series.is_none() && assignment.character.is_none() {
        return Err("シリーズまたはキャラクターが未指定です".to_string());
    }

    // 本処理
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction().map_err(|e| log_error(e.to_string()))?;

    // id指定時は洗い替え
    if let Some(id) = assignment.id {
        tx.execute("DELETE FROM COLLECT_UI_WORK WHERE id = ?1", [id])
            .map_err(|e| log_error(e.to_string()))?;
    }

    // root を取得（なければ None）
    let root: Option<String> = tx
        .query_row(
            "SELECT value FROM COMMON_MST WHERE key = ?",
            [constants::COLLECT_ROOT],
            |row| row.get(0),
        )
        .ok(); // 存在しないときは None

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

    tx.execute(
        "INSERT OR REPLACE INTO COLLECT_UI_WORK (
                id, entity_key, series, character, collect_dir, unsave, collect_type
            ) VALUES (0, ?1, ?2, ?3, ?4, 1, ?5)",
        params![
            entity_key,
            assignment.series,
            assignment.character,
            collect_dir,
            collect_type
        ],
    )
    .map_err(|e| log_error(e.to_string()))?;

    // ソートし直す
    sort_collect_work(&tx).map_err(|e| log_error(e.to_string()))?;

    // after_countを計算
    reflesh_collect_work(&tx).map_err(|e| log_error(e.to_string()))?;

    // コミット
    tx.commit().map_err(|e| log_error(e.to_string()))?;

    get_collect_summary(&conn).map_err(|e| e.to_string())
}

#[command]
pub fn delete_collect(
    assignment: TagAssignment,
    state: State<AppState>,
) -> Result<Vec<CollectSummary>, String> {
    // バリデーションチェック
    if assignment.id.is_none() && assignment.series.is_none() && assignment.character.is_none() {
        return Err("IDまたはシリーズまたはキャラクターが未指定です".to_string());
    }

    // 本処理
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction().map_err(|e| log_error(e.to_string()))?;

    let sql_template = "UPDATE COLLECT_UI_WORK SET collect_type = 3, unsave = 1, after_count = 0";

    if let Some(id) = assignment.id {
        // id指定時
        let sql = sql_template.to_owned() + " WHERE id = ?1";
        tx.execute(&sql, [id])
            .map_err(|e| log_error(e.to_string()))?;
    } else {
        // entity指定時
        let entity_key = assignment
            .character
            .clone()
            .or(assignment.series.clone())
            .expect("Invalid assignment: expected exactly one of 'character' or 'series'");

        let sql = sql_template.to_owned() + " WHERE entity_key = ?1";
        tx.execute(&sql, [entity_key])
            .map_err(|e| log_error(e.to_string()))?;
    }

    // after_countを計算
    reflesh_collect_work(&tx).map_err(|e| log_error(e.to_string()))?;

    // コミット
    tx.commit().map_err(|e| log_error(e.to_string()))?;

    get_collect_summary(&conn).map_err(|e| e.to_string())
}

#[command]
pub fn load_assignments(state: State<AppState>) -> Result<Vec<CollectSummary>, String> {
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction().map_err(|e| log_error(e.to_string()))?;

    // COLLECT_UI_WORKを準備
    prepare_collect_ui_work(&tx).map_err(|e| log_error(e.to_string()))?;

    // after_countを計算
    reflesh_collect_work(&tx).map_err(|e| log_error(e.to_string()))?;

    tx.commit().map_err(|e| log_error(e.to_string()))?;

    // 結果を返却
    get_collect_summary(&conn).map_err(|e| e.to_string())
}

#[command]
pub fn perform_collect(
    state: State<AppState>,
    window: tauri::Window,
) -> Result<Vec<CollectSummary>, String> {
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction().map_err(|e| log_error(e.to_string()))?;

    // COLLECT_UI_WORKから、unsave = false のレコードをすべて削除する
    tx.execute("DELETE FROM COLLECT_UI_WORK WHERE unsave = false", [])
        .map_err(|e| log_error(e.to_string()))?;

    collect_character_info(&tx).map_err(|e| log_error(e.to_string()))?;

    collect_illust_detail(&tx).map_err(|e| log_error(e.to_string()))?;

    move_illust_files(&tx).map_err(|e| log_error(e.to_string()))?;

    tx.commit().map_err(|e| log_error(e.to_string()))?;

    let tx = conn.transaction().map_err(|e| log_error(e.to_string()))?;

    // COLLECT_UI_WORKを準備
    prepare_collect_ui_work(&tx).map_err(|e| log_error(e.to_string()))?;

    // after_countを計算
    reflesh_collect_work(&tx).map_err(|e| log_error(e.to_string()))?;

    tx.commit().map_err(|e| log_error(e.to_string()))?;

    // DB変更を通知
    window.emit("update_db", ()).unwrap();

    // 結果を返却
    get_collect_summary(&conn).map_err(|e| e.to_string())
}

#[command]
pub fn set_root(root: String, state: State<AppState>) -> GeneralResponse {
    let conn = state.db.lock().unwrap();

    match conn.execute(
        "INSERT OR REPLACE INTO COMMON_MST (key, value) VALUES (?, ?)",
        params![constants::COLLECT_ROOT, root],
    ) {
        Ok(_) => GeneralResponse {
            success: Some(root),
            error: None,
        },
        Err(e) => GeneralResponse {
            success: None,
            error: Some(e.to_string()),
        },
    }
}

#[command]
pub fn get_root(state: State<AppState>) -> Result<Option<String>, String> {
    let conn = state.db.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT value FROM COMMON_MST WHERE key = ?")
        .map_err(|e| log_error(e.to_string()))?;
    let root_path: Option<String> = stmt
        .query_row([constants::COLLECT_ROOT], |row| row.get(0))
        .optional()
        .map_err(|e| log_error(e.to_string()))?;
    Ok(root_path)
}

#[command]
pub fn get_available_unique_tags(state: State<AppState>) -> Result<Vec<TagInfo>, String> {
    let conn = state.db.lock().unwrap();

    let sql = include_str!("../sql/collect/get_available_unique_tags.sql");
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

#[command]
pub fn sync_db(root: String, state: State<AppState>) -> Result<Vec<FileSummary>, String> {
    let mut conn = state.db.lock().unwrap();
    let res = process_sync_db(root, &mut conn).map_err(|e| log_error(e.to_string()))?;

    Ok(res)
}

#[command]
pub fn delete_missing_illusts(
    items: Vec<FileSummary>,
    state: State<AppState>,
) -> Result<(), String> {
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction().map_err(|e| log_error(e.to_string()))?;

    // 1. ILLUST_INFO から削除
    for item in &items {
        tx.execute(
            "DELETE FROM ILLUST_INFO WHERE illust_id = ? AND suffix = ?",
            params![item.illust_id, item.suffix],
        )
        .map_err(|e| log_error(e.to_string()))?;
    }

    // 2. 孤立した ILLUST_DETAIL を削除
    tx.execute(
        "DELETE FROM ILLUST_DETAIL
        WHERE NOT EXISTS (
            SELECT 1 FROM ILLUST_INFO I
            WHERE I.cnum = ILLUST_DETAIL.cnum
        );",
        (),
    )
    .map_err(|e| log_error(e.to_string()))?;

    tx.commit().map_err(|e| log_error(e.to_string()))?;
    Ok(())
}
