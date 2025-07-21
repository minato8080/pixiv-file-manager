# DB 定義

- **ILLUST_INFO**

  - `illust_id`: INTEGER NOT NULL - イラストの識別子
  - `suffix`: INTEGER NOT NULL - イラストのサフィックス
  - `extension`: TEXT NOT NULL - ファイルの拡張子
  - `save_dir`: TEXT - イラストが保存されているディレクトリのパス
  - `control_num`: INTEGER NOT NULL - タグ用の管理番号
  - **PRIMARY KEY**: (`illust_id`, `suffix`)

- **ILLUST_DETAIL**

  - `illust_id`: INTEGER NOT NULL - イラストの識別子
  - `control_num`: INTEGER NOT NULL - タグ用の管理番号
  - `author_id`: INTEGER NOT NULL - 作者の識別子
  - `series`: TEXT - シリーズ名
  - `character`: TEXT - イラストのキャラクター名
  - **PRIMARY KEY**: (`illust_id`, `control_num`)

- **ILLUST_INFO_WORK**

  - `illust_id`: INTEGER NOT NULL - イラストの識別子
  - `suffix`: INTEGER NOT NULL - イラストのサフィックス
  - `extension`: TEXT NOT NULL - ファイルの拡張子
  - `save_dir`: TEXT NOT NULL - 保存ディレクトリのパス
  - `created_time`: INTEGER NOT NULL - 作成時刻
  - `file_size` : INTEGER NOT NULL - ファイルサイズ
  - `delete_flg` : INTEGER NOT NULL - 重複ファイルを削除するフラグ
  - `insert_flg` : INTEGER NOT NULL - DB に追加するフラグ
  - `ignore_flg` : INTEGER NOT NULL - API フェッチから除外するフラグ
  - **PRIMARY KEY**: (`illust_id`, `suffix`, `extension`, `save_dir`)

- **TAG_INFO**

  - `illust_id`: INTEGER NOT NULL - イラストの識別子
  - `control_num`: INTEGER NOT NULL - 管理番号
  - `tag`: TEXT NOT NULL - タグ名
  - **PRIMARY KEY**: (`illust_id`, `control_num`, `tag`)

- **CHARACTER_INFO**

  - `series`: TEXT NOT NULL - シリーズ名
  - `character`: TEXT NOT NULL - キャラクター名
  - `collect_dir`: TEXT - コレクションディレクトリ
  - **PRIMARY KEY**: (`character`, `series`)

- **COLLECT_UI_WORK**

  - `id`: INTEGER NOT NULL API 用の連番
  - `series`: TEXT NOT NULL - シリーズ名
  - `character`: TEXT NOT NULL- キャラクター名
  - `collect_dir`: TEXT - コレクションディレクトリ
  - `before_count`: INTEGER
  - `after_count`: INTEGER
  - `unsave`: BOOLEAN
  - **PRIMARY KEY**: (`character`, `series`)

- **COLLECT_FILTER_WORK**

  - `illust_id`: INTEGER NOT NULL - イラストの識別子
  - `control_num`: INTEGER NOT NULL - タグ用の管理番号
  - `collect_type`: INTEGER NOT NULL - 0: キャラクター, 1: シリーズ
  - `series`: TEXT NOT NULL - シリーズ名
  - `character`: TEXT NOT NULL - イラストのキャラクター名
  - `save_dir`: TEXT - イラストが保存されているディレクトリのパス
  - `collect_dir`: TEXT - コレクションディレクトリ
  - **PRIMARY KEY**: (`illust_id`, `control_num`, `collect_type`)

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
