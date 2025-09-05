SELECT 
    C.character,
    COUNT(DISTINCT I.illust_id || '-' || I.suffix) AS count
FROM CHARACTER_INFO C
LEFT JOIN ILLUST_DETAIL D ON C.character = D.character
LEFT JOIN ILLUST_INFO I ON D.illust_id = I.illust_id
WHERE C.character IS NOT NULL
    AND (:character IS NULL OR D.character = :character)
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
GROUP BY C.character
ORDER BY count DESC, C.character ASC;