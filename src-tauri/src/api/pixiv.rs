use anyhow::{anyhow, Result};
use async_trait::async_trait;
use std::sync::{Arc, Mutex};
use tauri::async_runtime;

use pixieve_rs::pixiv::client::PixivClient;

#[async_trait]
pub trait PixivClientProvider: Send + Sync {
    async fn refresh_client(&self) -> Result<()>;
    async fn get_client(&self) -> Result<PixivClient>;
}

pub struct RealPixivClientProvider {
    inner: Arc<Mutex<Option<PixivClient>>>,
}

impl RealPixivClientProvider {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(None)),
        }
    }
}

#[async_trait]
impl PixivClientProvider for RealPixivClientProvider {
    async fn refresh_client(&self) -> Result<()> {
        let mut client = {
            let mut locked_client = self.inner.lock().unwrap();
            match locked_client.take() {
                Some(c) => c,
                None => PixivClient::new()?,
            }
        };

        // 認証処理は spawn_blocking で実行
        let refreshed_client = async_runtime::spawn_blocking(move || {
            let refresh_token = std::env::var("REFRESH_TOKEN")?;
            *client.refresh_token_mut() = refresh_token;
            client.refresh_auth()?;
            Ok::<_, anyhow::Error>(client)
        })
        .await??;

        // 更新されたクライアントを再びセット
        self.inner.lock().unwrap().replace(refreshed_client);

        Ok(())
    }

    async fn get_client(&self) -> Result<PixivClient> {
        let locked_client = self.inner.lock().unwrap();
        locked_client
            .as_ref()
            .cloned()
            .ok_or_else(|| anyhow!("API is unavailable. Please authorize first."))
    }
}
