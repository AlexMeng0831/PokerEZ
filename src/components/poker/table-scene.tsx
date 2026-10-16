import { PlayingCard, CardRow } from "@/components/poker/playing-card";
export function ChipStack({ value }: { value: number }) {
  return (
    <div className="chip-stack">
      <span className="poker-chip" />
      <span className="poker-chip" />
      <b>{value}</b>
    </div>
  );
}
export function PlayerSeat({
  name,
  initial,
  stack,
  hero = false,
  folded = false,
}: {
  name: string;
  initial: string;
  stack: number;
  hero?: boolean;
  folded?: boolean;
}) {
  return (
    <div
      className={`player-seat ${hero ? "hero-seat" : "opponent-seat"} ${folded ? "folded" : ""}`}
    >
      <div className="seat-cards">
        {hero ? (
          <CardRow
            cards={[
              ["Q", "♠"],
              ["J", "♥"],
            ]}
          />
        ) : (
          <div className="card-row">
            <PlayingCard hidden />
            <PlayingCard hidden />
          </div>
        )}
      </div>
      <div className="player-label">
        <span className="avatar">{initial}</span>
        <div>
          <strong>{name}</strong>
          <span>
            {stack} <small>chips</small>
          </span>
        </div>
        {hero && <span className="dealer-button">D</span>}
      </div>
      {hero && (
        <span className="turn-label">
          <i />
          {folded ? "You folded" : "Your seat"}
        </span>
      )}
    </div>
  );
}
export function CommunityCards({ street }: { street: number }) {
  return (
    <div className="community-cards">
      <PlayingCard rank="A" />
      <PlayingCard rank="K" suit="♥" />
      <PlayingCard rank="7" suit="♣" />
      <PlayingCard rank="4" suit="♦" empty={street < 1} />
      <PlayingCard rank="2" suit="♣" empty={street < 2} />
    </div>
  );
}
