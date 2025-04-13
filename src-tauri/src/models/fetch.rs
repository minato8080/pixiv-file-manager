use serde::Serialize;
use ts_rs::TS;

#[derive(Serialize, TS)]
#[ts(export)]
pub struct ProcessStats {
    pub total_files: usize,
    pub failed_files: usize,
    pub processing_time_ms: u128,
    pub failed_file_paths: Vec<String>,
}

#[derive(Debug, Clone, TS)]
#[ts(export)]
pub struct FileDetail {
    pub id: u32,
    pub suffix: u8,
    pub save_dir: String,
    #[allow(dead_code)]
    pub save_path: String,
    pub extension: String,
}

#[derive(Debug, Clone, TS)]
#[ts(export)]
pub struct IdInfo {
    pub id: u32,
    pub save_path: String,
}

#[derive(Debug, Clone, TS)]
#[ts(export)]
pub struct DirDetail {
    pub id_info: Vec<IdInfo>,
    pub file_details: Vec<FileDetail>,
}
