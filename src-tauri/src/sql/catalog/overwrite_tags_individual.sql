-- 1) suffixごとのタグ表現
DROP VIEW IF EXISTS tmp_in_per_suffix;
CREATE TEMP VIEW tmp_in_per_suffix AS
SELECT
    illust_id,
    suffix,
    GROUP_CONCAT(tag, ',' ORDER BY tag) AS tags_sorted
FROM tmp_edit_tags
GROUP BY illust_id, suffix;

-- 2) 同じタグ集合ごとに suffix をまとめる
DROP VIEW IF EXISTS tmp_in_groups;
CREATE TEMP VIEW tmp_in_groups AS
SELECT
    illust_id,
    tags_sorted,
    GROUP_CONCAT(suffix, ',' ORDER BY suffix) AS suf_set
FROM tmp_in_per_suffix
GROUP BY illust_id, tags_sorted;

-- 3) illust_id ごとの次の cnum
DROP VIEW IF EXISTS tmp_next_cn;
CREATE TEMP VIEW tmp_next_cn AS
SELECT illust_id, COALESCE(MAX(cnum),0)+1 AS next_cn
FROM ILLUST_INFO
GROUP BY illust_id;

-- 4) 新しい cnum を割り当て（タグ集合単位）
DROP TABLE IF EXISTS tmp_target_groups;
CREATE TEMP TABLE tmp_target_groups AS
SELECT
    ig.illust_id,
    ig.tags_sorted,
    ig.suf_set,
    nc.next_cn + ROW_NUMBER() OVER (PARTITION BY ig.illust_id ORDER BY ig.tags_sorted) - 1 AS new_cn
FROM tmp_in_groups ig
JOIN tmp_next_cn nc ON nc.illust_id = ig.illust_id;

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

-- 6) ILLUST_INFO を更新（新しい cnum に付け替え）
UPDATE ILLUST_INFO
SET cnum = (
    SELECT new_cn
    FROM tmp_target_suffix t
    WHERE t.illust_id = ILLUST_INFO.illust_id
      AND t.suffix    = ILLUST_INFO.suffix
)
WHERE (illust_id, suffix) IN (SELECT illust_id, suffix FROM tmp_target_suffix);

-- 7) ILLUST_DETAIL を複製
INSERT OR IGNORE INTO ILLUST_DETAIL (illust_id, cnum, author_id, character, series)
SELECT
    t.illust_id,
    t.new_cn,
    d.author_id,
    d.character,
    d.series
FROM tmp_target_suffix t
JOIN ILLUST_DETAIL d
  ON d.illust_id = t.illust_id AND d.cnum = (
      SELECT MAX(cnum) FROM ILLUST_DETAIL dd
      WHERE dd.illust_id = t.illust_id AND dd.cnum <> t.new_cn
  );

-- 8) TAG_INFO を複製
INSERT OR IGNORE INTO TAG_INFO (illust_id, cnum, tag)
SELECT
    t.illust_id,
    t.new_cn,
    et.tag
FROM tmp_edit_tags et
JOIN tmp_target_suffix t
  ON t.illust_id = et.illust_id AND t.suffix = et.suffix;
