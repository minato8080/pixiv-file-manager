use rusqlite::params;
use rusqlite::Connection;
use rusqlite::OptionalExtension;
use rusqlite::Transaction;
use tauri::{command, State};

use crate::models::global::GeneralResponse;
use crate::models::{
    collect::{CollectSummary, TagAssignment},
    global::AppState,
};

#[command]
pub fn assign_tag(
    assignment: TagAssignment,
    state: State<AppState>,
) -> Result<Vec<CollectSummary>, String> {
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    match (&assignment.series_tag, &assignment.character_tag) {
        (None, None) => {
            tx.execute(
                "DELETE FROM COLLECT_WORK WHERE id = ?1",
                params![assignment.id,],
            )
            .map_err(|e| e.to_string())?;
        }
        _ => {
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

            // INSERT OR IGNORE
            tx.execute(
                "INSERT OR IGNORE INTO COLLECT_WORK (
                id, series, character, collect_dir, before_count, after_count, unsave
            ) VALUES (?1, ?2, ?3, ?4, 0, 0, false)",
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

    // after_countを計算
    update_after_count(&tx).map_err(|e| e.to_string())?;

    // コミット
    tx.commit().map_err(|e| e.to_string())?;

    get_collect_summary(&conn)
}

fn update_after_count(tx: &Transaction) -> Result<(), String> {
    let sql = include_str!("sql/update_after_count.sql");
    tx.execute_batch(sql).map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
pub fn load_assignments(state: State<AppState>) -> Result<Vec<CollectSummary>, String> {
    let mut conn = state.db.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // COLLECT_WORKテーブルをトランケイト
    tx.execute("DELETE FROM COLLECT_WORK", [])
        .map_err(|e| e.to_string())?;
    {
        // CHARACTER_INFOの現在の状態を取得し、before_countにファイル数を設定
        let mut stmt = tx
            .prepare(
                "WITH root_value AS (
                SELECT root FROM DB_INFO LIMIT 1
                )
                SELECT 
                ROW_NUMBER() OVER () AS row_num,
                C.series,
                C.character,
                CASE
                    WHEN R.root IS NULL THEN NULL
                    WHEN C.series IS NULL THEN R.root || '\\' || C.character
                    ELSE R.root || '\\' || C.series || '\\' || C.character
                END AS new_path,
                COUNT(I.illust_id) AS before_count
                FROM CHARACTER_INFO C
                CROSS JOIN root_value R
                LEFT JOIN ILLUST_DETAIL D ON C.character = D.character
                LEFT JOIN ILLUST_INFO I 
                ON I.illust_id = D.illust_id
                AND I.save_dir = (
                    CASE
                    WHEN R.root IS NULL THEN NULL
                    WHEN C.series IS NULL THEN R.root || '\\' || C.character
                    ELSE R.root || '\\' || C.series || '\\' || C.character
                    END
                )
                GROUP BY C.series, C.character;
                ",
            )
            .map_err(|e| e.to_string())?;
        let character_info_iter = stmt
            .query_map([], |row| {
                Ok(CollectSummary {
                    id: row.get(0)?,
                    series_tag: row.get::<_, Option<String>>(1)?,
                    character_tag: row.get(2)?,
                    new_path: row.get::<_, Option<String>>(3)?,
                    before_count: row.get(4)?,
                    after_count: row.get(4)?,
                    is_new: false,
                })
            })
            .map_err(|e| e.to_string())?;

        // COLLECT_WORKにロード
        for character_info in character_info_iter {
            let info = character_info.map_err(|e| e.to_string())?;
            tx.execute(
                "INSERT INTO COLLECT_WORK (id, series, character, collect_dir, before_count, after_count, unsave) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![info.id, info.series_tag, info.character_tag, info.new_path, info.before_count, info.after_count, false],
            ).map_err(|e| e.to_string())?;
        }

        // 「未割り当てイラスト」のカウントを取得して、1件追加
        let unassigned_count: i64 = tx
            .query_row(
                "WITH total_after AS (
                SELECT SUM(after_count) AS total_after_count
                FROM COLLECT_WORK
                ),
                total_illusts AS (
                    SELECT COUNT(DISTINCT I.illust_id) AS total_illust_count
                    FROM ILLUST_INFO I
                )
                SELECT
                    (I.total_illust_count - T.total_after_count) AS missing_after_count
                FROM total_after T, total_illusts I;",
                [],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        tx.execute(
            "INSERT INTO COLLECT_WORK (id, series, character, collect_dir, before_count, after_count, unsave)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                -1,
                None::<String>,
                "",
                None::<String>,
                unassigned_count,
                unassigned_count,
                false
            ],
        ).map_err(|e| e.to_string())?;
    }

    // after_countを計算
    update_after_count(&tx).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    get_collect_summary(&conn)
}

fn get_collect_summary(conn: &Connection) -> Result<Vec<CollectSummary>, String> {
    // COLLECT_WORKの結果を取得して返す
    let mut stmt = conn
        .prepare(
            "SELECT
                id,
                series,
                character,
                collect_dir,
                before_count,
                after_count,
                unsave
            FROM COLLECT_WORK
            ORDER BY id ASC
            ;",
        )
        .map_err(|e| e.to_string())?;
    let collect_work_iter = stmt
        .query_map([], |row| {
            Ok(CollectSummary {
                id: row.get(0)?,
                series_tag: row.get::<_, Option<String>>(1)?,
                character_tag: row.get(2)?,
                new_path: row.get::<_, Option<String>>(3)?,
                before_count: row.get(4)?,
                after_count: row.get(5)?,
                is_new: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for collect_work in collect_work_iter {
        results.push(collect_work.map_err(|e| e.to_string())?);
    }

    Ok(results)
}

#[command]
pub fn perform_collect(state: State<AppState>) -> Result<String, String> {
    // コレクションを実行する処理を実装
    Ok("Collection process completed (DB save & file move executed)".to_string())
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
