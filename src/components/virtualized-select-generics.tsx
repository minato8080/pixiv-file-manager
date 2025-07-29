import type React from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FixedSizeList, type ListChildComponentProps } from "react-window";

import { getStringValue } from "../types/type-guard-util";

type Item = Record<string, string | number>;
const List = FixedSizeList<Item[]>;

interface VirtualizedSelectProps<T extends Item> {
  value: T[keyof T];
  keyProp: keyof T;
  options: T[];
  onChange: (item: T, key: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
  renderItem?: (item: T) => React.ReactNode;
}

const ITEM_HEIGHT = 24;
const MAX_HEIGHT = 200;
const INPUT_HEIGHT = 32; // 検索入力フィールドの高さ
const PADDING = 8; // ドロップダウンのパディング

export const VirtualizedSelect: React.FC<VirtualizedSelectProps<Item>> = ({
  value,
  keyProp,
  options,
  onChange,
  onClose,
  anchorRef,
  renderItem,
}) => {
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    width: 240,
    openUpward: false,
  });
  const [searchText, setSearchText] = useState(
    typeof value === "string" ? value : "_" + value.toString()
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 絞り込まれた表示対象オプション
  const filteredOptions = useMemo(() => {
    const keyword = searchText.toLowerCase();
    return options.filter((opt) =>
      getStringValue(opt, keyProp)?.toLowerCase().includes(keyword)
    );
  }, [options, searchText]);

  // ドロップダウンの高さを計算
  const dropdownHeight = useMemo(() => {
    const listHeight = Math.min(
      MAX_HEIGHT,
      filteredOptions.length * ITEM_HEIGHT
    );
    return listHeight + INPUT_HEIGHT + PADDING;
  }, [filteredOptions.length]);

  // 座標計算
  const calculatePosition = () => {
    const anchor = anchorRef.current;
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
  };

  // 初期位置計算
  useLayoutEffect(() => {
    calculatePosition();
  }, [anchorRef, dropdownHeight]);

  // スクロール時の位置更新（デバウンス付き）
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleScroll = () => {
      // デバウンス処理で頻繁な更新を防ぐ
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        calculatePosition();
      }, 10);
    };

    const handleResize = () => {
      calculatePosition();
    };

    // passiveオプションでパフォーマンス向上
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [anchorRef, dropdownHeight]);

  // 外側クリック / Esc対応
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
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
  const Row = ({ index, style, data }: ListChildComponentProps<Item[]>) => {
    const item = data[index];
    const key = getStringValue(item, keyProp) ?? "";
    return (
      <div
        style={style}
        key={key}
        className={`px-2 py-1 text-xs cursor-pointer hover:bg-blue-100 ${
          key === value ? "bg-blue-200" : ""
        }`}
        onClick={() => {
          onChange(item, key);
          onClose();
        }}
      >
        {renderItem ? renderItem(item) : key}
      </div>
    );
  };

  return createPortal(
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
      <input
        type="text"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        placeholder="Search..."
        className="w-full text-xs px-2 py-1 border border-gray-300 rounded mb-1 focus:outline-none"
        autoFocus
      />
      <List
        height={Math.min(MAX_HEIGHT, filteredOptions.length * ITEM_HEIGHT)}
        itemCount={filteredOptions.length}
        itemSize={ITEM_HEIGHT}
        width="100%"
        itemData={filteredOptions}
      >
        {Row}
      </List>
    </div>,
    document.body
  );
};
