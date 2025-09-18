SELECT 
    I.illust_id,
    I.suffix,
    I.extension,
    I.save_dir,
    I.illust_id || '_p' || I.suffix || '.' || I.extension AS file_name,
    I.save_dir || '\'  || I.illust_id || '_p' || I.suffix || '.' || I.extension AS thumbnail_url,
    D.character,
    A.author_name,
    GROUP_CONCAT(T.tag, ',') AS tags
FROM ILLUST_INFO I
LEFT JOIN ILLUST_DETAIL D
    ON I.illust_id = D.illust_id AND I.cnum = D.cnum
LEFT JOIN AUTHOR_INFO A
    ON D.author_id = A.author_id
LEFT JOIN TAG_INFO T
    ON I.illust_id = T.illust_id AND I.cnum = T.cnum
WHERE I.illust_id = ?
GROUP BY 
    I.illust_id,
    I.suffix
ORDER BY I.suffix ASC
LIMIT 500;