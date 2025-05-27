import { FolderSearch, Tags } from "lucide-react";

import TagsFetcher from "./tags-fetcher";
import TagsSearcher from "./tags-searcher/tags-searcher";

import { TabbedInterface, type TabItem } from "@/src/tabbed-interface";

export function App() {
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
  ];

  return (
    <div className="h-screen flex flex-col p-2 bg-gray-100 dark:bg-gray-900">
      <TabbedInterface tabs={tabs} className="h-full" />
    </div>
  );
}
