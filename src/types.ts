// TagsSearcher
export interface GetUniqueTagListResp {
  tag: string;
  count: number;
}

export interface SearchHistory {
  id: number;
  tags: GetUniqueTagListResp[];
  condition: "AND" | "OR";
  timestamp: Date;
}

export interface SearchResult {
  id: number;
  file_name: string;
  author: string;
  character: string | null;
  save_dir: string;
  update_time: string;
  thumbnail_url: string;
}

// TagsFetcher
export interface ProcessStats {
    total_files: number
    failed_files: number
    processing_time_ms: number
    failed_file_paths: string[]
  }