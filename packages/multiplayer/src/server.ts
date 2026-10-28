import { createServer } from "node:http";
import { Server, type Socket } from "socket.io";
import {
  applyAction,
  getLegalActions,
  getPlayerEvents,
  getPlayerView,
  type Card,
  type GameEvent,
} from "@pokerez/poker-engine";
import { createRooms, type Room } from "./rooms.js";
import {
  COOKIE,
  SESSION_TTL,
  createSessions,
  type Session,
} from "./sessions.js";
import { parseCommand } from "./validation.js";
import type {
  Ack,
  ClientEvents,
  RoomSnapshot,
  ServerEvents,
} from "./protocol.js";
export type ServerOptions = {
  origins?: string[];
  secureCookies?: boolean;
  turnTimeoutMs?: number;
  deal?: () => Card[];
};
type SocketData = { session: Session };
export function createPokerServer(options: ServerOptions = {}) {
  const origins = options.origins ?? [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];
  const sessions = createSessions();
  const service = createRooms(sessions.byId, options.deal);
  const timers = new Map<
    string,
    { key: string; timer: ReturnType<typeof setTimeout> }
  >();
  const turnTimeout = options.turnTimeoutMs ?? 45000;
  const requests = new Map<string, number[]>();
  const http = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    const origin = req.headers.origin;
    if (origin && origins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
    }
    if (req.url === "/health" && req.method === "GET") {
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (req.url !== "/api/session") {
      res.writeHead(404).end(JSON.stringify({ error: "NOT_FOUND" }));
      return;
    }
    if (!origin || !origins.includes(origin)) {
      res.writeHead(403).end(JSON.stringify({ error: "ORIGIN_DENIED" }));
      return;
    }
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "POST");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.writeHead(204).end();
      return;
    }
    if (req.method !== "POST") {
      res.writeHead(405).end();
      return;
    }
    try {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 4096) {
          res.writeHead(413).end();
          return;
        }
      }
      const input = body ? JSON.parse(body) : {};
      let session = sessions.get(req.headers.cookie);
      let token: string | undefined;
      if (!session) {
        const ip = req.socket.remoteAddress ?? "local";
        const recent = (requests.get(ip) ?? []).filter(
          (t) => t > Date.now() - 60000,
        );
        if (recent.length >= 30) {
          res.writeHead(429).end(JSON.stringify({ error: "RATE_LIMIT" }));
          return;
        }
        recent.push(Date.now());
        requests.set(ip, recent);
        if (requests.size > 1024)
          requests.delete(requests.keys().next().value!);
        const name =
          typeof input.name === "string"
            ? input.name
                .replace(/[\u0000-\u001f\u007f]/g, "")
                .trim()
                .slice(0, 24) || "Player"
            : "Player";
        ({ session, token } = sessions.create(name));
      }
      if (session.roomCode && !service.rooms.has(session.roomCode))
        session.roomCode = null;
      session.expiresAt = Date.now() + SESSION_TTL;
      if (token)
        res.setHeader(
          "Set-Cookie",
          `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL / 1000}${options.secureCookies ? "; Secure" : ""}`,
        );
      res.end(
        JSON.stringify({ playerId: session.id, roomCode: session.roomCode }),
      );
    } catch {
      res
        .writeHead(400)
        .end(JSON.stringify({ error: "INVALID_SESSION_REQUEST" }));
    }
  });
  const io = new Server<
    ClientEvents,
    ServerEvents,
    Record<string, never>,
    SocketData
  >(http, {
    cors: { origin: origins, credentials: true },
    maxHttpBufferSize: 16384,
    allowRequest: (req, cb) => {
      const origin = req.headers.origin;
      const forwarded = req.headers["x-forwarded-host"];
      const local = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
        req.socket.remoteAddress ?? "",
      );
      // Same-origin polling GETs omit Origin. Only our loopback proxy may vouch for the host.
      const allowed =
        typeof origin === "string"
          ? origins.includes(origin)
          : local &&
            typeof forwarded === "string" &&
            origins.some((o) => new URL(o).host === forwarded);
      cb(null, allowed);
    },
  });
  function connected(room: Room) {
    return room.state.players
      .filter((p) => sessions.byId.get(p.id)?.sockets.size)
      .map((p) => p.id);
  }
  function snapshot(
    room: Room,
    session: Session,
    events: GameEvent[],
    resume = false,
  ): RoomSnapshot {
    return {
      room: { ...room.info },
      playerId: session.id,
      view: getPlayerView(room.state, session.id),
      events: getPlayerEvents(events, session.id),
      version: room.version,
      connected: connected(room),
      turnDeadline: room.turnDeadline,
      resume,
    };
  }
  function setTimer(room: Room) {
    const key = `${room.state.handId}:${room.state.revision}:${room.state.actorId}`;
    const prior = timers.get(room.info.code);
    if (prior?.key === key) return;
    if (prior) clearTimeout(prior.timer);
    timers.delete(room.info.code);
    room.turnDeadline = null;
    if (
      !room.state.actorId ||
      room.state.phase === "FINISHED" ||
      room.state.phase === "WAITING"
    )
      return;
    room.turnDeadline = Date.now() + turnTimeout;
    const timer = setTimeout(() => {
      timers.delete(room.info.code);
      if (
        !service.rooms.has(room.info.code) ||
        `${room.state.handId}:${room.state.revision}:${room.state.actorId}` !==
          key
      )
        return;
      const playerId = room.state.actorId!;
      const legal = getLegalActions(room.state, playerId);
      const result = applyAction(room.state, {
        playerId,
        type: legal.check ? "CHECK" : "FOLD",
      });
      if (result.ok) {
        room.state = result.state;
        room.lastActive = Date.now();
        publish(room, result.events);
      }
    }, turnTimeout);
    timer.unref();
    timers.set(room.info.code, { key, timer });
  }
  function publish(room: Room, events: GameEvent[] = []) {
    setTimer(room);
    room.version++;
    for (const player of room.state.players) {
      const session = sessions.byId.get(player.id);
      if (!session) continue;
      for (const id of session.sockets)
        io.sockets.sockets
          .get(id)
          ?.emit("room:state", snapshot(room, session, events));
    }
  }
  io.use((socket, next) => {
    const session = sessions.get(socket.handshake.headers.cookie);
    if (!session) {
      next(new Error("AUTH_REQUIRED"));
      return;
    }
    socket.data.session = session;
    next();
  });
  io.on("connection", (socket) => {
    const session = socket.data.session;
    session.sockets.add(socket.id);
    socket.emit("session:ready", {
      playerId: session.id,
      roomCode: session.roomCode,
    });
    const room = session.roomCode
      ? service.rooms.get(session.roomCode)
      : undefined;
    if (room) {
      room.lastActive = Date.now();
      publish(room);
      socket.emit("room:state", snapshot(room, session, [], true));
    }
    socket.on("room:sync", () => {
      const room = session.roomCode
        ? service.rooms.get(session.roomCode)
        : undefined;
      if (room && sessions.get(socket.handshake.headers.cookie))
        socket.emit("room:state", snapshot(room, session, [], true));
    });
    socket.on("command", (input, ack) => {
      const respond = (reply: Ack) => {
        if (typeof ack === "function") ack(reply);
      };
      const command = parseCommand(input);
      const requestId =
        command?.requestId ??
        (input && typeof input.requestId === "string" ? input.requestId : "");
      const fail = (code: string, message: string) =>
        respond({ ok: false, requestId, error: { code, message } });
      if (!sessions.get(socket.handshake.headers.cookie)) {
        fail(
          "AUTH_REQUIRED",
          "Your guest session expired. Reconnect to continue.",
        );
        return;
      }
      if (!command) {
        fail("INVALID_REQUEST", "Invalid command or amount.");
        return;
      }
      const fingerprint = JSON.stringify(command);
      const cached = session.requests.get(requestId);
      if (cached) {
        if (cached.fingerprint !== fingerprint)
          fail(
            "REQUEST_CONFLICT",
            "Request ID was already used for a different command.",
          );
        else respond(cached.ack);
        return;
      }
      session.commands = session.commands.filter((t) => t > Date.now() - 60000);
      if (session.commands.length >= 120) {
        fail("RATE_LIMIT", "Please slow down.");
        return;
      }
      session.commands.push(Date.now());
      try {
        const result = service.execute(session, command);
        const reply: Ack = result.ok
          ? {
              ok: true,
              requestId,
              code: result.room?.info.code ?? null,
              revision: result.room?.state.revision ?? 0,
            }
          : { ok: false, requestId, error: result.error };
        session.requests.set(requestId, { fingerprint, ack: reply });
        if (session.requests.size > 256)
          session.requests.delete(session.requests.keys().next().value!);
        if (result.ok) {
          if (result.room) publish(result.room, result.events);
          if (result.left) {
            socket.emit("room:left");
            publish(result.left, result.events);
          }
        }
        respond(reply);
      } catch {
        fail("SERVER_ERROR", "The request could not be completed.");
      }
    });
    socket.on("disconnect", () => {
      session.sockets.delete(socket.id);
      const room = session.roomCode
        ? service.rooms.get(session.roomCode)
        : undefined;
      if (room) {
        room.lastActive = Date.now();
        publish(room);
      }
    });
  });
  const cleanup = setInterval(() => {
    for (const [code, room] of service.rooms)
      if (
        !connected(room).length &&
        room.lastActive < Date.now() - 2 * 60 * 60 * 1000
      ) {
        service.rooms.delete(code);
        const timer = timers.get(code);
        if (timer) clearTimeout(timer.timer);
        timers.delete(code);
        for (const p of room.state.players) {
          const s = sessions.byId.get(p.id);
          if (s?.roomCode === code) s.roomCode = null;
        }
      }
    sessions.cleanup();
  }, 60000);
  cleanup.unref();
  return {
    http,
    io,
    rooms: service.rooms,
    async listen(port = 3001, host = "127.0.0.1") {
      await new Promise<void>((resolve, reject) => {
        http.once("error", reject);
        http.listen(port, host, () => {
          http.off("error", reject);
          resolve();
        });
      });
      const address = http.address();
      return typeof address === "object" && address ? address.port : port;
    },
    async close() {
      clearInterval(cleanup);
      for (const t of timers.values()) clearTimeout(t.timer);
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}
