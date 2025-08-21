UPDATE ILLUST_INFO
SET save_dir = (
    SELECT CF.collect_dir
    FROM COLLECT_FILTER_WORK CF
    WHERE CF.illust_id = ILLUST_INFO.illust_id
      AND CF.cnum = ILLUST_INFO.cnum
)
WHERE EXISTS (
    SELECT 1
    FROM COLLECT_FILTER_WORK CF
    WHERE CF.illust_id = ILLUST_INFO.illust_id
      AND CF.cnum = ILLUST_INFO.cnum
);
