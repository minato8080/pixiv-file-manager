use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, Debug, Clone, Default, TS)]
#[ts(export)]
#[serde(rename_all = "UPPERCASE")]
pub struct EnvConfig {
    pixiv_id: String,
    pixiv_pw: String,
    refresh_token: String,
    interval_mill_sec: String,
    db_name: String,
}
