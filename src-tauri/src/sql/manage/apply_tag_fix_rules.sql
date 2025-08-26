-- カウンター用一時テーブル
DROP TABLE IF EXISTS tmp_tag_fix_counts;
CREATE TEMP TABLE tmp_tag_fix_counts (
    merged INTEGER DEFAULT 0,
    updated INTEGER DEFAULT 0,
    replaced INTEGER DEFAULT 0,
    deleted INTEGER DEFAULT 0,
    added INTEGER DEFAULT 0
);
INSERT INTO tmp_tag_fix_counts DEFAULT VALUES;

-- ルールをスナップショット（重複は除去）
DROP TABLE IF EXISTS tmp_rep_rules;
CREATE TEMP TABLE tmp_rep_rules AS
  SELECT DISTINCT src_tag AS src, dst_tag AS dst
  FROM TAG_FIX_RULES WHERE action_type = 1 AND dst_tag IS NOT NULL;

DROP TABLE IF EXISTS tmp_del_rules;
CREATE TEMP TABLE tmp_del_rules AS
  SELECT DISTINCT src_tag AS src
  FROM TAG_FIX_RULES WHERE action_type = 2;

DROP TABLE IF EXISTS tmp_add_rules;
CREATE TEMP TABLE tmp_add_rules AS
  SELECT DISTINCT src_tag AS src, dst_tag AS dst
  FROM TAG_FIX_RULES WHERE action_type = 0 AND dst_tag IS NOT NULL;


-- === REPLACE（action_type = 1） ===
-- merged: src が存在し、同じ (illust_id, cnum) に dst もある件数（削除対象）
WITH merged_count AS (
  SELECT COUNT(*) AS cnt
  FROM TAG_INFO T1
  JOIN tmp_rep_rules rr ON T1.tag = rr.src
  WHERE EXISTS (
    SELECT 1 FROM TAG_INFO T2
    WHERE T2.illust_id = T1.illust_id
      AND T2.cnum = T1.cnum
      AND T2.tag = rr.dst
  )
)
UPDATE tmp_tag_fix_counts SET merged = (SELECT cnt FROM merged_count);

-- 置換先が既にある場合にsrc行を削除（重複回避）
DELETE FROM TAG_INFO
WHERE EXISTS (
  SELECT 1 FROM tmp_rep_rules rr
  WHERE TAG_INFO.tag = rr.src
    AND EXISTS (
      SELECT 1 FROM TAG_INFO T2
      WHERE T2.illust_id = TAG_INFO.illust_id
        AND T2.cnum = TAG_INFO.cnum
        AND T2.tag = rr.dst
    )
);

-- 変換対象を一時テーブルに
DROP TABLE IF EXISTS tmp_replacements;
CREATE TEMP TABLE tmp_replacements AS
SELECT illust_id, cnum, rr.dst AS tag
FROM TAG_INFO T1
JOIN tmp_rep_rules rr ON T1.tag = rr.src
WHERE NOT EXISTS (
  SELECT 1 FROM TAG_INFO T2
  WHERE T2.illust_id = T1.illust_id
    AND T2.cnum = T1.cnum
    AND T2.tag = rr.dst
);

-- 置換件数を更新
WITH updated_count AS (
  SELECT COUNT(*) AS cnt FROM tmp_replacements
)
UPDATE tmp_tag_fix_counts SET replaced = (SELECT cnt FROM updated_count);

-- 元のsrc行を削除
DELETE FROM TAG_INFO WHERE tag IN (SELECT src FROM tmp_rep_rules);

-- 変換後のタグをINSERT
INSERT OR IGNORE INTO TAG_INFO (illust_id, cnum, tag)
SELECT illust_id, cnum, tag FROM tmp_replacements;

-- merged + updated を replaced として合算
UPDATE tmp_tag_fix_counts
SET merged = merged,
    updated = updated,
    replaced = merged + updated;

-- === DELETE（action_type = 2） ===
WITH del_count AS (
  SELECT COUNT(*) AS cnt FROM TAG_INFO WHERE tag IN (SELECT src FROM tmp_del_rules)
)
UPDATE tmp_tag_fix_counts SET deleted = (SELECT cnt FROM del_count);

DELETE FROM TAG_INFO WHERE tag IN (SELECT src FROM tmp_del_rules);


-- === ADD（action_type = 0） ===
-- 追加対象（重複除去）を一時テーブルに作る
DROP TABLE IF EXISTS tmp_add_targets;
CREATE TEMP TABLE tmp_add_targets AS
SELECT DISTINCT T1.illust_id, T1.cnum, ar.dst
FROM TAG_INFO T1
JOIN tmp_add_rules ar ON ar.src = T1.tag
LEFT JOIN TAG_INFO T2
  ON T2.illust_id = T1.illust_id
 AND T2.cnum = T1.cnum
 AND T2.tag = ar.dst
WHERE T2.illust_id IS NULL;

-- 追加件数を格納
WITH added_count AS (
  SELECT COUNT(*) AS cnt FROM tmp_add_targets
)
UPDATE tmp_tag_fix_counts SET added = (SELECT cnt FROM added_count);

-- 実際に追加（重複があれば無視）
INSERT OR IGNORE INTO TAG_INFO (illust_id, cnum, tag)
SELECT illust_id, cnum, dst FROM tmp_add_targets;