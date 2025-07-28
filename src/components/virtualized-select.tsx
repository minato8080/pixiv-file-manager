"use client";

import type React from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FixedSizeList, type ListChildComponentProps } from "react-window";
const List = FixedSizeList<string[]>;

interface VirtualizedSelectProps {
  value: string | null;
  options: string[];
  onChange: (val: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
}

const ITEM_HEIGHT = 24;
const MAX_HEIGHT = 200;
const INPUT_HEIGHT = 32; // 検索入力フィールドの高さ
const PADDING = 8; // ドロップダウンのパディング

export const VirtualizedSelect: React.FC<VirtualizedSelectProps> = ({
  value,
  options,
  onChange,
  onClose,
  anchorRef,
}) => {
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    width: 240,
    openUpward: false,
  });
  const [searchText, setSearchText] = useState(value ?? "");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 絞り込まれた表示対象オプション
  const filteredOptions = useMemo(() => {
    const keyword = searchText.toLowerCase();
    return options.filter((opt) => opt.toLowerCase().includes(keyword));
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
    const node = anchorRef.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // 下方向に表示した場合の底辺位置
    const bottomPosition = rect.bottom + dropdownHeight;

    // ビューポートの下部に収まらない場合は上方向に展開
    const shouldOpenUpward =
      bottomPosition > viewportHeight && rect.top > dropdownHeight;

    // position: absoluteで配置するため、ドキュメント全体に対する絶対座標が必要
    // getBoundingClientRect()はビューポート相対なので、スクロール値を加算
    setPosition({
      top: shouldOpenUpward ? window.scrollY - dropdownHeight : window.scrollY,
      left: window.scrollX,
      width: rect.width,
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
  const Row = ({ index, style, data }: ListChildComponentProps<string[]>) => {
    const val = data[index];
    return (
      <div
        style={style}
        key={val}
        className={`px-2 py-1 text-xs cursor-pointer hover:bg-blue-100 ${
          val === value ? "bg-blue-200" : ""
        }`}
        onClick={() => {
          onChange(val);
          onClose();
        }}
      >
        {val}
      </div>
    );
  };

  return (
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
    </div>
  );
};
