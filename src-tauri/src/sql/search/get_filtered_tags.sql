SELECT T.tag, COUNT(DISTINCT I.illust_id || '-' || I.suffix) AS count
FROM TAG_INFO T
JOIN ILLUST_INFO I
ON T.illust_id = I.illust_id AND T.cnum = I.cnum
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
GROUP BY T.tag
ORDER BY count DESC, T.tag ASC;