import { cn } from "@/lib/utils";
export function PlayingCard({
  rank = "A",
  suit = "♠",
  small = false,
  hidden = false,
  empty = false,
}: {
  rank?: string;
  suit?: string;
  small?: boolean;
  hidden?: boolean;
  empty?: boolean;
}) {
  return (
    <div
      className={cn(
        "playing-card",
        small && "card-small",
        (suit === "♥" || suit === "♦") && "card-red",
        hidden && "card-back",
        empty && "card-empty",
      )}
      aria-label={
        hidden
          ? "Face-down card"
          : empty
            ? "Undealt community card"
            : `${rank} ${suit}`
      }
    >
      {!hidden && !empty && (
        <>
          <span>
            {rank}
            <b>{suit}</b>
          </span>
          <i>{suit}</i>
        </>
      )}
      {hidden && <span>♠</span>}
    </div>
  );
}
export function CardRow({
  cards,
  small = false,
}: {
  cards: string[][];
  small?: boolean;
}) {
  return (
    <div className="card-row">
      {cards.map(([rank, suit], i) => (
        <PlayingCard key={i} rank={rank} suit={suit} small={small} />
      ))}
    </div>
  );
}
