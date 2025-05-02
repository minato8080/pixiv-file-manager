use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export)]
pub struct EditTagReq {
    pub file_name: String,
    pub tags: Vec<String>,
}

// AssociateInfo型の定義
#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export)]
pub struct AssociateInfo {
    pub characters: Vec<AssociateCharacter>,
    pub save_dirs: Vec<AssociateSaveDir>,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export)]
pub struct  AssociateCharacter {
    pub character: String,
    pub count: i32,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export)]
pub struct AssociateSaveDir {
    pub save_dir: String,
    pub count: i32,
}