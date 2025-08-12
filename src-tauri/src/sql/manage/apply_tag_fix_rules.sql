DROP TABLE IF EXISTS temp.tag_fix_counts;
DROP TABLE IF EXISTS temp.rep_rules;
DROP TABLE IF EXISTS temp.del_rules;
DROP TABLE IF EXISTS temp.add_rules;
DROP TABLE IF EXISTS temp.tmp_replacements;
DROP TABLE IF EXISTS temp.add_targets;

-- カウンター用一時テーブル
CREATE TEMP TABLE IF NOT EXISTS tag_fix_counts (
    merged INTEGER DEFAULT 0,
    updated INTEGER DEFAULT 0,
    replaced INTEGER DEFAULT 0,
    deleted INTEGER DEFAULT 0,
    added INTEGER DEFAULT 0
);
INSERT INTO tag_fix_counts DEFAULT VALUES;

-- ルールをスナップショット（重複は除去）
CREATE TEMP TABLE rep_rules AS
  SELECT DISTINCT src_tag AS src, dst_tag AS dst
  FROM TAG_FIX_RULES WHERE action_type = 1 AND dst_tag IS NOT NULL;

CREATE TEMP TABLE del_rules AS
  SELECT DISTINCT src_tag AS src
  FROM TAG_FIX_RULES WHERE action_type = 2;

CREATE TEMP TABLE add_rules AS
  SELECT DISTINCT src_tag AS src, dst_tag AS dst
  FROM TAG_FIX_RULES WHERE action_type = 0 AND dst_tag IS NOT NULL;


-- === REPLACE（action_type = 1） ===
-- merged: src が存在し、同じ (illust_id, control_num) に dst もある件数（削除対象）
WITH merged_count AS (
  SELECT COUNT(*) AS cnt
  FROM TAG_INFO t
  JOIN rep_rules r ON t.tag = r.src
  WHERE EXISTS (
    SELECT 1 FROM TAG_INFO t2
    WHERE t2.illust_id = t.illust_id
      AND t2.control_num = t.control_num
      AND t2.tag = r.dst
  )
)
UPDATE tag_fix_counts SET merged = (SELECT cnt FROM merged_count);

-- 置換先が既にある場合にsrc行を削除（重複回避）
DELETE FROM TAG_INFO
WHERE EXISTS (
  SELECT 1 FROM rep_rules r
  WHERE TAG_INFO.tag = r.src
    AND EXISTS (
      SELECT 1 FROM TAG_INFO t2
      WHERE t2.illust_id = TAG_INFO.illust_id
        AND t2.control_num = TAG_INFO.control_num
        AND t2.tag = r.dst
    )
);

-- 変換対象を一時テーブルに
CREATE TEMP TABLE tmp_replacements AS
SELECT illust_id, control_num, r.dst AS tag
FROM TAG_INFO t
JOIN rep_rules r ON t.tag = r.src
WHERE NOT EXISTS (
  SELECT 1 FROM TAG_INFO t2
  WHERE t2.illust_id = t.illust_id
    AND t2.control_num = t.control_num
    AND t2.tag = r.dst
);

-- 置換件数を更新
WITH updated_count AS (
  SELECT COUNT(*) AS cnt FROM tmp_replacements
)
UPDATE tag_fix_counts SET replaced = (SELECT cnt FROM updated_count);

-- 元のsrc行を削除
DELETE FROM TAG_INFO WHERE tag IN (SELECT src FROM rep_rules);

-- 変換後のタグをINSERT
INSERT OR IGNORE INTO TAG_INFO (illust_id, control_num, tag)
SELECT illust_id, control_num, tag FROM tmp_replacements;

-- merged + updated を replaced として合算
UPDATE tag_fix_counts
SET merged = merged,
    updated = updated,
    replaced = merged + updated;

-- === DELETE（action_type = 2） ===
WITH del_count AS (
  SELECT COUNT(*) AS cnt FROM TAG_INFO WHERE tag IN (SELECT src FROM del_rules)
)
UPDATE tag_fix_counts SET deleted = (SELECT cnt FROM del_count);

DELETE FROM TAG_INFO WHERE tag IN (SELECT src FROM del_rules);


-- === ADD（action_type = 0） ===
-- 追加対象（重複除去）を一時テーブルに作る
CREATE TEMP TABLE add_targets AS
SELECT DISTINCT t.illust_id, t.control_num, r.dst
FROM TAG_INFO t
JOIN add_rules r ON r.src = t.tag
LEFT JOIN TAG_INFO t2
  ON t2.illust_id = t.illust_id
 AND t2.control_num = t.control_num
 AND t2.tag = r.dst
WHERE t2.illust_id IS NULL;

-- 追加件数を格納
WITH added_count AS (
  SELECT COUNT(*) AS cnt FROM add_targets
)
UPDATE tag_fix_counts SET added = (SELECT cnt FROM added_count);

-- 実際に追加（重複があれば無視）
INSERT OR IGNORE INTO TAG_INFO (illust_id, control_num, tag)
SELECT illust_id, control_num, dst FROM add_targets;