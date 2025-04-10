# DB定義

- **ID_DETAIL**
  - `id`: INTEGER
  - `suffix`: INTEGER
  - `extension`: TEXT
  - `author_name`: TEXT
  - `author_account`: TEXT
  - `character`: TEXT
  - `save_dir`: TEXT
  - **PRIMARY KEY**: (`id`, `suffix`)

- **TAG_INFO**
  - `id`: INTEGER
  - `tag`: TEXT
  - **PRIMARY KEY**: (`id`, `tag`)

- **DB_INFO**
  - `update_time`: TEXT
