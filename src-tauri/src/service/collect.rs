use std::fs;
use std::path::Path;

use anyhow::{Context, Result};
use rusqlite::Connection;

use crate::models::collect::CollectSummary;

pub fn prepare_collect_ui_work(conn: &Connection) -> Result<()> {
    let sql = include_str!("../sql/prepare_collect_ui_work.sql");
    conn.execute_batch(sql)?;
    Ok(())
}

pub fn reflesh_collect_work(conn: &Connection) -> Result<()> {
    let sql = include_str!("../sql/prepare_collect_filter_work.sql");
    conn.execute_batch(sql)?;
    let sql = include_str!("../sql/update_after_count.sql");
    conn.execute_batch(sql)?;
    Ok(())
}

pub fn sort_collect_work(conn: &Connection) -> Result<()> {
    let sql = include_str!("../sql/sort_collect_work.sql");
    conn.execute_batch(sql)?;
    Ok(())
}

pub fn get_collect_summary(conn: &Connection) -> Result<Vec<CollectSummary>, String> {
    // COLLECT_UI_WORKの結果を取得して返す
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
            FROM COLLECT_UI_WORK
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

pub fn collect_character_info(conn: &Connection) -> Result<()> {
    let sql = include_str!("../sql/collect_character_info.sql");
    conn.execute_batch(sql)?;
    Ok(())
}

pub fn collect_illust_detail(conn: &Connection) -> Result<()> {
    let sql = include_str!("../sql/collect_illust_detail.sql");
    conn.execute_batch(sql)?;

    Ok(())
}

/// ILLUST_INFO.save_dir に {root}/{series}/{character} を設定
pub fn collect_illust_info(conn: &Connection) -> Result<()> {
    let sql = include_str!("../sql/collect_illust_info.sql");
    conn.execute_batch(sql)?;
    Ok(())
}

pub fn move_illust_files(conn: &Connection) -> Result<()> {
    let mut stmt = conn.prepare(
        "SELECT illust_id, suffix, extension, save_dir, collect_dir FROM COLLECT_FILTER_WORK",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,    // illust_id
            row.get::<_, i32>(1)?,    // suffix
            row.get::<_, String>(2)?, // extension
            row.get::<_, String>(3)?, // src_dir
            row.get::<_, String>(4)?, // dest_dir
        ))
    })?;

    for row in rows {
        let (illust_id, suffix, extension, src_dir, dest_dir) = row?;

        let filename = format!("{}_p{}.{}", illust_id, suffix, extension);
        let src_dir_path = Path::new(&src_dir);
        let src_path = src_dir_path.join(&filename);
        let dest_dir_path = Path::new(&dest_dir);
        let dest_path = dest_dir_path.join(&filename);

        // ディレクトリが存在しなければ作成
        if !dest_dir_path.exists() {
            fs::create_dir_all(&dest_dir_path)
                .with_context(|| format!("ディレクトリ作成失敗: {:?}", dest_dir_path))?;
        }
        if src_path != dest_path {
            match fs::rename(&src_path, &dest_path) {
                Ok(_) => {}
                Err(e) => {
                    eprintln!(
                        "ファイル移動失敗: {:?} → {:?} | エラー: {}",
                        src_path, dest_path, e
                    );

                    // 失敗時はパスを復元
                    update_save_dir(conn, illust_id, suffix, extension, dest_dir_path)?;
                }
            }
        }
    }

    Ok(())
}

fn update_save_dir(
    conn: &Connection,
    illust_id: i64,
    suffix: i32,
    extension: String,
    path: &Path,
) -> Result<()> {
    let save_dir = path.to_str().map(|s| s.to_string());

    conn.execute(
        r#"
        UPDATE ILLUST_INFO
        SET save_dir = ?1
        WHERE illust_id = ?2 AND suffix = ?3 AND extension = ?4
        "#,
        rusqlite::params![save_dir, illust_id, suffix, extension],
    )?;

    Ok(())
}
