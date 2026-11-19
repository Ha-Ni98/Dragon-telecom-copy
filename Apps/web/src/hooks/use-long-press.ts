import { useRef, type MouseEvent, type PointerEvent } from "react";

// S39 — touch long-press (the product card's "full name on long-press"). Fires `onLongPress` after
// `ms` of an unmoved TOUCH press (mouse users have the title tooltip), and swallows the click that
// follows so the long-press does not also navigate. Any pointer movement cancels the timer, so
// scrolling a row of cards never triggers it.
export function useLongPress(onLongPress: () => void, ms = 450) {
  const timer = useRef<number | undefined>(undefined);
  const fired = useRef(false);
  const clear = () => window.clearTimeout(timer.current);
  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      fired.current = false;
      timer.current = window.setTimeout(() => {
        fired.current = true;
        onLongPress();
      }, ms);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onPointerMove: clear,
    onClickCapture: (e: MouseEvent) => {
      if (fired.current) {
        e.preventDefault();
        e.stopPropagation();
        fired.current = false;
      }
    },
  };
}
