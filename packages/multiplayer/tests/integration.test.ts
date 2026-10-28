import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";
import { randomUUID } from "node:crypto";
import { createPokerServer } from "../src/server.js";
import { secureDeck } from "../src/random.js";
import { createDeck } from "@pokerez/poker-engine";
import type {
  Ack,
  ClientCommand,
  CommandInput,
  RoomSnapshot,
  SessionInfo,
} from "../src/protocol.js";
const origin = "http://localhost:3000";
let server: ReturnType<typeof createPokerServer>, url: string;
const sockets: Socket[] = [];
const until = async (fn: () => boolean) => {
  for (let i = 0; i < 200; i++) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("Condition timed out");
};
type Client = {
  socket: Socket;
  cookie: string;
  session: SessionInfo;
  latest: RoomSnapshot | null;
  packets: RoomSnapshot[];
};
async function guest(name: string, cookie?: string): Promise<Client> {
  const response = await fetch(url + "/api/session", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({ name }),
  });
  expect(response.status).toBe(200);
  const session = (await response.json()) as SessionInfo;
  const value = cookie ?? response.headers.get("set-cookie")!.split(";")[0];
  if (!cookie) {
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=Lax");
    expect(Object.keys(session)).toEqual(["playerId", "roomCode"]);
  }
  const socket = io(url, {
    autoConnect: false,
    transports: ["websocket"],
    extraHeaders: { Origin: origin, Cookie: value },
    reconnection: false,
  });
  sockets.push(socket);
  const client: Client = {
    socket,
    cookie: value,
    session,
    latest: null,
    packets: [],
  };
  socket.on("room:state", (packet: RoomSnapshot) => {
    client.latest = packet;
    client.packets.push(packet);
  });
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("connect_error", reject);
    socket.connect();
  });
  return client;
}
function command(
  client: Client,
  input: CommandInput,
  requestId = randomUUID(),
): Promise<Ack> {
  return new Promise((resolve) =>
    client.socket.emit("command", { ...input, requestId }, resolve),
  );
}
function okay(reply: Ack) {
  if (!reply.ok) throw new Error(reply.error.code + ": " + reply.error.message);
  return reply;
}
async function room(a: Client, b: Client, capacity = 2) {
  const result = okay(
    await command(a, {
      type: "create",
      name: "Integration",
      capacity,
      smallBlind: 5,
      bigBlind: 10,
    }),
  );
  okay(await command(b, { type: "join", code: result.code! }));
  await until(
    () =>
      a.latest?.view.players.length === 2 &&
      b.latest?.view.players.length === 2,
  );
  return result.code!;
}
async function act(client: Client, type: "CHECK" | "CALL" | "FOLD" | "ALL_IN") {
  const s = client.latest!.view;
  return command(client, {
    type: "action",
    revision: s.revision,
    handId: s.handId,
    action: { type },
  });
}
async function finish(clients: Client[]) {
  for (let i = 0; i < 60; i++) {
    await until(() =>
      clients.every(
        (c) => c.latest?.view.revision === clients[0].latest?.view.revision,
      ),
    );
    const view = clients[0].latest!.view;
    if (view.phase === "FINISHED") return;
    const client = clients.find((c) => c.session.playerId === view.actorId)!;
    const legal = client.latest!.view.legalActions!;
    const reply = okay(await act(client, legal.check ? "CHECK" : "CALL"));
    await until(() =>
      clients.every((c) => c.latest!.view.revision >= reply.revision),
    );
  }
  throw new Error("Hand did not finish");
}
beforeEach(async () => {
  server = createPokerServer({ turnTimeoutMs: 60000 });
  url = `http://127.0.0.1:${await server.listen(0)}`;
});
afterEach(async () => {
  sockets.splice(0).forEach((s) => s.disconnect());
  await server.close();
});
describe("real Socket.IO multiplayer", () => {
  it("plays a complete heads-up hand using recipient-only views and events", async () => {
    const a = await guest("Alice"),
      b = await guest("Bob");
    await room(a, b);
    okay(await command(a, { type: "start" }));
    await until(
      () =>
        a.latest?.view.phase === "PREFLOP" &&
        b.latest?.view.phase === "PREFLOP",
    );
    expect(
      a.latest!.view.players.find((p) => p.id === b.session.playerId)!
        .holeCards,
    ).toBeNull();
    expect(
      b.latest!.view.players.find((p) => p.id === a.session.playerId)!
        .holeCards,
    ).toBeNull();
    expect(
      a.latest!.view.players.find((p) => p.id === a.session.playerId)!
        .holeCards,
    ).toHaveLength(2);
    await finish([a, b]);
    expect(a.latest!.view.board).toHaveLength(5);
    expect(a.latest!.view.result!.pots.length).toBeGreaterThan(0);
    expect(a.latest!.view.players.reduce((n, p) => n + p.stack, 0)).toBe(2000);
    for (const c of [a, b])
      for (const p of c.packets) {
        expect(JSON.stringify(p)).not.toMatch(
          /"deck"|"burns"|"shuffleSeed"|"actionHistory"|DECK_ORDER|BURN_CARD/,
        );
        expect(
          p.events.every(
            (e) =>
              e.visibility === "PUBLIC" || e.recipientId === c.session.playerId,
          ),
        ).toBe(true);
        for (const player of p.view.players)
          if (player.id !== c.session.playerId && !player.revealed)
            expect(player.holeCards).toBeNull();
      }
  });
  it("restores the same guest, seat and private cards after refresh/disconnect", async () => {
    const a = await guest("Alice"),
      b = await guest("Bob");
    await room(a, b);
    okay(await command(a, { type: "start" }));
    await until(() => !!a.latest?.view.handId);
    const before = a.latest!.view.players.find(
      (p) => p.id === a.session.playerId,
    )!;
    a.socket.disconnect();
    const restored = await guest("Ignored new name", a.cookie);
    await until(() => !!restored.latest);
    expect(restored.session.playerId).toBe(a.session.playerId);
    expect(restored.latest!.resume).toBe(true);
    expect(
      restored.latest!.view.players.find((p) => p.id === a.session.playerId),
    ).toEqual(before);
    expect(restored.latest!.view.players).toHaveLength(2);
    await finish([restored, b]);
    expect(restored.latest!.view.phase).toBe("FINISHED");
  });
  it("deduplicates concurrent requests, rejects conflicts, stale actions and spoofed player IDs", async () => {
    const a = await guest("Alice"),
      b = await guest("Bob");
    const code = await room(a, b);
    okay(await command(a, { type: "start" }));
    await until(() => !!a.latest?.view.handId);
    const view = a.latest!.view;
    const input: CommandInput = {
      type: "action",
      revision: view.revision,
      handId: view.handId,
      action: { type: "CALL" },
    };
    const id = randomUUID();
    const [first, duplicate] = await Promise.all([
      command(a, input, id),
      command(a, input, id),
    ]);
    expect(first).toEqual(duplicate);
    okay(first);
    expect(server.rooms.get(code)!.state.actionHistory).toHaveLength(1);
    const conflict = await command(
      a,
      { ...input, action: { type: "FOLD" } },
      id,
    );
    expect(!conflict.ok && conflict.error.code).toBe("REQUEST_CONFLICT");
    const stale = await command(a, input);
    expect(!stale.ok && stale.error.code).toBe("STALE_REVISION");
    const forged = await command(b, {
      ...input,
      action: { type: "CALL", playerId: a.session.playerId },
    } as never);
    expect(!forged.ok && forged.error.code).toBe("INVALID_REQUEST");
    expect(server.rooms.get(code)!.state.actionHistory).toHaveLength(1);
  });
  it("rejects unauthenticated sockets and unauthorized origins", async () => {
    const denied = await fetch(url + "/api/session", {
      method: "POST",
      headers: { Origin: "https://evil.example" },
      body: "{}",
    });
    expect(denied.status).toBe(403);
    const socket = io(url, {
      autoConnect: false,
      transports: ["websocket"],
      extraHeaders: { Origin: origin },
      auth: { playerId: "stolen-id" },
      reconnection: false,
    });
    sockets.push(socket);
    const error = await new Promise<Error>((resolve) => {
      socket.once("connect_error", resolve);
      socket.connect();
    });
    expect(error.message).toBe("AUTH_REQUIRED");
  });
  it("supports six stable seats, capacity limits and between-hand membership", async () => {
    const clients = await Promise.all(
      Array.from({ length: 7 }, (_, i) => guest(`P${i}`)),
    );
    const code = await room(clients[0], clients[1], 6);
    for (const c of clients.slice(2, 6))
      okay(await command(c, { type: "join", code }));
    const full = await command(clients[6], { type: "join", code });
    expect(!full.ok && full.error.code).toBe("ROOM_FULL");
    okay(await command(clients[0], { type: "start" }));
    await until(() =>
      clients.slice(0, 6).every((c) => c.latest?.view.phase === "PREFLOP"),
    );
    expect(
      new Set(clients[0].latest!.view.players.map((p) => p.seat)).size,
    ).toBe(6);
    const leave = await command(clients[0], { type: "leave" });
    expect(!leave.ok && leave.error.code).toBe("HAND_IN_PROGRESS");
    await finish(clients.slice(0, 6));
    okay(await command(clients[0], { type: "leave" }));
    okay(await command(clients[6], { type: "join", code }));
  });
});
it("uses independent complete cryptographically shuffled decks", () => {
  const a = secureDeck(),
    b = secureDeck();
  expect(a).toHaveLength(52);
  expect(new Set(a.map((c) => `${c.rank}${c.suit}`)).size).toBe(52);
  expect(a).not.toEqual(b);
  expect(a).not.toEqual(createDeck());
});

