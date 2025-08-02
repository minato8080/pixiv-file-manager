import type * as React from "react";
import { useState, useRef, useEffect } from "react";

import { getNumber, getString, inferObjKey } from "../types/type-guard-util";
import { LimitedKeyOf } from "../types/util-types";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

interface InputDropdownProps<T> {
  items: T[];
  valueKey?: LimitedKeyOf<T, string>;
  labelKey?: LimitedKeyOf<T, string>;
  value?: string;
  defaultValue?: string;
  label?: string;
  placeholder?: string;
  inputClassName?: string;
  dropdownClassName?: string;
  onSelect?: (item: T) => void;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement> | undefined;
  renderItem?: (item: T, isSelected: boolean) => React.ReactNode;
  noResultsText?: string;
}

export function InputDropdown<T>({
  items,
  valueKey,
  labelKey = valueKey,
  value: controlledValue,
  defaultValue = "",
  label,
  placeholder = "テキストを入力",
  inputClassName = "",
  dropdownClassName = "",
  onSelect,
  onChange,
  onKeyDown,
  onFocus,
  renderItem,
  noResultsText = "結果がありません",
}: InputDropdownProps<T>) {
  // 制御/非制御モードの処理
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const value = isControlled ? controlledValue : internalValue;

  const [isOpen, setIsOpen] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [filtered, setFiltered] = useState<T[]>([]);
  const [selected, setSelected] = useState<T | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFiltered(items);
  }, [items]);

  // 入力値変更時のフィルタリング
  useEffect(() => {
    if (!isComposing) {
      if (value) {
        setFiltered(
          items.filter((item) =>
            inferObjKey(item, valueKey, (obj, key) =>
              getString(obj, key)?.toLowerCase().includes(value.toLowerCase())
            )
          )
        );
      } else setFiltered(items);
    }
  }, [value, items, isComposing, valueKey]);

  // 外部クリックでドロップダウンを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        !containerRef.current?.contains(target) ||
        (dropdownRef.current &&
          !dropdownRef.current.contains(target) &&
          inputRef.current &&
          !inputRef.current.contains(target))
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // 入力変更ハンドラ
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    if (!isControlled) {
      setInternalValue(newValue);
    }

    onChange?.(newValue);
  };

  // 項目選択ハンドラ
  const handleSelect = (item: T) => {
    const itemValue =
      inferObjKey<string>(item, valueKey, (o, k) => getString(o, k)) ?? "";

    if (!isControlled) {
      setInternalValue(itemValue);
    }

    setSelected(item);
    setIsOpen(false);
    onChange?.(itemValue);
    onSelect?.(item);
    inputRef.current?.focus();
  };

  // IME関連ハンドラ
  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    setIsComposing(false);
    setFiltered(
      value
        ? items.filter((item) =>
            inferObjKey(item, valueKey, (obj, key) =>
              getString(obj, key)?.toLowerCase().includes(value.toLowerCase())
            )
          )
        : items
    );
  };

  // フォーカス関連ハンドラ
  const handleInputClick = () => {
    if (!isComposing) {
      setIsOpen(true);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const nextFocused = e.relatedTarget as Node | null;
    if (!nextFocused || !containerRef.current?.contains(nextFocused)) {
      setIsOpen(false);
    }
  };

  const renderDropdown = () => {
    if (!isOpen || isComposing) return null;

    return (
      <div
        ref={dropdownRef}
        className={
          "absolute z-100 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm max-h-60 overflow-auto scroll-transparent " +
          dropdownClassName
        }
      >
        {filtered.length > 0 ? (
          <ScrollArea className="max-h-60">
            {filtered.map((item, index) => {
              const label =
                inferObjKey(item, labelKey, (obj, key) =>
                  getString(obj, key)
                ) ?? "";
              return (
                <div
                  key={index}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSelect(item)}
                >
                  {renderItem
                    ? renderItem(item, selected === item)
                    : inferObjKey(item, "count", (obj, key) => (
                        <div className="flex justify-between items-center gap-2 text-xs whitespace-nowrap w-40">
                          <span className="truncate">{label}</span>
                          <Badge
                            className={
                              "h-4 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                            }
                          >
                            {getNumber(obj, key)}
                          </Badge>
                        </div>
                      )) ?? label}
                </div>
              );
            })}
          </ScrollArea>
        ) : (
          <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm p-3 text-center text-gray-500 dark:text-gray-400">
            {noResultsText}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {label && (
        <Label htmlFor="input-dropdown" className="mb-2 block">
          {label}
        </Label>
      )}
      <div
        ref={containerRef}
        className="relative"
        tabIndex={-1}
        onBlur={handleBlur}
      >
        <Input
          id="input-dropdown"
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onClick={handleInputClick}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          className={`w-full ${inputClassName}`}
          autoComplete="off"
        />
        {renderDropdown()}
      </div>
    </div>
  );
}
