use rusqlite::params;

use crate::models::search::SearchHistory;

pub fn save_search_history(
    conn: &std::sync::MutexGuard<'_, rusqlite::Connection>,
    history: SearchHistory,
) -> Result<(), String> {
    let tags_json = serde_json::to_string(&history.tags).map_err(|e| e.to_string())?;
    let author_json = serde_json::to_string(&history.author).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO SEARCH_HISTORY (tags, character, author_info, condition, timestamp, result_count) VALUES (?, ?, ?, ?, ?, ?)",
        params![tags_json, history.character, author_json, history.condition, history.timestamp, history.result_count],
    )
    .map_err(|e| e.to_string())?;

    // 履歴は10件まで保存
    conn.execute(
        "DELETE FROM SEARCH_HISTORY WHERE ROWID NOT IN (
            SELECT ROWID FROM SEARCH_HISTORY ORDER BY timestamp DESC LIMIT 10
            )",
        [],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}
