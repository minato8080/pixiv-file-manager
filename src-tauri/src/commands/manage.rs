use crate::models::manage::{ExecuteResult, TagFixRule, TagFixRuleAction};

#[tauri::command]
pub async fn get_tag_fix_rules() -> Result<Vec<TagFixRule>, String> {
    // TODO: DBからSELECTして返す
    Ok(vec![]) // 仮
}

#[tauri::command]
pub async fn add_tag_fix_rule(
    src_tag: String,
    dst_tag: Option<String>,
    action_type: TagFixRuleAction,
) -> Result<(), String> {
    // TODO: DBにINSERT
    println!(
        "Add rule: {:?} -> {:?} ({:?})",
        src_tag, dst_tag, action_type
    );
    Ok(())
}

#[tauri::command]
pub async fn update_tag_fix_rule(
    id: i64,
    src_tag: String,
    dst_tag: Option<String>,
    action_type: TagFixRuleAction,
) -> Result<(), String> {
    // TODO: DBをUPDATE
    println!(
        "Update rule id={} : {:?} -> {:?} ({:?})",
        id, src_tag, dst_tag, action_type
    );
    Ok(())
}

#[tauri::command]
pub async fn delete_tag_fix_rule(id: i64) -> Result<(), String> {
    // TODO: DBをDELETE
    println!("Delete rule id={}", id);
    Ok(())
}

#[tauri::command]
pub async fn execute_tag_fixes() -> Result<ExecuteResult, String> {
    // TODO: DBでルールを読み込みTAG_INFOを修正
    let res = ExecuteResult {
        replaced: 0,
        deleted: 0,
        total_updated: 0,
    };
    Ok(res)
}
