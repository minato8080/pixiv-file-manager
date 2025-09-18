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
      AND (:author_id IS NULL OR D.author_id = :author_id)
),
filter AS (
    -- 検索条件に合致するレコードのみ抽出
    SELECT DISTINCT b.illust_id, suffix
    FROM base b
    LEFT JOIN TAG_INFO T ON b.illust_id = T.illust_id AND b.cnum = T.cnum
    WHERE :tag_count = 0 OR T.tag IN (:tags)
),
tagged AS (
    -- 条件に合致したイラストのみ選択するが、全タグを集計
    SELECT 
        b.illust_id,
        b.suffix,
        b.extension,
        b.save_dir,
        b.illust_id || '_p' || b.suffix || '.' || b.extension AS file_name,
        b.save_dir || '\'  || b.illust_id || '_p' || b.suffix || '.' || b.extension AS thumbnail_url,
        b.character,
        b.author_name,
        GROUP_CONCAT(T.tag, ',') AS tags
    FROM base b
    LEFT JOIN TAG_INFO T ON b.illust_id = T.illust_id AND b.cnum = T.cnum
    JOIN filter f ON b.illust_id = f.illust_id AND b.suffix = f.suffix
    GROUP BY b.illust_id, b.suffix
)
SELECT * FROM tagged
ORDER BY illust_id ASC, suffix ASC
LIMIT 500;
