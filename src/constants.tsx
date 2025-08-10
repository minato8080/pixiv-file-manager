import { Grid, List, LayoutGrid, Maximize2 } from "lucide-react";
import React from "react";

export type ViewMode = {
  name: string;
  icon: React.ReactNode;
  gridCols: string;
  size: string;
};

export type ViewModeKey = "large" | "medium" | "small" | "details";

// View mode state
export const VIEW_MODES: Record<ViewModeKey, ViewMode> = {
  large: {
    name: "Large Icons",
    icon: <Maximize2 className="w-4 h-4" />,
    gridCols: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6",
    size: "aspect-square",
  },
  medium: {
    name: "Medium Icons",
    icon: <LayoutGrid className="w-4 h-4" />,
    gridCols: "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8",
    size: "aspect-square",
  },
  small: {
    name: "Small Icons",
    icon: <Grid className="w-4 h-4" />,
    gridCols: "grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12",
    size: "h-16 w-16",
  },
  details: {
    name: "Details",
    icon: <List className="w-4 h-4" />,
    gridCols: "",
    size: "h-10 w-10",
  },
};

export const VIEW_MODE_KEYS: ViewModeKey[] = [
  "large",
  "medium",
  "small",
  "details",
] as const;
