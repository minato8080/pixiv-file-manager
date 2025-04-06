"use client"

import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Tag } from "../App"

interface TagSelectorProps {
  allTags: Tag[]
  onSelectTag: (tag: Tag) => void
}

export function TagSelector({ allTags, onSelectTag }: TagSelectorProps) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState("")

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Select Tags</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
            {value ? allTags.find((tag) => tag.name === value)?.name : "Select tag..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder="Search tag..." />
            <CommandList>
              <CommandEmpty>No tag found.</CommandEmpty>
              <CommandGroup>
                {allTags.map((tag) => (
                  <CommandItem
                    key={tag.id}
                    value={tag.name}
                    onSelect={(currentValue) => {
                      const selectedTag = allTags.find((t) => t.name.toLowerCase() === currentValue)
                      if (selectedTag) {
                        onSelectTag(selectedTag)
                      }
                      setValue("")
                      setOpen(false)
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === tag.name ? "opacity-100" : "opacity-0")} />
                    {tag.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

