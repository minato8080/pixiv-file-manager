DROP TABLE IF EXISTS tmp_label_character;
CREATE TEMP TABLE tmp_label_character (
    illust_id INTEGER NOT NULL,
    suffix INTEGER NOT NULL,
    cnum INTEGER NOT NULL
);