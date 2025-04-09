use pyo3::{PyObject, Python};
use std::error::Error;
use pyo3::prelude::*;
use tauri::State;

use crate::models::{global::AppState, pixiv::{PixivApi, PixivIllustDetail, RealPixivApi}};

impl PixivApi for RealPixivApi {
    fn create_api() -> Result<PyObject, Box<dyn Error>> {
        Python::with_gil(|py: Python| {
            // Pythonのモジュールパスにroot/src-tauri/src/pyを追加
            let sys_path = py.import("sys")?.getattr("path")?;
            sys_path.call_method1(
                "insert",
                (0, r"C:\Users\fujin\workspace\pixiv-file-manager\py"),
            )?;

            // Pythonファイルのモジュール名（拡張子 .py は不要）
            let module = PyModule::import(py, "pixiv_fetcher")?;

            // APIの作成
            let api: Py<PyAny> = module.getattr("create_api")?.call1(())?.into();
            // let mut pixiv_api = state.app_pixiv_api.lock().map_err(|_| {
            //     PyErr::new::<pyo3::exceptions::PyRuntimeError, _>("APIのロックに失敗しました")
            // })?;
            Ok(api)
        })
        .map_err(|e: PyErr| {
            eprintln!("APIの作成に失敗しました: {:?}", e);
            e.into()
        })
    }

    fn fetch_tags(state: &State<AppState>, image_id: usize) -> Result<Vec<String>, Box<dyn Error>> {
        Python::with_gil(|py| {
            // Pythonファイルのモジュール名（拡張子 .py は不要）
            let module = PyModule::import(py, "pixiv_fetcher")?;

            let result = module
                .getattr("fetch_tags_from_pixiv")?
                .call1((state.app_pixiv_api.clone_ref(py), image_id))?;

            // Pythonのリスト -> Rust Vec<String> に変換
            let tags: Vec<String> = result.extract()?;
            println!("取得タグ: {:?}", tags);
            if tags.is_empty() {
                Err("タグが見つかりませんでした".into())
            } else {
                Ok(tags)
            }
        })
        .map_err(|e| {
            eprintln!("タグ取得に失敗しました: {:?}", e);
            e
        })
    }

    fn fetch_detail(state: &State<AppState>, image_id: usize) -> Result<PixivIllustDetail, Box<dyn Error>> {
        Python::with_gil(|py| {
            // Pythonファイルのモジュール名（拡張子 .py は不要）
            let module = PyModule::import(py, "pixiv_fetcher")?;

            let result = module
                .getattr("fetch_detail_from_pixiv")?
                .call1((state.app_pixiv_api.clone_ref(py), image_id))?;
            println!("取得詳細: {:?}", result);

            let result_str: String = result.str()?.to_string();
            // println!("result_str = {}", result_str);

            let result_json: serde_json::Value = serde_json::from_str(&result_str)
                .map_err(|e| format!("JSON parse error: {}\ncontent: {}", e, result_str))?;
            
            // println!("result_json = {:?}", result_json);
            // serde_json::ValueをPixivIllustrationに変換
            let illustration: PixivIllustDetail = serde_json::from_value(result_json)?;
            // println!("取得イラスト: {:?}", illustration);
            Ok(illustration)
        })
        .map_err(|e| {
            eprintln!("詳細取得に失敗しました: {:?}", e);
            e
        })
    }
}
