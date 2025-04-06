#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{Manager, State};

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Tag {
    id: i64,
    tag: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct SearchResult {
    id: i64,
    title: String,
    thumbnail_path: String,
    author: String,
    character: String,
    save_dir: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct SearchHistoryItem {
    id: i64,
    tags: Vec<Tag>,
    condition: String,
    timestamp: String,
}

struct AppState {
    db: Mutex<Connection>,
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let db_path = app.path().app_data_dir().unwrap().join("pixiv.db");

            // Create directory if it doesn't exist
            if let Some(parent) = db_path.parent() {
                std::fs::create_dir_all(parent).unwrap();
            }

            let conn = Connection::open(&db_path).unwrap();

            // Initialize database
            initialize_db(&conn).unwrap();

            app.manage(AppState {
                db: Mutex::new(conn),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_all_tags,
            search_by_tags,
            get_search_history,
            save_search_history
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
fn initialize_db(conn: &Connection) -> Result<()> {
    // テーブルが存在しない場合は作成
    conn.execute(
        "CREATE TABLE IF NOT EXISTS ID_DETAIL (
            id INTEGER PRIMARY KEY,
            suffix INTEGER,
            author TEXT,
            character TEXT,
            save_dir TEXT
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS TAG_INFO (
            id INTEGER PRIMARY KEY,
            tag TEXT NOT NULL UNIQUE
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS DB_INFO (
            update_time TEXT
        )",
        [],
    )?;

    Ok(())
}

#[tauri::command]
fn get_all_tags(state: State<AppState>) -> Result<Vec<Tag>, String> {
    let conn = state.db.lock().unwrap();

    let mut stmt = conn
        .prepare("SELECT id, tag FROM TAG_INFO ORDER BY tag")
        .map_err(|e| e.to_string())?;

    let tag_iter = stmt
        .query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                tag: row.get(1)?,
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
fn search_by_tags(
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
fn get_search_history(state: State<AppState>) -> Result<Vec<SearchHistoryItem>, String> {
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
fn save_search_history(
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
