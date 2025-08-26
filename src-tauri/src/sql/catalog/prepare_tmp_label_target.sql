DROP TABLE IF EXISTS tmp_label_target;
CREATE TEMP TABLE tmp_label_target (
    illust_id INTEGER NOT NULL,
    suffix INTEGER NOT NULL,
    cnum INTEGER NOT NULL
);