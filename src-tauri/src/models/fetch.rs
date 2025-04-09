use serde::Serialize;

#[derive(Serialize)]
pub struct ProcessStats {
    pub total_files: usize,
    pub failed_files: usize,
    pub processing_time_ms: u128,
    pub failed_file_paths: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct FileDetail {
    pub id: String,
    pub suffix: String,
    pub save_path: String,
    pub extension: String,
}

#[derive(Debug, Clone)]
pub struct IdInfo {
    pub id: String,
    pub save_dir: String,
    pub save_path: String,
}

#[derive(Debug, Clone)]
pub struct DirDetail {
    pub id_info: Vec<IdInfo>,
    pub file_details: Vec<FileDetail>,
}