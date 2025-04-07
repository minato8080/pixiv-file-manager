use std::error::Error;
use pyo3::prelude::*;

pub trait PixivApi {
    fn fetch_tags(&self, image_id: usize) -> Result<Vec<String>, Box<dyn std::error::Error>>;
}

pub struct RealPixivApi;

impl PixivApi for RealPixivApi {
    fn fetch_tags(&self, image_id: usize) -> Result<Vec<String>, Box<dyn Error>> {
        
        Python::with_gil(|py| {
            // Pythonのモジュールパスにroot/src-tauri/src/pyを追加
            let sys_path = py.import("sys")?.getattr("path")?;
            sys_path.call_method1("insert", (0, r"C:\Users\fujin\workspace\pixiv-file-manager\py"))?;
    
            // Pythonファイルのモジュール名（拡張子 .py は不要）
            let module = PyModule::import(py, "pixiv_fetcher")?;
    
            // 関数の呼び出し
            let result = module.getattr("fetch_tags_from_pixiv")?.call1((
                image_id,
            ))?;
    
            // Pythonのリスト -> Rust Vec<String> に変換
            let tags: Option<Vec<String>> = result.extract()?;
            println!("取得タグ: {:?}", tags);
            tags.ok_or_else(|| "タグが見つかりませんでした".into())
        }).map_err(|e| {
            eprintln!("タグ取得に失敗しました: {:?}", e);
            e
        })
    }
}