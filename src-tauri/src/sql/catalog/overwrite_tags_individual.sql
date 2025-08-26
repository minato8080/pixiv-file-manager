-- 1) suffixごとのタグ表現
DROP VIEW IF EXISTS tmp_keys_per_suffix;
CREATE TEMP VIEW tmp_keys_per_suffix AS
SELECT
    et.illust_id,
    et.suffix,
    D.character,
    D.series,
    GROUP_CONCAT(et.tag, ',' ORDER BY et.tag) AS tags_sorted
FROM tmp_edit_tags et
JOIN ILLUST_INFO I
  ON I.illust_id = et.illust_id AND I.suffix = et.suffix
JOIN ILLUST_DETAIL D
  ON D.illust_id = I.illust_id AND D.cnum = I.cnum
GROUP BY et.illust_id, et.suffix, D.character, D.series;

-- 2) 同じ (タグ集合, character, series) ごとに suffix をまとめる
DROP VIEW IF EXISTS tmp_group_by_keys;
CREATE TEMP VIEW tmp_group_by_keys AS
SELECT
    illust_id,
    tags_sorted,
    character,
    series,
    GROUP_CONCAT(suffix, ',' ORDER BY suffix) AS suf_set
FROM tmp_keys_per_suffix
GROUP BY illust_id, tags_sorted, character, series;

-- 3) illust_id ごとの次の cnum
DROP VIEW IF EXISTS tmp_next_cnum;
CREATE TEMP VIEW tmp_next_cnum AS
SELECT illust_id, COALESCE(MAX(cnum),0)+1 AS next_cn
FROM ILLUST_INFO
GROUP BY illust_id;

-- 4) 新しい cnum を割り当て（タグ+キャラ+シリーズ 単位）
DROP TABLE IF EXISTS tmp_target_groups;
CREATE TEMP TABLE tmp_target_groups AS
SELECT
    gk.illust_id,
    gk.tags_sorted,
    gk.character,
    gk.series,
    gk.suf_set,
    nc.next_cn + ROW_NUMBER() OVER (
      PARTITION BY gk.illust_id ORDER BY gk.tags_sorted, gk.character, gk.series
    ) - 1 AS new_cnum
FROM tmp_group_by_keys gk
JOIN tmp_next_cnum nc ON nc.illust_id = gk.illust_id;

-- 5) suffix 単位に展開（SQLite では再帰CTEを利用）
DROP TABLE IF EXISTS tmp_new_cnum;
CREATE TEMP TABLE tmp_new_cnum AS
WITH RECURSIVE split(illust_id, new_cnum, suf_set, suffix, rest) AS (
    SELECT
        illust_id,
        new_cnum,
        suf_set || ',',          -- 末尾にカンマを付ける
        '',                      -- 最初の suffix は空
        suf_set || ','            -- 残り
    FROM tmp_target_groups
    UNION ALL
    SELECT
        illust_id,
        new_cnum,
        suf_set,
        substr(rest, 0, instr(rest, ',')),
        substr(rest, instr(rest, ',')+1)
    FROM split
    WHERE rest <> ''
)
SELECT
    illust_id,
    new_cnum,
    suffix
FROM split
WHERE suffix <> '';

-- 6) old_cnum を控える
DROP TABLE IF EXISTS tmp_old_cnum;
CREATE TEMP TABLE tmp_old_cnum AS
SELECT I.illust_id, I.suffix, I.cnum AS old_cnum
FROM ILLUST_INFO I
JOIN tmp_new_cnum nc
  ON nc.illust_id = I.illust_id AND nc.suffix = I.suffix;

-- 7) ILLUST_INFO を更新（新しい cnum に付け替え）
UPDATE ILLUST_INFO
SET cnum = (
    SELECT new_cnum
    FROM tmp_new_cnum nc
    WHERE nc.illust_id = ILLUST_INFO.illust_id
      AND nc.suffix    = ILLUST_INFO.suffix
)
WHERE (illust_id, suffix) IN (SELECT illust_id, suffix FROM tmp_new_cnum);

-- 8) ILLUST_DETAIL を複製
INSERT OR IGNORE INTO ILLUST_DETAIL (illust_id, cnum, author_id, character, series)
SELECT
    nc.illust_id,
    nc.new_cnum,
    D.author_id,
    D.character,
    D.series
FROM tmp_new_cnum nc
JOIN tmp_old_cnum oc
  ON oc.illust_id = nc.illust_id AND oc.suffix = nc.suffix
JOIN ILLUST_DETAIL D
  ON D.illust_id = oc.illust_id AND D.cnum = oc.old_cnum;

-- 9) TAG_INFO を複製
INSERT OR IGNORE INTO TAG_INFO (illust_id, cnum, tag)
SELECT
    nc.illust_id,
    nc.new_cnum,
    et.tag
FROM tmp_edit_tags et
JOIN tmp_new_cnum nc
  ON nc.illust_id = et.illust_id AND nc.suffix = et.suffix;
