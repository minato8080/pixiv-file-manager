SELECT
    id,
    series,
    character,
    collect_dir,
    before_count,
    after_count,
    unsave
FROM COLLECT_UI_WORK
WHERE collect_type <> 3
ORDER BY id ASC;