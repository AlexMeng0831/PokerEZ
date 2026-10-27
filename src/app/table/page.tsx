"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MotionConfig, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, Copy, Maximize2, RotateCcw, Spade } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedButton } from "@/components/ui/animated-button";
import { AnimationTable } from "@/components/poker/animation/animation-table";
import { TableFocusFrame } from "@/components/poker/animation/table-focus-frame";
import { useMockPlayback } from "@/components/poker/animation/use-mock-playback";
import { usePokerStore } from "@/lib/store";
import { rehearsalOpening, rehearsalRound, type RehearsalStreet, type RehearsalChoice, type SeatId } from "@/lib/animation/mock-game";
import "../preview/preview.css";
import "./table.css";

const STREETS = ["Pre-flop", "Flop", "Turn", "River"];
export default function Table() {
  const reduced = !!useReducedMotion();
  const playback = useMockPlayback({ reduced, speed: 1.35 });
  const { state, running } = playback;
  const { room, name, leave } = usePokerStore();
  const [mounted, setMounted] = useState(false);
  const [focused, setFocused] = useState(false);
  const [started, setStarted] = useState(false);
  const [street, setStreet] = useState<RehearsalStreet>(0);
  const [selected, setSelected] = useState<SeatId>("you");
  const [amount, setAmount] = useState(16);
  const [sizing, setSizing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState("");
  const busy = useRef(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setMounted(true);
    return () => { if (copyTimer.current) clearTimeout(copyTimer.current); };
  }, []);
  const activeRoom = mounted ? room : null;
  const finished = !!state.winner && !running;
  const canAct = started && !finished && !running;
  const hero = state.players.find((p) => p.id === "you")!;
  const displayState = { ...state, players: state.players.map((p) => p.id === "you" ? { ...p, name: mounted && name !== "Player" ? name : "You" } : p) };
  const phase = state.winner ? "Hand complete" : state.board.length === 5 ? "River" : state.board.length === 4 ? "Turn" : state.board.length === 3 ? "Flop" : "Pre-flop";

  async function start() {
    if (busy.current) return;
    busy.current = true;
    playback.reset();
    setFocused(true);
    setStarted(true);
    setStreet(0);
    setSelected("you");
    setAmount(16);
    setSizing(false);
    setFeedback("");
    try { await playback.playEvents(rehearsalOpening()); }
    catch { setFeedback("The deal stopped. Try dealing again."); setStarted(false); }
    finally { busy.current = false; }
  }
  async function act(choice: RehearsalChoice) {
    if (busy.current || !canAct) return;
    const events = rehearsalRound(state, street, choice, amount);
    if (!events.length) return;
    busy.current = true;
    setSizing(false);
    setFeedback("");
    try {
      await playback.playEvents(events);
      if (choice !== "fold" && street < 3) {
        setStreet((street + 1) as RehearsalStreet);
        setAmount(8);
      }
    } catch { setFeedback("The hand stopped. Deal again to reset the demo."); setStarted(false); }
    finally { busy.current = false; }
  }
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(activeRoom?.code || "EZDEMO");
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch { setFeedback(`Room code: ${activeRoom?.code || "EZDEMO"}`); }
  }
  const title = !started ? "A seat for you. A hand to try." : running ? "The table is moving…" : finished ? hero.folded ? "Folded. There’s always another hand." : `Nice hand. You collected ${state.awarded} chips.` : street === 0 ? "Your turn · 8 to call" : "Your turn · check or bet";
  const hint = !started ? "Try a short demo hand. No setup, no pressure." : running ? "Cards and chips settle before your next move." : finished ? "Same demo deal, fresh stacks. Try a different action." : street === 0 ? "Call matches the bet. Raise puts a little more in." : "Check to stay in for free, or choose a small bet.";
  return (
    <MotionConfig reducedMotion="user">
      <main className="page rehearsal-page">
        <div className="rehearsal-toolbar">
          <Button asChild variant="ghost" size="sm"><Link href="/" onClick={leave}><ArrowLeft size={15} /> Leave table</Link></Button>
          <div className="rehearsal-room"><strong>{activeRoom?.name || "The practice table"}</strong><button onClick={copyCode} aria-label="Copy demo room code">{copied ? <Check size={12} /> : <Copy size={12} />}{copied ? "Copied" : activeRoom?.code || "EZDEMO"}</button></div>
          <Button variant="outline" size="sm" onClick={() => setFocused(true)}><Maximize2 size={14} /> Focus table</Button>
        </div>
        <TableFocusFrame active={focused} onExit={() => setFocused(false)}>
          <div className="rehearsal-table">
            <AnimationTable state={displayState} flights={playback.flights} reduced={reduced} speed={1.35} phase={phase} selectedSeat={selected} onSelectSeat={setSelected} activeSeat={canAct ? "you" : undefined} />
            {!started && !running && <div className="table-welcome"><span className="welcome-spade"><Spade size={20} fill="currentColor" /></span><strong>Your next good hand starts here.</strong><span>3 seats · play chips · take your time</span><AnimatedButton onClick={() => void start()}>Deal me in <ArrowRight size={16} /></AnimatedButton></div>}
          </div>
          <section className="table-dock panel" aria-label="Your poker actions" aria-busy={running}>
            <div className="dock-topline">
              <div className="dock-status" role="status" aria-live="polite"><span className={`status-light ${canAct ? "your-turn" : ""}`} /><div><strong>{title}</strong><p>{hint}</p></div></div>
              <ol className="street-progress" aria-label="Hand progress">{STREETS.map((label, i) => <li key={label} className={started && (finished || i <= street) ? "reached" : ""} aria-current={started && !finished && i === street ? "step" : undefined}><span />{label}</li>)}</ol>
            </div>
            {sizing && canAct && <motion.div className="bet-sizing" initial={{ opacity: 0, height: reduced ? "auto" : 0 }} animate={{ opacity: 1, height: "auto" }} transition={{ duration: .16 }}>
              <div className="bet-presets"><label htmlFor="bet-size">{street === 0 ? "Raise to" : "Bet"} <strong>{amount} chips</strong></label><div>{(street === 0 ? [16, 20, 24] : [4, 8, 16]).map((value) => <button key={value} aria-pressed={amount === value} onClick={() => setAmount(value)}>{value}</button>)}</div></div>
              <input id="bet-size" aria-label={street === 0 ? "Raise amount" : "Bet amount"} type="range" min={street === 0 ? 16 : 4} max={street === 0 ? 24 : 16} step={2} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </motion.div>}
            <div className="dock-actions">
              {!started || finished ? <AnimatedButton onClick={() => void start()} disabled={running}>{finished ? <RotateCcw size={16} /> : <Spade size={16} />}{finished ? "Play another hand" : "Deal me in"}</AnimatedButton> : <>
                <AnimatedButton variant="outline" disabled={!canAct} onClick={() => void act("fold")} className="fold-action">Fold</AnimatedButton>
                <AnimatedButton variant="secondary" disabled={!canAct} onClick={() => void act("check-call")}>{street === 0 ? "Call 8" : "Check"}</AnimatedButton>
                <AnimatedButton disabled={!canAct} aria-expanded={sizing} onClick={() => sizing ? void act("bet") : setSizing(true)}>{sizing ? `${street === 0 ? "Raise to" : "Bet"} ${amount}` : street === 0 ? "Raise…" : "Bet…"}</AnimatedButton>
              </>}
            </div>
            <div className="dock-footnote"><span>LOCAL DEMO · Fixed cards & scripted opponents</span>{sizing && canAct ? <button onClick={() => setSizing(false)}>Cancel bet</button> : <span>Play chips only</span>}</div>
            {feedback && <p className="form-error" role="alert">{feedback}</p>}
          </section>
        </TableFocusFrame>
      </main>
    </MotionConfig>
  );
}