it("rejects a foreign WebSocket origin even with a valid cookie and spoofed proxy host", async () => {
  const a = await guest("Alice");
  const socket = io(url, {
    autoConnect: false,
    transports: ["websocket"],
    extraHeaders: {
      Origin: "https://evil.example",
      Cookie: a.cookie,
      "X-Forwarded-Host": "localhost:3000",
    },
    reconnection: false,
  });
  sockets.push(socket);
  const error = await new Promise<Error>((resolve, reject) => {
    socket.once("connect_error", resolve);
    socket.once("connect", () => reject(new Error("Foreign origin connected")));
    socket.connect();
  });
  expect(error).toBeInstanceOf(Error);
});
it("allows the trusted same-origin loopback polling proxy without an Origin header", async () => {
  const a = await guest("Alice");
  const socket = io(url, {
    autoConnect: false,
    transports: ["polling"],
    extraHeaders: { Cookie: a.cookie, "X-Forwarded-Host": "localhost:3000" },
    reconnection: false,
  });
  sockets.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
    socket.connect();
  });
  expect(socket.connected).toBe(true);
});
it("times out a disconnected actor without releasing or replacing that guest's seat", async () => {
  await server.close();
  server = createPokerServer({ turnTimeoutMs: 200 });
  url = `http://127.0.0.1:${await server.listen(0)}`;
  const a = await guest("Alice"),
    b = await guest("Bob");
  await room(a, b);
  okay(await command(a, { type: "start" }));
  await until(() => !!a.latest?.view.handId);
  a.socket.disconnect();
  await until(() => b.latest?.view.phase === "FINISHED");
  expect(b.latest!.view.players).toHaveLength(2);
  expect(
    b.latest!.view.players.find((p) => p.id === a.session.playerId)!.status,
  ).toBe("FOLDED");
  const back = await guest("Alice", a.cookie);
  await until(() => !!back.latest);
  expect(back.session.playerId).toBe(a.session.playerId);
  expect(
    back.latest!.view.players.find((p) => p.id === a.session.playerId)!.seat,
  ).toBe(0);
});
it("creates and settles multiple real side pots after players' stacks diverge", async () => {
  const { updateTable } = await import("@pokerez/poker-engine");
  const a = await guest("Alice"),
    b = await guest("Bob"),
    c = await guest("Carol");
  const code = await room(a, b, 3);
  okay(await command(c, { type: "join", code }));
  // Prepare different between-hand stacks using the Engine's own table operation.
  const r = server.rooms.get(code)!;
  let changed = updateTable(r.state, {
    type: "TOP_UP",
    playerId: a.session.playerId,
    amount: 500,
  });
  if (!changed.ok) throw new Error();
  r.state = changed.state;
  changed = updateTable(r.state, {
    type: "TOP_UP",
    playerId: b.session.playerId,
    amount: 200,
  });
  if (!changed.ok) throw new Error();
  r.state = changed.state;
  okay(await command(a, { type: "start" }));
  await until(() => [a, b, c].every((p) => !!p.latest?.view.handId));
  for (let i = 0; i < 4 && a.latest!.view.phase !== "FINISHED"; i++) {
    await until(() =>
      [a, b, c].every(
        (p) => p.latest?.view.revision === a.latest?.view.revision,
      ),
    );
    const actor = [a, b, c].find(
      (p) => p.session.playerId === a.latest!.view.actorId,
    )!;
    const legal = actor.latest!.view.legalActions!;
    const reply = okay(await act(actor, legal.allIn ? "ALL_IN" : "CALL"));
    await until(() =>
      [a, b, c].every((p) => p.latest!.view.revision >= reply.revision),
    );
  }
  expect(a.latest!.view.phase).toBe("FINISHED");
  expect(a.latest!.view.result!.pots.map((p) => p.amount)).toEqual([3000, 400]);
  expect(a.latest!.view.players.reduce((n, p) => n + p.stack, 0)).toBe(3700);
});

