WITH root_value AS (
    SELECT root FROM DB_INFO LIMIT 1
),
target_rows AS (
    SELECT 
        I.illust_id,
        I.control_num,
        CASE
            WHEN R.root IS NULL THEN NULL
            WHEN C.series IS NULL THEN R.root || '\' || C.character
            ELSE R.root || '\' || C.series || '\' || C.character
        END AS save_dir
    FROM ILLUST_INFO I
    JOIN ILLUST_DETAIL D ON I.illust_id = D.illust_id AND I.control_num = D.control_num
    JOIN COLLECT_WORK C ON D.character = C.character
    CROSS JOIN root_value R
)
UPDATE ILLUST_INFO
SET save_dir = (
    SELECT T.save_dir
    FROM target_rows T
    WHERE T.illust_id = ILLUST_INFO.illust_id
      AND T.control_num = ILLUST_INFO.control_num
)
WHERE EXISTS (
    SELECT 1
    FROM target_rows T
    WHERE T.illust_id = ILLUST_INFO.illust_id
      AND T.control_num = ILLUST_INFO.control_num
);
