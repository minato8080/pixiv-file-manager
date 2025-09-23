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
        async_runtime::spawn_blocking({
            let inner_clone = self.inner.clone();
            move || {
                let mut locked_client = inner_clone
                    .lock()
                    .map_err(|e| anyhow!("Mutex is poisoned: {}", e))?;

                let mut client = match locked_client.take() {
                    Some(c) => c,
                    None => PixivClient::new()?,
                };

                let refresh_token = std::env::var("REFRESH_TOKEN")?;
                *client.refresh_token_mut() = refresh_token;
                client.refresh_auth()?;

                locked_client.replace(client);

                Ok::<_, anyhow::Error>(())
            }
        })
        .await??;

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
