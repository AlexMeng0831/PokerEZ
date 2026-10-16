"use client";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Copy,
  Check,
  Users,
  RotateCcw,
  Info,
  CircleHelp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { usePokerStore } from "@/lib/store";
import {
  ChipStack,
  PlayerSeat,
  CommunityCards,
} from "@/components/poker/table-scene";
export default function Table() {
  const router = useRouter();
  const { room, name, leave } = usePokerStore();
  const [mounted, setMounted] = useState(false);
  const [amount, setAmount] = useState(8);
  const [pot, setPot] = useState(12);
  const [stack, setStack] = useState(92);
  const [street, setStreet] = useState(0);
  const [folded, setFolded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [logs, setLogs] = useState([
    "Demo hand started. The flop is on the table.",
  ]);
  useEffect(() => setMounted(true), []);
  const activeRoom = mounted ? room : null;
  function action(type: string) {
    if (type === "Fold") {
      setFolded(true);
      setLogs((l) => [
        "You folded. Reset the demo to try another action.",
        ...l,
      ]);
    } else {
      if (type === "Raise") {
        setPot((p) => p + amount);
        setStack((s) => s - amount);
      }
      setLogs((l) => [
        type === "Raise"
          ? `You raised to ${amount} chips. Scripted demo advanced.`
          : "You checked. Scripted demo advanced.",
        ...l,
      ]);
      setStreet((s) => Math.min(2, s + 1));
    }
  }
  function reset() {
    setPot(12);
    setStack(92);
    setStreet(0);
    setFolded(false);
    setLogs(["Demo hand reset. The flop is on the table."]);
  }
  return (
    <main className="page table-page">
      <div className="table-toolbar">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            leave();
            router.push("/");
          }}
        >
          <ArrowLeft size={16} /> Leave room
        </Button>
        <div className="room-details">
          <strong>{activeRoom?.name || "The practice table"}</strong>
          <button
            className="copy-code"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  activeRoom?.code || "EZDEMO",
                );
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                setLogs((l) => [
                  "Clipboard unavailable. Room code: " +
                    (activeRoom?.code || "EZDEMO"),
                  ...l,
                ]);
              }
            }}
          >
            {activeRoom?.code || "EZDEMO"}
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
        <span className="demo-badge">INTERACTIVE UI DEMO</span>
      </div>
      <div className="table-layout">
        <section className="table-stage" aria-label="Poker table">
          <div className="table-topline">
            <span>
              <i className="blue-dot" /> No Limit Hold’em
            </span>
            <span>Blinds {activeRoom?.blinds || "1 / 2"} · Play chips</span>
          </div>
          <div className="felt-wrap">
            <div className="poker-felt">
              <div className="felt-inner">
                <span className="felt-brand">♠ POKEREZ</span>
                <div className="pot">
                  <span>TOTAL POT</span>
                  <strong>
                    {pot} <small>chips</small>
                  </strong>
                </div>
                <CommunityCards street={street} />
                <div className="board-status">
                  {["FLOP", "TURN", "RIVER"][street]} <span>·</span> DEMO HAND
                  #001
                </div>
              </div>
            </div>
            <PlayerSeat name="Alex" initial="AL" stack={96} />
            <PlayerSeat
              name={mounted ? name : "Player"}
              initial="YO"
              stack={stack}
              hero
              folded={folded}
            />
            <span className="empty-seat empty-left">
              <PlusSeat /> Open seat
            </span>
            <span className="empty-seat empty-right">
              <PlusSeat /> Open seat
            </span>
            <div className="table-chips">
              <ChipStack value={pot} />
            </div>
          </div>
        </section>
        <aside className="table-sidebar panel">
          <div className="section-heading">
            <h3>At the table</h3>
            <span className="tag">2 / {activeRoom?.seats || 6}</span>
          </div>
          {[
            ["AL", "Alex", "96"],
            ["YO", mounted ? name : "Player", String(stack)],
          ].map(([a, n, s]) => (
            <div className="roster-player" key={a}>
              <span className="avatar">{a}</span>
              <div>
                <strong>
                  {n}
                  {a === "YO" && <small> (you)</small>}
                </strong>
                <span>
                  <i /> Seated
                </span>
              </div>
              <b>{s}</b>
            </div>
          ))}
          <div className="activity">
            <h4>
              TABLE ACTIVITY <span className="demo-badge">DEMO</span>
            </h4>
            <div aria-live="polite">
              {logs.slice(0, 5).map((l, i) => (
                <p key={`${l}-${i}`}>
                  <span />
                  {l}
                </p>
              ))}
            </div>
          </div>
          <div className="table-tip">
            <CircleHelp size={19} />
            <strong>A good time to check?</strong>
            <p>
              Checking keeps you in the hand without adding chips, when there’s
              no bet to call.
            </p>
          </div>
        </aside>
      </div>
      <section className="action-bar panel">
        <div className="action-context">
          <span className="blue-dot" />
          <div>
            <strong>
              {folded
                ? "Hand folded"
                : street === 2
                  ? "River is revealed"
                  : "Take a seat. Try an action."}
            </strong>
            <span>Scripted preview · no poker rules or opponents running</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Reset demo hand"
            onClick={reset}
          >
            <RotateCcw size={17} />
          </Button>
        </div>
        <div className="action-controls">
          <Button
            variant="outline"
            onClick={() => action("Fold")}
            disabled={folded}
          >
            Fold
          </Button>
          <Button
            variant="secondary"
            onClick={() => action("Check")}
            disabled={folded || street === 2}
          >
            Check
          </Button>
          <div className="raise-input">
            <label htmlFor="raise">Raise to</label>
            <input
              id="raise"
              type="number"
              min={4}
              max={stack}
              step={2}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>
          <Button
            onClick={() => action("Raise")}
            disabled={
              folded ||
              street === 2 ||
              amount < 4 ||
              amount > stack ||
              !Number.isFinite(amount)
            }
          >
            Raise <span>{amount}</span>
          </Button>
        </div>
      </section>
      <div className="table-disclaimer">
        <Info size={14} /> This table demonstrates UI interactions only. Room
        codes don’t connect to other players.
      </div>
    </main>
  );
}
function PlusSeat() {
  return <span>+</span>;
}
