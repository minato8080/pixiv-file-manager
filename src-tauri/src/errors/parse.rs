use std::fmt;

#[derive(Debug)]
pub enum FileParseError {
    InvalidFormat(String),
    InvalidIllustId(String),
    InvalidSuffix(String),
    RegexCompileError(String),
    FileNameNotFound(String),
    ParentDirNotFound(String),
}

impl fmt::Display for FileParseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidFormat(s) => write!(f, "ファイル名の形式が不正です: {}", s),
            Self::InvalidIllustId(s) => write!(f, "illust_id のパースに失敗: {}", s),
            Self::InvalidSuffix(s) => write!(f, "suffix のパースに失敗: {}", s),
            Self::RegexCompileError(s) => write!(f, "正規表現のコンパイルに失敗: {}", s),
            Self::FileNameNotFound(s) => write!(f, "ファイル名が取得できません: {}", s),
            Self::ParentDirNotFound(s) => write!(f, "親ディレクトリの取得に失敗しました: {}", s),
        }
    }
}

impl std::error::Error for FileParseError {}
