# DB 定義

- **ILLUST_INFO**

  - `illust_id`: INTEGER NOT NULL - イラストの識別子
  - `suffix`: INTEGER NOT NULL - イラストのサフィックス
  - `extension`: TEXT NOT NULL - ファイルの拡張子
  - `save_dir`: TEXT - イラストが保存されているディレクトリのパス
  - `cnum`: INTEGER NOT NULL - タグ用の管理番号
  - **PRIMARY KEY**: (`illust_id`, `suffix`)

- **ILLUST_DETAIL**

  - `illust_id`: INTEGER NOT NULL - イラストの識別子
  - `cnum`: INTEGER NOT NULL - タグ用の管理番号
  - `author_id`: INTEGER NOT NULL - 作者の識別子
  - `series`: TEXT - シリーズ名
  - `character`: TEXT - イラストのキャラクター名
  - **PRIMARY KEY**: (`illust_id`, `cnum`)

- **TAG_INFO**

  - `illust_id`: INTEGER NOT NULL - イラストの識別子
  - `cnum`: INTEGER NOT NULL - 管理番号
  - `tag`: TEXT NOT NULL - タグ名
  - **PRIMARY KEY**: (`illust_id`, `cnum`, `tag`)

- **CHARACTER_INFO**

  - `entity_key`: TEXT NOT NULL - シリーズまたはキャラクター
  - `series`: TEXT - シリーズ名
  - `character`: TEXT - キャラクター名
  - `collect_dir`: TEXT - コレクションディレクトリ
  - **PRIMARY KEY**: (`entity_key`)

- **AUTHOR_INFO**

  - `author_id`: INTEGER NOT NULL - 作者の識別子
  - `author_name`: TEXT NOT NULL - 作者名
  - `author_account`: TEXT NOT NULL - 作者のアカウント
  - **PRIMARY KEY**: (`author_id`)

- **TAG_FIX_RULES**

  - `id`: INTEGER AUTOINCREMENT - ルールの一意 ID
  - `src_tag`: TEXT NOT NULL - 修正元タグ
  - `dst_tag`: TEXT - 修正先タグ（削除の場合は NULL）
  - `action_type`: INTEGER NOT NULL - 0:Add, 1:Replace, 2:Delete
  - `created_at`: INTEGER NOT NULL - 作成日時（UNIX time）
  - **PRIMARY KEY**: (`id`)

- **COMMON_MST**

  - `key`: TEXT NOT NULL
  - `value`: TEXT
  - **PRIMARY KEY**: (`key`)

- **ILLUST_FETCH_WORK**

  - `id`: INTEGER NOT NULL - サロゲートキー
  - `illust_id`: INTEGER NOT NULL - イラストの識別子
  - `suffix`: INTEGER NOT NULL - イラストのサフィックス
  - `extension`: TEXT NOT NULL - ファイルの拡張子
  - `save_dir`: TEXT NOT NULL - 保存ディレクトリのパス
  - `created_time`: INTEGER NOT NULL - 作成時刻
  - `file_size` : INTEGER NOT NULL - ファイルサイズ
  - **PRIMARY KEY**: (`id`)

- **COLLECT_UI_WORK**

  - `id`: INTEGER NOT NULL API 用の連番
  - `entity_key`: TEXT NOT NULL - シリーズまたはキャラクター
  - `series`: TEXT - シリーズ名
  - `character`: TEXT - キャラクター名
  - `collect_dir`: TEXT - コレクションディレクトリ
  - `before_count`: INTEGER
  - `after_count`: INTEGER
  - `unsave`: BOOLEAN
  - `collect_type`: INTEGER NOT NULL - 0: 未整理, 1: シリーズ, 2: キャラクター, 3: 削除
  - **PRIMARY KEY**: (`entity_key`)

- **COLLECT_FILTER_WORK**

  - `illust_id`: INTEGER NOT NULL - イラストの識別子
  - `cnum`: INTEGER NOT NULL - タグ用の管理番号
  - `collect_type`: INTEGER NOT NULL - 1: シリーズ, 2: キャラクター, 4: 移動
  - `series`: TEXT - シリーズ名
  - `character`: TEXT - キャラクター名
  - `collect_dir`: TEXT - コレクションディレクトリ
  - **PRIMARY KEY**: (`illust_id`, `cnum`, `collect_type`)

- **SYNC_DB_WORK**

  - `illust_id`: INTEGER NOT NULL - イラストの識別子
  - `suffix`: INTEGER NOT NULL - ファイルのサフィックス
  - `extension`: TEXT NOT NULL - ファイルの拡張子
  - `save_dir`: TEXT NOT NULL - 保存ディレクトリのパス
  - `in_db`: BOOLEAN DEFAULT 0 - データベースに存在するかのフラグ
