"use client";
import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Trophy,
  Coins,
  ArrowRight,
  Check,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardRow } from "@/components/poker/playing-card";
import { rankings } from "@/lib/demo";
export default function Learn() {
  const [tab, setTab] = useState("rules");
  const [step, setStep] = useState(0);
  const steps = [
    {
      name: "Pre-flop",
      text: "Everyone receives two private cards. Starting left of the big blind, players can fold, call, or raise.",
    },
    {
      name: "Flop",
      text: "Three community cards are revealed. A new betting round begins with the first active player left of the dealer.",
    },
    {
      name: "Turn",
      text: "A fourth community card is revealed, followed by another round of betting.",
    },
    {
      name: "River",
      text: "The fifth community card is revealed. After the final betting round, remaining players compare their best five-card hands.",
    },
  ];
  return (
    <main className="page">
      <div className="page-heading">
        <div className="eyebrow">A LITTLE KNOW-HOW GOES A LONG WAY</div>
        <h1>Find your poker footing.</h1>
        <p>Simple explanations. Better decisions. One hand at a time.</p>
      </div>
      <div className="learn-layout">
        <aside className="learn-nav panel" aria-label="Learning topics">
          {[
            ["rules", "Rules & objective", BookOpen],
            ["rankings", "Hand rankings", Trophy],
            ["basics", "Betting basics", Coins],
          ].map(([id, title, Icon]) => {
            const I = Icon as typeof BookOpen;
            return (
              <button
                key={String(id)}
                onClick={() => setTab(String(id))}
                className={tab === id ? "selected" : ""}
              >
                <I size={18} />
                {String(title)}
              </button>
            );
          })}
          <div className="sidebar-tip">
            <Lightbulb size={20} />
            <strong>Start small. Stay curious.</strong>
            <p>You don’t need to know everything to enjoy your first hand.</p>
          </div>
        </aside>
        <article className="panel lesson">
          {tab === "rules" ? (
            <>
              <span className="lesson-kicker">
                THE FIRST CHAPTER · 3 MIN READ
              </span>
              <h2>Two cards. Endless possibilities.</h2>
              <p>
                In Texas Hold’em, combine your two private cards with five
                shared community cards to make the best possible five-card hand.
                Win at showdown, or be the last player who hasn’t folded.
              </p>
              <div className="lesson-diagram">
                <span className="diagram-label">
                  COMMUNITY CARDS <span>Shared by everyone</span>
                </span>
                <div className="mini-felt">
                  <CardRow
                    cards={[
                      ["A", "♠"],
                      ["K", "♥"],
                      ["7", "♣"],
                      ["Q", "♦"],
                      ["5", "♠"],
                    ]}
                  />
                  <div className="private-cards">
                    <CardRow
                      cards={[
                        ["J", "♠"],
                        ["10", "♥"],
                      ]}
                    />
                  </div>
                </div>
                <span className="diagram-label">
                  YOUR HOLE CARDS <span>Just for you</span>
                </span>
              </div>
              <h3>The three things to remember</h3>
              <div className="key-points">
                {[
                  [
                    "Two cards are yours.",
                    "Only you can see your private cards.",
                  ],
                  [
                    "Five cards belong to everyone.",
                    "Community cards appear in stages: flop, turn, and river.",
                  ],
                  [
                    "Your best five cards count.",
                    "Use both, one, or neither of your private cards.",
                  ],
                ].map(([a, b], i) => (
                  <div key={a}>
                    <span>{i + 1}</span>
                    <p>
                      <strong>{a}</strong>
                      <small>{b}</small>
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : tab === "rankings" ? (
            <>
              <span className="lesson-kicker">
                KNOW A GOOD HAND WHEN YOU SEE ONE
              </span>
              <h2>From high card to royal flush.</h2>
              <p>
                Hands are ranked from strongest to weakest. If two players have
                the same type of hand, compare the card ranks, then the
                remaining cards (kickers). Identical best five-card hands split
                the pot.
              </p>
              <div className="full-rankings">
                {rankings.map((r, i) => (
                  <div className="ranking" key={r.name}>
                    <span className="rank-number">{i + 1}</span>
                    <div>
                      <strong>{r.name}</strong>
                      <CardRow cards={r.cards} small />
                    </div>
                    <p>{r.note}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <span className="lesson-kicker">YOUR OPTIONS AT THE TABLE</span>
              <h2>A little betting confidence.</h2>
              <p>
                Each decision is a chance to stay in the hand, put chips in the
                pot, or wait for a better spot.
              </p>
              <div className="betting-options">
                {[
                  [
                    "Fold",
                    "Let go of your cards and sit out the rest of this hand.",
                  ],
                  [
                    "Check",
                    "Pass the action without adding chips. Available when there’s no bet to match.",
                  ],
                  ["Call", "Match the current bet to stay in the hand."],
                  [
                    "Bet / Raise",
                    "Put chips in when nobody has bet, or increase the current bet.",
                  ],
                ].map(([a, b]) => (
                  <div key={a}>
                    <span className="icon-box">
                      <Check size={18} />
                    </span>
                    <div>
                      <h3>{a}</h3>
                      <p>{b}</p>
                    </div>
                  </div>
                ))}
              </div>
              <h3>A hand, step by step</h3>
              <div className="street-tabs">
                {steps.map((s, i) => (
                  <button
                    key={s.name}
                    className={step === i ? "selected" : ""}
                    onClick={() => setStep(i)}
                  >
                    {i + 1}. {s.name}
                  </button>
                ))}
              </div>
              <div className="street-explanation">
                <strong>{steps[step].name}</strong>
                <p>{steps[step].text}</p>
              </div>
              <div className="info-note">
                <Lightbulb size={18} /> Blinds are forced bets that start the
                pot. The dealer position moves each hand.
              </div>
            </>
          )}
        </article>
        <aside className="panel ranking-sidebar">
          <div className="section-heading">
            <h3>Hand rankings</h3>
            <Trophy size={17} />
          </div>
          <p className="muted small-text">Strongest to weakest</p>
          {rankings.map((r, i) => (
            <button
              className="ranking"
              key={r.name}
              onClick={() => setTab("rankings")}
            >
              <span className="rank-number">{i + 1}</span>
              <div>
                <strong>{r.name}</strong>
                <CardRow cards={r.cards} small />
              </div>
            </button>
          ))}
        </aside>
      </div>
      <div className="practice-banner">
        <span className="icon-box">
          <BookOpen size={23} />
        </span>
        <div>
          <h3>Ready to put it into practice?</h3>
          <p>Explore the demo table. Take your time.</p>
        </div>
        <Button asChild>
          <Link href="/table">
            Try the demo table <ArrowRight size={17} />
          </Link>
        </Button>
      </div>
    </main>
  );
}
