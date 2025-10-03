import { useRef, useCallback } from "react";

type UseClickOptions<T extends unknown[]> = {
  onClick: (...args: T) => void;
  onDoubleClick: (...args: T) => void;
  delay?: number;
};

export function useClickHandler<T extends unknown[]>({
  onClick,
  onDoubleClick,
  delay = 250,
}: UseClickOptions<T>) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback(
    (...args: T) => {
      if (timerRef.current) {
        // 2回目のクリック → ダブルクリック扱い
        clearTimeout(timerRef.current);
        timerRef.current = null;
        onDoubleClick(...args);
      } else {
        // 1回目のクリック → シングルクリック用にタイマー開始
        timerRef.current = setTimeout(() => {
          onClick(...args);
          timerRef.current = null;
        }, delay);
      }
    },
    [onClick, onDoubleClick, delay]
  );

  return handleClick;
}
