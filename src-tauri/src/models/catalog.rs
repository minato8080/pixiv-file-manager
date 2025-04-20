use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, Debug, Clone, TS)]
#[ts(export)]
pub struct EditTagReq {
    pub file_name: String,
    pub tags: Vec<String>,
}
