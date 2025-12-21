DROP TABLE IF EXISTS tmp_move_by_character;
CREATE TEMP TABLE tmp_move_by_character AS
SELECT
    I.illust_id,
    I.suffix,
    I.extension,
    I.save_dir AS src_dir,
    F.collect_dir AS dest_dir
FROM COLLECT_FILTER_WORK F
JOIN ILLUST_INFO I
  ON F.illust_id = I.illust_id
 AND F.cnum = I.cnum
WHERE I.save_dir IS NOT NULL
  AND F.collect_dir IS NOT NULL
  AND I.save_dir <> F.collect_dir;

DROP TABLE IF EXISTS tmp_move_by_author;
CREATE TEMP TABLE tmp_move_by_author AS
SELECT
    I.illust_id,
    I.suffix,
    I.extension,
    I.save_dir AS src_dir,
    C.value || '\' || A.fs_author_name AS dest_dir
FROM ILLUST_INFO I
JOIN ILLUST_DETAIL D
  ON D.illust_id = I.illust_id
 AND D.cnum      = I.cnum
JOIN AUTHOR_INFO A
  ON A.author_id = D.author_id
JOIN COMMON_MST C
  ON C.key = :author_root
WHERE C.value IS NOT NULL
  AND C.value <> ''
  AND I.save_dir <> (C.value || '\' || A.fs_author_name)
  AND NOT EXISTS (
      SELECT 1
      FROM COLLECT_FILTER_WORK F
      WHERE F.illust_id = I.illust_id
        AND F.cnum      = I.cnum
  );

DROP TABLE IF EXISTS tmp_move;
CREATE TEMP TABLE tmp_move AS
SELECT illust_id, suffix, extension, src_dir, dest_dir, 2 AS pri
FROM tmp_move_by_author
UNION ALL
SELECT illust_id, suffix, extension, src_dir, dest_dir, 1 AS pri
FROM tmp_move_by_character;