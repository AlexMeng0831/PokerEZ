"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Plus,
  ArrowRight,
  Link2,
  BookOpen,
  ShieldCheck,
  Users,
  ChevronRight,
  Check,
  Play as PlayIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { usePokerStore } from "@/lib/store";
import { CardRow } from "@/components/poker/playing-card";
export default function Play() {
  const router = useRouter();
  const leave = usePokerStore((s) => s.leave);
  const setRoom = usePokerStore((s) => s.setRoom);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [roomName, setRoomName] = useState("Friday night poker");
  const [blinds, setBlinds] = useState("1 / 2");
  const [seats, setSeats] = useState("6");
  function create() {
    setRoom({
      code: Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "X"),
      name: roomName.trim() || "My poker room",
      blinds,
      seats: Number(seats),
    });
    router.push("/table");
  }
  function join(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      setError("Enter a 6-character room code, like AB12CD.");
      return;
    }
    setRoom({ code, name: "Your poker room", blinds: "1 / 2", seats: 6 });
    router.push("/table");
  }
  return (
    <main className="page play-page">
      <section className="hero">
        <div>
          <div className="eyebrow">
            <span className="blue-dot" /> GOOD COMPANY. GREAT HANDS.
          </div>
          <h1>
            Make poker <span>EZ.</span>
          </h1>
          <p>
            Your seat at the table starts here. <br />
            Play with friends, learn the ropes, and enjoy the game.
          </p>
          <div className="hero-quick-play">
            <Button asChild><Link href="/table" onClick={leave}><PlayIcon size={15} fill="currentColor" /> Try a hand <ArrowRight size={16} /></Link></Button>
            <span>Instant local demo · no setup</span>
          </div>
          <div className="hero-meta">
            <span>
              <ShieldCheck size={15} /> No stakes. No pressure.
            </span>
            <span>
              <Users size={15} /> Built for beginners
            </span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-ring" />
          <div className="hero-card one">
            <CardRow cards={[["A", "♠"]]} />
          </div>
          <div className="hero-card two">
            <CardRow cards={[["K", "♥"]]} />
          </div>
          <span className="art-chip">EZ</span>
          <span className="art-spark">✦</span>
          <div className="art-caption">
            A good hand starts with a little confidence.
          </div>
        </div>
      </section>
      <section className="room-grid" aria-label="Play options">
        <div className="panel room-card">
          <div className="room-card-top">
            <span className="icon-box">
              <Plus size={24} />
            </span>
            <span className="tag">YOUR TABLE, YOUR RULES</span>
          </div>
          <h2>Create a room</h2>
          <p>
            Bring your friends to the table. <br />
            We’ll take care of the seats.
          </p>
          <Button onClick={() => setOpen(true)}>
            Create Room <ArrowRight size={17} />
          </Button>
          <span className="card-footnote">
            Set up in seconds. No account needed.
          </span>
        </div>
        <div className="panel room-card join-card">
          <div className="room-card-top">
            <span className="icon-box">
              <Link2 size={23} />
            </span>
            <span className="tag">SAVE YOUR SEAT</span>
          </div>
          <h2>Join your friends</h2>
          <p>
            Already have a room code? <br />
            There’s a seat waiting for you.
          </p>
          <form onSubmit={join}>
            <label className="sr-only" htmlFor="room-code">
              Room code
            </label>
            <div className="join-input">
              <input
                id="room-code"
                maxLength={6}
                placeholder="Enter room code"
                value={code}
                onChange={(e) => {
                  setCode(
                    e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                  );
                  setError("");
                }}
                aria-invalid={!!error}
                aria-describedby="join-note"
              />
              <Button variant="secondary" type="submit">
                Join Room <ArrowRight size={16} />
              </Button>
            </div>
            <span
              id="join-note"
              className={error ? "form-error" : "card-footnote"}
            >
              {error || "Frontend demo · any 6-letter or number code works."}
            </span>
          </form>
        </div>
      </section>
      <Link href="/learn" className="learn-banner">
        <div className="icon-box subtle">
          <BookOpen size={23} />
        </div>
        <div>
          <h3>New to the table? You’re in the right place.</h3>
          <p>Learn the rules, know your hands, and play with confidence.</p>
        </div>
        <span className="text-link">
          Explore the basics <ArrowRight size={17} />
        </span>
      </Link>
      <section className="recent-section">
        <div className="section-heading">
          <div>
            <h2>
              Recent sessions <span className="demo-badge">DEMO DATA</span>
            </h2>
            <p>A little look at what your poker journey could look like.</p>
          </div>
          <Link href="/profile" className="text-link">
            View profile <ArrowRight size={16} />
          </Link>
        </div>
        <div className="panel table-scroll">
          <table>
            <thead>
              <tr>
                <th>Session</th>
                <th>Players</th>
                <th>Blinds</th>
                <th>Result</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {[
                [
                  "Friday night with friends",
                  "Oct 12, 2026",
                  "4 players",
                  "1 / 2",
                  "+24",
                ],
                [
                  "A little evening practice",
                  "Oct 10, 2026",
                  "3 players",
                  "1 / 2",
                  "−8",
                ],
                [
                  "First time at the table",
                  "Oct 08, 2026",
                  "2 players",
                  "0.5 / 1",
                  "+12",
                ],
              ].map(([title, date, players, blinds, result]) => (
                <tr key={title}>
                  <td>
                    <strong>{title}</strong>
                    <small>{date}</small>
                  </td>
                  <td>
                    <Users size={14} className="inline-icon" />
                    {players}
                  </td>
                  <td>
                    {blinds}
                    <span className="muted"> chips</span>
                  </td>
                  <td
                    className={result.startsWith("+") ? "positive" : "negative"}
                  >
                    {result} <span className="muted">BB</span>
                  </td>
                  <td>
                    <Link
                      aria-label={`View demo session: ${title}`}
                      href="/profile"
                    >
                      <ChevronRight size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Your table, your way."
        description="Choose a few details to open your frontend demo room."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
          className="modal-form"
        >
          <label>
            Room name
            <input
              value={roomName}
              maxLength={35}
              onChange={(e) => setRoomName(e.target.value)}
              required
            />
          </label>
          <div className="form-grid">
            <label>
              Blinds (play chips)
              <select
                value={blinds}
                onChange={(e) => setBlinds(e.target.value)}
              >
                <option>0.5 / 1</option>
                <option>1 / 2</option>
                <option>2 / 4</option>
              </select>
            </label>
            <label>
              Seats
              <select value={seats} onChange={(e) => setSeats(e.target.value)}>
                <option>2</option>
                <option>4</option>
                <option>6</option>
              </select>
            </label>
          </div>
          <div className="info-note">
            <Check size={16} /> No real money. Just a friendly practice space.
          </div>
          <Button type="submit">
            Open my table <ArrowRight size={17} />
          </Button>
        </form>
      </Modal>
    </main>
  );
}
