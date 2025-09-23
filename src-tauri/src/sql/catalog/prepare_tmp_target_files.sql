-- tmp_target_files に対象ファイルを登録
DROP TABLE IF EXISTS tmp_target_files;
CREATE TEMP TABLE tmp_target_files (illust_id INTEGER, suffix INTEGER);

INSERT INTO tmp_target_files (illust_id, suffix)
VALUES [(?, ?)];