"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { rankings } from "@/lib/demo";

export function TableHelp() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        aria-label="Poker help"
        onClick={(event) => {
          trigger.current = event.currentTarget;
          setOpen(true);
        }}
      >
        ?
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          trigger.current?.focus();
        }}
        title="Poker, at a glance"
        description="A quick reference. Your turn timer keeps running while you read."
      >
        <div className="poker-help">
          <section>
            <h3>
              Hand rankings <small>Strongest first</small>
            </h3>
            <ol>
              {rankings.map((r) => (
                <li key={r.name}>
                  <strong>{r.name}</strong>
                  <span>{r.note}</span>
                </li>
              ))}
            </ol>
          </section>
          <section>
            <h3>Betting</h3>
            <p>
              <strong>Check</strong> costs nothing when no chips are owed.{" "}
              <strong>Call</strong> matches the outstanding bet, up to your
              remaining stack. <strong>Fold</strong> gives up this hand.
            </p>
            <p>
              <strong>Raise to</strong> is your total bet on this street,
              including chips already in front of you. MIN selects the smallest
              legal total; ALL IN uses your remaining stack. The amount and
              available actions update on every turn.
            </p>
            <p>
              A short all-in may be below a full minimum raise and may not
              reopen raising for everyone. The controls show what is legal for
              your seat.
            </p>
          </section>
          <section>
            <h3>Kickers & ties</h3>
            <p>
              Make the best five cards from your two cards and the board. With
              equal pairs, compare the highest remaining card, then the next.
              For example, Q-Q-A-9-7 beats Q-Q-K-9-7. Suits never break a tie.
            </p>
            <p>
              If both players have the same best five cards, they split the pot.
              The board can play for everyone. An ace can be low in A-2-3-4-5.
            </p>
          </section>
          <section>
            <h3>Side pots & reconnects</h3>
            <p>
              An all-in player can only win the chips they matched. Extra bets
              go into side pots, each with its own eligible players and winners.
              The result lists each payout.
            </p>
            <p>
              Refresh or return to the lobby without losing your seat. Leave
              room releases it between hands. If a turn expires, you check when
              possible; otherwise you fold.
            </p>
          </section>
        </div>
      </Modal>
    </>
  );
}
