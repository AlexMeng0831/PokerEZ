"use client";
import Link from "next/link";
import { useState } from "react";
import { MotionConfig, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  Play,
  StepForward,
  RotateCcw,
  Check,
  ChevronRight,
  Sparkles,
  Activity,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedButton } from "@/components/ui/animated-button";
import { TableFocusFrame } from "@/components/poker/animation/table-focus-frame";
import type { SeatId } from "@/lib/animation/mock-game";
import { AnimationTable } from "@/components/poker/animation/animation-table";
import { useMockPlayback } from "@/components/poker/animation/use-mock-playback";
import { MOCK_CHAPTERS } from "@/lib/animation/mock-game";
import "./preview.css";
export default function Preview() {
  const systemReduced = useReducedMotion();
  const [manualReduced, setManualReduced] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [focused, setFocused] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState<SeatId>("you");
  const reduced = !!systemReduced || manualReduced;
  const playback = useMockPlayback({ reduced, speed });
  const { state, completed, active, running } = playback;
  const done = completed === MOCK_CHAPTERS.length;
  function startPlayback(all: boolean) {
    setFocused(true);
    void playback.play(all);
  }
  function resetPlayback() {
    setSelectedSeat("you");
    playback.reset();
  }
  const chapter = active === null ? null : MOCK_CHAPTERS[active];
  const phase = state.awarded
    ? "Hand complete"
    : state.winner
      ? "Showdown"
      : state.board.length === 5
        ? "River"
        : state.board.length === 4
          ? "Turn"
          : state.board.length === 3
            ? "Flop"
            : "Pre-flop";
  return (
    <MotionConfig reducedMotion={reduced ? "always" : "user"}>
      <main className="page animation-preview" data-reduced-motion={reduced}>
        <div className="preview-page-top">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft size={14} /> Back to play
            </Link>
          </Button>
          <div className="preview-top-actions">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFocused(true)}
            >
              <Maximize2 size={14} /> Focus table
            </Button>
            <span className="demo-badge">MOTION LAB · MOCK EVENTS</span>
          </div>
        </div>
        <div className="preview-heading">
          <div>
            <div className="eyebrow">
              <Sparkles size={12} /> SMALL MOVEMENTS. A BETTER FEEL.
            </div>
            <h1>A little life at the table.</h1>
            <p>
              Deal, bet, reveal. Explore the rhythm of a hand, one moment at a
              time.
            </p>
          </div>
          <span className="preview-status">
            <i />
            {running
              ? "Playing sequence"
              : done
                ? "Hand complete"
                : "Ready when you are"}
          </span>
        </div>
        <div className="preview-workspace">
          <TableFocusFrame active={focused} onExit={() => setFocused(false)}>
            <AnimationTable
              state={state}
              flights={playback.flights}
              reduced={reduced}
              speed={speed}
              phase={phase}
              selectedSeat={selectedSeat}
              onSelectSeat={setSelectedSeat}
            />
            <section
              className="preview-controls panel"
              aria-label="Animation playback controls"
            >
              <div className="playback-description" aria-live="polite">
                <span className="icon-box">
                  <Activity size={19} />
                </span>
                <div>
                  <strong>
                    {chapter ? chapter.label : "Your table is ready."}
                  </strong>
                  <p>
                    {chapter
                      ? chapter.description
                      : "Start the full hand, or take it one step at a time."}
                  </p>
                </div>
              </div>
              <div className="playback-buttons">
                <AnimatedButton
                  reduceMotion={reduced}
                  onClick={() => startPlayback(true)}
                  disabled={running || done}
                >
                  <Play size={15} fill="currentColor" />
                  {completed > 0 && !done
                    ? "Continue sequence"
                    : "Play full hand"}
                </AnimatedButton>
                <AnimatedButton
                  variant="outline"
                  reduceMotion={reduced}
                  onClick={() => startPlayback(false)}
                  disabled={running || done}
                >
                  <StepForward size={16} /> Next step
                </AnimatedButton>
                <AnimatedButton
                  variant="ghost"
                  reduceMotion={reduced}
                  onClick={resetPlayback}
                  aria-label="Reset animation preview"
                >
                  <RotateCcw size={16} />
                  <span>Reset</span>
                </AnimatedButton>
              </div>
              <div className="preview-preferences">
                <label>
                  Playback speed
                  <select
                    aria-label="Playback speed"
                    value={speed}
                    disabled={running}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                  >
                    <option value={0.75}>0.75×</option>
                    <option value={1}>1×</option>
                    <option value={1.5}>1.5×</option>
                  </select>
                </label>
                <label className="reduced-toggle">
                  <input
                    type="checkbox"
                    checked={reduced}
                    disabled={!!systemReduced || running}
                    onChange={(e) => setManualReduced(e.target.checked)}
                  />
                  <span>Reduced motion</span>
                  {systemReduced && <small>System setting</small>}
                </label>
                <span className="preview-chips-note">
                  480 play chips · no engine running
                </span>
              </div>
              {playback.error && (
                <p role="alert" className="form-error">
                  {playback.error}
                </p>
              )}
            </section>
          </TableFocusFrame>
          <aside className="preview-inspector">
            <section className="panel sequence-panel">
              <div className="section-heading">
                <h3>The hand, in motion</h3>
                <span>{String(completed).padStart(2, "0")} / 10</span>
              </div>
              <div
                className="sequence-progress"
                role="progressbar"
                aria-label="Completed animation chapters"
                aria-valuemin={0}
                aria-valuemax={10}
                aria-valuenow={completed}
              >
                <motion.div
                  animate={{ width: `${completed * 10}%` }}
                  transition={{ duration: reduced ? 0 : 0.3 }}
                />
              </div>
              <ol className="chapter-list">
                {MOCK_CHAPTERS.map((s, i) => (
                  <li
                    key={s.label}
                    className={`${i < completed ? "complete" : ""} ${active === i ? "current" : ""}`}
                    aria-current={active === i ? "step" : undefined}
                  >
                    <span>
                      {i < completed ? (
                        <Check size={12} />
                      ) : (
                        String(i + 1).padStart(2, "0")
                      )}
                    </span>
                    <span>{s.label}</span>
                    {active === i && <ChevronRight size={13} />}
                  </li>
                ))}
              </ol>
              <div className="sequence-hint">
                Next step plays one chapter.
                <br />
                Reset interrupts safely and clears the table.
              </div>
            </section>
            <section className="panel event-panel">
              <div className="section-heading">
                <h3>
                  <Activity size={14} /> Event feed
                </h3>
                <span className="demo-badge">MOCK</span>
              </div>
              <div className="event-log" aria-label="Mock game event history">
                {playback.logs.length ? (
                  playback.logs.map((l, i) => (
                    <motion.p
                      key={l.id}
                      initial={{ opacity: 0, y: reduced ? 0 : 3 }}
                      animate={{ opacity: i === 0 ? 1 : 0.6, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <span />
                      {l.text}
                    </motion.p>
                  ))
                ) : (
                  <p className="event-empty">Waiting for the first deal.</p>
                )}
              </div>
            </section>
          </aside>
        </div>
        <div className="preview-bottom-note">
          <span className="blue-dot" />
          <p>
            A scripted animation fixture, not a poker simulation. Side pots and
            the winner are supplied by mock events.{" "}
            <span>Mobile friendly · DOM anchors · Reduced Motion</span>
          </p>
        </div>
      </main>
    </MotionConfig>
  );
}
