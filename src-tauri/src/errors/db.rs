#[derive(Debug)]
pub enum ParameterError {
    DuplicateKey(String),
}

impl std::fmt::Display for ParameterError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::DuplicateKey(k) => write!(f, "Duplicate key: {}", k),
        }
    }
}

impl std::error::Error for ParameterError {}
