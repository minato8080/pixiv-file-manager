use serde::Serialize;
use ts_rs::TS;

#[derive(Serialize, TS)]
#[ts(export)]
pub struct ProcessStats {
    pub total_files: u32,
    pub failed_files: u32,
    pub process_time: String,
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
    pub success: u32,
    pub fail: u32,
    pub current: u32,
    pub total: u32,
    pub elapsed_time: String,
    pub remaining_time: String,
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
