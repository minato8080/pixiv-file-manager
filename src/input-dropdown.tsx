import type * as React from "react"
import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"

interface InputDropdownProps<T> {
  items: T[]
  valueKey: (item: T) => string
  labelKey?: (item: T) => string
  value?: string
  defaultValue?: string
  label?: string
  placeholder?: string
  className?: string
  onSelect?: (item: T) => void
  onChange?: (value: string) => void
  renderItem?: (item: T, isSelected: boolean) => React.ReactNode
  noResultsText?: string
}

export function InputDropdown<T>({
  items,
  valueKey,
  labelKey = valueKey,
  value: controlledValue,
  defaultValue = "",
  label,
  placeholder = "テキストを入力",
  className = "",
  onSelect,
  onChange,
  renderItem,
  noResultsText = "結果がありません",
}: InputDropdownProps<T>) {
  // 制御/非制御モードの処理
  const isControlled = controlledValue !== undefined
  const [internalValue, setInternalValue] = useState(defaultValue)
  const value = isControlled ? controlledValue : internalValue

  // 状態
  const [isOpen, setIsOpen] = useState(false)
  const [isComposing, setIsComposing] = useState(false)
  const [filtered, setFiltered] = useState<T[]>(items)
  const [selected, setSelected] = useState<T | null>(null)

  // 参照
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 入力値変更時のフィルタリング
  useEffect(() => {
    if (!isComposing) {
      setFiltered(value ? items.filter((item) => valueKey(item).toLowerCase().includes(value.toLowerCase())) : items)
    }
  }, [value, items, isComposing, valueKey])

  // 外部クリックでドロップダウンを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node

      if (
        !containerRef.current?.contains(target) ||
        (dropdownRef.current &&
          !dropdownRef.current.contains(target) &&
          inputRef.current &&
          !inputRef.current.contains(target))
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // 入力変更ハンドラ
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value

    if (!isControlled) {
      setInternalValue(newValue)
    }

    onChange?.(newValue)
  }

  // 項目選択ハンドラ
  const handleSelect = (item: T) => {
    const itemValue = valueKey(item)

    if (!isControlled) {
      setInternalValue(itemValue)
    }

    setSelected(item)
    setIsOpen(false)
    onChange?.(itemValue)
    onSelect?.(item)
    inputRef.current?.focus()
  }

  // IME関連ハンドラ
  const handleCompositionStart = () => {
    setIsComposing(true)
  }

  const handleCompositionEnd = () => {
    setIsComposing(false)
    setFiltered(value ? items.filter((item) => valueKey(item).toLowerCase().includes(value.toLowerCase())) : items)
  }

  // フォーカス関連ハンドラ
  const handleInputClick = () => {
    if (!isComposing) {
      setIsOpen(true)
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const nextFocused = e.relatedTarget as Node | null
    if (!nextFocused || !containerRef.current?.contains(nextFocused)) {
      setIsOpen(false)
    }
  }

  return (
    <div className={className}>
      {label && (
        <Label htmlFor="input-dropdown" className="mb-2 block">
          {label}
        </Label>
      )}
      <div ref={containerRef} className="relative" tabIndex={-1} onBlur={handleBlur}>
        <Input
          id="input-dropdown"
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onClick={handleInputClick}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          className="w-full"
        />

        {isOpen && !isComposing && filtered.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-100 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm max-h-60 overflow-auto"
          >
            <ScrollArea className="max-h-60">
              {filtered.map((item, index) => (
                <div
                  key={index}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSelect(item)}
                >
                  {renderItem ? renderItem(item, selected === item) : labelKey(item)}
                </div>
              ))}
            </ScrollArea>
          </div>
        )}

        {isOpen && !isComposing && filtered.length === 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm p-3 text-center text-gray-500 dark:text-gray-400">
            {noResultsText}
          </div>
        )}
      </div>
    </div>
  )
}
