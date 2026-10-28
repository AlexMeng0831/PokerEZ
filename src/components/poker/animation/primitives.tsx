"use client";
import { useEffect } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useTransform,
} from "motion/react";
import { PlayingCard } from "@/components/poker/playing-card";
import { useAnchors, type AnchorId } from "./dom-anchors";
import type {
  VisualCard as Card,
  VisualPot as Pot,
} from "@/lib/multiplayer/presentation";
export function AnimatedAmount({
  value,
  reduced,
  className,
}: {
  value: number;
  reduced: boolean;
  className?: string;
}) {
  const number = useMotionValue(value);
  const display = useTransform(number, (latest) =>
    Math.round(latest).toLocaleString("en-US"),
  );
  useEffect(() => {
    const control = animate(number, value, {
      duration: reduced ? 0 : 0.42,
      ease: "easeOut",
    });
    return () => control.stop();
  }, [number, value, reduced]);
  return (
    <span className={className} aria-label={value.toLocaleString("en-US")}>
      <motion.span aria-hidden="true">{display}</motion.span>
    </span>
  );
}

export function FlipCard({
  card,
  revealed,
  reduced,
  highlighted = false,
}: {
  card: Card;
  revealed: boolean;
  reduced: boolean;
  highlighted?: boolean;
}) {
  return (
    <motion.div
      className={`anim-card ${highlighted ? "card-made" : ""}`}
      data-highlighted={highlighted && revealed}
      role="img"
      aria-label={
        revealed
          ? `${card.rank} ${card.suit}${highlighted ? ", part of best hand" : ""}`
          : "Face-down card"
      }
      initial={false}
      transition={{ type: "spring", stiffness: 380, damping: 24 }}
    >
      {reduced ? (
        <>
          <motion.div
            className="card-face"
            animate={{ opacity: revealed ? 0 : 1 }}
            transition={{ duration: 0.1 }}
            aria-hidden="true"
          >
            <PlayingCard hidden />
          </motion.div>
          <motion.div
            className="card-face"
            animate={{ opacity: revealed ? 1 : 0 }}
            transition={{ duration: 0.1 }}
            aria-hidden="true"
          >
            <PlayingCard {...card} />
          </motion.div>
        </>
      ) : (
        <motion.div
          className="flip-inner"
          initial={false}
          animate={{ rotateY: revealed ? 180 : 0 }}
          transition={{ duration: 0.46, ease: [0.22, 0.8, 0.3, 1] }}
        >
          <div className="card-face flip-back" aria-hidden="true">
            <PlayingCard hidden />
          </div>
          <div className="card-face flip-front" aria-hidden="true">
            <PlayingCard {...card} />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
export type Flight = {
  id: number;
  from: AnchorId;
  to: AnchorId;
  kind: "card" | "chip";
  amount?: number;
};
export function DealFlightLayer({
  flights,
  reduced,
  speed,
}: {
  flights: Flight[];
  reduced: boolean;
  speed: number;
}) {
  const { rects } = useAnchors();
  if (reduced) return null;
  return (
    <div className="flight-layer" aria-hidden="true">
      {flights.map((f) => {
        const from = rects[f.from],
          to = rects[f.to];
        if (!from || !to) return null;
        const width = f.kind === "card" ? to.width : 23;
        const height = f.kind === "card" ? to.height : 23;
        return (
          <motion.div
            key={f.id}
            className={`flight flight-${f.kind}`}
            style={{ width, height }}
            initial={{
              x: from.x + (from.width - width) / 2,
              y: from.y + (from.height - height) / 2,
              opacity: 0,
              rotate: f.kind === "card" ? -13 : 0,
              scale: 0.92,
            }}
            animate={{
              x: [
                from.x + (from.width - width) / 2,
                to.x + (to.width - width) / 2,
              ],
              y: [
                from.y + (from.height - height) / 2,
                (from.y + to.y) / 2 - (f.kind === "card" ? 14 : 4),
                to.y + (to.height - height) / 2,
              ],
              opacity: 1,
              rotate: f.kind === "card" ? [-13, 4, 0] : 0,
              scale: f.kind === "card" ? [0.92, 1.04, 1] : [0.92, 1.12, 1],
            }}
            transition={{
              duration:
                (f.kind === "card" && f.to.startsWith("seat-") ? 0.26 : 0.48) /
                speed,
              ease: [0.22, 0.75, 0.25, 1],
            }}
          >
            {f.kind === "card" ? (
              <PlayingCard hidden />
            ) : (
              <span className="anim-chip" />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
export function BetChips({
  amount,
  reduced,
}: {
  amount: number;
  reduced: boolean;
}) {
  return (
    <motion.div
      className="bet-chips"
      initial={{ opacity: 0, y: reduced ? 0 : 5, scale: reduced ? 1 : 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0.1 : 0.22 }}
    >
      <motion.span
        key={amount}
        className="anim-chip"
        animate={reduced ? {} : { y: [0, -6, 0], scale: [1, 1.12, 1] }}
        transition={{ duration: 0.28 }}
      />
      <AnimatedAmount value={amount} reduced={reduced} />
    </motion.div>
  );
}

export function PotDisplay({
  amount,
  pots = [],
  reduced,
  names,
}: {
  amount: number;
  pots?: Pot[];
  names?: Record<string, string>;
  reduced: boolean;
}) {
  return (
    <SidePotLabels pots={pots} total={amount} reduced={reduced} names={names} />
  );
}
export function SidePotLabels({
  pots,
  total,
  reduced,
  names,
}: {
  pots: Pot[];
  total: number;
  names?: Record<string, string>;
  reduced: boolean;
}) {
  const main = pots[0];
  return (
    <motion.div
      className={`pot-split-display ${main ? "is-split" : ""} ${pots.length > 3 ? "many-pots" : ""}`}
      aria-label={`Total pot: ${total} chips`}
    >
      <motion.div
        layout={!reduced}
        className="pot-main-tile"
        transition={{ type: "spring", stiffness: 270, damping: 26 }}
      >
        <span>{main?.label ?? "Total pot"}</span>
        <strong>
          <AnimatedAmount value={main?.amount ?? total} reduced={reduced} />
          <small> chips</small>
        </strong>
        {main && (
          <small className="pot-eligible">
            {main.eligible
              .map(
                (id) =>
                  names?.[id] ??
                  (id === "you"
                    ? "You"
                    : id.charAt(0).toUpperCase() + id.slice(1)),
              )
              .join(" · ")}
          </small>
        )}
      </motion.div>
      <AnimatePresence>
        {pots.slice(1).map((p) => (
          <motion.div
            layout={!reduced}
            key={p.id}
            className="pot-side-tile"
            initial={{
              opacity: 0,
              x: reduced ? 0 : "-65%",
              scale: reduced ? 1 : 0.75,
            }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{
              opacity: 0,
              x: reduced ? 0 : "-65%",
              scale: reduced ? 1 : 0.85,
            }}
            transition={{ type: "spring", stiffness: 270, damping: 25 }}
          >
            <span>{p.label}</span>
            <strong>
              <AnimatedAmount value={p.amount} reduced={reduced} />
              <small> chips</small>
            </strong>
            <small className="pot-eligible">
              {p.eligible
                .map(
                  (id) =>
                    names?.[id] ??
                    (id === "you"
                      ? "You"
                      : id.charAt(0).toUpperCase() + id.slice(1)),
                )
                .join(" · ")}
            </small>
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
