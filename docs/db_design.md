# DB定義

- **ILLUST_INFO**
  - `illust_id`: INTEGER NOT NULL - イラストの識別子
  - `suffix`: INTEGER NOT NULL - イラストのサフィックス
  - `extension`: TEXT NOT NULL - ファイルの拡張子
  - `author_id`: INTEGER NOT NULL - 作者の識別子
  - `character`: TEXT - イラストのキャラクター名
  - `save_dir`: TEXT - イラストが保存されているディレクトリのパス
  - `control_num`: INTEGER NOT NULL - タグ用の管理番号
  - `update_time`: INTEGER NOT NULL - ファイルの更新時刻
  - **PRIMARY KEY**: (`illust_id`, `suffix`)

- **ILLUST_INFO_WORK**
  - `illust_id`: INTEGER NOT NULL - イラストの識別子
  - `suffix`: INTEGER NOT NULL - イラストのサフィックス
  - `extension`: TEXT NOT NULL - ファイルの拡張子
  - `save_dir`: TEXT NOT NULL - 保存ディレクトリのパス
  - `update_time`: INTEGER NOT NULL - 更新時刻
  - `file_size` : INTEGER NOT NULL - ファイルサイズ
  - `delete_flg` : INTEGER NOT NULL - 削除フラグ
  - `ignore_flg` : INTEGER NOT NULL - 無視フラグ
  - **PRIMARY KEY**: (`illust_id`, `suffix`, `extension`, `save_dir`)

- **TAG_INFO**
  - `illust_id`: INTEGER NOT NULL - イラストの識別子
  - `control_num`: INTEGER NOT NULL - 管理番号
  - `tag`: TEXT NOT NULL - タグ名
  - **PRIMARY KEY**: (`illust_id`, `control_num`, `tag`)

- **CHARACTER_INFO**
  - `character`: TEXT NOT NULL - キャラクター名
  - `collect_dir`: TEXT - コレクションディレクトリ
  - `series`: TEXT - シリーズ名
  - **PRIMARY KEY**: (`character`)

- **AUTHOR_INFO**
  - `author_id`: INTEGER NOT NULL - 作者の識別子
  - `author_name`: TEXT NOT NULL - 作者名
  - `author_account`: TEXT NOT NULL - 作者のアカウント
  - **PRIMARY KEY**: (`author_id`)

- **SEARCH_HISTORY**
  - `tags`: TEXT NOT NULL - 検索タグ
  - `character`: TEXT - 検索キャラクター
  - `author_info`: TEXT - 作者情報
  - `condition`: TEXT NOT NULL - 検索条件
  - `timestamp`: TEXT NOT NULL - タイムスタンプ
  - `result_count`: INTEGER NOT NULL - 結果数

- **DB_INFO**
  - `root`: TEXT - ルートパス