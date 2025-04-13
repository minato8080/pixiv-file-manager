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

// #[derive(Debug, Serialize, Deserialize, Clone)]
// pub struct PixivIllustDetail {
//     pub id: i64,
//     pub title: String,
//     pub image_urls: ImageUrls,
//     pub user: User,
//     pub tags: Vec<Tag>,
//     pub create_date: String,
//     pub width: i32,
//     pub height: i32,
//     pub total_view: i32,
//     pub total_bookmarks: i32,
//     pub total_comments: i32,
// }

// #[derive(Debug, Serialize, Deserialize, Clone)]
// pub struct ImageUrls {
//     pub square_medium: String,
//     pub medium: String,
//     pub large: String,
// }

// #[derive(Debug, Serialize, Deserialize, Clone)]
// pub struct User {
//     pub id: i64,
//     pub name: String,
//     pub account: String,
//     pub profile_image_urls: ProfileImageUrls,
// }

// #[derive(Debug, Serialize, Deserialize, Clone)]
// pub struct ProfileImageUrls {
//     pub medium: String,
// }

// #[derive(Debug, Serialize, Deserialize, Clone)]
// pub struct Tag {
//     pub name: String,
//     pub translated_name: Option<String>,
// }
