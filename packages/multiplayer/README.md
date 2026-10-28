# Multiplayer server

One Node.js + Socket.IO process, using `@pokerez/poker-engine` as the only source of poker rules. Rooms, Guest sessions and recent request receipts live in memory.

## Run

From the repository root with Node.js 24:

```sh
npm ci
npm run dev
```

The app runs on `http://localhost:3000`; the backend listens on `127.0.0.1:3001`. Next.js proxies `/api/game/*` and `/socket.io/*`, including WebSocket upgrades and HTTP polling. A trailing-slash-preserving rewrite is required for Engine.IO.

For separate terminals, first run `npm run engine:build`, then `npm run dev:web` and `npm run dev:server`.

```sh
npm run check
npm run build
npm start
```

`check` runs the complete local validation: Engine tests/typecheck, multiplayer integration tests/typecheck/build, adapter tests, existing Mock tests, and frontend typecheck/build. `start` builds the backend, then runs both production processes. Local HTTP development uses non-Secure cookies; set `NODE_ENV=production` behind HTTPS to enable Secure cookies.

## Browser flow

Use two browsers, two browser profiles, or a normal/private window. The same profile shares its cookie and therefore represents the same player in multiple tabs. For local isolated-session testing, `localhost:3000` and `127.0.0.1:3000` also use different cookie stores.

Create a room, join by code, then deal with at least two connected funded players. Seat IDs remain stable until an explicit between-hand leave. A page reload bootstraps the existing cookie and receives a fresh private snapshot; it does not create a new player or replay old animations. An active-hand lobby link preserves the seat. Between hands, **Leave room** releases it. An unfunded player can use **Add 1,000 chips** between hands to continue in the same seat.

## Protocol

- `POST /api/game/session` through Next.js creates/resumes an opaque Guest cookie. Its JSON response contains only player ID and current room code. No bearer token is stored in browser localStorage.
- Socket.IO authenticates the cookie during connection. A client cannot choose its player ID.
- Client `command` messages contain a unique `requestId` and one of `create`, `join`, `start`, `action`, `leave`, `topup`.
- `action` additionally includes `handId`, `revision`, and an Engine action without `playerId`. The server supplies the authenticated ID. Bet/Raise `to` values retain Engine street-total semantics.
- Acknowledgements return success/typed errors. The latest 256 receipts per Guest are deduplicated: an identical request returns its receipt, while a reused ID with another payload is rejected. Stale action revisions/hand IDs are rejected by the server/Engine. Receipts are not persisted across restarts.
- `room:state` contains room metadata, recipient ID, `PlayerView`, recipient-filtered events, connected player IDs, version and turn deadline. Each socket receives its own packet; the server never broadcasts full `GameState`, internal events, deck or burns.
- `room:sync` sends a fresh authorized snapshot. Connection/resume snapshots replace local presentation state immediately; normal event batches enter the Motion queue.

State changes run synchronously on the Node event loop. Revision checking prevents two requests from spending the same turn; no second rules implementation or client-side authority is involved.

## Privacy and dealing

Guest credentials are 32 cryptographically random bytes in an HttpOnly, SameSite=Lax cookie. The server stores their SHA-256 hashes and separate stable player IDs. Cookies expire after 24 hours. Socket and HTTP origins are restricted. Origin-less same-origin polling is accepted only through the loopback proxy with an approved forwarded host; an explicit foreign Origin always loses.

Every real hand uses a fresh Fisher–Yates deck sampled with `node:crypto.randomInt`. The Engine's seeded fixture shuffle is never used for multiplayer. Internal state stays in the room service; only `getPlayerView` and `getPlayerEvents` projections reach sockets. Live hands are intentionally revealed at showdown/closed all-in runout according to house rules; folded opponents remain private.

The frontend maps known cards and explicit face-down placeholders into existing Motion primitives. It supports relative 2–6 player seating, custom legal amount ranges, multiple side pots and multiple payout winners. It does not calculate legal actions or choose winners.

## Reconnects and memory

Socket disconnects do not remove seats or chips. Timers remain anchored to the current Engine revision, so reconnecting does not reset a turn. At 45 seconds the server checks if legal, otherwise folds. The next hand excludes disconnected or unfunded players; reconnecting restores eligibility on the next deal.

Rooms expire after two hours with nobody connected. Server restarts discard all rooms, sessions and receipts. Basic room/session caps, payload limits and per-Guest command limits bound local memory and traffic; this is a single-process implementation, not durable hosting.

## Configuration

| Variable                      | Default                                       | Purpose                                            |
| ----------------------------- | --------------------------------------------- | -------------------------------------------------- |
| `GAME_PORT`                   | `3001`                                        | Backend port                                       |
| `GAME_HOST`                   | `127.0.0.1`                                   | Backend bind address                               |
| `GAME_INTERNAL_URL`           | `http://127.0.0.1:3001`                       | Next.js proxy target; change with the backend port |
| `ALLOWED_ORIGINS`             | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated browser origins                    |
| `NEXT_PUBLIC_GAME_SERVER_URL` | Browser origin                                | Optional direct Socket.IO endpoint override        |

For public hosting, use HTTPS at the frontend, an authenticated-origin allowlist and a trusted reverse proxy. Keep the Node listener private or otherwise restrict direct access. A static hosting target alone cannot run Socket.IO.

## Tests

`npm run server:test` starts real ephemeral HTTP/Socket.IO servers and clients. It covers full heads-up play, six-seat capacity, refresh recovery, cookie/Origin enforcement, duplicate/conflicting/stale/spoofed requests, disconnect timeouts, and real multi-pot settlement. `npm run adapter:test` verifies seat rotation, private-card placeholders, useful-card highlights and multiple winners.
