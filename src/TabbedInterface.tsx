"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

export type TabItem = {
  label: string
  content: React.ReactNode
  icon?: React.ReactNode
}

interface TabbedInterfaceProps {
  tabs: TabItem[]
  defaultTabIndex?: number
  className?: string
}

export function TabbedInterface({ tabs, defaultTabIndex = 0, className }: TabbedInterfaceProps) {
  const [activeTabIndex, setActiveTabIndex] = useState(defaultTabIndex)
  const [initializedTabs, setInitializedTabs] = useState<boolean[]>([])

  // Initialize the tabs tracking array on first render
  useEffect(() => {
    const initialized = tabs.map((_, index) => index === defaultTabIndex)
    setInitializedTabs(initialized)
  }, [tabs.length, defaultTabIndex])

  const handleTabClick = (index: number) => {
    setActiveTabIndex(index)

    // Mark this tab as initialized if it wasn't already
    if (!initializedTabs[index]) {
      const newInitializedTabs = [...initializedTabs]
      newInitializedTabs[index] = true
      setInitializedTabs(newInitializedTabs)
    }
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="border-b bg-gray-100 dark:bg-gray-800">
        <div className="flex overflow-x-auto scrollbar-hide">
          {tabs.map((tab, index) => (
            <button
              key={index}
              onClick={() => handleTabClick(index)}
              className={cn(
                "relative px-4 py-2 text-sm font-medium transition-colors focus:outline-none",
                activeTabIndex === index
                  ? "text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-900"
                  : "text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400",
              )}
              aria-selected={activeTabIndex === index}
              role="tab"
            >
              <div className="flex items-center space-x-2">
                {tab.icon && <span>{tab.icon}</span>}
                <span>{tab.label}</span>
              </div>
              {activeTabIndex === index && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 relative overflow-hidden">
        {tabs.map((tab, index) => (
          <div
            key={index}
            className={cn(
              "absolute inset-0 transition-opacity duration-200 flex flex-col",
              activeTabIndex === index ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none",
            )}
            style={{ display: initializedTabs[index] ? "flex" : "none" }}
          >
            {initializedTabs[index] && tab.content}
          </div>
        ))}
      </div>
    </div>
  )
}
