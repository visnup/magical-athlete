import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { assign, GOLD, mulberry32, NAMES, type Name, shuffle, SILVER } from "../src/game.ts";
import { table } from "../src/tables.ts";

/**
 * Which race to play each racer in, and what a racer is worth in the draft. A team's value is its
 * best assignment of four racers to the four races; a racer's draft value is the average value of
 * teams that include it. `--write` saves both to ratings.json, which the engine plays by.
 */
const { values: args } = parseArgs({
  options: {
    n: { type: "string", default: "100000" },
    players: { type: "string", default: "5" },
    teams: { type: "string", default: "20000" },
    write: { type: "boolean", default: false },
  },
});
const players = Number(args.players);
const tables = [];
for (const race of [0, 1, 2, 3]) {
  // Twin copies an earlier winner, so each race draws them from the races before it.
  const earlier = tables.map((rows) => Object.fromEntries([...rows].map(([name, row]) => [name, row.first])));
  tables.push(await table(race, { n: Number(args.n), players, earlier }));
}
const table4 = Object.fromEntries(NAMES.map((name) => [name, tables.map((t) => t.get(name)!.points)])) as Record<Name, number[]>;
const pts = (name: Name, race: number) => table4[name][race];
const best = (team: Name[]) => assign(team, table4);

console.log(`Points per race at ${players} players (races alternate Mild Mile and Wild Wilds):\n`);
console.log(`| racer | race 1 (${GOLD[0]}/${SILVER[0]}) | race 2 (${GOLD[1]}/${SILVER[1]}) | race 3 (${GOLD[2]}/${SILVER[2]}) | race 4 (${GOLD[3]}/${SILVER[3]}) | best race | draft value |`);
console.log("| --- | --- | --- | --- | --- | --- | --- |");

const rng = mulberry32(2);
const draft = new Map<Name, number>();
const usual = new Map<Name, number[]>(NAMES.map((name) => [name, [0, 0, 0, 0]]));
for (const name of NAMES) {
  const others = NAMES.filter((x) => x !== name);
  let total = 0;
  for (let i = 0; i < Number(args.teams); i++) {
    const team = [name, ...shuffle(others, rng).slice(0, 3)];
    const { value, order } = best(team);
    total += value;
    usual.get(name)![order[0]]++;
  }
  draft.set(name, total / Number(args.teams));
}
const mean = [...draft.values()].reduce((s, v) => s + v, 0) / draft.size;
for (const name of [...NAMES].sort((a, b) => draft.get(b)! - draft.get(a)!)) {
  const slots = usual.get(name)!;
  const where = slots.indexOf(Math.max(...slots));
  const cells = [0, 1, 2, 3].map((race) => pts(name, race).toFixed(2));
  console.log(`| ${name} | ${cells.join(" | ")} | ${where + 1} (${((100 * slots[where]) / Number(args.teams)).toFixed(0)}%) | ${(draft.get(name)! - mean >= 0 ? "+" : "")}${(draft.get(name)! - mean).toFixed(2)} |`);
}
console.log(`\nDraft value: a team's best total with this racer, against the average team (${mean.toFixed(2)}). Best race: where its best team plays it most.`);

if (args.write) {
  const round = (x: number) => Math.round(x * 100) / 100;
  const ratings = {
    points: Object.fromEntries(NAMES.map((name) => [name, table4[name].map(round)])),
    draft: Object.fromEntries(NAMES.map((name) => [name, round(draft.get(name)! - mean)])),
  };
  writeFileSync(new URL("../src/ratings.json", import.meta.url), JSON.stringify(ratings, null, 2) + "\n");
}
