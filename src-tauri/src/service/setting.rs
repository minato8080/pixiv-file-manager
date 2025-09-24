use anyhow::{anyhow, Result};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use futures::channel::oneshot;
use rand::{distr::Alphanumeric, Rng};
use reqwest::Client;
use serde::{de::DeserializeOwned, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::sync::{Arc, Mutex};
use std::{collections::HashMap, path::PathBuf};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

use crate::constants::{AUTH_TOKEN_URL, CLIENT_ID, CLIENT_SECRET, LOGIN_URL, REDIRECT_URI};
use crate::util::ResultWithLocationExt;

pub async fn process_pixiv_authorization(app: tauri::AppHandle) -> Result<String> {
    let (tx, rx) = oneshot::channel::<String>();
    let (code_verifier, code_challenge) = generate_code_verifier_challenge();

    let login_url = format!(
        "{}?code_challenge={}&code_challenge_method=S256&client=pixiv-android",
        LOGIN_URL, code_challenge
    );

    let tx_opt = Arc::new(Mutex::new(Some(tx)));
    let tx_clone = tx_opt.clone();

    let window = WebviewWindowBuilder::new(
        &app,
        "pixiv_auth",
        WebviewUrl::External(login_url.parse().unwrap()),
    )
    .title("Pixiv Login")
    .on_navigation(move |url| {
        if let Some(query) = url.query() {
            if let Some(code) = url::form_urlencoded::parse(query.as_bytes())
                .find(|(k, _)| k == "code")
                .map(|(_, v)| v.to_string())
            {
                if let Some(tx) = tx_clone.lock().unwrap().take() {
                    let _ = tx.send(code.clone());
                }
                return false; // 遷移止める
            }
        }
        true
    })
    .build()
    .with_location()?;

    let code = rx.await.with_location()?;

    let _ = window.close().with_location()?;

    let refresh_token = exchange_code_for_token(code, code_verifier).await?;

    Ok(refresh_token)
}

fn generate_code_verifier_challenge() -> (String, String) {
    // ランダムな文字列
    let code_verifier: String = rand::rng()
        .sample_iter(&Alphanumeric)
        .take(64)
        .map(char::from)
        .collect();

    // SHA256 → Base64URL
    let hash = Sha256::digest(code_verifier.as_bytes());
    let code_challenge = URL_SAFE_NO_PAD.encode(hash);

    (code_verifier, code_challenge)
}

async fn exchange_code_for_token(code: String, code_verifier: String) -> Result<String> {
    let client = Client::new();

    let res = client
        .post(AUTH_TOKEN_URL)
        .form(&[
            ("client_id", CLIENT_ID),
            ("client_secret", CLIENT_SECRET),
            ("code", &code),
            ("code_verifier", &code_verifier),
            ("grant_type", "authorization_code"),
            ("include_policy", "true"),
            ("redirect_uri", REDIRECT_URI),
        ])
        .header(
            "User-Agent",
            "PixivAndroidApp/5.0.234 (Android 11; Pixel 5)",
        )
        .send()
        .await
        .with_location()?;

    let text = res.text().await.with_location()?;
    let json: Value = serde_json::from_str(&text).with_location()?;

    if let Some(refresh_token) = json.get("refresh_token") {
        Ok(refresh_token.as_str().unwrap_or_default().to_string())
    } else {
        Err(anyhow!("failed: {}", text))
    }
}

pub fn get_config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| e.to_string())
        .map(|p| p.join(".env"))
}

pub fn from_map<T: DeserializeOwned>(map: HashMap<String, String>) -> Result<T, String> {
    serde_json::from_value(serde_json::to_value(map).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())
}

pub fn to_env_string<T: Serialize>(cfg: &T) -> String {
    match serde_json::to_value(cfg) {
        Ok(Value::Object(map)) => map
            .into_iter()
            .map(|(k, v)| {
                let val_str = v.as_str().map_or_else(|| v.to_string(), |s| s.to_string());
                format!("{}={}", k.to_uppercase(), val_str)
            })
            .collect::<Vec<_>>()
            .join("\n"),
        _ => String::new(),
    }
}
