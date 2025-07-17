use rusqlite::{params, OptionalExtension};
use tauri::{command, State};

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
pub fn get_related_tags(tag: &str, state: State<AppState>) -> Result<Vec<String>, String> {
    let conn = state.db.lock().unwrap();
    let mut stmt = conn
        .prepare(
            r#"
        SELECT DISTINCT T2.tag
        FROM TAG_INFO T1
        JOIN TAG_INFO T2
          ON T1.illust_id = T2.illust_id
         AND T1.control_num = T2.control_num
        WHERE T1.tag = ?1
          AND T2.tag != ?1
        ORDER BY T2.tag COLLATE NOCASE
        "#,
        )
        .map_err(|e| e.to_string())?;

    let tags = stmt
        .query_map([tag], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(tags)
}

#[command]
pub fn assign_tag(
    assignment: TagAssignment,
    state: State<AppState>,
) -> Result<Vec<CollectSummary>, String> {
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    match (&assignment.series_tag, &assignment.character_tag) {
        (None, None) => {}
        _ => {
            tx.execute("DELETE FROM COLLECT_UI_WORK WHERE id = ?1", [assignment.id])
                .map_err(|e| e.to_string())?;

            // DB_INFO.root を取得（なければ None）
            let root: Option<String> = tx
                .query_row("SELECT root FROM DB_INFO LIMIT 1", [], |row| row.get(0))
                .ok(); // 存在しないときは None

            let collect_dir = match root {
                None => None, // rootがNoneならcollect_dirはNone
                Some(r) => match (&assignment.series_tag, &assignment.character_tag) {
                    (Some(series), Some(character)) => {
                        Some(format!("{}\\{}\\{}", r, series, character))
                    }
                    (Some(series), None) => Some(format!("{}\\{}", r, series)),
                    (None, Some(character)) => Some(format!("{}\\{}", r, character)),
                    (None, None) => None,
                },
            };

            tx.execute(
                "INSERT OR REPLACE INTO COLLECT_UI_WORK (
                id, series, character, collect_dir, before_count, after_count, unsave
            ) VALUES (?1, ?2, ?3, ?4, 0, 0, true)",
                params![
                    assignment.id,
                    assignment.series_tag,
                    assignment.character_tag,
                    collect_dir,
                ],
            )
            .map_err(|e| e.to_string())?;
        }
    }

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
    character: String,
    state: State<AppState>,
) -> Result<Vec<CollectSummary>, String> {
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // CHARACTER_INFO から削除
    tx.execute(
        "DELETE FROM CHARACTER_INFO WHERE character = ?1",
        params![character],
    )
    .map_err(|e| e.to_string())?;

    // ILLUST_DETAIL から削除
    tx.execute(
        "DELETE FROM ILLUST_DETAIL WHERE character = ?1",
        params![character],
    )
    .map_err(|e| e.to_string())?;

    // COLLECT_UI_WORK から削除
    tx.execute(
        "DELETE FROM COLLECT_UI_WORK WHERE character = ?1",
        params![character],
    )
    .map_err(|e| e.to_string())?;

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
        .prepare("SELECT root FROM DB_INFO")
        .map_err(|e| e.to_string())?;
    let root_path: Option<String> = stmt
        .query_row([], |row| row.get(0))
        .optional()
        .map_err(|e| e.to_string())?;
    Ok(root_path)
}
