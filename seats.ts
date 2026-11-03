import { parseArgs } from "node:util";
import { GOLD, mulberry32, NAMES, Race, shuffle, SILVER } from "./game.ts";
import { parallel } from "./parallel.ts";
import { points, trackFor } from "./tables.ts";

/** What each seat in turn order is worth, the first player's especially, at 3 to 6 players. */
export function seatTask(race: number, players: number, seed: number, n: number) {
  const rng = mulberry32(seed);
  const total = Array(players).fill(0);
  for (let i = 0; i < n; i++) {
    const result = new Race({ racers: shuffle([...NAMES], rng).slice(0, players), track: trackFor(race), rng, first: 0 }).run();
    for (const r of result.racers) total[r.seat] += points(result, r, race);
  }
  return total;
}

if (import.meta.main) {
  const { values: args } = parseArgs({ options: { n: { type: "string", default: "200000" } } });
  const n = Number(args.n);
  for (const race of [0, 1]) {
    console.log(`\nRace ${race + 1}, ${trackFor(race).name} (${GOLD[race]}/${SILVER[race]}), ${n} races each; points by seat, 1st going first:\n`);
    console.log("| players | " + [1, 2, 3, 4, 5, 6].map((s) => `seat ${s}`).join(" | ") + " | 1st seat − average |");
    console.log("| --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const players of [3, 4, 5, 6]) {
      const per = (await parallel<number[]>(import.meta.url, "seatTask", [race, players], n)).map((t) => t / n);
      const mean = per.reduce((s, p) => s + p, 0) / players;
      const cells = [1, 2, 3, 4, 5, 6].map((s) => (s <= players ? per[s - 1].toFixed(2) : ""));
      console.log(`| ${players} | ${cells.join(" | ")} | ${per[0] - mean >= 0 ? "+" : ""}${(per[0] - mean).toFixed(2)} |`);
    }
  }
}
