import { useEffect, useRef } from "react";

type UseOutsideCloseOptions = {
  enabled?: boolean; // フック全体を有効化/無効化
  stopPropagation?: boolean; // イベント伝播を止めるか
  closeOnEscape?: boolean; // Escapeキーで閉じる
  closeOnClickOutside?: boolean; // 外部クリックで閉じる
  onClose: () => void; // 閉じ処理
};

export function useOutsideClose<T extends HTMLElement>({
  enabled = true,
  stopPropagation = true,
  closeOnEscape = true,
  closeOnClickOutside = true,
  onClose,
}: UseOutsideCloseOptions) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        closeOnClickOutside &&
        ref.current &&
        !ref.current.contains(event.target as Node)
      ) {
        event.stopPropagation();
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (closeOnEscape && event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, stopPropagation, closeOnEscape, closeOnClickOutside, onClose]);

  return ref;
}
