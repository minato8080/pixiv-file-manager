-- 1) 分裂が必要な (illust_id, cnum) を見つけ、
--    ディレクトリ単位（distinct save_dir）で新しい cnum を割り当てる
DROP TABLE IF EXISTS tmp_cnum_assign;
CREATE TEMP TABLE tmp_cnum_assign AS
WITH conflict_groups AS (
  -- 同じ illust_id & cnum なのに save_dir が異なるグループ
  SELECT I1.illust_id, I1.cnum AS old_cnum
  FROM ILLUST_INFO I1
  JOIN ILLUST_INFO I2
    ON I1.illust_id = I2.illust_id
   AND I1.cnum = I2.cnum
   AND IFNULL(I1.save_dir,'') <> IFNULL(I2.save_dir,'')
  GROUP BY I1.illust_id, I1.cnum
),
group_dirs AS (
  -- 分裂対象グループの「ディレクトリ単位」の集合
  SELECT DISTINCT I.illust_id, I.cnum AS old_cnum, I.save_dir
  FROM ILLUST_INFO I
  JOIN conflict_groups cg
    ON cg.illust_id = I.illust_id AND cg.old_cnum = I.cnum
),
dir_rank AS (
  -- 同じ (illust_id, old_cnum) 内で save_dir ごとにランク付け（1が元の番号を残す代表）
  SELECT gd.*,
         ROW_NUMBER() OVER (PARTITION BY gd.illust_id, gd.old_cnum ORDER BY gd.save_dir) AS dir_rank
  FROM group_dirs gd
),
max_cnum AS (
  -- illust_id ごとの既存最大 cnum
  SELECT illust_id, MAX(cnum) AS max_cnum
  FROM ILLUST_INFO
  GROUP BY illust_id
),
extras AS (
  -- 代表(dir_rank=1)以外を、illust_id 単位で一意な通し番号 extra_idx にする
  SELECT dr.*,
         CASE
           WHEN dr.dir_rank = 1 THEN NULL
           ELSE ROW_NUMBER() OVER (
                  PARTITION BY dr.illust_id
                  ORDER BY dr.save_dir, dr.old_cnum
                )
         END AS extra_idx
  FROM dir_rank dr
)

-- 割当表：代表は old_cnum のまま、代表以外は max_cnum + extra_idx
SELECT e.illust_id,
       e.old_cnum,
       e.save_dir,
       CASE
         WHEN e.dir_rank = 1 THEN e.old_cnum
         ELSE mc.max_cnum + e.extra_idx
       END AS new_cnum
FROM extras e
JOIN max_cnum mc USING (illust_id);

-- 2) ILLUST_INFO を「ディレクトリ単位」で更新
UPDATE ILLUST_INFO AS I
SET cnum = (
  SELECT ca.new_cnum
  FROM tmp_cnum_assign ca
  WHERE ca.illust_id = I.illust_id
    AND ca.old_cnum   = I.cnum
    AND IFNULL(ca.save_dir,'') = IFNULL(I.save_dir,'')
)
WHERE EXISTS (
  SELECT 1
  FROM tmp_cnum_assign ca
  WHERE ca.illust_id = I.illust_id
    AND ca.old_cnum   = I.cnum
    AND IFNULL(ca.save_dir,'') = IFNULL(I.save_dir,'')
    AND ca.new_cnum <> I.cnum
);

-- 3) ILLUST_DETAIL を必要な分だけ複製（新しい cnum にまだ無いもの）
INSERT INTO ILLUST_DETAIL (illust_id, cnum, author_id, series, character)
SELECT D.illust_id, ca.new_cnum, D.author_id, D.series, D.character
FROM ILLUST_DETAIL D
JOIN tmp_cnum_assign ca
  ON ca.illust_id = D.illust_id
 AND ca.old_cnum    = D.cnum
WHERE ca.new_cnum <> D.cnum
  AND NOT EXISTS (
    SELECT 1 FROM ILLUST_DETAIL x
    WHERE x.illust_id = D.illust_id
      AND x.cnum = ca.new_cnum
  );

-- 4) 参照されなくなった ILLUST_DETAIL を削除
DELETE FROM ILLUST_DETAIL
WHERE NOT EXISTS (
  SELECT 1
  FROM ILLUST_INFO I
  WHERE I.illust_id = ILLUST_DETAIL.illust_id
    AND I.cnum = ILLUST_DETAIL.cnum
);

-- 5) TAG_INFO を複製
INSERT INTO TAG_INFO (illust_id, cnum, tag)
SELECT T.illust_id, ca.new_cnum, T.tag
FROM TAG_INFO T
JOIN tmp_cnum_assign ca
  ON ca.illust_id = T.illust_id
 AND ca.old_cnum    = T.cnum
WHERE ca.new_cnum <> T.cnum
  AND NOT EXISTS (
    SELECT 1 FROM TAG_INFO x
    WHERE x.illust_id = T.illust_id
      AND x.cnum = ca.new_cnum
      AND x.tag = T.tag
  );

-- 6) 存在しない TAG_INFO を削除
DELETE FROM TAG_INFO
WHERE NOT EXISTS (
  SELECT 1
  FROM ILLUST_INFO I
  WHERE I.illust_id = TAG_INFO.illust_id
    AND I.cnum = TAG_INFO.cnum
);