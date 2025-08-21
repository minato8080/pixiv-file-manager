CREATE TABLE IF NOT EXISTS ILLUST_INFO (
    illust_id INTEGER NOT NULL,
    suffix INTEGER NOT NULL,
    cnum INTEGER NOT NULL,
    extension TEXT NOT NULL,
    save_dir TEXT,
    PRIMARY KEY (illust_id, suffix)
);
CREATE INDEX IF NOT EXISTS idx_illust_info_illust_control ON ILLUST_INFO(illust_id, cnum);
CREATE INDEX IF NOT EXISTS idx_illust_info_save_dir ON ILLUST_INFO(save_dir);


CREATE TABLE IF NOT EXISTS ILLUST_DETAIL (
    illust_id INTEGER NOT NULL,
    cnum INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    series TEXT,
    character TEXT,
    PRIMARY KEY (illust_id, cnum)
);
CREATE INDEX IF NOT EXISTS idx_illust_detail_character ON ILLUST_DETAIL(character);
CREATE INDEX IF NOT EXISTS idx_illust_detail_illust_control ON ILLUST_DETAIL(illust_id, cnum);


CREATE TABLE IF NOT EXISTS ILLUST_FETCH_WORK (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    illust_id INTEGER NOT NULL,
    suffix INTEGER NOT NULL,
    extension TEXT NOT NULL,
    save_dir TEXT NOT NULL,
    created_time INTEGER NOT NULL,
    file_size INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_illust_fetch_uniq_illust_suffix ON ILLUST_FETCH_WORK (illust_id, suffix);
CREATE INDEX IF NOT EXISTS idx_illust_fetch_save_dir ON ILLUST_FETCH_WORK (save_dir);


CREATE TABLE IF NOT EXISTS TAG_INFO (
    illust_id INTEGER NOT NULL,
    cnum INTEGER NOT NULL,
    tag TEXT NOT NULL,
    PRIMARY KEY (illust_id, cnum, tag)
);
CREATE INDEX IF NOT EXISTS idx_tag_info_tag ON TAG_INFO(tag);
CREATE INDEX IF NOT EXISTS idx_tag_info_illust_control ON TAG_INFO(illust_id, cnum);


CREATE TABLE IF NOT EXISTS CHARACTER_INFO (
    series TEXT NOT NULL,
    character TEXT NOT NULL,
    collect_dir TEXT,
    PRIMARY KEY (character, series)
);
CREATE INDEX IF NOT EXISTS idx_character_info_series_character ON CHARACTER_INFO(series, character);


CREATE TABLE IF NOT EXISTS COLLECT_UI_WORK (
    id INTEGER NOT NULL,
    series TEXT NOT NULL,
    character TEXT NOT NULL,
    collect_dir TEXT,
    before_count INTEGER,
    after_count INTEGER,
    unsave BOOLEAN,
    collect_type INTEGER NOT NULL,
    PRIMARY KEY (series, character)
);
CREATE INDEX IF NOT EXISTS idx_collect_ui_work_character ON COLLECT_UI_WORK(character);
CREATE INDEX IF NOT EXISTS idx_collect_ui_work_series ON COLLECT_UI_WORK(series);


CREATE TABLE IF NOT EXISTS COLLECT_FILTER_WORK (
    illust_id INTEGER NOT NULL,
    cnum INTEGER NOT NULL,
    series TEXT NOT NULL,
    character TEXT NOT NULL,
    save_dir TEXT,
    collect_dir TEXT,
    collect_type INTEGER NOT NULL,
    PRIMARY KEY (illust_id, cnum, collect_type)
);
CREATE INDEX IF NOT EXISTS idx_cfw_ic_type ON COLLECT_FILTER_WORK (illust_id, cnum, collect_type);


CREATE TABLE IF NOT EXISTS AUTHOR_INFO (
    author_id INTEGER NOT NULL,
    author_name TEXT NOT NULL,
    author_account TEXT NOT NULL,
    PRIMARY KEY (author_id)
);
INSERT OR IGNORE INTO AUTHOR_INFO (author_id, author_name, author_account) VALUES (0, 'Missing', 'Missing');


CREATE TABLE IF NOT EXISTS SEARCH_HISTORY (
    tags TEXT NOT NULL,
    character TEXT,
    author_info TEXT,
    condition TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    result_count INTEGER NOT NULL
);


CREATE TABLE IF NOT EXISTS TAG_FIX_RULES (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    src_tag TEXT NOT NULL,
    dst_tag TEXT,
    action_type INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tag_fix_rules_src_tag ON TAG_FIX_RULES(src_tag);
CREATE INDEX IF NOT EXISTS idx_tag_fix_rules_dst_tag ON TAG_FIX_RULES(dst_tag);


CREATE TABLE IF NOT EXISTS COMMON_MST (
    key TEXT NOT NULL,
    value TEXT,
    PRIMARY KEY (key)
);

CREATE TABLE IF NOT EXISTS SYNC_DB_WORK (
    illust_id INTEGER NOT NULL,
    suffix INTEGER NOT NULL,
    extension TEXT NOT NULL,
    save_dir TEXT NOT NULL,
    path TEXT NOT NULL,
    in_db BOOLEAN DEFAULT 0
);