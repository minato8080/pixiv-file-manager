# DB定義

- **ILLUST_INFO**
  - `illust_id`: INTEGER
  - `suffix`: INTEGER
  - `extension`: TEXT
  - `author_id`: INTEGER
  - `character`: TEXT
  - `save_dir`: TEXT
  - `update_time`: INTEGER
  - **PRIMARY KEY**: (`illust_id`, `suffix`)

- **ILLUST_INFO_WORK**
  - `illust_id`: INTEGER
  - `suffix`: INTEGER
  - `extension`: TEXT
  - `save_dir`: TEXT
  - `update_time`: TEXT
  - **PRIMARY KEY**: (`illust_id`, `suffix`, `extension`, `save_dir`)

- **TAG_INFO**
  - `illust_id`: INTEGER
  - `tag`: TEXT
  - **PRIMARY KEY**: (`illust_id`, `tag`)

  **CHARACTER_INFO**
  - `character`: TEXT
  - `save_dir`: TEXT
  - **PRIMARY KEY**: (`character`)

  - **AUTHOR_INFO**
  - `author_id`: INTEGER
  - `author_name`: TEXT
  - `author_account`: TEXT
  - **PRIMARY KEY**: (`author_id`)

- **SEARCH_HISTORY**
  - `tags`: TEXT
  - `character`: TEXT
  - `author_info`: TEXT
  - `condition`: TEXT
  - `timestamp`: TEXT
  - `result_count`: INTEGER

- **DB_INFO**
  - `update_time`: INTEGER