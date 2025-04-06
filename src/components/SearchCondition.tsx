"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface SearchConditionProps {
  condition: "AND" | "OR"
  onChangeCondition: (condition: "AND" | "OR") => void
}

export function SearchCondition({ condition, onChangeCondition }: SearchConditionProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Search Condition</label>
      <RadioGroup
        value={condition}
        onValueChange={(value) => onChangeCondition(value as "AND" | "OR")}
        className="flex gap-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="AND" id="and" />
          <Label htmlFor="and">AND</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="OR" id="or" />
          <Label htmlFor="or">OR</Label>
        </div>
      </RadioGroup>
    </div>
  )
}