it("deduplicates a between-hand top-up and keeps the busted guest in the same seat", async () => {
  const { createDeck } = await import("@pokerez/poker-engine");
  const first = [
    { rank: 12, suit: "s" },
    { rank: 14, suit: "s" },
    { rank: 12, suit: "h" },
    { rank: 14, suit: "h" },
    { rank: 4, suit: "c" },
    { rank: 2, suit: "c" },
    { rank: 3, suit: "d" },
    { rank: 7, suit: "h" },
    { rank: 5, suit: "c" },
    { rank: 8, suit: "s" },
    { rank: 6, suit: "c" },
    { rank: 9, suit: "c" },
  ] as import("@pokerez/poker-engine").Card[];
  const deck = [
    ...first,
    ...createDeck().filter(
      (c) => !first.some((p) => p.rank === c.rank && p.suit === c.suit),
    ),
  ];
  await server.close();
  server = createPokerServer({ deal: () => deck, turnTimeoutMs: 60000 });
  url = `http://127.0.0.1:${await server.listen(0)}`;
  const a = await guest("Alice"),
    b = await guest("Bob");
  const code = await room(a, b);
  okay(await command(a, { type: "start" }));
  await until(() => !!a.latest?.view.handId);
  okay(await act(a, "ALL_IN"));
  await until(() => b.latest?.view.actorId === b.session.playerId);
  okay(await act(b, "CALL"));
  await until(() => b.latest?.view.phase === "FINISHED");
  expect(
    b.latest!.view.players.find((p) => p.id === b.session.playerId)!.stack,
  ).toBe(0);
  const id = randomUUID();
  const replies = await Promise.all([
    command(b, { type: "topup" }, id),
    command(b, { type: "topup" }, id),
  ]);
  expect(replies[0]).toEqual(replies[1]);
  okay(replies[0]);
  const p = server.rooms
    .get(code)!
    .state.players.find((p) => p.id === b.session.playerId)!;
  expect(p.stack).toBe(1000);
  expect(p.seat).toBe(1);
  okay(await command(b, { type: "start" }));
  const illegal = await command(b, { type: "topup" });
  expect(illegal.ok).toBe(false);
});
