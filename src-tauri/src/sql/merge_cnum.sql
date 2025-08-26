-- 1) cnum ごとにタグ集合を正規化して保持
DROP VIEW IF EXISTS tmp_tag_groups;
CREATE TEMP VIEW tmp_tag_groups AS
SELECT
  illust_id,
  cnum,
  GROUP_CONCAT(tag, ',' ORDER BY tag) AS tags_sorted
FROM TAG_INFO
GROUP BY illust_id, cnum;

-- 2) 同じ character + series + tag集合 を持つ cnum 群をまとめる
DROP TABLE IF EXISTS tmp_merge_candidates;
CREATE TEMP TABLE tmp_merge_candidates AS
SELECT
  D.illust_id,
  D.character,
  D.series,
  tg.tags_sorted,
  MIN(D.cnum) AS rep_cnum,              -- 代表 cnum
  GROUP_CONCAT(DISTINCT D.cnum) AS all_cnums
FROM ILLUST_DETAIL D
LEFT JOIN tmp_tag_groups tg
  ON tg.illust_id = D.illust_id AND tg.cnum = D.cnum
GROUP BY D.illust_id, D.character, D.series, tg.tags_sorted
HAVING COUNT(DISTINCT D.cnum) > 1;     -- 複数あるものだけ対象

-- 3) 代表以外を代表 cnum に寄せる
-- 3-1) ILLUST_INFO 更新
UPDATE ILLUST_INFO
SET cnum = (
  SELECT rep_cnum
  FROM tmp_merge_candidates mc
  WHERE mc.illust_id = ILLUST_INFO.illust_id
    AND mc.all_cnums LIKE '%' || ILLUST_INFO.cnum || '%'
    AND mc.rep_cnum <> ILLUST_INFO.cnum
)
WHERE EXISTS (
  SELECT 1
  FROM tmp_merge_candidates mc
  WHERE mc.illust_id = ILLUST_INFO.illust_id
    AND mc.all_cnums LIKE '%' || ILLUST_INFO.cnum || '%'
    AND mc.rep_cnum <> ILLUST_INFO.cnum
);

-- 3-2) TAG_INFO マージ（代表に集約）
INSERT OR IGNORE INTO TAG_INFO (illust_id, cnum, tag)
SELECT T.illust_id, mc.rep_cnum, T.tag
FROM TAG_INFO T
JOIN tmp_merge_candidates mc
  ON mc.illust_id = T.illust_id
 AND mc.all_cnums LIKE '%' || T.cnum || '%'
WHERE T.cnum <> mc.rep_cnum;

-- 4) 参照されなくなった ILLUST_DETAIL を削除
DELETE FROM ILLUST_DETAIL
WHERE NOT EXISTS (
  SELECT 1
  FROM ILLUST_INFO I
  WHERE I.illust_id = ILLUST_DETAIL.illust_id
    AND I.cnum = ILLUST_DETAIL.cnum
);

-- 5) 参照されなくなった TAG_INFO を削除
DELETE FROM TAG_INFO
WHERE NOT EXISTS (
  SELECT 1
  FROM ILLUST_INFO I
  WHERE I.illust_id = TAG_INFO.illust_id
    AND I.cnum = TAG_INFO.cnum
);