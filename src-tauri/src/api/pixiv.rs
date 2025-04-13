use pixieve_rs::{errors::AuthError, pixiv::{client::PixivClient, request_builder::PixivRequestBuilder, result::illustration_proxy::IllustrationProxy}};
use tauri::State;

use crate::models::{
    global::AppState,
    pixiv::{PixivApi, RealPixivApi},
};

impl PixivApi for RealPixivApi {
    fn create_api() -> Result<PixivClient, AuthError> {
        dotenv::dotenv().ok();

        let mut pixiv: PixivClient = PixivClient::new().unwrap();

        let refresh_token = std::env::var("REFRESH_TOKEN").expect("REFRESH_TOKEN isn't set!");
        *pixiv.refresh_token_mut() = refresh_token;

        pixiv.refresh_auth()?;
        Ok(pixiv)
    }

    fn fetch_detail(
        state: &State<'_,AppState>,
        image_id: u32,
    ) -> Result<IllustrationProxy, anyhow::Error> {
        let illust_id = image_id.try_into().unwrap();
        let request = PixivRequestBuilder::request_illustration(illust_id);

        let illustration = state.app_pixiv_api
            .execute_with_auth(request)?
            .json::<IllustrationProxy>()?;
        Ok(illustration)
    }
}
