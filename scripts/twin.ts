import { parseArgs } from "node:util";
import { type Name, NAMES } from "../src/game.ts";
import { parquet, pointsSql, query, races, write } from "../src/results.ts";
import { forcedRows, type Options, tableRows } from "../src/tables.ts";

/**
 * The racers that pick other racers (Twin, Egg, Mastermind, Copycat) with a rating to pick by, and
 * Twin with earlier winners to copy. Ratings are race k's points in the race dataset; earlier
 * winners are drawn from earlier races' chances of 1st, leaving out this race's lineup. Writes the
 * pickers' races to results/twin.parquet, then reruns whole races with ratings
 * (results/twin-rated.parquet) to see whether the order moves.
 */
const { values: args } = parseArgs({ options: { n: { type: "string", default: "100000" } } });
const n = Number(args.n);
const pickers: Name[] = ["Twin", "Egg", "Mastermind", "Copycat"];
const games = [0, 1, 2, 3];

const base = await Promise.all(games.map((race) =>
  query(`select racer, avg(${pointsSql(race)}) points, avg(gold) first from ${races(race)} group by racer`)));
const rated = (race: number): Options => ({
  n,
  ratings: Object.fromEntries(base[race].map((r) => [r.racer, r.points])),
  earlier: base.slice(0, race).map((rows) => Object.fromEntries(rows.map((r) => [r.racer, r.first]))),
});

const forced = [];
const whole = [];
for (const race of games) {
  for (const name of pickers) for (const row of (await forcedRows(name, race, rated(race))).map((r) => ({ game_race: race + 1, ...r }))) forced.push(row);
  for (const row of (await tableRows(race, rated(race))).map((r) => ({ game_race: race + 1, ...r }))) whole.push(row);
}
await write("twin", forced);
await write("twin-rated", whole);

const scored = (file: string) => games.map((race) => `select game_race, racer, ${pointsSql(race)} p from ${file} where game_race = ${race + 1}`).join(" union all ");
console.log(`Points per race at 5 players, ${n} races each:\n`);
console.log("| racer | race | as simulated before | with ratings and earlier winners | change |");
console.log("| --- | --- | --- | --- | --- |");
const after = await query(`select racer, game_race, avg(p) points from (${scored(parquet("twin"))}) group by all`);
for (const name of pickers) {
  for (const race of games) {
    const before = base[race].find((r) => r.racer === name)!.points;
    const now = after.find((r) => r.racer === name && r.game_race === race + 1)!.points;
    console.log(`| ${name} | ${race + 1} | ${before.toFixed(2)} | ${now.toFixed(2)} | ${now - before >= 0 ? "+" : ""}${(now - before).toFixed(2)} |`);
  }
}

// Does rating the pickers reorder everyone else? Compare rank orders, by Spearman's rho.
const again = await query(`select racer, game_race, avg(p) points from (${scored(parquet("twin-rated"))}) group by all`);
const ranks = (rows: { racer: string; points: number }[]) => new Map(rows.toSorted((a, b) => b.points - a.points).map((r, i) => [r.racer, i]));
for (const race of games) {
  const [a, b] = [ranks(base[race]), ranks(again.filter((r) => r.game_race === race + 1))];
  const d2 = NAMES.reduce((s, name) => s + (a.get(name)! - b.get(name)!) ** 2, 0);
  const k = NAMES.length;
  const moved = NAMES.filter((name) => Math.abs(a.get(name)! - b.get(name)!) >= 3).map((name) => `${name} ${a.get(name)! + 1}→${b.get(name)! + 1}`);
  console.log(`\nRace ${race + 1}: rank correlation with ratings ${(1 - (6 * d2) / (k * (k * k - 1))).toFixed(3)}; moved 3+ places: ${moved.join(", ") || "none"}`);
}
