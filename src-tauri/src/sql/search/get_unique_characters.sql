SELECT 
    C.character,
    COUNT(DISTINCT I.illust_id || '-' || I.suffix) AS count
FROM CHARACTER_INFO C
LEFT JOIN ILLUST_DETAIL D ON C.character = D.character
LEFT JOIN ILLUST_INFO I ON D.illust_id = I.illust_id
WHERE C.character IS NOT NULL
GROUP BY C.character
ORDER BY count DESC, C.character ASC;