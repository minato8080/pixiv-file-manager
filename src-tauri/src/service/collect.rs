use anyhow::Result;
use regex::Regex;
use sqlx::Acquire;
use sqlx::SqliteConnection;
use sqlx::SqlitePool;
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use walkdir::WalkDir;

use crate::constants;
use crate::execute_queries;
use crate::models::collect::*;
use crate::service::common::hash_params;
use crate::service::common::{execute_named_queries, update_cnum};
use crate::util::log_error;
use crate::util::ResultWithLocationExt;

pub async fn prepare_collect_ui_work(conn: &mut SqliteConnection) -> Result<()> {
    let sql = include_str!("../sql/collect/prepare_collect_ui_work.sql");
    execute_named_queries(
        &mut *conn,
        &sql,
        &hash_params(&vec![(":collect_root", constants::COLLECT_ROOT.into())]).with_location()?,
    )
    .await
    .with_location()?;

    Ok(())
}

pub async fn reflesh_collect_work(conn: &mut SqliteConnection) -> Result<()> {
    sqlx::query("DELETE FROM COLLECT_FILTER_WORK;")
        .execute(&mut *conn)
        .await
        .with_location()?;

    let sql = include_str!("../sql/collect/insert_collect_filter_work_character.sql");
    execute_named_queries(
        &mut *conn,
        sql,
        &hash_params(&vec![
            (":uncategorized_dir", constants::UNCATEGORIZED_DIR.into()),
            (":collect_root", constants::COLLECT_ROOT.into()),
        ])
        .with_location()?,
    )
    .await
    .with_location()?;

    let sql = include_str!("../sql/collect/insert_collect_filter_work_series.sql");
    execute_named_queries(
        &mut *conn,
        sql,
        &hash_params(&vec![
            (":uncategorized_dir", constants::UNCATEGORIZED_DIR.into()),
            (":collect_root", constants::COLLECT_ROOT.into()),
        ])
        .with_location()?,
    )
    .await
    .with_location()?;

    let sql = include_str!("../sql/collect/delete_collect_filter_work.sql");
    execute_queries(&mut *conn, sql).await.with_location()?;

    let sql = include_str!("../sql/collect/update_after_count.sql");
    execute_queries(&mut *conn, sql).await.with_location()?;

    Ok(())
}

pub async fn sort_collect_work(conn: &mut SqliteConnection) -> Result<()> {
    let sql = include_str!("../sql/collect/sort_collect_work.sql");
    execute_queries(&mut *conn, sql).await.with_location()?;

    Ok(())
}

pub async fn get_collect_summary(pool: &SqlitePool) -> Result<Vec<CollectSummary>> {
    let sql = include_str!("../sql/collect/get_collect_summary.sql");
    let results = sqlx::query_as::<_, CollectSummary>(sql)
        .fetch_all(pool)
        .await
        .with_location()?;

    Ok(results)
}

pub async fn collect_character_info(conn: &mut SqliteConnection) -> Result<()> {
    let sql = include_str!("../sql/collect/collect_character_info.sql");
    execute_named_queries(
        &mut *conn,
        sql,
        &hash_params(&vec![(":collect_root", constants::COLLECT_ROOT.into())]).with_location()?,
    )
    .await
    .with_location()?;

    Ok(())
}

pub async fn collect_illust_detail(conn: &mut SqliteConnection) -> Result<()> {
    let sql = include_str!("../sql/collect/collect_illust_detail.sql");
    execute_queries(&mut *conn, sql).await.with_location()?;

    Ok(())
}

