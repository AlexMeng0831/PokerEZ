"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Minimize2, Spade } from "lucide-react";
import { Button } from "@/components/ui/button";
export function TableFocusFrame({
  active,
  onExit,
  children,
}: {
  active: boolean;
  onExit: () => void;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const exit = useRef(onExit);
  exit.current = onExit;
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const overscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        exit.current();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        root.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex="0"]',
        ) ?? [],
      ).filter((el) => el.getClientRects().length > 0);
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    root.current
      ?.querySelector<HTMLElement>("[data-exit-focus]")
      ?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.overscrollBehavior = overscroll;
      document.removeEventListener("keydown", keydown);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [active]);
  return (
    <div
      ref={root}
      className={`preview-main ${active ? "table-focus-active" : ""}`}
      role={active ? "dialog" : undefined}
      aria-modal={active ? true : undefined}
      aria-label={active ? "Poker table focus view" : undefined}
    >
      <div className="focus-toolbar" hidden={!active}>
        <span>
          <Spade size={17} fill="currentColor" /> PokerEZ{" "}
          <small>FOCUS TABLE</small>
        </span>
        <Button variant="outline" size="sm" data-exit-focus onClick={onExit}>
          <Minimize2 size={14} /> Exit focus
        </Button>
      </div>
      {children}
    </div>
  );
}
