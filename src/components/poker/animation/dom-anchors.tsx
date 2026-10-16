"use client";
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
  type RefCallback,
} from "react";
import type { SeatId } from "@/lib/animation/mock-game";
export type AnchorId =
  | "deck"
  | "pot"
  | `seat-${SeatId}-${number}`
  | `stack-${SeatId}`
  | `bet-${SeatId}`
  | `board-${number}`;
type Rect = { x: number; y: number; width: number; height: number };
type Registry = {
  register: (id: AnchorId) => RefCallback<HTMLDivElement>;
  rects: Partial<Record<AnchorId, Rect>>;
};
const AnchorContext = createContext<Registry | null>(null);
export function useAnchors() {
  const value = useContext(AnchorContext);
  if (!value) throw new Error("Poker animation requires a DomAnchorProvider");
  return value;
}
export function DomAnchorProvider({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<AnchorId, HTMLDivElement>());
  const callbacks = useRef(new Map<AnchorId, RefCallback<HTMLDivElement>>());
  const [rects, setRects] = useState<Registry["rects"]>({});
  const register = useCallback((id: AnchorId) => {
    if (!callbacks.current.has(id))
      callbacks.current.set(id, (node) => {
        if (node) nodes.current.set(id, node);
        else nodes.current.delete(id);
      });
    return callbacks.current.get(id)!;
  }, []);
  useLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      if (!root.current) return;
      const container = root.current.getBoundingClientRect();
      const next: Registry["rects"] = {};
      nodes.current.forEach((node, id) => {
        const box = node.getBoundingClientRect();
        next[id] = {
          x: box.left - container.left,
          y: box.top - container.top,
          width: box.width,
          height: box.height,
        };
      });
      setRects((prev) =>
        JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    if (root.current) observer.observe(root.current);
    nodes.current.forEach((node) => observer.observe(node));
    measure();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, []);
  const value = useMemo(() => ({ register, rects }), [register, rects]);
  return (
    <AnchorContext.Provider value={value}>
      <div className={className} ref={root}>
        {children}
      </div>
    </AnchorContext.Provider>
  );
}
export function DomAnchor({
  id,
  children,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "id"> & {
  id: AnchorId;
  children?: ReactNode;
}) {
  const { register } = useAnchors();
  return (
    <div {...props} ref={register(id)} data-anchor={id}>
      {children}
    </div>
  );
}
