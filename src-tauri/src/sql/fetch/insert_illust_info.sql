INSERT OR IGNORE INTO ILLUST_INFO (
    illust_id, suffix, extension, save_dir, cnum
)
SELECT
    t.illust_id,
    t.suffix,
    t.extension,
    t.save_dir,
    ?1
FROM tmp_insert_files AS t
WHERE t.illust_id = ?2;