import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { assign, GOLD, mulberry32, NAMES, type Name, shuffle, SILVER } from "../src/game.ts";
import { parquet, pointsSql, query, races, write } from "../src/results.ts";
import { forcedRows } from "../src/tables.ts";

/**
 * Which race to play each racer in, and what a racer is worth in the draft. Each racer's points in
 * each race come from the race dataset, except Twin's: it copies an earlier winner, so it's raced
 * again with earlier winners drawn from the races before it (results/lineup-twin.parquet). A
 * team's value is its best assignment of four racers to the four races; a racer's draft value is
 * the average value of teams that include it (results/lineup-draft.parquet). `--write` saves both
 * to ratings.json, which the engine plays by, with each racer's chance of 1st in each race, which
 * standalone races draw Twin's earlier winners from.
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
const teams = Number(args.teams);
const games = [0, 1, 2, 3];
const tables = await Promise.all(games.map((race) =>
  query(`select racer, avg(${pointsSql(race)}) points, avg(gold) first from ${races(race, players)} group by racer`)));
const twin = [];
for (const race of games) {
  const earlier = tables.slice(0, race).map((rows) => Object.fromEntries(rows.map((r) => [r.racer, r.first])));
  for (const row of (await forcedRows("Twin", race, { n: Number(args.n), players, earlier })).map((r) => ({ game_race: race + 1, ...r }))) twin.push(row);
}
await write("lineup-twin", twin);
const twins = await query(`select game_race, avg(p) points, avg(gold) first from (${games.map((race) =>
  `select game_race, gold, ${pointsSql(race)} p from ${parquet("lineup-twin")} where game_race = ${race + 1}`).join(" union all ")}) group by all`);
const table4 = Object.fromEntries(NAMES.map((name) => [name, games.map((race) =>
  name === "Twin" ? twins.find((r) => r.game_race === race + 1)!.points : tables[race].find((r) => r.racer === name)!.points)])) as Record<Name, number[]>;
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
  for (let i = 0; i < teams; i++) {
    const { value, order } = best([name, ...shuffle(others, rng).slice(0, 3)]);
    total += value;
    usual.get(name)![order[0]]++;
  }
  draft.set(name, total / teams);
}
const mean = [...draft.values()].reduce((s, v) => s + v, 0) / draft.size;
await write("lineup-draft", NAMES.map((name) => ({
  racer: name,
  ...Object.fromEntries(games.map((race) => [`race${race + 1}`, pts(name, race)])),
  value: draft.get(name)! - mean,
  ...Object.fromEntries(usual.get(name)!.map((k, race) => [`in_race${race + 1}`, k / teams])),
})));
for (const name of [...NAMES].sort((a, b) => draft.get(b)! - draft.get(a)!)) {
  const slots = usual.get(name)!;
  const where = slots.indexOf(Math.max(...slots));
  const cells = [0, 1, 2, 3].map((race) => pts(name, race).toFixed(2));
  console.log(`| ${name} | ${cells.join(" | ")} | ${where + 1} (${((100 * slots[where]) / teams).toFixed(0)}%) | ${(draft.get(name)! - mean >= 0 ? "+" : "")}${(draft.get(name)! - mean).toFixed(2)} |`);
}
console.log(`\nDraft value: a team's best total with this racer, against the average team (${mean.toFixed(2)}). Best race: where its best team plays it most.`);

if (args.write) {
  const round = (x: number) => Math.round(x * 100) / 100;
  const ratings = {
    points: Object.fromEntries(NAMES.map((name) => [name, table4[name].map(round)])),
    draft: Object.fromEntries(NAMES.map((name) => [name, round(draft.get(name)! - mean)])),
    first: Object.fromEntries(NAMES.map((name) => [name, games.map((race) =>
      Math.round(1000 * (name === "Twin" ? twins.find((r) => r.game_race === race + 1)! : tables[race].find((r) => r.racer === name)!).first) / 1000)])),
  };
  writeFileSync(new URL("../src/ratings.json", import.meta.url), JSON.stringify(ratings, null, 2) + "\n");
}
