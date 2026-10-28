"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Plus,
  ArrowRight,
  Link2,
  ShieldCheck,
  Users,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { sendCommand, useMultiplayer } from "@/lib/multiplayer/client";
import { CardRow } from "@/components/poker/playing-card";
export default function Play() {
  const router = useRouter();
  const connection = useMultiplayer();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [roomName, setRoomName] = useState("Friday night poker");
  const [blinds, setBlinds] = useState("1 / 2");
  const [seats, setSeats] = useState("6");
  async function create() {
    setError("");
    const [smallBlind, bigBlind] = blinds.split(" / ").map(Number);
    try {
      await sendCommand({
        type: "create",
        name: roomName.trim() || "My poker room",
        capacity: Number(seats),
        smallBlind,
        bigBlind,
      });
      router.push("/table");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to create room.",
      );
    }
  }
  async function join(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      setError("Enter the 6-character code from your friend.");
      return;
    }
    try {
      await sendCommand({ type: "join", code });
      router.push("/table");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to join room.");
    }
  }
  return (
    <main className="page play-page">
      <section className="hero">
        <div>
          <div className="eyebrow">
            <span className="blue-dot" /> PLAY WITH FRIENDS
          </div>
          <h1>
            Make poker <span>EZ.</span>
          </h1>
          <p>
            Create a room, share the code, and play with friends. <br />
            2–6 players. No account needed.
          </p>
          {connection.snapshot && (
            <div className="hero-quick-play">
              <Button asChild>
                <Link href="/table">
                  Return to Table <ArrowRight size={16} />
                </Link>
              </Button>
              <span>
                Your seat in {connection.snapshot.room.name} is saved.
              </span>
            </div>
          )}
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
          <div className="art-caption">Private rooms · Play chips</div>
        </div>
      </section>
      <section className="room-grid" aria-label="Play options">
        <div className="panel room-card">
          <div className="room-card-top">
            <span className="icon-box">
              <Plus size={24} />
            </span>
            <span className="tag">PRIVATE TABLE</span>
          </div>
          <h2>Create a room</h2>
          <p>Choose blinds and seats, then share your room code.</p>
          <Button
            onClick={() => setOpen(true)}
            disabled={connection.pending || !!connection.snapshot}
          >
            Create Room <ArrowRight size={17} />
          </Button>
          <span className="card-footnote">
            {connection.snapshot
              ? "You already have a seat. Return to your table, then leave between hands to create another room."
              : "Set up in seconds. No account needed."}
          </span>
        </div>
        <div className="panel room-card join-card" id="join-room">
          <div className="room-card-top">
            <span className="icon-box">
              <Link2 size={23} />
            </span>
            <span className="tag">ROOM CODE</span>
          </div>
          <h2>Join your friends</h2>
          <p>Enter the six-character code from your friend.</p>
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
              <Button
                variant="secondary"
                type="submit"
                disabled={
                  connection.pending ||
                  connection.status !== "connected" ||
                  !!connection.snapshot
                }
              >
                {connection.pending ? "Joining…" : "Join Room"}{" "}
                <ArrowRight size={16} />
              </Button>
            </div>
            <span
              id="join-note"
              className={error ? "form-error" : "card-footnote"}
            >
              {error ||
                (connection.snapshot
                  ? "You already have a seat. Return to your table to keep playing."
                  : "") ||
                connection.error ||
                (connection.status !== "connected"
                  ? "Connecting your guest session…"
                  : "Enter your friend’s room code to take a seat.")}
            </span>
            {["error", "reconnecting"].includes(connection.status) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={connection.reconnect}
              >
                Reconnect
              </Button>
            )}
          </form>
        </div>
      </section>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Create a room"
        description="Create a multiplayer room and invite friends with its room code."
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
                <option>5 / 10</option>
                <option>1 / 2</option>
                <option>2 / 4</option>
              </select>
            </label>
            <label>
              Seats
              <select value={seats} onChange={(e) => setSeats(e.target.value)}>
                <option>2</option>
                <option>3</option>
                <option>4</option>
                <option>5</option>
                <option>6</option>
              </select>
            </label>
          </div>
          <div className="info-note">
            <Check size={16} /> No real money. Just a friendly practice space.
          </div>
          {connection.status !== "connected" && (
            <p className="form-error" role="status">
              {connection.error || "Connecting to the multiplayer server…"}
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={connection.pending || connection.status !== "connected"}
          >
            {connection.pending ? "Creating room…" : "Create Room"}{" "}
            <ArrowRight size={17} />
          </Button>
        </form>
      </Modal>
    </main>
  );
}
