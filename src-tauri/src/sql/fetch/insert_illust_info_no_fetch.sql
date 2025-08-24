-- ILLUST_INFO に挿入
INSERT OR IGNORE INTO ILLUST_INFO (
    illust_id, suffix, extension, save_dir, cnum
)
WITH base AS (
    SELECT f.*
    FROM insert_files f
    LEFT JOIN fetch_ids fi ON f.illust_id = fi.illust_id
    WHERE fi.illust_id IS NULL
),
control_map AS (
    SELECT
        illust_id,
        COALESCE(
            (SELECT cnum
             FROM ILLUST_INFO ii
             WHERE ii.illust_id = b.illust_id
             ORDER BY cnum ASC LIMIT 1),
            0
        ) AS cnum
    FROM base b
    GROUP BY illust_id
),
inserted AS (
    SELECT
        b.illust_id,
        b.suffix,
        b.extension,
        b.save_dir,
        cm.cnum
    FROM base b
    JOIN control_map cm ON b.illust_id = cm.illust_id
)
SELECT * FROM inserted;

-- TAG_INFO に "Missing" を追加
INSERT OR IGNORE INTO TAG_INFO (illust_id, cnum, tag)
SELECT illust_id, cnum, 'Missing'
FROM ILLUST_INFO
WHERE (illust_id, cnum) IN (
    SELECT illust_id, cnum FROM inserted
);
