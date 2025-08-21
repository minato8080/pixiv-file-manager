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
    WHERE ( :character IS NULL OR D.character = :character )
      AND ( :author IS NULL OR D.author_id = :author )
),
tagged AS (
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
    WHERE (:tag_count = 0 OR t.tag IN (:tags))
    GROUP BY b.illust_id, b.suffix
    HAVING (:tag_count = 0 OR COUNT(DISTINCT t.tag) = :tag_count)
)
SELECT * FROM tagged
ORDER BY illust_id ASC, suffix ASC
LIMIT 500;