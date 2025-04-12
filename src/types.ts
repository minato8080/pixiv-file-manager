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
  result_count: number;
}

export interface SearchResult {
  id: number;
  file_name: string;
  author: AuthorInfo;
  character: string | null;
  save_dir: string;
  update_time: string;
  thumbnail_url: string;
}

export interface AuthorInfo {
  author_id: number;
  author_name: string;
  author_account: string;
}

// TagsFetcher
export interface ProcessStats {
  total_files: number;
  failed_files: number;
  processing_time_ms: number;
  failed_file_paths: string[];
}
