use pyo3::PyObject;
use rusqlite::Connection;
use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub app_pixiv_api: PyObject,
}
