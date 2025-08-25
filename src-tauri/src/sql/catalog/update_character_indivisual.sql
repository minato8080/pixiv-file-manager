-- 1. illust_id ごとの最大 cnum を取得
DROP TABLE IF EXISTS tmp_max_cnum;
CREATE TEMP TABLE tmp_max_cnum AS
SELECT illust_id, COALESCE(MAX(cnum),0) AS max_cnum
FROM ILLUST_DETAIL
GROUP BY illust_id;

-- 2. 各リクエストに新しい cnum を割り当て tmp_next_cnums に保存
DROP TABLE IF EXISTS tmp_next_cnums;
CREATE TEMP TABLE tmp_next_cnums AS
SELECT
    tmp.illust_id,
    tmp.suffix,
    d.cnum AS old_cnum,
    mc.max_cnum + ROW_NUMBER() OVER (PARTITION BY tmp.illust_id ORDER BY tmp.suffix) AS new_cnum,
    d.author_id,
    d.series
FROM tmp_label_character tmp
JOIN ILLUST_INFO i
  ON i.illust_id = tmp.illust_id AND i.suffix = tmp.suffix
JOIN ILLUST_DETAIL d
  ON d.illust_id = i.illust_id AND d.cnum = i.cnum
JOIN tmp_max_cnum mc
  ON mc.illust_id = tmp.illust_id;

-- 2. ILLUST_DETAIL に新規行を追加
INSERT INTO ILLUST_DETAIL (illust_id, cnum, author_id, character, series)
SELECT
  illust_id,
  new_cnum,
  author_id,
  :character,
  series
FROM tmp_next_cnums;

-- 3. TAG_INFO 複製
INSERT INTO TAG_INFO (illust_id, cnum, tag)
SELECT
  nc.illust_id,
  nc.new_cnum,
  t.tag
FROM tmp_next_cnums nc
JOIN TAG_INFO t
  ON t.illust_id = nc.illust_id AND t.cnum = nc.old_cnum;

-- 4. ILLUST_INFO 更新
UPDATE ILLUST_INFO
SET cnum = (
  SELECT new_cnum FROM tmp_next_cnums nc
  WHERE nc.illust_id = ILLUST_INFO.illust_id
    AND nc.suffix = ILLUST_INFO.suffix
)
WHERE (illust_id, suffix) IN (SELECT illust_id, suffix FROM tmp_label_character);