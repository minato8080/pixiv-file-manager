use super::global::AppState;
use pixieve_rs::{errors::AuthError, pixiv::{client::PixivClient, result::illustration_proxy::IllustrationProxy}};
// use serde::{Deserialize, Serialize};
use tauri::State;

pub trait PixivApi {
    fn create_api() -> Result<PixivClient, AuthError>
    where
        Self: Sized;
    fn fetch_detail(
        state: &State<'_,AppState>,
        image_id: u32,
    ) -> Result<IllustrationProxy, anyhow::Error>;
}

#[derive(Clone)]
pub struct RealPixivApi;