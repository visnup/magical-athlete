import { parseArgs } from "node:util";
import { GOLD, MILD_MILE, NAMES, type Name, SILVER, WILD_WILDS } from "./game.ts";
import { table } from "./tables.ts";

/**
 * Each racer's points per race at 3 to 6 players, as a multiple of a fair share, so counts compare
 * directly. Prints a markdown table per track.
 */
const { values: args } = parseArgs({ options: { n: { type: "string", default: "100000" } } });
const n = Number(args.n);
const counts = [3, 4, 5, 6];

async function shares(race: number, players: number) {
  const fair = (GOLD[race] + SILVER[race]) / players;
  const rows = await table(race, { n, players });
  return new Map([...rows].map(([name, row]) => [name, row.points / fair]));
}

for (const race of [0, 1]) {
  const by = [];
  for (const players of counts) by.push(await shares(race, players));
  const mean = (name: Name) => by.reduce((s, m) => s + m.get(name)!, 0) / by.length;
  console.log(`\nRace ${race + 1}, ${[MILD_MILE, WILD_WILDS][race].name} (${GOLD[race]}/${SILVER[race]}), points ÷ a fair share, ${n} races each:\n`);
  console.log(`| racer | ${counts.map((c) => `${c}p`).join(" | ")} | 6p ÷ 3p |`);
  console.log(`| --- | ${counts.map(() => "---").join(" | ")} | --- |`);
  for (const name of [...NAMES].sort((a, b) => mean(b) - mean(a))) {
    const xs = by.map((m) => m.get(name)!);
    console.log(`| ${name} | ${xs.map((x) => x.toFixed(2)).join(" | ")} | ${(xs[3] / xs[0]).toFixed(2)} |`);
  }
}
