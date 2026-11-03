import { parseArgs } from "node:util";
import { MILD_MILE, NAMES, type Rules, WILD_WILDS } from "../src/game.ts";
import { table } from "../src/tables.ts";

/** Reruns the points table with each unsettled rule read the other way, and prints what moves. */
const { values: args } = parseArgs({
  options: {
    n: { type: "string", default: "100000" },
    players: { type: "string", default: "5" },
    threshold: { type: "string", default: "0.1" },
  },
});
const n = Number(args.n);
const players = Number(args.players);

const variants: { name: string; rules: Partial<Rules> }[] = [
  { name: "main moves can go backwards", rules: { backwards: true } },
  { name: "triggers queue and resolve even if the board changed", rules: { queue: true } },
];

for (const race of [0, 1]) {
  const base = await table(race, { n, players });
  console.log(`\nRace ${race + 1} on the ${[MILD_MILE, WILD_WILDS][race].name}, ${n} races of ${players}:`);
  for (const v of variants) {
    const alt = await table(race, { n, players, rules: v.rules });
    const moved = NAMES.map((name) => [name, alt.get(name)!.points - base.get(name)!.points] as const)
      .filter(([, d]) => Math.abs(d) >= Number(args.threshold))
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const list = moved.map(([name, d]) => `${name} ${d > 0 ? "+" : ""}${d.toFixed(2)} (${base.get(name)!.points.toFixed(2)})`);
    console.log(`  ${v.name}: ${list.join(", ") || "nothing moves"}`);
  }
}
