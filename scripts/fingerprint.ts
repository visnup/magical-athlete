import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { tableTask } from "../src/tables.ts";
import { gamesTask } from "./games.ts";
import { playoutTask } from "./playouts.ts";

/**
 * Hashes what the engine does on a fixed sample (races on both tracks at 3 and 6 players, whole
 * games, and a few playouts) into engine.sha, rewriting it only when the hash changes. The
 * Makefile's data depends on it, so a change to src/ that doesn't change results reruns nothing.
 */
const hash = createHash("sha256");
for (const race of [0, 1]) for (const players of [3, 6]) hash.update(JSON.stringify(tableTask(race, { players }, 1, 5000)));
hash.update(JSON.stringify(gamesTask(5, false, 1, 500)));
hash.update(JSON.stringify(gamesTask(3, true, 1, 200)));
hash.update(JSON.stringify(playoutTask("Mastermind", 5, 1, 5, 1, 20)));
const sha = hash.digest("hex") + "\n";
const file = new URL("../engine.sha", import.meta.url);
let old = "";
try {
  old = readFileSync(file, "utf8");
} catch {}
if (sha !== old) writeFileSync(file, sha);
console.log(sha === old ? "engine unchanged" : "engine changed");