pub async fn mark_illust_move_targets(conn: &mut SqliteConnection) -> Result<Vec<MoveIllustFiles>> {
    let sql = include_str!("../sql/collect/prepare_tmp_move_candidates.sql");
    sqlx::query(sql).execute(&mut *conn).await.with_location()?;

    let rows: Vec<MoveIllustFiles> = sqlx::query_as("SELECT * FROM tmp_move_candidates")
        .fetch_all(&mut *conn)
        .await
        .with_location()?;

    // ファイルチェック
    let mut ng_keys = Vec::new();
    for row in &rows {
        let filename = format!("{}_p{}.{}", row.illust_id, row.suffix, row.extension);
        let src_path = Path::new(&row.src_dir).join(&filename);
        let dest_path = Path::new(&row.dest_dir).join(&filename);

        if !src_path.exists() {
            log_error(format!("移動元にファイルが存在しません: {:?}", src_path));
            ng_keys.push((row.illust_id, row.suffix));
        } else if dest_path.exists() {
            log_error(format!("移動先にファイルが存在します: {:?}", src_path));
            ng_keys.push((row.illust_id, row.suffix));
        }
    }

    // NGを削除
    for (illust_id, suffix) in ng_keys {
        sqlx::query("DELETE FROM tmp_move_candidates WHERE illust_id = ? AND suffix = ?")
            .bind(illust_id)
            .bind(suffix)
            .execute(&mut *conn)
            .await
            .with_location()?;
    }

    // 一括UPDATE
    let sql = include_str!("../sql/collect/update_from_move_candidates.sql");
    sqlx::query(sql).execute(&mut *conn).await.with_location()?;

    // 残ったOKを返す
    let ok_rows: Vec<MoveIllustFiles> = sqlx::query_as("SELECT * FROM tmp_move_candidates")
        .fetch_all(&mut *conn)
        .await
        .with_location()?;

    Ok(ok_rows)
}

pub fn apply_file_moves(rows: Vec<MoveIllustFiles>) {
    for row in rows {
        let MoveIllustFiles {
            illust_id,
            suffix,
            extension,
            src_dir,
            dest_dir,
        } = row;

        let filename = format!("{}_p{}.{}", illust_id, suffix, extension);
        let src_path = Path::new(&src_dir).join(&filename);
        let dest_path = Path::new(&dest_dir).join(&filename);

        if let Some(parent) = dest_path.parent() {
            if let Err(e) = fs::create_dir_all(parent) {
                log_error(format!("ディレクトリ作成失敗: {:?} | {}", parent, e));
                continue;
            }
        }

        match fs::rename(&src_path, &dest_path) {
            Ok(_) => {}
            Err(e) => {
                log_error(format!(
                    "ファイル移動失敗: {:?} → {:?} | {}",
                    src_path, dest_path, e
                ));
            }
        }
    }
}

pub async fn process_sync_db(root: String, pool: &SqlitePool) -> Result<Vec<FileSummary>> {
    let mut tx = pool.begin().await.with_location()?;
    let conn = tx.acquire().await.with_location()?;

    let missing_files;

    {
        let reg = Regex::new(r"^(\d+)_p(\d+)\.(jpg|png|jpeg)$").with_location()?;
        let mut paths_to_insert = Vec::new();

        // root以下の解析
        for entry in WalkDir::new(&root)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            if let Some(caps) = reg.captures(&entry.file_name().to_string_lossy()) {
                let path = entry.path();
                let save_dir = path
                    .parent()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();

                let temp_file = TempFile {
                    illust_id: caps[1].parse().with_location()?,
                    suffix: caps[2].parse().with_location()?,
                    extension: caps[3].to_string(),
                    save_dir,
                    path: path.to_string_lossy().to_string(),
                };
                paths_to_insert.push(temp_file);
            }
        }

        // SYNC_DB_WORK に一括 INSERT
        sqlx::query("DELETE FROM SYNC_DB_WORK")
            .execute(&mut *conn)
            .await
            .with_location()?;

        let sql = "INSERT INTO SYNC_DB_WORK (illust_id, suffix, extension, save_dir, path)
         VALUES (?, ?, ?, ?, ?)";

        for file in paths_to_insert {
            sqlx::query(sql)
                .bind(file.illust_id)
                .bind(file.suffix)
                .bind(file.extension)
                .bind(file.save_dir)
                .bind(file.path)
                .execute(&mut *conn)
                .await
                .with_location()?;
        }

        // メイン処理(SQL)
        let sql = include_str!("../sql/collect/process_sync_db.sql");
        execute_queries(&mut *conn, sql).await.with_location()?;

        // 重複ファイルをゴミ箱に
        let rows: Vec<String> = sqlx::query_scalar("SELECT path FROM tmp_to_trash")
            .fetch_all(&mut *tx)
            .await
            .with_location()?;

        for p in rows {
            let path = PathBuf::from(p);
            if path.exists() {
                trash::delete(&path).with_location()?;
            }
        }

        // 結果を返却
        let sql = "SELECT illust_id, suffix, path FROM tmp_missing_files";

        missing_files = sqlx::query_as::<_, FileSummary>(sql)
            .fetch_all(&mut *tx)
            .await
            .with_location()?;

        // 管理番号を更新
        update_cnum(&mut *tx).await.with_location()?;
    }

    tx.commit().await.with_location()?;

    Ok(missing_files)
}
