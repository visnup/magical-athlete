import { parseArgs } from "node:util";
import { GOLD, MILD_MILE, mulberry32, NAMES, type Name, Race, type Rules, shuffle, SILVER, WILD_WILDS } from "./game.ts";

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

type Variant = { name: string; rules?: Partial<Rules> };
const variants: Variant[] = [
  { name: "main moves can go backwards", rules: { backwards: true } },
];

function points(race: number, v: Partial<Variant> = {}) {
  const track = [MILD_MILE, WILD_WILDS][race % 2];
  const rng = mulberry32(1);
  const total = new Map<Name, [number, number]>(NAMES.map((name) => [name, [0, 0]]));
  for (let i = 0; i < n; i++) {
    const result = new Race({ racers: shuffle([...NAMES], rng).slice(0, players), track, rng, rules: v.rules }).run();
    for (const r of result.racers) {
      const t = total.get(r.name)!;
      t[0] += +(result.finishers[0] === r.seat) * GOLD[race] + +(result.finishers[1] === r.seat) * SILVER[race] + r.bronze;
      t[1]++;
    }
  }
  return new Map([...total].map(([name, [p, k]]) => [name, p / k]));
}

for (const race of [0, 1]) {
  const base = points(race);
  console.log(`\nRace ${race + 1} on the ${[MILD_MILE, WILD_WILDS][race].name}, ${n} races of ${players}:`);
  for (const v of variants) {
    const alt = points(race, v);
    const moved = NAMES.map((name) => [name, alt.get(name)! - base.get(name)!] as const)
      .filter(([, d]) => Math.abs(d) >= Number(args.threshold))
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const list = moved.map(([name, d]) => `${name} ${d > 0 ? "+" : ""}${d.toFixed(2)} (${base.get(name)!.toFixed(2)})`);
    console.log(`  ${v.name}: ${list.join(", ") || "nothing moves"}`);
  }
}
