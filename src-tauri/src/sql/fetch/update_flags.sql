-- すでにILLUST_INFOに存在するillust_idはignore
UPDATE ILLUST_FETCH_WORK
SET ignore_flg = 1
WHERE illust_id IN (SELECT illust_id FROM ILLUST_INFO);

-- すでにILLUST_INFOに存在する (illust_id, suffix) はinsertしない
UPDATE ILLUST_FETCH_WORK
SET insert_flg = 0
WHERE (illust_id, suffix) IN (
    SELECT illust_id, suffix
    FROM ILLUST_INFO
);

-- delete_flgの更新：重複の中で優先度の低いものにフラグを立てる
UPDATE ILLUST_FETCH_WORK
SET delete_flg = CASE
    WHEN ROWID = (
        SELECT MIN(sub.ROWID)
        FROM ILLUST_FETCH_WORK sub
        WHERE sub.illust_id = ILLUST_FETCH_WORK.illust_id
        AND sub.suffix = ILLUST_FETCH_WORK.suffix
        AND sub.file_size = (
            SELECT MIN(sub2.file_size)
            FROM ILLUST_FETCH_WORK sub2
            WHERE sub2.illust_id = ILLUST_FETCH_WORK.illust_id
            AND sub2.suffix = ILLUST_FETCH_WORK.suffix
        )
        AND sub.created_time = (
            SELECT MIN(sub3.created_time)
            FROM ILLUST_FETCH_WORK sub3
            WHERE sub3.illust_id = ILLUST_FETCH_WORK.illust_id
            AND sub3.suffix = ILLUST_FETCH_WORK.suffix
            AND sub3.file_size = (
                SELECT MIN(sub4.file_size)
                FROM ILLUST_FETCH_WORK sub4
                WHERE sub4.illust_id = ILLUST_FETCH_WORK.illust_id
                AND sub4.suffix = ILLUST_FETCH_WORK.suffix
            )
        )
    ) THEN 0
    ELSE 1
END;

-- delete対象はinsertしない
UPDATE ILLUST_FETCH_WORK
SET insert_flg = 0
WHERE delete_flg = 1;
