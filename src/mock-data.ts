// DB定義に基づくモックデータ型定義
export interface IllustInfo {
  illust_id: number
  suffix: number
  extension: string
  save_dir: string | null
  control_num: number
}

export interface IllustDetail {
  illust_id: number
  control_num: number
  author_id: number
  character: string | null
}

export interface TagInfo {
  illust_id: number
  control_num: number
  tag: string
}

export interface CharacterInfo {
  character: string
  collect_dir: string | null
  series: string | null
}

export interface DbInfo {
  root: string | null
}

export interface CollectPreviewItem {
  illust_id: number
  currentTags: string[]
  currentPath: string
  newCharacter: string
  newSeries: string
  newPath: string
}

// モックデータ - 最初は全てUncollected状態
export const mockIllustInfo: IllustInfo[] = [
  { illust_id: 1001, suffix: 0, extension: "jpg", save_dir: "temp/uncollected/1001_0.jpg", control_num: 1 },
  { illust_id: 1002, suffix: 0, extension: "png", save_dir: "temp/uncollected/1002_0.png", control_num: 2 },
  { illust_id: 1003, suffix: 0, extension: "jpg", save_dir: "temp/uncollected/1003_0.jpg", control_num: 3 },
  { illust_id: 1004, suffix: 0, extension: "png", save_dir: "temp/uncollected/1004_0.png", control_num: 4 },
  { illust_id: 1005, suffix: 0, extension: "jpg", save_dir: "temp/uncollected/1005_0.jpg", control_num: 5 },
  { illust_id: 1006, suffix: 0, extension: "png", save_dir: "temp/uncollected/1006_0.png", control_num: 6 },
  { illust_id: 1007, suffix: 0, extension: "jpg", save_dir: "temp/uncollected/1007_0.jpg", control_num: 7 },
  { illust_id: 1008, suffix: 0, extension: "png", save_dir: "temp/uncollected/1008_0.png", control_num: 8 },
  { illust_id: 1009, suffix: 0, extension: "jpg", save_dir: "temp/uncollected/1009_0.jpg", control_num: 9 },
  { illust_id: 1010, suffix: 0, extension: "png", save_dir: "temp/uncollected/1010_0.png", control_num: 10 },
  { illust_id: 1011, suffix: 0, extension: "jpg", save_dir: "temp/uncollected/1011_0.jpg", control_num: 11 },
  { illust_id: 1012, suffix: 0, extension: "png", save_dir: "temp/uncollected/1012_0.png", control_num: 12 },
  { illust_id: 1013, suffix: 0, extension: "jpg", save_dir: "temp/uncollected/1013_0.jpg", control_num: 13 },
  { illust_id: 1014, suffix: 0, extension: "png", save_dir: "temp/uncollected/1014_0.png", control_num: 14 },
  { illust_id: 1015, suffix: 0, extension: "jpg", save_dir: "temp/uncollected/1015_0.jpg", control_num: 15 },
  { illust_id: 1016, suffix: 0, extension: "png", save_dir: "temp/uncollected/1016_0.png", control_num: 16 },
  { illust_id: 1017, suffix: 0, extension: "jpg", save_dir: "temp/uncollected/1017_0.jpg", control_num: 17 },
  { illust_id: 1018, suffix: 0, extension: "png", save_dir: "temp/uncollected/1018_0.png", control_num: 18 },
  { illust_id: 1019, suffix: 0, extension: "jpg", save_dir: "temp/uncollected/1019_0.jpg", control_num: 19 },
  { illust_id: 1020, suffix: 0, extension: "png", save_dir: "temp/uncollected/1020_0.png", control_num: 20 },
]

// 最初は全てcharacterがnull（Uncollected状態）
export const mockIllustDetail: IllustDetail[] = [
  { illust_id: 1001, control_num: 1, author_id: 101, character: null },
  { illust_id: 1002, control_num: 2, author_id: 102, character: null },
  { illust_id: 1003, control_num: 3, author_id: 103, character: null },
  { illust_id: 1004, control_num: 4, author_id: 104, character: null },
  { illust_id: 1005, control_num: 5, author_id: 105, character: null },
  { illust_id: 1006, control_num: 6, author_id: 106, character: null },
  { illust_id: 1007, control_num: 7, author_id: 107, character: null },
  { illust_id: 1008, control_num: 8, author_id: 108, character: null },
  { illust_id: 1009, control_num: 9, author_id: 109, character: null },
  { illust_id: 1010, control_num: 10, author_id: 110, character: null },
  { illust_id: 1011, control_num: 11, author_id: 111, character: null },
  { illust_id: 1012, control_num: 12, author_id: 112, character: null },
  { illust_id: 1013, control_num: 13, author_id: 113, character: null },
  { illust_id: 1014, control_num: 14, author_id: 114, character: null },
  { illust_id: 1015, control_num: 15, author_id: 115, character: null },
  { illust_id: 1016, control_num: 16, author_id: 116, character: null },
  { illust_id: 1017, control_num: 17, author_id: 117, character: null },
  { illust_id: 1018, control_num: 18, author_id: 118, character: null },
  { illust_id: 1019, control_num: 19, author_id: 119, character: null },
  { illust_id: 1020, control_num: 20, author_id: 120, character: null },
]

