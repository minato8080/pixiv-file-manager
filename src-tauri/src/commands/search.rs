use std::path::Path;

use crate::{
    api::windows::generate_thumbnail,
    models::{
        global::AppState,
        search::{GetUniqueTagListResp, SearchHistoryItem, SearchResult},
    },
};
use rusqlite::{params, Result};
use tauri::State;

#[tauri::command]
pub fn get_unique_tag_list(state: State<AppState>) -> Result<Vec<GetUniqueTagListResp>, String> {
    let conn = state.db.lock().unwrap();

    let mut stmt = conn
        .prepare("SELECT tag, COUNT(tag) as count FROM TAG_INFO GROUP BY tag ORDER BY count DESC")
        .map_err(|e| e.to_string())?;

    let tag_iter = stmt
        .query_map([], |row| {
            Ok(GetUniqueTagListResp {
                tag: row.get(0)?,
                count: row.get(1)?,
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
    tags: Vec<String>,
    condition: String,
) -> Result<Vec<SearchResult>, String> {
    if tags.is_empty() {
        return Ok(Vec::new());
    }

    let conn = state.db.lock().unwrap();

    // クエリを条件に基づいて構築
    let query = match condition.as_str() {
        "AND" => {
            let placeholders = (0..tags.len()).map(|_| "?").collect::<Vec<_>>().join(",");

            format!(
                "SELECT id 
                FROM TAG_INFO 
                WHERE tag IN ({})
                GROUP BY id
                HAVING COUNT(DISTINCT tag) = ?",
                placeholders
            )
        }
        "OR" => {
            let placeholders = (0..tags.len()).map(|_| "?").collect::<Vec<_>>().join(",");

            format!(
                "SELECT DISTINCT id 
                FROM TAG_INFO 
                WHERE tag IN ({})",
                placeholders
            )
        }
        _ => return Err("Invalid condition".to_string()),
    };

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    let mut params: Vec<&dyn rusqlite::ToSql> =
        tags.iter().map(|tag| tag as &dyn rusqlite::ToSql).collect();

    // AND条件の場合、タグの数を追加
    let tag_count = tags.len() as i64;
    if condition == "AND" {
        params.push(&tag_count);
    }

    let id_iter = stmt
        .query_map(params.as_slice(), |row| {
            let id: i64 = row.get(0)?;
            Ok(id)
        })
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for id in id_iter {
        let id = id.map_err(|e| e.to_string())?;
        let mut detail_stmt = conn
            .prepare(
                "SELECT id, suffix, extension, author_name, character, save_dir
            FROM ID_DETAIL 
            WHERE id = ?",
            )
            .map_err(|e| e.to_string())?;

        let detail_iter = detail_stmt
            .query_map(params![id], |row| {
                println!("{:?}", row);
                let id: i64 = row.get(0)?;
                let suffix: Option<i64> = row.get(1)?;
                let extension: String = row.get(2)?;
                let author: String = row.get(3)?;
                let character: Option<String> = row.get(4)?;
                let save_dir: String = row.get(5)?;
                let file_name = match suffix {
                    Some(s) => format!("{}_p{}.{}", id, s, extension),
                    None => format!("{}.{}", id, extension),
                };
                let pathbuf = Path::new(&save_dir).join(&file_name);
                let path = pathbuf.to_str().unwrap().to_string();
                println!("{}", path);
                let update_time: String = {
                    let metadata = std::fs::metadata(&path)
                        .map_err(|_e| rusqlite::Error::InvalidPath(pathbuf.clone()))?;
                    let modified_time = metadata.modified().unwrap();
                    let datetime: chrono::DateTime<chrono::Local> = modified_time.into();
                    datetime.format("%Y-%m-%d %H:%M:%S").to_string()
                };
                // ここでサムネイルを取得する処理を書く
                let thumbnail_path = generate_thumbnail(pathbuf.clone())
                    .map_err(|_e| rusqlite::Error::InvalidPath(pathbuf))?;

                Ok(SearchResult {
                    id,
                    file_name,
                    author,
                    character,
                    save_dir,
                    path,
                    update_time,
                    thumbnail_path,
                })
            })
            .map_err(|e| e.to_string())?;

        for detail in detail_iter {
            results.push(detail.map_err(|e| e.to_string())?);
        }
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
    // conn.execute("DELETE FROM SEARCH_HISTORY", [])
    //     .map_err(|e| e.to_string())?;

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
