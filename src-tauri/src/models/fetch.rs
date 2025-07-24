use serde::Serialize;
use ts_rs::TS;

#[derive(Serialize, TS)]
#[ts(export)]
pub struct ProcessStats {
    pub total_files: usize,
    pub failed_files: usize,
    pub process_time_ms: u128,
    pub failed_file_paths: Vec<String>,
}

#[derive(Debug, Clone, TS)]
#[ts(export)]
pub struct FileDetail {
    pub id: u32,
    pub suffix: u8,
    pub save_dir: String,
    pub extension: String,
    pub created_time: i64,
    pub file_size: i64,
}

#[derive(Serialize, Debug, Clone, TS)]
#[ts(export)]
pub struct TagProgress {
    pub success: usize,
    pub fail: usize,
    pub current: usize,
    pub total: usize,
}

#[derive(Serialize, Debug, Clone, TS)]
#[ts(export)]
pub struct FolderCount {
    pub base_count: i32,
    pub sub_dir_count: i32,
}

#[derive(Serialize, Debug, Clone, TS)]
#[ts(export)]
pub struct FileCounts {
    pub folders: Vec<FolderCount>,
    pub total: i32,
    pub process_time: String,
}

#[derive(Debug)]
pub struct PreConvSequentialInfo {
    pub suffix: Vec<i64>,
    pub extension: Vec<String>,
    pub save_dir: Vec<String>,
    pub delete_flag: Vec<i64>,
    pub insert_flag: Vec<i64>,
    pub ignore_flag: Vec<i64>,
}

#[derive(Clone)]
pub struct PostConvSequentialInfo {
    pub suffix: i64,
    pub extension: String,
    pub save_dir: String,
    #[allow(dead_code)]
    pub delete_flag: i64,
    pub insert_flag: i64,
    pub ignore_flag: i64,
}

#[derive(Clone)]
pub struct IdInfo {
    pub illust_id: i64,
    pub sequential_info: Vec<PostConvSequentialInfo>,
}
