use tauri::State;

use crate::models::{
    common::AppState,
    manage::{ExecuteResult, TagFixRule, TagFixRuleAction},
};

#[tauri::command]
pub fn get_tag_fix_rules(state: State<AppState>) -> Result<Vec<TagFixRule>, String> {
    let conn = state.db.lock().unwrap();
    // TODO: DBからSELECTして返す
    Ok(vec![]) // 仮
}

#[tauri::command]
pub fn add_tag_fix_rule(
    src_tag: String,
    dst_tag: Option<String>,
    action_type: TagFixRuleAction,
    state: State<AppState>,
) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    // TODO: DBにINSERT
    println!(
        "Add rule: {:?} -> {:?} ({:?})",
        src_tag, dst_tag, action_type
    );
    Ok(())
}

#[tauri::command]
pub fn update_tag_fix_rule(
    id: i64,
    src_tag: String,
    dst_tag: Option<String>,
    action_type: TagFixRuleAction,
    state: State<AppState>,
) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    // TODO: DBをUPDATE
    println!(
        "Update rule id={} : {:?} -> {:?} ({:?})",
        id, src_tag, dst_tag, action_type
    );
    Ok(())
}

#[tauri::command]
pub fn delete_tag_fix_rule(id: i64, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().unwrap();
    // TODO: DBをDELETE
    println!("Delete rule id={}", id);
    Ok(())
}

#[tauri::command]
pub fn execute_tag_fixes(state: State<AppState>) -> Result<ExecuteResult, String> {
    let conn = state.db.lock().unwrap();
    // TODO: DBでルールを読み込みTAG_INFOを修正
    let res = ExecuteResult {
        replaced: 0,
        deleted: 0,
        added: 0,
        total_updated: 0,
    };
    Ok(res)
}
