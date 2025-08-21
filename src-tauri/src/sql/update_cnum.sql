-- 既存の割当があれば消す
DROP TABLE IF EXISTS TEMP_CN_ASSIGN;

-- 1) 分裂が必要な (illust_id, cnum) を見つけ、
--    ディレクトリ単位（distinct save_dir）で新しい cnum を割り当てる
CREATE TEMP TABLE TEMP_CN_ASSIGN AS
WITH conflict_groups AS (
  -- 同じ illust_id & cnum なのに save_dir が異なるグループ
  SELECT i1.illust_id, i1.cnum AS old_cn
  FROM ILLUST_INFO i1
  JOIN ILLUST_INFO i2
    ON i1.illust_id = i2.illust_id
   AND i1.cnum = i2.cnum
   AND IFNULL(i1.save_dir,'') <> IFNULL(i2.save_dir,'')
  GROUP BY i1.illust_id, i1.cnum
),
group_dirs AS (
  -- 分裂対象グループの「ディレクトリ単位」の集合
  SELECT DISTINCT i.illust_id, i.cnum AS old_cn, i.save_dir
  FROM ILLUST_INFO i
  JOIN conflict_groups g
    ON g.illust_id = i.illust_id AND g.old_cn = i.cnum
),
dir_rank AS (
  -- 同じ (illust_id, old_cn) 内で save_dir ごとにランク付け（1が元の番号を残す代表）
  SELECT gd.*,
         ROW_NUMBER() OVER (PARTITION BY gd.illust_id, gd.old_cn ORDER BY gd.save_dir) AS dir_rank
  FROM group_dirs gd
),
max_cn AS (
  -- illust_id ごとの既存最大 cnum
  SELECT illust_id, MAX(cnum) AS max_cn
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
                  ORDER BY dr.save_dir, dr.old_cn
                )
         END AS extra_idx
  FROM dir_rank dr
)

-- 割当表：代表は old_cn のまま、代表以外は max_cn + extra_idx
SELECT e.illust_id,
       e.old_cn,
       e.save_dir,
       CASE
         WHEN e.dir_rank = 1 THEN e.old_cn
         ELSE m.max_cn + e.extra_idx
       END AS new_cn
FROM extras e
JOIN max_cn m USING (illust_id);

-- 2) ILLUST_INFO を「ディレクトリ単位」で更新
UPDATE ILLUST_INFO AS t
SET cnum = (
  SELECT a.new_cn
  FROM TEMP_CN_ASSIGN a
  WHERE a.illust_id = t.illust_id
    AND a.old_cn   = t.cnum
    AND IFNULL(a.save_dir,'') = IFNULL(t.save_dir,'')
)
WHERE EXISTS (
  SELECT 1
  FROM TEMP_CN_ASSIGN a
  WHERE a.illust_id = t.illust_id
    AND a.old_cn   = t.cnum
    AND IFNULL(a.save_dir,'') = IFNULL(t.save_dir,'')
    AND a.new_cn <> t.cnum
);

-- 3) ILLUST_DETAIL を必要な分だけ複製（新しい cnum にまだ無いもの）
INSERT INTO ILLUST_DETAIL (illust_id, cnum, author_id, series, character)
SELECT d.illust_id, a.new_cn, d.author_id, d.series, d.character
FROM ILLUST_DETAIL d
JOIN TEMP_CN_ASSIGN a
  ON a.illust_id = d.illust_id
 AND a.old_cn    = d.cnum
WHERE a.new_cn <> d.cnum
  AND NOT EXISTS (
    SELECT 1 FROM ILLUST_DETAIL x
    WHERE x.illust_id = d.illust_id
      AND x.cnum = a.new_cn
  );

-- 4) 参照されなくなった ILLUST_DETAIL を削除
DELETE FROM ILLUST_DETAIL
WHERE NOT EXISTS (
  SELECT 1
  FROM ILLUST_INFO i
  WHERE i.illust_id = ILLUST_DETAIL.illust_id
    AND i.cnum = ILLUST_DETAIL.cnum
);

-- 5) TAG_INFO を複製
INSERT INTO TAG_INFO (illust_id, cnum, tag)
SELECT t.illust_id, a.new_cn, t.tag
FROM TAG_INFO t
JOIN TEMP_CN_ASSIGN a
  ON a.illust_id = t.illust_id
 AND a.old_cn    = t.cnum
WHERE a.new_cn <> t.cnum
  AND NOT EXISTS (
    SELECT 1 FROM TAG_INFO x
    WHERE x.illust_id = t.illust_id
      AND x.cnum = a.new_cn
      AND x.tag = t.tag
  );

-- 6) 存在しない TAG_INFO を削除
DELETE FROM TAG_INFO
WHERE NOT EXISTS (
  SELECT 1
  FROM ILLUST_INFO i
  WHERE i.illust_id = TAG_INFO.illust_id
    AND i.cnum = TAG_INFO.cnum
);