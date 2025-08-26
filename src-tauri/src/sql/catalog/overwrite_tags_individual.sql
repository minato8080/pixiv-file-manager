-- 1) suffixごとのタグ表現
DROP VIEW IF EXISTS tmp_in_per_suffix;
CREATE TEMP VIEW tmp_in_per_suffix AS
SELECT
    et.illust_id,
    et.suffix,
    d.character,
    d.series,
    GROUP_CONCAT(et.tag, ',' ORDER BY et.tag) AS tags_sorted
FROM tmp_edit_tags et
JOIN ILLUST_INFO i
  ON i.illust_id = et.illust_id AND i.suffix = et.suffix
JOIN ILLUST_DETAIL d
  ON d.illust_id = i.illust_id AND d.cnum = i.cnum
GROUP BY et.illust_id, et.suffix, d.character, d.series;

-- 2) 同じ (タグ集合, character, series) ごとに suffix をまとめる
DROP VIEW IF EXISTS tmp_in_groups;
CREATE TEMP VIEW tmp_in_groups AS
SELECT
    illust_id,
    tags_sorted,
    character,
    series,
    GROUP_CONCAT(suffix, ',' ORDER BY suffix) AS suf_set
FROM tmp_in_per_suffix
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
    ig.illust_id,
    ig.tags_sorted,
    ig.character,
    ig.series,
    ig.suf_set,
    nc.next_cn + ROW_NUMBER() OVER (
      PARTITION BY ig.illust_id ORDER BY ig.tags_sorted, ig.character, ig.series
    ) - 1 AS new_cn
FROM tmp_in_groups ig
JOIN tmp_next_cnum nc ON nc.illust_id = ig.illust_id;

-- 5) suffix 単位に展開（SQLite では再帰CTEを利用）
DROP TABLE IF EXISTS tmp_target_suffix;
CREATE TEMP TABLE tmp_target_suffix AS
WITH RECURSIVE split(illust_id, new_cn, suf_set, suffix, rest) AS (
    SELECT
        illust_id,
        new_cn,
        suf_set || ',',          -- 末尾にカンマを付ける
        '',                      -- 最初の suffix は空
        suf_set || ','            -- 残り
    FROM tmp_target_groups
    UNION ALL
    SELECT
        illust_id,
        new_cn,
        suf_set,
        substr(rest, 0, instr(rest, ',')),
        substr(rest, instr(rest, ',')+1)
    FROM split
    WHERE rest <> ''
)
SELECT
    illust_id,
    new_cn,
    suffix
FROM split
WHERE suffix <> '';

-- 6) old_cnum を控える
DROP TABLE IF EXISTS tmp_old_cnum;
CREATE TEMP TABLE tmp_old_cnum AS
SELECT i.illust_id, i.suffix, i.cnum AS old_cn
FROM ILLUST_INFO i
JOIN tmp_target_suffix t
  ON t.illust_id = i.illust_id AND t.suffix = i.suffix;

-- 7) ILLUST_INFO を更新（新しい cnum に付け替え）
UPDATE ILLUST_INFO
SET cnum = (
    SELECT new_cn
    FROM tmp_target_suffix t
    WHERE t.illust_id = ILLUST_INFO.illust_id
      AND t.suffix    = ILLUST_INFO.suffix
)
WHERE (illust_id, suffix) IN (SELECT illust_id, suffix FROM tmp_target_suffix);

-- 8) ILLUST_DETAIL を複製
INSERT OR IGNORE INTO ILLUST_DETAIL (illust_id, cnum, author_id, character, series)
SELECT
    t.illust_id,
    t.new_cn,
    d.author_id,
    d.character,
    d.series
FROM tmp_target_suffix t
JOIN tmp_old_cnum om
  ON om.illust_id = t.illust_id AND om.suffix = t.suffix
JOIN ILLUST_DETAIL d
  ON d.illust_id = om.illust_id AND d.cnum = om.old_cn;

-- 9) TAG_INFO を複製
INSERT OR IGNORE INTO TAG_INFO (illust_id, cnum, tag)
SELECT
    t.illust_id,
    t.new_cn,
    et.tag
FROM tmp_edit_tags et
JOIN tmp_target_suffix t
  ON t.illust_id = et.illust_id AND t.suffix = et.suffix;
