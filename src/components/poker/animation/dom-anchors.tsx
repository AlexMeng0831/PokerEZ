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

export type AnchorId =
  | "deck"
  | "pot"
  | `seat-${string}-${number}`
  | `stack-${string}`
  | `bet-${string}`
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
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const scheduleMeasure = useRef<() => void>(() => {});
  const [rects, setRects] = useState<Registry["rects"]>({});
  const register = useCallback((id: AnchorId) => {
    if (!callbacks.current.has(id))
      callbacks.current.set(id, (node) => {
        const prior = nodes.current.get(id);
        if (prior) resizeObserver.current?.unobserve(prior);
        if (node) {
          nodes.current.set(id, node);
          resizeObserver.current?.observe(node);
        } else nodes.current.delete(id);
        scheduleMeasure.current();
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
    scheduleMeasure.current = schedule;
    const observer = new ResizeObserver(schedule);
    resizeObserver.current = observer;
    if (root.current) observer.observe(root.current);
    nodes.current.forEach((node) => observer.observe(node));
    measure();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      observer.disconnect();
      resizeObserver.current = null;
      scheduleMeasure.current = () => {};
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
