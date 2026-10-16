"use client";
import { AnimatePresence, motion } from "motion/react";
import { Check, Crown } from "lucide-react";
import { PlayingCard } from "@/components/poker/playing-card";
import {
  cardKey,
  type GameState,
  type Player,
  type SeatId,
} from "@/lib/animation/mock-game";
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
}: {
  player: Player;
  winner: boolean;
  flights: Flight[];
  reduced: boolean;
  awarded: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const visible = player.revealed || player.folded;
  return (
    <div
      className={`preview-seat seat-${player.id} ${player.folded ? "seat-folded" : ""}`}
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
        className={`preview-seat-label ${winner ? "is-winner" : ""} ${player.folded ? "is-folded" : ""} ${selected ? "is-inspected" : ""}`}
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
            {player.name}
            {player.id === "you" && <small> · your seat</small>}
          </strong>
          <DomAnchor id={`stack-${player.id}`}>
            <AnimatedAmount value={player.stack} reduced={reduced} />
            <small> chips</small>
          </DomAnchor>
          {visible && player.hand && (
            <span
              className="player-best-hand"
              aria-label={`Best hand: ${player.hand.label}, ${player.hand.detail}`}
            >
              {player.hand.label} · {player.hand.detail}
            </span>
          )}
        </div>
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
export function AnimationTable({
  state,
  flights,
  reduced,
  speed,
  phase,
  selectedSeat,
  onSelectSeat,
}: {
  state: GameState;
  flights: Flight[];
  reduced: boolean;
  speed: number;
  phase: string;
  selectedSeat: SeatId;
  onSelectSeat: (id: SeatId) => void;
}) {
  const inspected = state.players.find((p) => p.id === selectedSeat)!;
  const highlight =
    inspected.revealed || inspected.folded
      ? (inspected.hand?.madeCards ?? [])
      : [];
  return (
    <DomAnchorProvider className="preview-stage panel">
      <div className="preview-stage-top">
        <span>
          <i className="blue-dot" /> No Limit Hold’em
        </span>
        <span>3 seats · Play chips</span>
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
          <PotDisplay amount={state.pot} pots={state.pots} reduced={reduced} />
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
          {phase} <span>·</span> MOCK HAND #001
        </span>
      </div>
      {state.players.map((player) => (
        <AnimatedSeat
          key={player.id}
          player={player}
          winner={state.winner === player.id}
          awarded={state.awarded}
          flights={flights}
          reduced={reduced}
          selected={selectedSeat === player.id}
          onSelect={() => onSelectSeat(player.id)}
        />
      ))}
      {state.players.map((player) => (
        <DomAnchor
          key={player.id}
          id={`bet-${player.id}`}
          className={`preview-bet bet-${player.id}`}
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
