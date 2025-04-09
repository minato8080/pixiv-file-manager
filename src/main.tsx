import React from "react";
import ReactDOM from "react-dom/client";
import { FolderSearch, Tags } from "lucide-react";
import { TabbedInterface, type TabItem } from "@/src/TabbedInterface";
import TagsSearcher from "./TagsSearcher";
import TagsFetcher from "./TagsFetcher";
import "@/styles/styles.css";

function Page() {
  
  const tabs: TabItem[] = [
    {
      label: "Search Tags",
      icon: <FolderSearch className="h-4 w-4" />,
      content: <TagsSearcher />,
    },
    {
      label: "Get Tags",
      icon: <Tags className="h-4 w-4" />,
      content: <TagsFetcher />,
    },
  ];

  return (
    <div className="w-full py-2 px-2">
      <h1 className="text-3xl font-bold mb-2">Pixiv File Manager</h1>
      <TabbedInterface tabs={tabs} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>
);
