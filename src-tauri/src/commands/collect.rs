use rusqlite::params;
use tauri::{command, State};

use crate::models::{
    collect::{CollectStats, CollectSummary, TagAssignment},
    global::AppState,
};

#[command]
pub fn assign_tag(
    series_tag: Option<String>,
    character_tag: Option<String>,
) -> Result<String, String> {
    // タグを割り当てる処理を実装
    Ok(format!(
        "Series tag \"{}\", Character tag \"{}\" assigned",
        series_tag.unwrap_or("Unset".to_string()),
        character_tag.unwrap_or("Unset".to_string())
    ))
}

#[command]
pub fn save_assignments(assignments: Vec<TagAssignment>) -> Result<String, String> {
    // 割り当てを保存する処理を実装
    Ok("Assignment settings saved".to_string())
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
                "SELECT 
                    ROW_NUMBER() OVER () AS row_num, C.series, C.character, C.collect_dir, COUNT(I.illust_id) as file_count
                 FROM CHARACTER_INFO C
                    LEFT JOIN ILLUST_DETAIL D ON C.character = D.character
                    LEFT JOIN ILLUST_INFO I ON I.illust_id = D.illust_id
                 GROUP BY C.series, C.character, C.collect_dir",
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
                "INSERT INTO COLLECT_WORK (series, character, collect_dir, before_count, after_count, unsave) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![info.series_tag, info.character_tag, info.new_path, info.before_count, info.after_count, false],
            ).map_err(|e| e.to_string())?;
        }

        // 「未割り当てイラスト」のカウントを取得して、1件追加
        let unassigned_count: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM ILLUST_INFO I
                LEFT JOIN ILLUST_DETAIL D ON I.illust_id = D.illust_id
                WHERE D.character IS NULL",
                [],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        if unassigned_count > 0 {
            tx.execute(
                "INSERT INTO COLLECT_WORK (series, character, collect_dir, before_count, after_count, unsave)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    None::<String>,
                    "",
                    None::<String>,
                    unassigned_count,
                    unassigned_count,
                    false
                ],
            ).map_err(|e| e.to_string())?;
        }
    }

    tx.commit().map_err(|e| e.to_string())?;

    // COLLECT_WORKの結果を取得して返す
    let mut stmt = conn
        .prepare("SELECT ROW_NUMBER() OVER () AS row_num, series, character, collect_dir, before_count, after_count, unsave FROM COLLECT_WORK")
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
pub fn get_collect_summary(
    assignments: Vec<TagAssignment>,
    previous_summary: Vec<CollectSummary>,
) -> Result<(Vec<CollectSummary>, CollectStats), String> {
    // コレクトサマリーを取得する処理を実装
    Ok((
        vec![],
        CollectStats {
            before_uncollected: 0,
            after_uncollected: 0,
            total_assigned: 0,
        },
    )) // 仮のデータを返す
}

#[command]
pub fn perform_collect() -> Result<String, String> {
    // コレクションを実行する処理を実装
    Ok("Collection process completed (DB save & file move executed)".to_string())
}

#[command]
pub fn set_root(root: String) -> Result<String, String> {
    // ルートパスを設定する処理を実装
    Ok("Root path set successfully".to_string())
}

#[command]
pub fn get_root() -> Result<Option<String>, String> {
    // ルートパスを取得する処理を実装
    Ok(Some("".to_string())) // 仮の空の文字列を返す
}