// 外部APIから取得したタグ情報
export const mockTagInfo: TagInfo[] = [
  { illust_id: 1001, control_num: 1, tag: "attack_titan" },
  { illust_id: 1001, control_num: 1, tag: "eren" },
  { illust_id: 1001, control_num: 1, tag: "protagonist" },
  { illust_id: 1002, control_num: 2, tag: "founding_titan" },
  { illust_id: 1002, control_num: 2, tag: "eren" },
  { illust_id: 1002, control_num: 2, tag: "angry" },
  { illust_id: 1003, control_num: 3, tag: "mikasa" },
  { illust_id: 1003, control_num: 3, tag: "ackerman" },
  { illust_id: 1003, control_num: 3, tag: "scarf" },
  { illust_id: 1004, control_num: 4, tag: "mikasa" },
  { illust_id: 1004, control_num: 4, tag: "blade" },
  { illust_id: 1004, control_num: 4, tag: "combat" },
  { illust_id: 1005, control_num: 5, tag: "armin" },
  { illust_id: 1005, control_num: 5, tag: "colossal_titan" },
  { illust_id: 1005, control_num: 5, tag: "smart" },
  { illust_id: 1006, control_num: 6, tag: "tanjiro" },
  { illust_id: 1006, control_num: 6, tag: "demon_slayer" },
  { illust_id: 1006, control_num: 6, tag: "water_breathing" },
  { illust_id: 1007, control_num: 7, tag: "tanjiro" },
  { illust_id: 1007, control_num: 7, tag: "hinokami_kagura" },
  { illust_id: 1007, control_num: 7, tag: "fire" },
  { illust_id: 1008, control_num: 8, tag: "nezuko" },
  { illust_id: 1008, control_num: 8, tag: "demon" },
  { illust_id: 1008, control_num: 8, tag: "bamboo" },
  { illust_id: 1009, control_num: 9, tag: "nezuko" },
  { illust_id: 1009, control_num: 9, tag: "blood_art" },
  { illust_id: 1009, control_num: 9, tag: "protective" },
  { illust_id: 1010, control_num: 10, tag: "zenitsu" },
  { illust_id: 1010, control_num: 10, tag: "thunder_breathing" },
  { illust_id: 1010, control_num: 10, tag: "yellow" },
  { illust_id: 1011, control_num: 11, tag: "zenitsu" },
  { illust_id: 1011, control_num: 11, tag: "sleeping" },
  { illust_id: 1011, control_num: 11, tag: "lightning" },
  { illust_id: 1012, control_num: 12, tag: "yuji" },
  { illust_id: 1012, control_num: 12, tag: "sukuna" },
  { illust_id: 1012, control_num: 12, tag: "vessel" },
  { illust_id: 1013, control_num: 13, tag: "yuji" },
  { illust_id: 1013, control_num: 13, tag: "divergent_fist" },
  { illust_id: 1013, control_num: 13, tag: "kind_heart" },
  { illust_id: 1014, control_num: 14, tag: "megumi" },
  { illust_id: 1014, control_num: 14, tag: "ten_shadows" },
  { illust_id: 1014, control_num: 14, tag: "shikigami" },
  { illust_id: 1015, control_num: 15, tag: "nobara" },
  { illust_id: 1015, control_num: 15, tag: "hammer" },
  { illust_id: 1015, control_num: 15, tag: "nails" },
  { illust_id: 1016, control_num: 16, tag: "background" },
  { illust_id: 1016, control_num: 16, tag: "scenery" },
  { illust_id: 1017, control_num: 17, tag: "group" },
  { illust_id: 1017, control_num: 17, tag: "multiple" },
  { illust_id: 1018, control_num: 18, tag: "fanart" },
  { illust_id: 1018, control_num: 18, tag: "original" },
  { illust_id: 1019, control_num: 19, tag: "crossover" },
  { illust_id: 1019, control_num: 19, tag: "mix" },
  { illust_id: 1020, control_num: 20, tag: "misc" },
  { illust_id: 1020, control_num: 20, tag: "other" },
]

// 最初は空（まだキャラクター設定されていない）
export const mockCharacterInfo: CharacterInfo[] = []

export const mockDbInfo: DbInfo = {
  root: null,
}

// TAG_INFOから取得される利用可能なタグ一覧
export const getAvailableTags = (): string[] => {
  const tags = new Set<string>()
  mockTagInfo.forEach((tagInfo) => tags.add(tagInfo.tag))
  return Array.from(tags).sort()
}
