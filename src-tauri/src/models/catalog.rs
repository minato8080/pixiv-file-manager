use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export)]
pub struct EditTag {
    pub file_name: String,
    pub individual_tags: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export)]
pub struct EditTagReq {
    pub vec: Vec<EditTag>,
    pub overwrite_tags: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export)]
pub struct AssociateInfo {
    pub characters: Vec<AssociateCharacter>,
    pub save_dirs: Vec<AssociateSaveDir>,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export)]
pub struct AssociateCharacter {
    pub character: String,
    pub count: i32,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export)]
pub struct AssociateSaveDir {
    pub save_dir: String,
    pub count: i32,
}
