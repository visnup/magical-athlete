import { parseArgs } from "node:util";
import { GOLD, mulberry32, NAMES, type Name, Race, shuffle, SILVER } from "./game.ts";
import { parallel } from "./parallel.ts";
import { points, trackFor } from "./tables.ts";

/**
 * How spread out each racer's points are in one race, not just the average: for picking a safe
 * racer when ahead or a swingy one when behind. Defaults to race 4.
 */
export function spreadTask(race: number, players: number, seed: number, n: number) {
  const rng = mulberry32(seed);
  // [races, sum, sum of squares, 0 points, at least silver, at least gold]
  const sums = Object.fromEntries(NAMES.map((name) => [name, [0, 0, 0, 0, 0, 0]])) as Record<Name, number[]>;
  for (let i = 0; i < n; i++) {
    const result = new Race({ racers: shuffle([...NAMES], rng).slice(0, players), track: trackFor(race), rng }).run();
    for (const r of result.racers) {
      const p = points(result, r, race);
      const s = sums[r.name];
      s[0]++;
      s[1] += p;
      s[2] += p * p;
      s[3] += +(p <= 0);
      s[4] += +(p >= SILVER[race]);
      s[5] += +(p >= GOLD[race]);
    }
  }
  return sums;
}

if (import.meta.main) {
  const { values: args } = parseArgs({
    options: {
      n: { type: "string", default: "100000" },
      players: { type: "string", default: "5" },
      race: { type: "string", default: "4" },
    },
  });
  const n = Number(args.n);
  const players = Number(args.players);
  const race = Number(args.race) - 1;
  const sums = await parallel<Record<Name, number[]>>(import.meta.url, "spreadTask", [race, players], n);
  const pct = (x: number) => `${(100 * x).toFixed(0)}%`;
  console.log(`Race ${race + 1}, ${trackFor(race).name} (${GOLD[race]}/${SILVER[race]}), ${n} races of ${players}:\n`);
  console.log("| racer | mean | sd | 0 points | at least silver | at least gold |");
  console.log("| --- | --- | --- | --- | --- | --- |");
  const rows = NAMES.map((name) => {
    const [k, sum, sq, zero, silver, gold] = sums[name];
    const mean = sum / k;
    return { name, mean, sd: Math.sqrt(sq / k - mean * mean), zero: zero / k, silver: silver / k, gold: gold / k };
  });
  for (const r of rows.sort((a, b) => b.sd - a.sd)) {
    console.log(`| ${r.name} | ${r.mean.toFixed(2)} | ${r.sd.toFixed(2)} | ${pct(r.zero)} | ${pct(r.silver)} | ${pct(r.gold)} |`);
  }
}
