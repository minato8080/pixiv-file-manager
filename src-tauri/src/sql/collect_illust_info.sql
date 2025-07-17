UPDATE ILLUST_INFO
SET save_dir = (
    SELECT CF.collect_dir
    FROM COLLECT_FILTER_WORK CF
    WHERE CF.illust_id = ILLUST_INFO.illust_id
      AND CF.control_num = ILLUST_INFO.control_num
)
WHERE EXISTS (
    SELECT 1
    FROM COLLECT_FILTER_WORK CF
    WHERE CF.illust_id = ILLUST_INFO.illust_id
      AND CF.control_num = ILLUST_INFO.control_num
);
