import type React from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { FixedSizeList, type ListChildComponentProps } from "react-window";

import {
  Object,
  getNumber,
  getString,
  isPropertyKey,
} from "../types/type-guard-util";

import { Badge } from "@/components/ui/badge";

const List = FixedSizeList<Object[]>;

interface VirtualizedSelectProps<T extends Object> {
  value: T[keyof T] & string;
  valueKey: keyof T;
  options: T[];
  onChange?: (value: string, item?: T) => void;
  onClose?: () => void;
  onFocus?: () => void;
  renderItem?: (item: T) => React.ReactNode;
}

const ITEM_HEIGHT = 24;
const MAX_HEIGHT = 200;
const INPUT_HEIGHT = 32;
const PADDING = 8;

export function VirtualizedSelect<T extends Object>({
  value,
  valueKey,
  options,
  onChange,
  onClose,
  onFocus,
  renderItem,
}: VirtualizedSelectProps<T>) {
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    width: 240,
    openUpward: false,
  });
  const [searchText, setSearchText] = useState<string>(value);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 絞り込まれた表示対象オプション
  const filteredOptions = useMemo(() => {
    const keyword = searchText.toLowerCase();
    return options.filter((opt) =>
      getString(opt, valueKey)?.toLowerCase().includes(keyword)
    );
  }, [valueKey, options, searchText]);

  // ドロップダウンの高さを計算
  const dropdownHeight = useMemo(() => {
    const listHeight = Math.min(
      MAX_HEIGHT,
      filteredOptions.length * ITEM_HEIGHT
    );
    return listHeight + INPUT_HEIGHT + PADDING;
  }, [filteredOptions.length]);

  // 座標計算
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
        ? anchorRect.top + scrollY - dropdownHeight
        : dropdownTop,
      left: dropdownLeft,
      width: anchorRect.width,
      openUpward: shouldOpenUpward,
    });
  }, [containerRef, dropdownHeight]);

  // 初期位置計算
  useLayoutEffect(() => {
    calculatePosition();
  }, [containerRef, calculatePosition, dropdownHeight]);

  // スクロール時の位置更新（デバウンス付き）
  useEffect(() => {
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

    // passiveオプションでパフォーマンス向上
    window.addEventListener("scroll", handleScroll, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(rafId);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [containerRef, calculatePosition, dropdownHeight]);

  // 外側クリック / Esc対応
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        onClose?.();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // リスト行
  const Row = ({ index, style, data }: ListChildComponentProps<Object[]>) => {
    const item = data[index] as T;
    const key = getString(item, valueKey) ?? "";
    return (
      <div
        style={style}
        key={key}
        className={`px-2 py-1 text-xs cursor-pointer hover:bg-blue-100 ${
          key === value ? "bg-blue-200" : ""
        }`}
        onClick={() => {
          onChange?.(key, item);
          onClose?.();
        }}
      >
        {renderItem ? (
          renderItem(item)
        ) : isPropertyKey(item, "count") ? (
          <div className="flex justify-between items-center gap-2 text-xs whitespace-nowrap">
            {key}
            <Badge
              className={
                "h-4 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              }
            >
              {getNumber(item, "count")}
            </Badge>
          </div>
        ) : (
          key
        )}
      </div>
    );
  };

  return (
    <div ref={containerRef} className="relative">
      {createPortal(
        <div
          ref={dropdownRef}
          className="border rounded bg-white shadow-lg z-[9999] p-1"
          style={{
            position: "absolute",
            top: position.top,
            left: position.left,
            width: position.width,
            maxWidth: "90vw", // ビューポートからはみ出さないように
          }}
        >
          {position.openUpward ? (
            <>
              <List
                height={Math.min(
                  MAX_HEIGHT,
                  filteredOptions.length * ITEM_HEIGHT
                )}
                itemCount={filteredOptions.length}
                itemSize={ITEM_HEIGHT}
                width="100%"
                itemData={filteredOptions}
              >
                {Row}
              </List>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onFocus={onFocus}
                placeholder="Search..."
                className="w-full text-xs px-2 py-1 border border-gray-300 rounded mb-1 focus:outline-none"
                autoFocus
              />
            </>
          ) : (
            <>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onFocus={onFocus}
                placeholder="Search..."
                className="w-full text-xs px-2 py-1 border border-gray-300 rounded mb-1 focus:outline-none"
                autoFocus
              />
              <List
                height={Math.min(
                  MAX_HEIGHT,
                  filteredOptions.length * ITEM_HEIGHT
                )}
                itemCount={filteredOptions.length}
                itemSize={ITEM_HEIGHT}
                width="100%"
                itemData={filteredOptions}
              >
                {Row}
              </List>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
