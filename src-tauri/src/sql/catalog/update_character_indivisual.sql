-- 1. illust_id ごとの最大 cnum を取得
DROP TABLE IF EXISTS tmp_max_cnum;
CREATE TEMP TABLE tmp_max_cnum AS
SELECT illust_id, COALESCE(MAX(cnum),0) AS max_cnum
FROM ILLUST_DETAIL
GROUP BY illust_id;

-- 2. 各リクエストに新しい cnum を割り当て tmp_next_cnum_ex に保存
DROP TABLE IF EXISTS tmp_next_cnum_ex;
CREATE TEMP TABLE tmp_next_cnum_ex AS
SELECT
    lt.illust_id,
    lt.suffix,
    D.cnum AS old_cnum,
    mc.max_cnum + ROW_NUMBER() OVER (PARTITION BY lt.illust_id ORDER BY lt.suffix) AS new_cnum,
    D.author_id,
    D.series
FROM tmp_label_target lt
JOIN ILLUST_INFO I
  ON I.illust_id = lt.illust_id AND I.suffix = lt.suffix
JOIN ILLUST_DETAIL D
  ON D.illust_id = I.illust_id AND D.cnum = I.cnum
JOIN tmp_max_cnum mc
  ON mc.illust_id = lt.illust_id;

-- 3. ILLUST_DETAIL に新規行を追加
INSERT INTO ILLUST_DETAIL (illust_id, cnum, author_id, character, series)
SELECT
  illust_id,
  new_cnum,
  author_id,
  :character,
  series
FROM tmp_next_cnum_ex;

-- 4. TAG_INFO 複製
INSERT INTO TAG_INFO (illust_id, cnum, tag)
SELECT
  nc.illust_id,
  nc.new_cnum,
  T.tag
FROM tmp_next_cnum_ex nc
JOIN TAG_INFO T
  ON T.illust_id = nc.illust_id AND T.cnum = nc.old_cnum;

-- 5. ILLUST_INFO 更新
UPDATE ILLUST_INFO
SET cnum = (
  SELECT new_cnum FROM tmp_next_cnum_ex nc
  WHERE nc.illust_id = ILLUST_INFO.illust_id
    AND nc.suffix = ILLUST_INFO.suffix
)
WHERE (illust_id, suffix) IN (SELECT illust_id, suffix FROM tmp_label_target);