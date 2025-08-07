use crate::models::search::SearchHistory;
use anyhow::Result;
use rusqlite::params;

pub fn save_search_history(
    conn: &std::sync::MutexGuard<'_, rusqlite::Connection>,
    history: SearchHistory,
) -> Result<()> {
    let tags_json = serde_json::to_string(&history.tags)?;
    let author_json = serde_json::to_string(&history.author)?;
    conn.execute(
        "INSERT INTO SEARCH_HISTORY (tags, character, author_info, condition, timestamp, result_count) VALUES (?, ?, ?, ?, ?, ?)",
        params![tags_json, history.character, author_json, history.condition, history.timestamp, history.result_count],
    )
    ?;

    // 履歴は10件まで保存
    conn.execute(
        "DELETE FROM SEARCH_HISTORY WHERE ROWID NOT IN (
            SELECT ROWID FROM SEARCH_HISTORY ORDER BY timestamp DESC LIMIT 10
            )",
        [],
    )?;

    Ok(())
}
