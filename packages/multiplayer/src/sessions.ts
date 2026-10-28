import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Ack } from "./protocol.js";
export const COOKIE = "pokerez_guest";
export const SESSION_TTL = 24 * 60 * 60 * 1000;
export type Session = {
  id: string;
  name: string;
  hash: string;
  roomCode: string | null;
  expiresAt: number;
  sockets: Set<string>;
  requests: Map<string, { fingerprint: string; ack: Ack }>;
  commands: number[];
};
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function createSessions() {
  const byHash = new Map<string, Session>();
  const byId = new Map<string, Session>();
  function get(cookie = ""): Session | undefined {
    const token = cookie
      .split(";")
      .map((p) => p.trim())
      .find((p) => p.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1);
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return;
    const session = byHash.get(digest(token));
    return session && session.expiresAt > Date.now() ? session : undefined;
  }
  function create(name: string) {
    if (byId.size >= 4096) throw new Error("Session capacity reached");
    const token = randomBytes(32).toString("base64url");
    const session: Session = {
      id: randomUUID(),
      name,
      hash: digest(token),
      roomCode: null,
      expiresAt: Date.now() + SESSION_TTL,
      sockets: new Set(),
      requests: new Map(),
      commands: [],
    };
    byHash.set(session.hash, session);
    byId.set(session.id, session);
    return { session, token };
  }
  function cleanup() {
    for (const [id, s] of byId)
      if (s.expiresAt <= Date.now() && s.sockets.size === 0 && !s.roomCode) {
        byId.delete(id);
        byHash.delete(s.hash);
      }
  }
  return { get, create, byId, cleanup };
}
