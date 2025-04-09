use crate::models::{
    global::AppState,
    search::{SearchHistoryItem, SearchResult,GetUniqueTagListResp},
};
use rusqlite::{params, Result};
use tauri::State;

#[tauri::command]
pub fn get_unique_tag_list(state: State<AppState>) -> Result<Vec<GetUniqueTagListResp>, String> {
    let conn = state.db.lock().unwrap();
    // let count: i64 = conn
    //     .query_row("SELECT COUNT(*) FROM TAG_INFO", [], |row| row.get(0))
    //     .map_err(|e| e.to_string())?;
    // println!("TAG_INFOの総数: {}", count);

    let mut stmt = conn
        .prepare("SELECT tag, COUNT(tag) as count FROM TAG_INFO GROUP BY tag ORDER BY count DESC")
        .map_err(|e| e.to_string())?;

    let tag_iter = stmt
        .query_map([], |row| {
            Ok(GetUniqueTagListResp {
                tag: row.get(0)?,
                count: row.get(1)?
            })
        })
        .map_err(|e| e.to_string())?;

    let mut tags = Vec::new();
    for tag in tag_iter {
        tags.push(tag.map_err(|e| e.to_string())?);
    }

    Ok(tags)
}

#[tauri::command]
pub fn search_by_tags(
    state: State<AppState>,
    tag_ids: Vec<i64>,
    condition: String,
) -> Result<Vec<SearchResult>, String> {
    if tag_ids.is_empty() {
        return Ok(Vec::new());
    }

    let conn = state.db.lock().unwrap();

    // Build query based on condition
    let query = match condition.as_str() {
        "AND" => {
            let placeholders = (0..tag_ids.len())
                .map(|_| "?")
                .collect::<Vec<_>>()
                .join(",");

            format!(
                "SELECT i.id, i.title, i.thumbnail_path 
                FROM ITEMS i
                WHERE i.id IN (
                    SELECT it.item_id 
                    FROM ITEM_TAGS it
                    WHERE it.tag_id IN ({})
                    GROUP BY it.item_id
                    HAVING COUNT(DISTINCT it.tag_id) = ?
                )
                ORDER BY i.title",
                placeholders
            )
        }
        "OR" => {
            let placeholders = (0..tag_ids.len())
                .map(|_| "?")
                .collect::<Vec<_>>()
                .join(",");

            format!(
                "SELECT DISTINCT i.id, i.title, i.thumbnail_path 
                FROM ITEMS i
                JOIN ITEM_TAGS it ON i.id = it.item_id
                WHERE it.tag_id IN ({})
                ORDER BY i.title",
                placeholders
            )
        }
        _ => return Err("Invalid condition".to_string()),
    };

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    let mut params: Vec<&dyn rusqlite::ToSql> = tag_ids
        .iter()
        .map(|id| id as &dyn rusqlite::ToSql)
        .collect();

    // For AND condition, we need to add the count of tags
    let tag_count = tag_ids.len() as i64;
    if condition == "AND" {
        params.push(&tag_count);
    }

    let result_iter = stmt
        .query_map(params.as_slice(), |row| {
            Ok(SearchResult {
                id: row.get(0)?,
                title: row.get(1)?,
                thumbnail_path: row.get(2)?,
                author: row.get(3)?,
                character: row.get(4)?,
                save_dir: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for result in result_iter {
        results.push(result.map_err(|e| e.to_string())?);
    }

    Ok(results)
}

#[tauri::command]
pub fn get_search_history(state: State<AppState>) -> Result<Vec<SearchHistoryItem>, String> {
    let conn = state.db.lock().unwrap();

    let mut stmt = conn.prepare(
        "SELECT id, history_data, timestamp FROM SEARCH_HISTORY ORDER BY timestamp DESC LIMIT 10"
    ).map_err(|e| e.to_string())?;

    let history_iter = stmt
        .query_map([], |row| {
            let id: i64 = row.get(0)?;
            let history_data: String = row.get(1)?;
            let timestamp: String = row.get(2)?;

            let history_item: SearchHistoryItem = serde_json::from_str(&history_data)
                .map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string()))?;

            Ok(SearchHistoryItem {
                id,
                tags: history_item.tags,
                condition: history_item.condition,
                timestamp,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut history = Vec::new();
    for item in history_iter {
        history.push(item.map_err(|e| e.to_string())?);
    }

    Ok(history)
}

#[tauri::command]
pub fn save_search_history(
    state: State<AppState>,
    history: Vec<SearchHistoryItem>,
) -> Result<(), String> {
    let conn = state.db.lock().unwrap();

    // Clear existing history
    conn.execute("DELETE FROM SEARCH_HISTORY", [])
        .map_err(|e| e.to_string())?;

    // Insert new history items
    for item in history {
        let history_data = serde_json::to_string(&item).map_err(|e| e.to_string())?;

        conn.execute(
            "INSERT INTO SEARCH_HISTORY (id, history_data, timestamp) VALUES (?, ?, ?)",
            params![item.id, history_data, item.timestamp],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}
