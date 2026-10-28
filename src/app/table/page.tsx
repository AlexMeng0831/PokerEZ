"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  Copy,
  Check,
  Maximize2,
  RotateCcw,
  Spade,
  WifiOff,
} from "lucide-react";
import type { GuestAction } from "@pokerez/multiplayer/protocol";
import { TableHelp } from "@/components/poker/table-help";
import { Button } from "@/components/ui/button";
import { AnimatedButton } from "@/components/ui/animated-button";
import { AnimationTable } from "@/components/poker/animation/animation-table";
import { TableFocusFrame } from "@/components/poker/animation/table-focus-frame";
import { sendCommand, useMultiplayer } from "@/lib/multiplayer/client";
import { useRoomMotion } from "@/lib/multiplayer/use-room-motion";
import "../preview/preview.css";
import "./table.css";
const STREETS = ["Pre-flop", "Flop", "Turn", "River"];
export default function Table() {
  const { snapshot, status, pending, error, reconnect } = useMultiplayer();
  const reduced = !!useReducedMotion();
  const { presentation, flights, busy } = useRoomMotion(snapshot, reduced);
  const [focused, setFocused] = useState(false),
    [selected, setSelected] = useState(""),
    [sizing, setSizing] = useState(false),
    [amount, setAmount] = useState(0),
    [copied, setCopied] = useState(false);
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    if (!snapshot?.turnDeadline) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [snapshot?.turnDeadline]);
  const focusedHand = useRef("");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const view = snapshot?.view;
  const range = view?.legalActions?.bet ?? view?.legalActions?.raiseTo;
  useEffect(() => {
    if (
      view?.handId &&
      !["WAITING", "FINISHED"].includes(view.phase) &&
      view.handId !== focusedHand.current
    ) {
      focusedHand.current = view.handId;
      setFocused(true);
    }
    if (snapshot) setSelected(snapshot.playerId);
  }, [view?.handId, view?.phase, snapshot?.playerId]);
  useEffect(() => {
    setSizing(false);
    setAmount(range?.minTo ?? 0);
  }, [view?.revision, range?.minTo]);
  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );
  async function action(action: GuestAction) {
    if (!snapshot) return;
    try {
      await sendCommand({
        type: "action",
        revision: snapshot.view.revision,
        handId: snapshot.view.handId,
        action,
      });
    } catch {}
  }
  async function start() {
    try {
      await sendCommand({ type: "start" });
    } catch {}
  }
  async function leave() {
    if (!view || !["WAITING", "FINISHED"].includes(view.phase)) return;
    try {
      await sendCommand({ type: "leave" });
      window.location.assign("/");
    } catch {}
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(snapshot!.room.code);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1800);
    } catch {}
  }
  if (!snapshot || !view || !presentation)
    return (
      <main className="page">
        <div className="panel connection-empty">
          <Spade size={30} />
          <h2>
            {status === "connected"
              ? "Your seat starts here."
              : "Connecting your guest seat…"}
          </h2>
          <p>
            {error || "Create a room or enter a friend's room code to play."}
          </p>
          <Button asChild>
            <Link href="/">Back to Play</Link>
          </Button>
          {status !== "connected" && (
            <Button variant="outline" onClick={reconnect}>
              Reconnect
            </Button>
          )}
        </div>
      </main>
    );
  const hero = view.players.find((p) => p.id === snapshot.playerId)!;
  const between = ["WAITING", "FINISHED"].includes(view.phase);
  const ready = view.players.filter(
    (p) => snapshot.connected.includes(p.id) && p.stack > 0,
  ).length;
  const canAct =
    status === "connected" &&
    !pending &&
    !busy &&
    view.actorId === snapshot.playerId;
  const canStart =
    between && ready >= 2 && status === "connected" && !pending && !busy;
  const actor = view.players.find((p) => p.id === view.actorId);
  const legal = view.legalActions!;
  const title =
    status !== "connected"
      ? "Reconnecting · your seat is reserved"
      : busy
        ? "Cards and chips are settling…"
        : view.phase === "WAITING"
          ? ready < 2
            ? "Waiting for a friend to take a seat."
            : "Two or more players are ready. Start when you like."
          : view.phase === "FINISHED"
            ? presentation.awards?.[snapshot.playerId]
              ? `You collected ${presentation.awards[snapshot.playerId]} chips.`
              : "Hand complete. Ready for another?"
            : canAct
              ? legal.call !== null
                ? `Your turn · ${legal.call} to call`
                : "Your turn · check or bet"
              : `${actor?.name ?? "Player"} to act`;
  const phaseIndex = ["PREFLOP", "FLOP", "TURN", "RIVER"].indexOf(view.phase);
  const valid =
    !!range &&
    Number.isSafeInteger(amount) &&
    amount >= range.minTo &&
    amount <= range.maxTo;
  function confirm() {
    if (!range || !valid) return;
    void action(
      amount === range.maxTo && legal.allIn
        ? { type: "ALL_IN" }
        : { type: view!.currentBet === 0 ? "BET" : "RAISE_TO", to: amount },
    );
  }
  return (
    <main
      className={`page rehearsal-page multiplayer-page ${view.phase === "WAITING" ? "is-waiting" : ""}`}
    >
      <div className="rehearsal-toolbar">
        {between ? (
          <Button variant="ghost" size="sm" onClick={leave} disabled={pending}>
            <ArrowLeft size={15} />
            Leave room
          </Button>
        ) : (
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft size={15} />
              Back to lobby
            </Link>
          </Button>
        )}
        <div className="rehearsal-room">
          <strong>{snapshot.room.name}</strong>
          <button onClick={copy} aria-label="Copy room code">
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span data-room-code>{snapshot.room.code}</span>
          </button>
        </div>
        <TableHelp />
        <Button variant="outline" size="sm" onClick={() => setFocused(true)}>
          <Maximize2 size={14} />
          Focus table
        </Button>
      </div>
      <TableFocusFrame
        active={focused}
        onExit={() => setFocused(false)}
        actions={
          <>
            <TableHelp />
            <Button asChild variant="outline" size="sm">
              <Link href="/" title="Return to lobby · keep your seat">
                Lobby
              </Link>
            </Button>
          </>
        }
      >
        <div className="rehearsal-table">
          <AnimationTable
            state={presentation}
            flights={flights}
            reduced={reduced}
            speed={1}
            phase={presentation.phase ?? view.phase.toLowerCase()}
            selectedSeat={selected}
            onSelectSeat={setSelected}
            activeSeat={busy ? undefined : (view.actorId ?? undefined)}
          />
          {view.phase === "WAITING" && (
            <div className="table-welcome">
              <Spade size={22} fill="currentColor" />
              <strong>
                {ready < 2 ? "Waiting for players" : "Your table is ready."}
              </strong>
              <span>
                {view.players.length} / {snapshot.room.capacity} players ·{" "}
                {snapshot.room.smallBlind} / {snapshot.room.bigBlind} blinds
              </span>
              <button className="room-code-share" onClick={copy}>
                {copied ? "Copied!" : snapshot.room.code}
                <Copy size={15} />
              </button>
              <span>Share the code with a friend in another browser.</span>
            </div>
          )}
        </div>
        <section
          className="table-dock panel"
          aria-label="Your poker actions"
          aria-busy={busy || pending}
        >
          <div className="dock-topline">
            <div className="dock-status" role="status" aria-live="polite">
              <span className={`status-light ${canAct ? "your-turn" : ""}`} />
              <div>
                <strong>{title}</strong>
                {snapshot.turnDeadline && !between && (
                  <span
                    className="turn-clock"
                    role="timer"
                    aria-live="off"
                    aria-label="Seconds remaining in this turn"
                  >
                    {Math.max(
                      0,
                      Math.ceil((snapshot.turnDeadline - now) / 1000),
                    )}
                    s
                  </span>
                )}
                <p>
                  {between
                    ? "Your guest seat is saved for reconnects."
                    : hero.status === "FOLDED"
                      ? "Your cards stay visible to you while the hand plays out."
                      : "Choose an action before the timer runs out."}
                </p>
              </div>
            </div>
            <ol className="street-progress" aria-label="Hand progress">
              {STREETS.map((label, i) => (
                <li
                  key={label}
                  className={
                    i <= phaseIndex || view.phase === "FINISHED"
                      ? "reached"
                      : ""
                  }
                >
                  <span />
                  {label}
                </li>
              ))}
            </ol>
          </div>
          {view.phase === "WAITING" && (
            <div className="room-roster" aria-label="Room players">
              <p>
                <strong>
                  {ready} ready · {view.players.length}/{snapshot.room.capacity}{" "}
                  seats
                </strong>
                <span>
                  {ready >= 2
                    ? "Any connected player can start."
                    : "At least two online players with chips are needed."}
                </span>
              </p>
              <ul>
                {view.players.map((p) => {
                  const online = snapshot.connected.includes(p.id);
                  return (
                    <li key={p.id}>
                      <i className={online ? "online" : "offline"} />
                      <strong>
                        {p.id === snapshot.playerId ? "You" : p.name}
                      </strong>
                      <span>
                        {!online
                          ? "Offline · seat saved"
                          : p.stack === 0
                            ? "Needs chips"
                            : "Ready"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {!busy && view.result && (
            <details className="hand-result" open>
              <summary>
                Hand result ·{" "}
                {view.result.reason === "UNCONTESTED"
                  ? "Everyone else folded"
                  : "Showdown"}
              </summary>
              <ul>
                {view.result.pots.map((pot, i) => (
                  <li key={pot.id}>
                    <strong>
                      {i === 0 ? "Main pot" : `Side pot ${i}`} · {pot.amount}{" "}
                      chips{pot.winners.length > 1 ? " · Split" : ""}
                    </strong>
                    <span>
                      {pot.shares
                        .map(
                          (share) =>
                            `${share.playerId === snapshot.playerId ? "You" : (view.players.find((p) => p.id === share.playerId)?.name ?? "Player")} +${share.amount}`,
                        )
                        .join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {sizing && range && canAct && (
            <div className="bet-sizing">
              <div className="bet-presets">
                <label htmlFor="custom-bet">
                  {view.currentBet === 0 ? "Bet" : "Raise to"}
                </label>
                <input
                  id="custom-bet"
                  aria-label="Custom bet amount"
                  aria-describedby="bet-range-note"
                  aria-invalid={!valid}
                  type="number"
                  inputMode="numeric"
                  min={range.minTo}
                  max={range.maxTo}
                  step={1}
                  value={amount}
                  onChange={(e) =>
                    setAmount(
                      e.target.value === "" ? 0 : Number(e.target.value),
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && valid) {
                      e.preventDefault();
                      confirm();
                    }
                  }}
                />
                <div>
                  <button onClick={() => setAmount(range.minTo)}>MIN</button>
                  <button
                    onClick={() =>
                      setAmount(
                        Math.min(
                          range.maxTo,
                          Math.max(
                            range.minTo,
                            Math.floor(
                              (view.totalPot + (legal.call ?? 0)) / 2,
                            ) + view.currentBet,
                          ),
                        ),
                      )
                    }
                  >
                    ½ POT
                  </button>
                  <button onClick={() => setAmount(range.maxTo)}>ALL IN</button>
                </div>
              </div>
              <p id="bet-range-note" className="bet-range-note">
                {range.minTo === range.maxTo && range.minTo < range.fullMinTo
                  ? `Short all-in only: ${range.maxTo} total.`
                  : `Min ${range.minTo} · Max ${range.maxTo} chips.`}{" "}
                Your total on this street
                {valid
                  ? ` · add ${amount - hero.streetCommitted} chips`
                  : ". Enter a whole number in range."}
              </p>
              <input
                type="range"
                aria-label="Bet amount slider"
                min={range.minTo}
                max={range.maxTo}
                step={1}
                value={Math.max(range.minTo, Math.min(range.maxTo, amount))}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
          )}
          <div className="dock-actions">
            {between ? (
              <AnimatedButton
                disabled={
                  hero.stack === 0
                    ? status !== "connected" || pending || busy
                    : !canStart
                }
                onClick={() =>
                  hero.stack === 0
                    ? void sendCommand({ type: "topup" }).catch(() => {})
                    : void start()
                }
              >
                {view.phase === "FINISHED" ? (
                  <RotateCcw size={16} />
                ) : (
                  <Spade size={16} />
                )}{" "}
                {hero.stack === 0
                  ? "Add 1,000 chips"
                  : ready < 2
                    ? "Waiting for players…"
                    : view.phase === "FINISHED"
                      ? "Deal next hand"
                      : "Deal me in"}
              </AnimatedButton>
            ) : (
              <>
                <AnimatedButton
                  variant="outline"
                  className="fold-action"
                  disabled={!canAct || !legal.fold}
                  onClick={() => void action({ type: "FOLD" })}
                >
                  Fold
                </AnimatedButton>
                <AnimatedButton
                  variant="secondary"
                  disabled={!canAct || (!legal.check && legal.call === null)}
                  onClick={() =>
                    void action({ type: legal.check ? "CHECK" : "CALL" })
                  }
                >
                  {legal.check
                    ? "Check"
                    : legal.call !== null
                      ? `Call ${legal.call}${legal.call === hero.stack ? " · All in" : ""}`
                      : "Call"}
                </AnimatedButton>
                <AnimatedButton
                  disabled={
                    !canAct || (!range && !legal.allIn) || (sizing && !valid)
                  }
                  aria-expanded={range ? sizing : undefined}
                  onClick={() =>
                    !range && legal.allIn
                      ? void action({ type: "ALL_IN" })
                      : sizing
                        ? confirm()
                        : setSizing(true)
                  }
                >
                  {!range && legal.allIn
                    ? `All in ${legal.allIn.to}`
                    : sizing && range
                      ? amount === range.maxTo
                        ? `All in ${amount}`
                        : `${view.currentBet === 0 ? "Bet" : "Raise to"} ${amount}`
                      : view.currentBet === 0
                        ? "Bet…"
                        : "Raise…"}
                </AnimatedButton>
              </>
            )}
          </div>
          <div className="dock-footnote">
            <span>
              {status === "connected" ? "LIVE TABLE" : "RECONNECTING"} ·{" "}
              {snapshot.connected.length} connected · Play chips only
            </span>
            {sizing ? (
              <button onClick={() => setSizing(false)}>Cancel bet</button>
            ) : (
              <span>{snapshot.room.code}</span>
            )}
          </div>
          {status !== "connected" && (
            <div className="connection-message">
              <WifiOff size={14} />
              <span>Your seat and chips are reserved.</span>
              <button onClick={reconnect}>Reconnect</button>
            </div>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </section>
      </TableFocusFrame>
    </main>
  );
}
