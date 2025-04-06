"use client"

import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Tag } from "../App"

interface TagListProps {
  selectedTags: Tag[]
  onRemoveTag: (tagId: number) => void
}

export function TagList({ selectedTags, onRemoveTag }: TagListProps) {
  if (selectedTags.length === 0) {
    return <div className="text-sm text-muted-foreground py-2">No tags selected</div>
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Selected Tags</label>
      <div className="flex flex-wrap gap-2">
        {selectedTags.map((tag) => (
          <Badge key={tag.id} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1">
            {tag.name}
            <Button variant="ghost" size="icon" className="h-4 w-4 rounded-full" onClick={() => onRemoveTag(tag.id)}>
              <X className="h-3 w-3" />
              <span className="sr-only">Remove {tag.name}</span>
            </Button>
          </Badge>
        ))}
      </div>
    </div>
  )
}

