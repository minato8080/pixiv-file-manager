import type * as React from "react";
import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";

import { inferObjKey, getStringOnly } from "../types/type-guard-util";
import { LimitedKeyOf } from "../types/util-types";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

const ITEM_HEIGHT = 22;
const MAX_HEIGHT = 200;
const INPUT_HEIGHT = 32;
const PADDING = 8;

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
  const [filtered, setFiltered] = useState<T[]>(items);
  const [selected, setSelected] = useState<T | null>(null);
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    width: 240,
    openUpward: false,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 入力値変更時のフィルタリング
  useEffect(() => {
    if (!isComposing) {
      if (value) {
        setFiltered(
          items.filter(
            (item) =>
              inferObjKey(item, valueKey, (obj, key) =>
                getStringOnly(obj, key)
                  ?.toLowerCase()
                  .includes(value.toLowerCase())
              ).callbackResult
          )
        );
      } else setFiltered(items);
    }
  }, [value, items, isComposing, valueKey]);

  // ドロップダウンの高さを計算
  const dropdownHeight = useMemo(() => {
    const listHeight = Math.min(MAX_HEIGHT, filtered.length * ITEM_HEIGHT);
    return listHeight + INPUT_HEIGHT + PADDING;
  }, [filtered.length]);

  // 座標計算を修正
  const calculatePosition = useCallback(() => {
    const anchor = containerRef.current;
    if (!anchor) return;

    const anchorRect = anchor.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    const dropdownTop = anchorRect.bottom + scrollY;
    const dropdownLeft = anchorRect.left + scrollX;

    const viewportHeight = window.innerHeight;
    const bottomPosition = anchorRect.bottom + dropdownHeight;

    const shouldOpenUpward =
      bottomPosition > viewportHeight && anchorRect.top > dropdownHeight;

    setPosition({
      top: shouldOpenUpward
        ? anchorRect.bottom + scrollY - dropdownHeight
        : dropdownTop,
      left: dropdownLeft,
      width: anchorRect.width,
      openUpward: shouldOpenUpward,
    });
  }, [dropdownHeight]);

  // isOpenが変更されたときとfilteredが変更されたときに位置を再計算
  useLayoutEffect(() => {
    if (isOpen) {
      calculatePosition();
    }
  }, [isOpen, calculatePosition]);

  // スクロール時の位置更新を改善
  useEffect(() => {
    if (!isOpen) return;

    let rafId: number;

    const handlePositionUpdate = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        calculatePosition();
      });
    };

    // より頻繁に位置を更新
    const handleScroll = handlePositionUpdate;
    const handleResize = handlePositionUpdate;

    // 全てのスクロール可能な要素でリスニング
    window.addEventListener("scroll", handleScroll, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", handleResize);

    // 初回計算
    handlePositionUpdate();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", handleScroll, { capture: true });
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen, calculatePosition]);

  // 外側クリック / Esc対応
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
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
    const itemValue = valueKey ? (item[valueKey] as string) : "";

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
        ? items.filter(
            (item) =>
              inferObjKey(item, valueKey, (obj, key) =>
                getStringOnly(obj, key)
                  ?.toLowerCase()
                  .includes(value.toLowerCase())
              ).callbackResult
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

  // ドロップダウンのレンダリング
  const renderDropdown = () => {
    if (!isOpen || isComposing) return null;

    const dropdownContent = (
      <div
        className={`fixed z-50 shadow-sm`}
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          width: `${position.width}px`,
        }}
        ref={dropdownRef}
      >
        {filtered.length > 0 ? (
          <div
            className={
              "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md max-h-60 overflow-auto " +
              dropdownClassName
            }
          >
            <ScrollArea className="max-h-60">
              {filtered.map((item, index) => (
                <div
                  key={index}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSelect(item)}
                >
                  {renderItem
                    ? renderItem(item, selected === item)
                    : inferObjKey<string>(item, labelKey, (obj, key) =>
                        getStringOnly(obj, key)
                      ).callbackResult ?? ""}
                </div>
              ))}
            </ScrollArea>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm p-3 text-center text-gray-500 dark:text-gray-400">
            {noResultsText}
          </div>
        )}
      </div>
    );

    return createPortal(dropdownContent, document.body);
  };

  return (
    <div>
      {label && (
        <Label htmlFor="input-dropdown" className="mb-2 block">
          {label}
        </Label>
      )}
      <div ref={containerRef} className="relative">
        <Input
          id="input-dropdown"
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onClick={handleInputClick}
          onKeyDown={onKeyDown}
          onFocus={() => {
            setIsOpen(true);
            onFocus?.();
          }}
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
