import React from "react";
import ReactDOM from "react-dom/client";
import { FolderSearch, Tags } from "lucide-react";
import { TabbedInterface, type TabItem } from "@/src/TabbedInterface";
import TagsSearcher from "./TagsSearcher";
import TagsFetcher from "./TagsFetcher";
import "@/styles/styles.css";

function App() {
  const tabs: TabItem[] = [
    {
      label: "Search",
      icon: <FolderSearch className="h-4 w-4" />,
      content: <TagsSearcher />,
    },
    {
      label: "Get Tags",
      icon: <Tags className="h-4 w-4" />,
      content: <TagsFetcher />,
    },
  ]

  return (
    <div className="h-screen flex flex-col p-2 bg-gray-100 dark:bg-gray-900">
      <TabbedInterface tabs={tabs} className="h-full" />
    </div>
  )
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
