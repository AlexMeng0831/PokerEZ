import { createPokerServer } from "./server.js";
const port = Number(process.env.GAME_PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("GAME_PORT must be 1–65535");
const server = createPokerServer({
  origins: process.env.ALLOWED_ORIGINS?.split(",").map((s) => s.trim()),
  secureCookies: process.env.NODE_ENV === "production",
});
await server.listen(port, process.env.GAME_HOST ?? "127.0.0.1");
console.log(
  `PokerEZ multiplayer listening on http://${process.env.GAME_HOST ?? "127.0.0.1"}:${port}`,
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    void server.close().then(() => process.exit(0));
  });
