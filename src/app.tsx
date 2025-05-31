import { FolderSearch, FolderSymlink, Tags } from "lucide-react";

import FileOrganizer from "./file-organizer/file-organizer";
import TagsFetcher from "./tags-fetcher/tags-fetcher";
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
    {
      label: "Collect",
      icon: <FolderSymlink className="h-4 w-4" />,
      content: <FileOrganizer />,
    },
  ];

  return (
    <div className="h-screen flex flex-col p-2 bg-gray-100 dark:bg-gray-900">
      <TabbedInterface tabs={tabs} className="h-full" />
    </div>
  );
}
