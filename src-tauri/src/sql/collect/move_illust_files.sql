SELECT
    I.illust_id,
    I.suffix,
    I.extension,
    I.save_dir,
    F.collect_dir
FROM COLLECT_FILTER_WORK F
JOIN ILLUST_INFO I
ON F.illust_id = I.illust_id
AND F.cnum = I.cnum;