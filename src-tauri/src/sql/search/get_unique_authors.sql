SELECT 
    A.author_id,
    A.author_name,
    A.author_account,
    COUNT(DISTINCT I.illust_id || '-' || I.suffix) AS count
FROM ILLUST_INFO I
INNER JOIN AUTHOR_INFO A ON A.author_id = D.author_id
INNER JOIN ILLUST_DETAIL D ON I.illust_id = D.illust_id AND I.cnum = D.cnum
GROUP BY A.author_id, A.author_name, A.author_account
ORDER BY count DESC, A.author_id ASC;