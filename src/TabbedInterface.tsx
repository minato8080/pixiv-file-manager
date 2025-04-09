"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
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
    <div className={cn("w-full", className)}>
      <div className="border-b">
        <div className="flex overflow-x-auto scrollbar-hide">
          {tabs.map((tab, index) => (
            <button
              key={index}
              onClick={() => handleTabClick(index)}
              className={cn(
                "relative px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-blue-500",
                activeTabIndex === index ? "text-blue-600" : "text-gray-500 hover:text-blue-600",
              )}
              aria-selected={activeTabIndex === index}
              role="tab"
            >
              <div className="flex items-center space-x-2">
                {tab.icon && <span>{tab.icon}</span>}
                <span>{tab.label}</span>
              </div>
              {activeTabIndex === index && (
                <motion.div
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                  layoutId="tab-indicator"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 relative">
        {tabs.map((tab, index) => (
          <div
            key={index}
            className={cn(
              "absolute top-0 left-0 w-full transition-opacity duration-200",
              activeTabIndex === index ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none",
            )}
            style={{ display: initializedTabs[index] ? "block" : "none" }}
          >
            {initializedTabs[index] && tab.content}
          </div>
        ))}
      </div>
    </div>
  )
}
