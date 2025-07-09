import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { FixedSizeList, ListChildComponentProps } from "react-window";
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

export const VirtualizedSelect: React.FC<VirtualizedSelectProps> = ({
  value,
  options,
  onChange,
  onClose,
  anchorRef,
}) => {
  const [position, setPosition] = useState({ top: 0, left: 0, width: 240 });
  const [searchText, setSearchText] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 絞り込まれた表示対象オプション
  const filteredOptions = useMemo(() => {
    const keyword = searchText.toLowerCase();
    return [
      "__unset__",
      ...options.filter((opt) => opt.toLowerCase().includes(keyword)),
    ];
  }, [options, searchText]);

  // 座標計算
  useLayoutEffect(() => {
    const node = anchorRef.current;
    if (node) {
      const rect = node.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, [anchorRef.current]);

  // 外側クリック / Esc対応
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(event.target as Node)
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
          onChange(val === "__unset__" ? "" : val);
          onClose();
        }}
      >
        {val === "__unset__" ? "Unset" : val}
      </div>
    );
  };

  return createPortal(
    <div
      ref={dropdownRef}
      className="border rounded bg-white shadow z-[9999] p-1"
      style={{
        position: "absolute",
        top: position.top,
        left: position.left,
        width: position.width,
      }}
    >
      <input
        type="text"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        placeholder="Search..."
        className="w-full text-xs px-2 py-1 border border-gray-300 rounded mb-1 focus:outline-none"
      />
      <List
        height={Math.min(MAX_HEIGHT, filteredOptions.length * ITEM_HEIGHT)}
        itemCount={filteredOptions.length}
        itemSize={ITEM_HEIGHT}
        width={position.width}
        itemData={filteredOptions}
      >
        {Row}
      </List>
    </div>,
    document.body
  );
};
