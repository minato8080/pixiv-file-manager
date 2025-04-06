"use client"

import { Clock, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"
import type { SearchHistoryItem } from "../App"

interface SearchHistoryProps {
  history: SearchHistoryItem[]
  onSelectHistory: (historyItem: SearchHistoryItem) => void
}

export function SearchHistory({ history, onSelectHistory }: SearchHistoryProps) {
  if (history.length === 0) {
    return null
  }

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <h2 className="text-lg font-medium flex items-center gap-2">
        <Clock className="h-4 w-4" />
        Search History
      </h2>
      <ScrollArea className="h-[200px]">
        <div className="space-y-3">
          {history.map((item) => (
            <Button
              key={item.id}
              variant="outline"
              className="w-full justify-start flex-col items-start h-auto p-3 gap-2"
              onClick={() => onSelectHistory(item)}
            >
              <div className="flex items-center gap-2 w-full">
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                </span>
                <Badge variant="outline" className="ml-auto">
                  {item.condition}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1 w-full">
                {item.tags.map((tag) => (
                  <Badge key={tag.id} variant="secondary" className="text-xs">
                    <Tag className="h-3 w-3 mr-1" />
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </Button>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

