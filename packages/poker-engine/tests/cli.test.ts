import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const script = fileURLToPath(
  new URL("../examples/simulate.mjs", import.meta.url),
);
function run(args: string[] = []) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    timeout: 10000,
  });
}
describe("compiled package and CLI", () => {
  it("runs complete heads-up, six-player and different-pot-winner examples", () => {
    const result = run();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Heads-up: four streets");
    expect(result.stdout).toContain("six-player:1:pot:4: 120");
    expect(result.stdout).toContain(
      "split-winners:1:pot:0: 150; eligible p0, p1, p2; p1 +150",
    );
    expect(result.stdout).toContain(
      "split-winners:1:pot:1: 100; eligible p0, p2; p2 +100",
    );
    expect(result.stdout.match(/replay verified/g)).toHaveLength(3);
  });
  it("accepts player count, hand count and seed options", () => {
    const result = run(["--players", "2", "--hands", "2", "--seed", "7"]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.match(/replay verified/g)).toHaveLength(2);
  });
  it("rejects unsupported arguments", () => {
    const result = run(["--players", "1"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("players must be an integer in 2..6");
  });
});
