"use client";
import { AnimatePresence, motion } from "motion/react";
import { Check, Crown } from "lucide-react";
import { seatPositions } from "@/lib/multiplayer/seat-layout";
import "./table-surface.css";
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
      className={`poker-seat slot-${position} ${hero ? "is-hero" : ""} ${player.folded ? "is-folded" : ""} ${active ? "is-active" : ""}`}
      data-player-id={player.id}
    >
      <div className="poker-hole-cards">
        {[0, 1].map((i) => (
          <DomAnchor
            id={`seat-${player.id}-${i}`}
            className="poker-card-slot"
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
        className={`poker-seat-label ${winner ? "is-winner" : ""} ${player.folded ? "is-folded" : ""} ${selected ? "is-inspected" : ""} ${active ? "is-turn" : ""}`}
        initial={false}
        animate={{
          boxShadow: winner
            ? "0 0 0 2px rgba(55,180,140,.45), 0 4px 24px rgba(55,180,140,.18)"
            : "0 0 0 0px rgba(55,180,140,0), 0 4px 20px rgba(55,180,140,0)",
        }}
        whileTap={reduced ? undefined : { scale: 0.97 }}
        transition={{ duration: reduced ? 0.1 : 0.35 }}
      >
        <span className="seat-avatar">
          {winner ? <Crown size={15} /> : player.name.slice(0, 2).toUpperCase()}
        </span>
        <div>
          <strong title={player.name}>
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
            {player.role && <span className="seat-role">{player.role}</span>}
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
      </motion.button>
      <div className={`poker-seat-footer ${player.bet > 0 ? "has-bet" : ""}`}>
        {active && (
          <span className="turn-tag" aria-label={hero ? "Your turn" : "To act"}>
            <span className="turn-label">{hero ? "YOUR TURN" : "TO ACT"}</span>
            <span className="turn-short" aria-hidden="true">
              TURN
            </span>
          </span>
        )}
        {player.folded && <span className="folded-tag">FOLDED</span>}

        <DomAnchor
          id={`bet-${player.id}`}
          className="poker-bet"
          aria-label={`${player.name} bet: ${player.bet} chips`}
        >
          <AnimatePresence>
            {player.bet > 0 && (
              <BetChips amount={player.bet} reduced={reduced} />
            )}
          </AnimatePresence>
        </DomAnchor>
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
  const positions =
    state.positions ??
    seatPositions(
      state.players.map((p, seat) => ({ id: p.id, seat })),
      state.heroId ?? "you",
    );
  return (
    <DomAnchorProvider
      className={`poker-surface panel table-count-${state.players.length} phase-${phase.toLowerCase().replaceAll(" ", "-")}`}
    >
      <div className="poker-table-heading">
        <span>
          <i className="blue-dot" /> No Limit Hold’em
        </span>
        <DomAnchor id="deck" className="poker-deck">
          <PlayingCard hidden />
          <small>DECK</small>
        </DomAnchor>
        <span>{state.players.length} seats · Play chips</span>
      </div>
      <div className="poker-felt">
        <div className="poker-felt-line" />
        <span className="poker-watermark">♠ POKEREZ</span>
      </div>
      <div className="poker-community">
        <DomAnchor id="pot" className="poker-pot-anchor">
          <PotDisplay
            amount={state.pot}
            pending={state.players.reduce((n, p) => n + p.bet, 0)}
            pots={state.pots}
            reduced={reduced}
            names={Object.fromEntries(state.players.map((p) => [p.id, p.name]))}
          />
        </DomAnchor>
        <div className="poker-board">
          {[0, 1, 2, 3, 4].map((i) => (
            <DomAnchor
              id={`board-${i}`}
              className="poker-card-slot board-slot"
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
        <span className="poker-phase">
          {phase} <span>·</span> {state.handLabel ?? "MOCK HAND #001"}
        </span>
      </div>
      {state.players.map((player) => (
        <AnimatedSeat
          key={player.id}
          player={player}
          hero={player.id === (state.heroId ?? "you")}
          position={positions[player.id]}
          active={activeSeat === player.id}
          winner={(state.winners ?? [state.winner]).includes(player.id)}
          awarded={state.awards?.[player.id] ?? state.awarded}
          flights={flights}
          reduced={reduced}
          selected={selectedSeat === player.id}
          onSelect={() => onSelectSeat(player.id as Id)}
        />
      ))}
      <DealFlightLayer flights={flights} reduced={reduced} speed={speed} />
    </DomAnchorProvider>
  );
}
