SELECT 
    F.illust_id,
    suffix,
    extension,
    F.author_id,
    character,
    save_dir,
    author_name,
    author_account,
    GROUP_CONCAT(T.tag, ',') AS tags
FROM (
    SELECT 
        I.illust_id,
        I.suffix,
        I.extension,
        D.author_id,
        D.character,
        I.save_dir,
        I.control_num,
        A.author_name,
        A.author_account
    FROM ILLUST_INFO AS I
    JOIN ILLUST_DETAIL AS D ON I.illust_id = D.illust_id AND I.control_num = D.control_num
    JOIN AUTHOR_INFO AS A ON D.author_id = A.author_id
    JOIN TAG_INFO AS T ON I.illust_id = T.illust_id AND I.control_num = T.control_num
    /*:subquery_where_clause*/
    GROUP BY I.illust_id, I.suffix
    /*:having_clause*/
) AS F
LEFT JOIN TAG_INFO AS T ON F.illust_id = T.illust_id AND F.control_num = T.control_num
/*:where_clause*/
GROUP BY F.illust_id, suffix
ORDER BY F.illust_id ASC, suffix ASC
LIMIT 500;
