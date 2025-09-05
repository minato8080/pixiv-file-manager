SELECT 
    A.author_id,
    A.author_name,
    A.author_account,
    COUNT(DISTINCT I.illust_id || '-' || I.suffix) AS count
FROM ILLUST_INFO I
INNER JOIN AUTHOR_INFO A ON A.author_id = D.author_id
INNER JOIN ILLUST_DETAIL D ON I.illust_id = D.illust_id AND I.cnum = D.cnum
WHERE (:character IS NULL OR D.character = :character)
    AND (:author_id IS NULL OR D.author_id = :author_id)
    AND (
            :tag_count = 0
            OR EXISTS (
                SELECT 1
                FROM TAG_INFO T2
                WHERE T2.illust_id = D.illust_id
                AND T2.cnum      = D.cnum
                AND T2.tag IN (:tags)
            )
        )
GROUP BY A.author_id, A.author_name, A.author_account
ORDER BY count DESC, A.author_id ASC;