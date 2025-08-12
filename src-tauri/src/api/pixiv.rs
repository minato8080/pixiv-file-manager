use anyhow::Result;
use pixieve_rs::pixiv::{
    client::PixivClient, request_builder::PixivRequestBuilder,
    result::illustration_proxy::IllustrationProxy,
};

pub fn create_api() -> Result<PixivClient> {
    let mut pixiv: PixivClient = PixivClient::new()?;

    let refresh_token = std::env::var("REFRESH_TOKEN")?;

    *pixiv.refresh_token_mut() = refresh_token;

    pixiv.refresh_auth()?;

    Ok(pixiv)
}

pub fn fetch_detail(app_pixiv_api: &PixivClient, image_id: u32) -> Result<IllustrationProxy> {
    let illust_id = image_id.try_into()?;
    let request = PixivRequestBuilder::request_illustration(illust_id);

    let illustration = app_pixiv_api
        .execute_with_auth(request)?
        .json::<IllustrationProxy>()?;
    Ok(illustration)
}
