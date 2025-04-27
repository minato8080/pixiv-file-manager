import React from "react";
import { Grid, List, LayoutGrid, Maximize2 } from "lucide-react";

export type ViewMode = {
  id: string;
  name: string;
  icon: React.ReactNode;
  gridCols: string;
  size: string;
};

// View mode state
export const VIEW_MODES: ViewMode[] = [
  {
    id: "large",
    name: "Large Icons",
    icon: <Maximize2 className="w-4 h-4" />,
    gridCols: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6",
    size: "aspect-square",
  },
  {
    id: "medium",
    name: "Medium Icons",
    icon: <LayoutGrid className="w-4 h-4" />,
    gridCols: "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8",
    size: "aspect-square",
  },
  {
    id: "small",
    name: "Small Icons",
    icon: <Grid className="w-4 h-4" />,
    gridCols: "grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12",
    size: "h-16 w-16",
  },
  {
    id: "details",
    name: "Details",
    icon: <List className="w-4 h-4" />,
    gridCols: "",
    size: "h-10 w-10",
  },
];
