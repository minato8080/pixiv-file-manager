INSERT OR IGNORE INTO ILLUST_INFO (
    illust_id, suffix, extension, save_dir, control_num
)
WITH base AS (
    SELECT f.*
    FROM insert_files f
    LEFT JOIN fetch_ids fi ON f.illust_id = fi.illust_id
    WHERE fi.illust_id IS NULL  -- フェッチ対象ではない
),
control_map AS (
    SELECT
        illust_id,
        COALESCE(
            (SELECT control_num
             FROM ILLUST_INFO ii
             WHERE ii.illust_id = b.illust_id
             ORDER BY control_num ASC LIMIT 1),
            0
        ) AS control_num
    FROM base b
    GROUP BY illust_id
)
SELECT
    b.illust_id,
    b.suffix,
    b.extension,
    b.save_dir,
    cm.control_num
FROM base b
JOIN control_map cm ON b.illust_id = cm.illust_id;