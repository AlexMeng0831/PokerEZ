"use client";
import type { CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Crown } from "lucide-react";
import { PlayingCard } from "@/components/poker/playing-card";
import {
  visualKey as cardKey,
  type TablePresentation,
  type VisualPlayer,
  type SeatPosition,
} from "@/lib/multiplayer/presentation";
import { DomAnchor, DomAnchorProvider } from "./dom-anchors";
import {
  AnimatedAmount,
  BetChips,
  DealFlightLayer,
  FlipCard,
  PotDisplay,
  type Flight,
} from "./primitives";
function AnimatedSeat({
  player,
  winner,
  flights,
  reduced,
  awarded,
  selected,
  onSelect,
  active = false,
  hero = false,
  position,
}: {
  player: VisualPlayer;
  winner: boolean;
  flights: Flight[];
  reduced: boolean;
  awarded: number;
  selected: boolean;
  onSelect: () => void;
  active?: boolean;
  hero?: boolean;
  position?: SeatPosition;
}) {
  const visible = player.revealed;
  return (
    <div
      style={
        position
          ? {
              left: `${position.left}%`,
              top: position.top === undefined ? undefined : `${position.top}%`,
              bottom:
                position.bottom === undefined
                  ? undefined
                  : `${position.bottom}%`,
            }
          : undefined
      }
      className={`preview-seat ${hero ? "hero-seat-live" : ""} seat-${player.id} ${player.folded ? "seat-folded" : ""}`}
    >
      <div className="preview-hole-cards">
        {[0, 1].map((i) => (
          <DomAnchor
            id={`seat-${player.id}-${i}`}
            className="preview-card-slot"
            key={i}
          >
            <AnimatePresence>
              {player.cards[i] && (
                <motion.div
                  key={`${player.id}-${i}`}
                  className="seat-card-content"
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: flights.some(
                      (f) => f.to === `seat-${player.id}-${i}`,
                    )
                      ? 0
                      : player.folded
                        ? 0.48
                        : 1,
                  }}
                  transition={{ duration: reduced ? 0 : 0.08 }}
                >
                  <FlipCard
                    card={player.cards[i]}
                    revealed={visible}
                    reduced={reduced}
                    highlighted={
                      selected &&
                      visible &&
                      !!player.hand?.madeCards.includes(
                        cardKey(player.cards[i]),
                      )
                    }
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </DomAnchor>
        ))}
      </div>
      <motion.button
        type="button"
        onClick={onSelect}
        disabled={!visible}
        aria-label={`Inspect ${player.name}'s best hand`}
        aria-pressed={selected}
        className={`preview-seat-label ${winner ? "is-winner" : ""} ${player.folded ? "is-folded" : ""} ${selected ? "is-inspected" : ""} ${active ? "is-turn" : ""}`}
        initial={false}
        animate={{
          boxShadow: winner
            ? "0 0 0 2px rgba(55,180,140,.45), 0 4px 24px rgba(55,180,140,.18)"
            : "0 0 0 0px rgba(55,180,140,0), 0 4px 20px rgba(55,180,140,0)",
        }}
        whileTap={reduced ? undefined : { scale: 0.97 }}
        transition={{ duration: reduced ? 0.1 : 0.35 }}
      >
        <span className="avatar">
          {winner ? <Crown size={15} /> : player.name.slice(0, 2).toUpperCase()}
        </span>
        <div>
          <strong>
            {player.connected !== undefined && (
              <span
                className={`seat-presence ${player.connected ? "online" : "offline"}`}
                aria-label={
                  player.connected ? "Online" : "Offline · seat reserved"
                }
                title={player.connected ? "Online" : "Offline · seat reserved"}
              />
            )}
            {player.name}
            {hero && <small> · your seat</small>}
          </strong>
          <DomAnchor id={`stack-${player.id}`}>
            <AnimatedAmount value={player.stack} reduced={reduced} />
            <small> chips</small>
          </DomAnchor>
          {player.bet > 0 && (
            <span className="seat-bet-compact">Bet {player.bet}</span>
          )}
          {visible && player.hand && (
            <span
              className="player-best-hand"
              aria-label={`Best hand: ${player.hand.label}, ${player.hand.detail}`}
            >
              {player.hand.label} · {player.hand.detail}
            </span>
          )}
        </div>
        {player.role && <span className="seat-role">{player.role}</span>}
        {active && (
          <span className="turn-tag">{hero ? "YOUR TURN" : "TO ACT"}</span>
        )}
        {player.folded && <span className="folded-tag">FOLDED</span>}
      </motion.button>
      <div className={`seat-action ${winner ? "winner-action" : ""}`}>
        <AnimatePresence mode="wait">
          <motion.span
            key={`${player.action}-${player.hand?.label}`}
            initial={{ opacity: 0, y: reduced ? 0 : 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.13 }}
          >
            {winner && <Check size={11} />}{" "}
            {awarded && winner ? `Won +${awarded}` : player.action}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
export function AnimationTable<Id extends string>({
  state,
  flights,
  reduced,
  speed,
  phase,
  selectedSeat,
  onSelectSeat,
  activeSeat,
}: {
  state: TablePresentation;
  flights: Flight[];
  reduced: boolean;
  speed: number;
  phase: string;
  selectedSeat: Id;
  onSelectSeat: (id: Id) => void;
  activeSeat?: string;
}) {
  const inspected = state.players.find((p) => p.id === selectedSeat);
  const highlight = inspected?.revealed
    ? (inspected.hand?.madeCards ?? [])
    : [];
  return (
    <DomAnchorProvider
      className={`preview-stage panel table-count-${state.players.length} phase-${phase}`}
    >
      <div className="preview-stage-top">
        <span>
          <i className="blue-dot" /> No Limit Hold’em
        </span>
        <span>{state.players.length} seats · Play chips</span>
      </div>
      <div className="preview-felt">
        <div className="preview-felt-line" />
        <span className="preview-watermark">♠ POKEREZ</span>
      </div>
      <DomAnchor id="deck" className="preview-deck">
        <PlayingCard hidden />
        <small>DECK</small>
      </DomAnchor>
      <div className="preview-center">
        <DomAnchor id="pot" className="preview-pot-anchor">
          <PotDisplay
            amount={state.pot}
            pending={state.players.reduce((n, p) => n + p.bet, 0)}
            pots={state.pots}
            reduced={reduced}
            names={Object.fromEntries(state.players.map((p) => [p.id, p.name]))}
          />
        </DomAnchor>
        <div className="preview-board">
          {[0, 1, 2, 3, 4].map((i) => (
            <DomAnchor
              id={`board-${i}`}
              className="preview-card-slot board-slot"
              key={i}
            >
              {state.board[i] ? (
                <div
                  style={{
                    opacity: flights.some((f) => f.to === `board-${i}`) ? 0 : 1,
                  }}
                >
                  <FlipCard
                    card={state.board[i].card}
                    revealed={state.board[i].revealed}
                    reduced={reduced}
                    highlighted={
                      state.board[i].revealed &&
                      highlight.includes(cardKey(state.board[i].card))
                    }
                  />
                </div>
              ) : (
                <div
                  className="board-placeholder"
                  aria-label="Undealt community card"
                />
              )}
            </DomAnchor>
          ))}
        </div>
        <span className="preview-phase">
          {phase} <span>·</span> {state.handLabel ?? "MOCK HAND #001"}
        </span>
      </div>
      {state.players.map((player) => (
        <AnimatedSeat
          key={player.id}
          player={player}
          hero={player.id === (state.heroId ?? "you")}
          position={state.positions?.[player.id]}
          active={activeSeat === player.id}
          winner={(state.winners ?? [state.winner]).includes(player.id)}
          awarded={state.awards?.[player.id] ?? state.awarded}
          flights={flights}
          reduced={reduced}
          selected={selectedSeat === player.id}
          onSelect={() => onSelectSeat(player.id as Id)}
        />
      ))}
      {state.players.map((player) => (
        <DomAnchor
          key={player.id}
          id={`bet-${player.id}`}
          className={`preview-bet bet-${player.id}`}
          style={
            state.positions
              ? ({
                  left: `${state.positions[player.id].left}%`,
                  ...(player.id === state.heroId
                    ? { bottom: "27%" }
                    : {
                        top: `${(state.positions[player.id].top ?? 50) + (state.positions[player.id].top! >= 50 ? -7 : 24)}%`,
                      }),
                } as CSSProperties)
              : undefined
          }
        >
          <AnimatePresence>
            {player.bet > 0 && (
              <BetChips amount={player.bet} reduced={reduced} />
            )}
          </AnimatePresence>
        </DomAnchor>
      ))}
      <DealFlightLayer flights={flights} reduced={reduced} speed={speed} />
    </DomAnchorProvider>
  );
}
