SELECT 
    T2.tag,
    COUNT(DISTINCT I.illust_id || '-' || I.suffix) AS count
FROM TAG_INFO T1
JOIN TAG_INFO T2
    ON T1.illust_id = T2.illust_id
    AND T1.cnum = T2.cnum
JOIN ILLUST_INFO I
    ON T2.illust_id = I.illust_id 
    AND T2.cnum = I.cnum
LEFT JOIN CHARACTER_INFO CI
    ON T2.tag = CI.character OR T2.tag = CI.series
WHERE T1.tag = ?1
    AND T2.tag != ?1
    AND CI.character IS NULL
GROUP BY T2.tag
ORDER BY count DESC, T2.tag COLLATE NOCASE;