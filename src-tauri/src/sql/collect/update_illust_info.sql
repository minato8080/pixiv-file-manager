UPDATE ILLUST_INFO
SET save_dir = (
    SELECT m.dest_dir
    FROM tmp_move m
    WHERE m.illust_id = ILLUST_INFO.illust_id
      AND m.suffix    = ILLUST_INFO.suffix
    ORDER BY m.pri
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1
    FROM tmp_move m
    WHERE m.illust_id = ILLUST_INFO.illust_id
      AND m.suffix    = ILLUST_INFO.suffix
);
