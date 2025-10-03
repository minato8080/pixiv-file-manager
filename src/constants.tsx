import { Grid, List, LayoutGrid, Maximize2, Maximize } from "lucide-react";
import React from "react";

export type ViewMode = {
  name: string;
  icon: React.ReactNode;
  gridStyle: string;
  size: string;
};

export type ViewModeKey = "xlarge" | "large" | "medium" | "small" | "details";

// View mode state
export const VIEW_MODES: Record<ViewModeKey, ViewMode> = {
  xlarge: {
    name: "Max Icons",
    icon: <Maximize className="w-4 h-4" />,
    gridStyle: "grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    size: "aspect-square",
  },
  large: {
    name: "Large Icons",
    icon: <Maximize2 className="w-4 h-4" />,
    gridStyle: "grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
    size: "aspect-square",
  },
  medium: {
    name: "Medium Icons",
    icon: <LayoutGrid className="w-4 h-4" />,
    gridStyle: "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7",
    size: "aspect-square",
  },
  small: {
    name: "Small Icons",
    icon: <Grid className="w-4 h-4" />,
    gridStyle: "grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9",
    size: "aspect-square",
  },
  details: {
    name: "Details",
    icon: <List className="w-4 h-4" />,
    gridStyle: "",
    size: "h-10 w-10",
  },
};

export const VIEW_MODE_KEYS: ViewModeKey[] = [
  "xlarge",
  "large",
  "medium",
  "small",
  "details",
] as const;
