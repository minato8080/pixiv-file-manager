# Pixiv ファイルマネージャー

[xuejianxianzun](https://github.com/xuejianxianzun)さんの[Chrome 拡張](https://github.com/xuejianxianzun/PixivBatchDownloader)でダウンロードしたローカルファイルを整理する GUI アプリ。

## 機能一覧

### 1. タグ検索画面

- タグ、作者、キャラクター、ID による検索
- ファイルの移動・削除
- キャラクター名・タグの各種登録

### 2. タグ取得画面

- タグ情報を Pixiv から取得
- ローカルファイルを DB に登録

### 3. ファイル整理画面

- シリーズ・キャラクター単位での集計・ファイル整理
- DB とディレクトリ の同期

### 4. タグ管理画面

- タグの置換・追加・削除

### 3. 設定画面

- 各種アプリの設定

## 技術スタック

フロントエンド：React, TypeScript

バックエンド：Tauri + Rust

データベース：SQLite3
