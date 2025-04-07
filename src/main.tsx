import React from "react";
import ReactDOM from "react-dom/client";
// import ExplorerSearch from "./ExplorerSearch";
import TagExplorer from "./TagExplorer";
// import ExplorerSearch from "./App";
import "@/styles/styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {/* <ExplorerSearch /> */}
    <TagExplorer/>
  </React.StrictMode>
);
