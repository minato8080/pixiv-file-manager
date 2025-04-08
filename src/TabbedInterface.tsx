"use client"

import type React from "react"

import { useState } from "react"
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

  return (
    <div className={cn("w-full", className)}>
      <div className="border-b">
        <div className="flex overflow-x-auto scrollbar-hide">
          {tabs.map((tab, index) => (
            <button
              key={index}
              onClick={() => setActiveTabIndex(index)}
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
      <div className="mt-4">
        <motion.div
          key={activeTabIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {tabs[activeTabIndex].content}
        </motion.div>
      </div>
    </div>
  )
}

