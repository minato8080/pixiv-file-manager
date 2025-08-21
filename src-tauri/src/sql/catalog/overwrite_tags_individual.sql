-- 1) リクエスト (tmp_edit_tags: illust_id, suffix, tag) から
--    suffixごとのタグ表現と、タググループごとの suffix 集合を作る
DROP VIEW  IF EXISTS tmp_in_per_suffix;
CREATE TEMP VIEW tmp_in_per_suffix AS
SELECT
  illust_id,
  suffix,
  GROUP_CONCAT(tag, ',' ORDER BY tag) AS tags_sorted
FROM tmp_edit_tags
GROUP BY illust_id, suffix;

DROP VIEW  IF EXISTS tmp_in_groups;
CREATE TEMP VIEW tmp_in_groups AS
SELECT
  illust_id,
  tags_sorted,                                           -- グループキー（同一タグ集合）
  GROUP_CONCAT(suffix, ',' ORDER BY suffix) AS suf_set,  -- その集合に属する suffix 一覧（正規化）
  COUNT(*) AS suf_count
FROM tmp_in_per_suffix
GROUP BY illust_id, tags_sorted;

-- 2) DB 側の cnum ごとの suffix 集合を作る
DROP VIEW  IF EXISTS tmp_db_groups;
CREATE TEMP VIEW tmp_db_groups AS
SELECT
  illust_id,
  cnum,
  GROUP_CONCAT(suffix, ',' ORDER BY suffix) AS suf_set,  -- 正規化
  COUNT(*) AS suf_count
FROM ILLUST_INFO
GROUP BY illust_id, cnum;

-- 3) illust_id ごとの次の cnum（新規発番用）
DROP VIEW  IF EXISTS tmp_next_cn;
CREATE TEMP VIEW tmp_next_cn AS
SELECT illust_id, COALESCE(MAX(cnum), 0) + 1 AS next_cn
FROM ILLUST_INFO
GROUP BY illust_id;

-- 4) 「完全一致」判定：
--    リクエスト側グループ(suf_set)とDB側グループ(suf_set)が一致すれば既存 cnum を再利用、
--    見つからなければ next_cn を採用
DROP TABLE IF EXISTS tmp_target_groups;
CREATE TEMP TABLE tmp_target_groups AS
SELECT
  ig.illust_id,
  ig.tags_sorted,
  ig.suf_set,
  COALESCE(dg.cnum, nc.next_cn) AS chosen_cn,
  CASE WHEN dg.cnum IS NULL THEN 1 ELSE 0 END AS is_new
FROM tmp_in_groups ig
LEFT JOIN tmp_db_groups dg
  ON dg.illust_id = ig.illust_id
 AND dg.suf_set    = ig.suf_set
LEFT JOIN tmp_next_cn nc
  ON nc.illust_id  = ig.illust_id;

-- 5) suffix 単位に chosen_cn を割り当てる
DROP TABLE IF EXISTS tmp_target_suffix;
CREATE TEMP TABLE tmp_target_suffix AS
SELECT
  ps.illust_id,
  ps.suffix,
  tg.chosen_cn,
  tg.is_new
FROM tmp_in_per_suffix ps
JOIN tmp_target_groups tg
  ON tg.illust_id  = ps.illust_id
 AND tg.tags_sorted = ps.tags_sorted;

-- （任意）更新前の旧 cnum を控えておく（ILLUST_DETAIL 複製に使う）
DROP TABLE IF EXISTS tmp_old_map;
CREATE TEMP TABLE tmp_old_map AS
SELECT i.illust_id, i.suffix, i.cnum AS old_cn
FROM ILLUST_INFO i
JOIN tmp_target_suffix t
  ON t.illust_id = i.illust_id
 AND t.suffix    = i.suffix;

-- 6) ILLUST_INFO を suffix 単位で chosen_cn に更新
UPDATE ILLUST_INFO
SET cnum = (
  SELECT chosen_cn
  FROM tmp_target_suffix t
  WHERE t.illust_id = ILLUST_INFO.illust_id
    AND t.suffix    = ILLUST_INFO.suffix
)
WHERE (illust_id, suffix) IN (SELECT illust_id, suffix FROM tmp_target_suffix);

-- 7) 新規 cnum が発生したグループだけ ILLUST_DETAIL を複製
DROP TABLE IF EXISTS tmp_new_groups;
CREATE TEMP TABLE tmp_new_groups AS
SELECT
  tg.illust_id,
  tg.chosen_cn AS new_cn,
  MIN(om.old_cn) AS src_cn       -- 任意の元 cn をコピー元とする
FROM tmp_target_groups tg
JOIN tmp_target_suffix ts
  ON ts.illust_id = tg.illust_id
JOIN tmp_old_map om
  ON om.illust_id = ts.illust_id AND om.suffix = ts.suffix
WHERE tg.is_new = 1
GROUP BY tg.illust_id, tg.chosen_cn;

INSERT OR IGNORE INTO ILLUST_DETAIL (illust_id, cnum, author_id, character)
SELECT ng.illust_id, ng.new_cn, d.author_id, d.character
FROM tmp_new_groups ng
JOIN ILLUST_DETAIL d
  ON d.illust_id = ng.illust_id AND d.cnum = ng.src_cn;

-- 8) 対象グループの TAG_INFO を「洗い替え」
--    ※ 完全一致で既存 cn を再利用する場合も、集合全体が対象なので一括で消して入れ直してOK
DROP VIEW IF EXISTS tmp_target_cn;
CREATE TEMP VIEW tmp_target_cn AS
SELECT DISTINCT illust_id, chosen_cn AS cnum
FROM tmp_target_groups;

-- 8-1) 既存タグ削除（対象 cn のみ。関係ない cn は触らない）
DELETE FROM TAG_INFO
WHERE (illust_id, cnum) IN (SELECT illust_id, cnum FROM tmp_target_cn);

-- 8-2) 新タグ挿入（グループごとに重複排除して投入）
INSERT OR IGNORE INTO TAG_INFO (illust_id, cnum, tag)
SELECT
  t.illust_id,
  tg.chosen_cn,
  t.tag
FROM tmp_edit_tags t
JOIN tmp_in_per_suffix ps
  ON ps.illust_id = t.illust_id AND ps.suffix = t.suffix
JOIN tmp_target_groups tg
  ON tg.illust_id = ps.illust_id AND tg.tags_sorted = ps.tags_sorted
GROUP BY t.illust_id, tg.chosen_cn, t.tag;

-- 9) 後片付け：もはや参照されなくなった cnum の孤児タグ/詳細を掃除
DELETE FROM TAG_INFO
WHERE NOT EXISTS (
  SELECT 1 FROM ILLUST_INFO i
  WHERE i.illust_id = TAG_INFO.illust_id
    AND i.cnum = TAG_INFO.cnum
);

DELETE FROM ILLUST_DETAIL
WHERE NOT EXISTS (
  SELECT 1 FROM ILLUST_INFO i
  WHERE i.illust_id = ILLUST_DETAIL.illust_id
    AND i.cnum = ILLUST_DETAIL.cnum
);
