WITH base AS (
    SELECT 
        I.illust_id,
        I.suffix,
        I.extension,
        I.save_dir,
        I.cnum,
        D.character,
        D.author_id,
        A.author_name
    FROM ILLUST_INFO I
    JOIN ILLUST_DETAIL D ON I.illust_id = D.illust_id AND I.cnum = D.cnum
    JOIN AUTHOR_INFO A ON D.author_id = A.author_id
    WHERE (:character IS NULL OR D.character = :character)
      AND (:author IS NULL OR D.author_id = :author)
),
filter AS (
    -- 検索条件に合致するレコードのみ抽出
    SELECT DISTINCT b.illust_id, suffix
    FROM base b
    LEFT JOIN TAG_INFO t ON b.illust_id = t.illust_id AND b.cnum = t.cnum
    WHERE :tag_count = 0 OR t.tag IN (:tags)
),
tagged AS (
    -- 条件に合致したイラストのみ選択するが、全タグを集計
    SELECT 
        b.illust_id,
        b.suffix,
        b.extension,
        b.save_dir,
        b.character,
        b.author_name,
        GROUP_CONCAT(t.tag, ',') AS tags
    FROM base b
    LEFT JOIN TAG_INFO t ON b.illust_id = t.illust_id AND b.cnum = t.cnum
    JOIN filter f ON b.illust_id = f.illust_id AND b.suffix = f.suffix
    GROUP BY b.illust_id, b.suffix
)
SELECT * FROM tagged
ORDER BY illust_id ASC, suffix ASC
LIMIT 500;
