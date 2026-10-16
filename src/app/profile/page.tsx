"use client";
import { useState, useEffect } from "react";
import {
  Pencil,
  Layers,
  Trophy,
  Coins,
  Crosshair,
  TrendingUp,
  ArrowUpRight,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { CardRow } from "@/components/poker/playing-card";
import { usePokerStore } from "@/lib/store";
const hands = [
  {
    cards: [
      ["A", "♠"],
      ["K", "♥"],
    ],
    position: "BTN",
    result: 48,
    note: "Top pair, better kicker",
    date: "Oct 12 · 9:14 PM",
  },
  {
    cards: [
      ["Q", "♠"],
      ["J", "♦"],
    ],
    position: "CO",
    result: -12,
    note: "Missed straight draw",
    date: "Oct 12 · 8:37 PM",
  },
  {
    cards: [
      ["7", "♥"],
      ["7", "♣"],
    ],
    position: "MP",
    result: 36,
    note: "Three of a kind on the flop",
    date: "Oct 12 · 8:12 PM",
  },
  {
    cards: [
      ["A", "♣"],
      ["Q", "♥"],
    ],
    position: "SB",
    result: -24,
    note: "Lost to a higher kicker",
    date: "Oct 10 · 10:03 PM",
  },
  {
    cards: [
      ["K", "♠"],
      ["10", "♠"],
    ],
    position: "BB",
    result: 28,
    note: "Made a straight on the river",
    date: "Oct 10 · 9:41 PM",
  },
];
export default function Profile() {
  const { name, setName } = usePokerStore();
  const [mounted, setMounted] = useState(false);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState("");
  const [range, setRange] = useState("30D");
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => setMounted(true), []);
  const paths: Record<string, string> = {
    "7D": "0,145 45,165 90,134 135,143 180,109 225,118 270,80 315,100 360,55 405,66 450,38 500,17",
    "30D":
      "0,151 20,164 40,178 60,163 80,179 100,158 120,164 140,156 160,132 180,129 200,117 220,130 240,119 260,108 280,117 300,108 320,116 340,95 360,72 380,83 400,69 420,72 440,58 460,60 480,43 500,48 520,19 540,25 560,6",
    "90D":
      "0,178 40,165 80,183 120,152 160,160 200,138 240,144 280,115 320,125 360,88 400,97 440,62 480,72 520,33 560,6",
    All: "0,185 40,192 80,170 120,181 160,153 200,147 240,160 280,120 320,125 360,102 400,86 440,91 480,54 520,28 560,6",
  };
  const line = paths[range];
  return (
    <main className="page profile-page">
      <div className="profile-identity">
        <span className="profile-avatar">
          {mounted ? name.charAt(0).toUpperCase() : "P"}
        </span>
        <div>
          <div className="identity-name">
            <h1>{mounted ? name : "Player"}</h1>
            <span className="demo-badge">GUEST PROFILE</span>
          </div>
          <p>Keep learning. Find your rhythm. Play better.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setDraft(name);
            setEdit(true);
          }}
        >
          <Pencil size={15} /> Edit profile
        </Button>
      </div>
      <div className="demo-notice">
        <span className="demo-badge">DEMO DATA</span> A preview of your future
        poker dashboard. These stats and hands are sample data.
      </div>
      <section className="stats-grid">
        {[
          [
            Layers,
            "Total hands",
            "1,248",
            "Every hand is a little experience.",
            "blue",
          ],
          [Trophy, "Win rate", "22.8%", "+4.1% from last period", "green"],
          [
            Coins,
            "Net result",
            "+86.5 BB",
            "Play chips. Real progress.",
            "blue",
          ],
          [
            Crosshair,
            "Best position",
            "BTN",
            "The button looks good on you.",
            "purple",
          ],
        ].map(([Icon, title, value, note, color]) => {
          const I = Icon as typeof Layers;
          return (
            <div className="panel stat-card" key={String(title)}>
              <div className={`icon-box ${color}`}>
                <I size={21} />
              </div>
              <span>{String(title)}</span>
              <strong className={title === "Net result" ? "positive" : ""}>
                {String(value)}
              </strong>
              <small className={title === "Win rate" ? "positive" : ""}>
                {title === "Win rate" && <ArrowUpRight size={13} />}{" "}
                {String(note)}
              </small>
            </div>
          );
        })}
      </section>
      <div className="charts-grid">
        <section className="panel chart-panel">
          <div className="section-heading">
            <div>
              <h3>
                <TrendingUp size={18} /> Your progress
              </h3>
              <p>Cumulative result in big blinds</p>
            </div>
            <div className="range-tabs" aria-label="Chart period">
              {["7D", "30D", "90D", "All"].map((r) => (
                <button
                  key={r}
                  className={range === r ? "selected" : ""}
                  onClick={() => setRange(r)}
                  aria-pressed={range === r}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="line-chart">
            <div className="y-labels">
              <span>300</span>
              <span>200</span>
              <span>100</span>
              <span>0</span>
              <span>−100</span>
            </div>
            <svg
              viewBox="0 0 560 210"
              preserveAspectRatio="none"
              role="img"
              aria-label={`Sample cumulative profit over ${range}`}
            >
              <defs>
                <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop stopColor="#3478f6" stopOpacity=".2" />
                  <stop offset="1" stopColor="#3478f6" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0, 50, 100, 150, 200].map((y) => (
                <line
                  key={y}
                  x1="0"
                  x2="560"
                  y1={y}
                  y2={y}
                  className="chart-grid-line"
                />
              ))}
              <polygon
                points={`0,210 ${line} 560,210`}
                fill="url(#chart-fill)"
              />
              <polyline
                points={line}
                fill="none"
                stroke="#3478f6"
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
            </svg>
            <div className="x-labels">
              {["Oct 1", "Oct 5", "Oct 9", "Oct 13"].map((x, i) => (
                <span key={x}>
                  {range === "7D"
                    ? ["Oct 7", "Oct 9", "Oct 11", "Oct 13"][i]
                    : range === "90D"
                      ? ["Jul", "Aug", "Sep", "Oct"][i]
                      : range === "All"
                        ? ["Jan", "Apr", "Jul", "Oct"][i]
                        : x}
                </span>
              ))}
            </div>
          </div>
        </section>
        <section className="panel chart-panel">
          <div className="section-heading">
            <div>
              <h3>Winning hands</h3>
              <p>A breakdown of your demo wins</p>
            </div>
            <span className="tag">285 WINS</span>
          </div>
          <div className="donut-layout">
            <div className="donut">
              <div>
                <span>Hands won</span>
                <strong>285</strong>
              </div>
            </div>
            <div className="chart-legend">
              {[
                ["One pair", "38.6%", "#2874f5"],
                ["Two pair", "23.2%", "#6199fb"],
                ["Three of a kind", "12.6%", "#91b8fc"],
                ["Straight", "8.1%", "#b6cffb"],
                ["Flush", "6.7%", "#d2dffa"],
                ["Other", "10.8%", "#e5eaf3"],
              ].map(([label, value, color]) => (
                <div key={label}>
                  <span style={{ background: color }} />
                  <span>{label}</span>
                  <b>{value}</b>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      <section className="recent-section">
        <div className="section-heading">
          <div>
            <h2>
              Recent hands <span className="demo-badge">DEMO DATA</span>
            </h2>
            <p>Every hand has something to teach you.</p>
          </div>
          <span className="muted small-text">5 sample hands</span>
        </div>
        <div className="panel table-scroll">
          <table>
            <thead>
              <tr>
                <th>Played</th>
                <th>Your cards</th>
                <th>Position</th>
                <th>Result (BB)</th>
                <th>What happened</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {hands.map((h, i) => (
                <tr
                  key={i}
                  onClick={() => setSelected(i)}
                  className="clickable-row"
                >
                  <td>{h.date}</td>
                  <td>
                    <CardRow cards={h.cards} small />
                  </td>
                  <td>
                    <span className="position-badge">{h.position}</span>
                  </td>
                  <td className={h.result > 0 ? "positive" : "negative"}>
                    {h.result > 0 ? "+" : ""}
                    {h.result}
                  </td>
                  <td>{h.note}</td>
                  <td>
                    <button
                      className="row-button"
                      aria-label={`Inspect sample hand ${i + 1}`}
                      onClick={() => setSelected(i)}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Modal
        open={edit}
        onOpenChange={setEdit}
        title="Make yourself at home."
        description="Your display name is saved in this browser only."
      >
        <form
          className="modal-form"
          onSubmit={(e) => {
            e.preventDefault();
            setName(draft.trim());
            setEdit(false);
          }}
        >
          <label>
            Display name
            <input
              maxLength={20}
              minLength={1}
              required
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <Button disabled={!draft.trim()} type="submit">
            Save profile
          </Button>
        </form>
      </Modal>
      <Modal
        open={selected !== null}
        onOpenChange={() => setSelected(null)}
        title="A hand to learn from."
        description="Illustrative sample hand · no real hand history is stored."
      >
        {selected !== null && (
          <div className="hand-detail">
            <CardRow cards={hands[selected].cards} />
            <h3>{hands[selected].note}</h3>
            <p>
              You played from {hands[selected].position}. Sample result:{" "}
              <strong
                className={hands[selected].result > 0 ? "positive" : "negative"}
              >
                {hands[selected].result > 0 ? "+" : ""}
                {hands[selected].result} BB
              </strong>
              .
            </p>
            <div className="info-note">
              Tip: your position affects how much information you have before
              acting.
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
}
