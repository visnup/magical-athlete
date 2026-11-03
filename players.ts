import { parseArgs } from "node:util";
import { GOLD, MILD_MILE, mulberry32, NAMES, type Name, Race, shuffle, SILVER, WILD_WILDS } from "./game.ts";

/**
 * Each racer's points per race at 3 to 6 players, as a multiple of a fair share, so counts compare
 * directly. Prints a markdown table per track.
 */
const { values: args } = parseArgs({ options: { n: { type: "string", default: "100000" } } });
const n = Number(args.n);
const counts = [3, 4, 5, 6];

function shares(race: number, players: number) {
  const track = [MILD_MILE, WILD_WILDS][race % 2];
  const fair = (GOLD[race] + SILVER[race]) / players;
  const rng = mulberry32(1);
  const total = new Map<Name, [number, number]>(NAMES.map((name) => [name, [0, 0]]));
  for (let i = 0; i < n; i++) {
    const result = new Race({ racers: shuffle([...NAMES], rng).slice(0, players), track, rng }).run();
    for (const r of result.racers) {
      const t = total.get(r.name)!;
      t[0] += +(result.finishers[0] === r.seat) * GOLD[race] + +(result.finishers[1] === r.seat) * SILVER[race] + r.bronze;
      t[1]++;
    }
  }
  return new Map([...total].map(([name, [p, k]]) => [name, p / k / fair]));
}

for (const race of [0, 1]) {
  const by = counts.map((players) => shares(race, players));
  const mean = (name: Name) => by.reduce((s, m) => s + m.get(name)!, 0) / by.length;
  console.log(`\nRace ${race + 1}, ${[MILD_MILE, WILD_WILDS][race].name} (${GOLD[race]}/${SILVER[race]}), points ÷ a fair share, ${n} races each:\n`);
  console.log(`| racer | ${counts.map((c) => `${c}p`).join(" | ")} | 6p ÷ 3p |`);
  console.log(`| --- | ${counts.map(() => "---").join(" | ")} | --- |`);
  for (const name of [...NAMES].sort((a, b) => mean(b) - mean(a))) {
    const xs = by.map((m) => m.get(name)!);
    console.log(`| ${name} | ${xs.map((x) => x.toFixed(2)).join(" | ")} | ${(xs[3] / xs[0]).toFixed(2)} |`);
  }
}
