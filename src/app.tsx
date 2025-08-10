import { Combine, FolderSearch, Globe } from "lucide-react";

import FileOrganizer from "./feat/file-organizer/file-organizer";
import TagFetcher from "./feat/tag-fetcher/tag-fetcher";
import TagSearcher from "./feat/tag-searcher/tag-searcher";

import {
  TabbedInterface,
  type TabItem,
} from "@/src/components/tabbed-interface";

export function App() {
  const tabs: TabItem[] = [
    {
      label: "Search",
      icon: <FolderSearch className="h-4 w-4" />,
      content: <TagSearcher />,
    },
    {
      label: "Fetch",
      icon: <Globe className="h-4 w-4" />,
      content: <TagFetcher />,
    },
    {
      label: "Collect",
      icon: <Combine className="h-4 w-4" />,
      content: <FileOrganizer />,
    },
  ];

  return (
    <div className="h-screen flex flex-col p-2 bg-gray-100 dark:bg-gray-900">
      <TabbedInterface tabs={tabs} className="h-full" />
    </div>
  );
}
