import { invoke } from "@tauri-apps/api/core";
import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./app";

import "@/styles/styles.css";

window.addEventListener("DOMContentLoaded", () => {
  void (async () => {
    try {
      console.log("Initializing Pixiv client...");
      await invoke("init_pixiv_client");
      console.log("Pixiv client initialized successfully.");
    } catch (e) {
      console.error("Failed to initialize Pixiv client:", e);
    }
  })();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
