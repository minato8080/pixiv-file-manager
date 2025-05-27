import React from "react";
import ReactDOM from "react-dom/client";

import "@/styles/styles.css";
import { App } from "./app";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
