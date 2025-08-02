use rusqlite::{params, OptionalExtension};
use tauri::{command, State};

use crate::models::search::TagInfo;
use crate::service::collect::{
    collect_character_info, collect_illust_detail, collect_illust_info, get_collect_summary,
    move_illust_files, prepare_collect_ui_work, reflesh_collect_work,
};
use crate::{
    models::{
        collect::{CollectSummary, TagAssignment},
        global::{AppState, GeneralResponse},
    },
    service::collect::sort_collect_work,
};

#[command]
pub fn get_related_tags(tag: &str, state: State<AppState>) -> Result<Vec<TagInfo>, String> {
    let conn = state.db.lock().unwrap();
    let mut stmt = conn
        .prepare(
            r#"
        SELECT 
          T2.tag,
          COUNT(DISTINCT I.illust_id || '-' || I.suffix) AS count
        FROM TAG_INFO T1
        JOIN TAG_INFO T2
          ON T1.illust_id = T2.illust_id
          AND T1.control_num = T2.control_num
        JOIN ILLUST_INFO I
          ON T2.illust_id = I.illust_id AND T2.control_num = I.control_num
        WHERE T1.tag = ?1
          AND T2.tag != ?1
        GROUP BY T2.tag
        ORDER BY count DESC, T2.tag COLLATE NOCASE;
        "#,
        )
        .map_err(|e| e.to_string())?;

    let tags = stmt
        .query_map([tag], |row| {
            Ok(TagInfo {
                tag: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<TagInfo>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(tags)
}

#[command]
pub fn assign_tag(
    assignment: TagAssignment,
    state: State<AppState>,
) -> Result<Vec<CollectSummary>, String> {
    // バリデーションチェック
    if assignment.series.trim().is_empty() || assignment.character.trim().is_empty() {
        return Err("シリーズまたはキャラクターが未指定です".to_string());
    }
    if assignment.series == "-" && assignment.character == "-" {
        return Err("シリーズおよびキャラクターが未指定です".to_string());
    }

    // 本処理
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // id指定時は洗い替え
    if let Some(id) = assignment.id {
        tx.execute("DELETE FROM COLLECT_UI_WORK WHERE id = ?1", [id])
            .map_err(|e| e.to_string())?;
    }

    // DB_INFO.root を取得（なければ None）
    let root: Option<String> = tx
        .query_row("SELECT root FROM DB_INFO LIMIT 1", [], |row| row.get(0))
        .ok(); // 存在しないときは None

    let collect_dir = root.map(|r| {
        let mut parts = vec![r];

        if assignment.series != "-" {
            parts.push(assignment.series.clone());
        }

        if assignment.character != "-" {
            parts.push(assignment.character.clone());
        }

        parts.join("\\")
    });

    let collect_type = if assignment.character == "-" { 1 } else { 2 };

    // キャラクターは重複禁止のため洗い替え
    tx.execute(
        "DELETE FROM COLLECT_UI_WORK WHERE character = ?1 AND character <> '-'",
        params![assignment.character],
    )
    .map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT OR REPLACE INTO COLLECT_UI_WORK (
                id, series, character, collect_dir, before_count, after_count, unsave, collect_type
            ) VALUES (0, ?1, ?2, ?3, 0, 0, true, ?4)",
        params![
            assignment.series,
            assignment.character,
            collect_dir,
            collect_type
        ],
    )
    .map_err(|e| e.to_string())?;

    // ソートし直す
    sort_collect_work(&tx).map_err(|e| e.to_string())?;

    // after_countを計算
    reflesh_collect_work(&tx).map_err(|e| e.to_string())?;

    // コミット
    tx.commit().map_err(|e| e.to_string())?;

    get_collect_summary(&conn)
}

#[command]
pub fn delete_collect(
    assignment: TagAssignment,
    state: State<AppState>,
) -> Result<Vec<CollectSummary>, String> {
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // COLLECT_UI_WORK から削除
    tx.execute(
        "DELETE FROM COLLECT_UI_WORK WHERE series = ?1 AND character = ?2",
        params![assignment.series, assignment.character],
    )
    .map_err(|e| e.to_string())?;

    // CHARACTER_INFO から削除
    tx.execute(
        "DELETE FROM CHARACTER_INFO WHERE series = ?1 AND character = ?2",
        params![assignment.series, assignment.character],
    )
    .map_err(|e| e.to_string())?;

    // ILLUST_DETAIL から削除
    tx.execute(
        "UPDATE ILLUST_DETAIL SET character = NULL WHERE character = ?1",
        params![assignment.character],
    )
    .map_err(|e| e.to_string())?;

    // ソートし直す
    sort_collect_work(&tx).map_err(|e| e.to_string())?;

    // after_countを計算
    reflesh_collect_work(&tx).map_err(|e| e.to_string())?;

    // コミット
    tx.commit().map_err(|e| e.to_string())?;

    get_collect_summary(&conn)
}

#[command]
pub fn load_assignments(state: State<AppState>) -> Result<Vec<CollectSummary>, String> {
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // COLLECT_UI_WORKを準備
    prepare_collect_ui_work(&tx).map_err(|e| e.to_string())?;

    // after_countを計算
    reflesh_collect_work(&tx).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    // 結果を返却
    get_collect_summary(&conn)
}

#[command]
pub fn perform_collect(state: State<AppState>) -> Result<Vec<CollectSummary>, String> {
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // COLLECT_UI_WORKから、unsave = false のレコードをすべて削除する
    tx.execute("DELETE FROM COLLECT_UI_WORK WHERE unsave = false", [])
        .map_err(|e| e.to_string())?;

    collect_character_info(&tx).map_err(|e| e.to_string())?;

    collect_illust_detail(&tx).map_err(|e| e.to_string())?;

    collect_illust_info(&tx).map_err(|e| e.to_string())?;

    move_illust_files(&tx).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // COLLECT_UI_WORKを準備
    prepare_collect_ui_work(&tx).map_err(|e| e.to_string())?;

    // after_countを計算
    reflesh_collect_work(&tx).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    // 結果を返却
    get_collect_summary(&conn)
}

#[command]
pub fn set_root(root: String, state: State<AppState>) -> GeneralResponse {
    let conn = state.db.lock().unwrap();

    if let Err(e) = conn.execute("DELETE FROM DB_INFO", []) {
        return GeneralResponse {
            success: None,
            error: Some(e.to_string()),
        };
    }

    match conn.execute("INSERT INTO DB_INFO (root) VALUES (?)", params![root]) {
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
        .prepare("SELECT root FROM DB_INFO LIMIT 1")
        .map_err(|e| e.to_string())?;
    let root_path: Option<String> = stmt
        .query_row([], |row| row.get(0))
        .optional()
        .map_err(|e| e.to_string())?;
    Ok(root_path)
}
