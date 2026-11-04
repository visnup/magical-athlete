import { parseArgs } from "node:util";
import { defaultPolicy, mulberry32, NAMES, Race, type Racer, shuffle } from "../src/game.ts";
import { parallel } from "../src/parallel.ts";
import { landing, rolled } from "../src/racers.ts";
import { points, trackFor } from "../src/tables.ts";

/**
 * Whether to play defensively against Dicemonger, which moves 1 whenever another racer takes its
 * reroll. Dicemonger and a test racer are in every race; the test racer takes the reroll by the
 * default rule, only when it's worth `margin` spaces more, or never, on the same seeds, while
 * everyone else plays the default. Prints the test racer's points and the paired change.
 */
const variants = { "default": 0, "margin 2": 2, "margin 4": 4, "never": Infinity };

export function dicemongerTask(race: number, players: number, seed: number, n: number) {
  const others = NAMES.filter((x) => x !== "Dicemonger");
  return Array.from({ length: n }, (_, i) =>
    Object.values(variants).map((margin) => {
      const rng = mulberry32(seed * 1_000_000 + i);
      const pool = shuffle(others, rng);
      const test = pool[0];
      const policy = {
        reroll: (r: Race, x: Racer, roll: number, left: number) =>
          x.name === test && margin > 0 && left === 1 && !r.has(x, "Magician")
            ? rolled(r, x.pos, 15) - landing(r, x.pos + roll, 15) >= margin
            : defaultPolicy.reroll(r, x, roll, left),
      };
      const racers = shuffle(["Dicemonger" as const, ...pool.slice(0, players - 1)], rng);
      const result = new Race({ racers, track: trackFor(race), rng, policy }).run();
      return points(result, result.racers.find((x) => x.name === test)!, race);
    })
  );
}

if (import.meta.main) {
  const { values: args } = parseArgs({
    options: { race: { type: "string", default: "2" }, n: { type: "string", default: "100000" }, players: { type: "string", default: "5" } },
  });
  const race = Number(args.race) - 1;
  const rows = await parallel<number[][]>(import.meta.url, "dicemongerTask", [race, Number(args.players)], Number(args.n), (a, b) => a.concat(b));
  const n = rows.length;
  console.log(`Race ${race + 1}, ${n} races of ${args.players} with Dicemonger; the test racer takes its reroll:\n`);
  console.log("| when | points | change |\n| --- | --- | --- |");
  Object.keys(variants).forEach((label, v) => {
    const d = rows.map((r) => r[v] - r[0]);
    const mean = d.reduce((s, x) => s + x, 0) / n;
    const se = Math.sqrt(d.reduce((s, x) => s + (x - mean) ** 2, 0) / n / n);
    const pts = rows.reduce((s, r) => s + r[v], 0) / n;
    console.log(`| ${label} | ${pts.toFixed(2)} | ${v ? `${mean >= 0 ? "+" : ""}${mean.toFixed(2)} ±${se.toFixed(3)}` : ""} |`);
  });
}
