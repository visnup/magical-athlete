import { parseArgs } from "node:util";
import { NAMES, type Name } from "../src/game.ts";
import { forced, type Options, type Row, table } from "../src/tables.ts";

/**
 * The racers that pick other racers (Twin, Egg, Mastermind, Copycat) with a rating to pick by, and
 * Twin with earlier winners to copy. Ratings are race k's points table; earlier winners are drawn
 * from earlier races' chances of 1st, leaving out this race's lineup. Then the whole table is
 * rerun with ratings to see whether the order moves.
 */
const { values: args } = parseArgs({
  options: {
    n: { type: "string", default: "100000" },
    players: { type: "string", default: "5" },
  },
});
const n = Number(args.n);
const players = Number(args.players);
const pickers: Name[] = ["Twin", "Egg", "Mastermind", "Copycat"];

const base: Map<Name, Row>[] = [];
for (const race of [0, 1, 2, 3]) base.push(await table(race, { n, players }));

const rated = (race: number): Options => ({
  n,
  players,
  ratings: Object.fromEntries([...base[race]].map(([name, row]) => [name, row.points])),
  earlier: base.slice(0, race).map((rows) => Object.fromEntries([...rows].map(([name, row]) => [name, row.first]))),
});

console.log(`Points per race at ${players} players, ${n} races each:\n`);
console.log("| racer | race | as simulated before | with ratings and earlier winners | change |");
console.log("| --- | --- | --- | --- | --- |");
for (const name of pickers) {
  for (const race of [0, 1, 2, 3]) {
    const before = base[race].get(name)!.points;
    const after = await forced(name, race, rated(race));
    console.log(`| ${name} | ${race + 1} | ${before.toFixed(2)} | ${after.toFixed(2)} | ${after - before >= 0 ? "+" : ""}${(after - before).toFixed(2)} |`);
  }
}

// Does rating the pickers reorder everyone else? Compare rank orders, by Spearman's rho.
const ranks = (rows: Map<Name, Row>) => new Map([...rows].sort((a, b) => b[1].points - a[1].points).map(([name], i) => [name, i]));
for (const race of [0, 1, 2, 3]) {
  const again = await table(race, rated(race));
  const [a, b] = [ranks(base[race]), ranks(again)];
  const d2 = NAMES.reduce((s, name) => s + (a.get(name)! - b.get(name)!) ** 2, 0);
  const k = NAMES.length;
  const moved = NAMES.filter((name) => Math.abs(a.get(name)! - b.get(name)!) >= 3).map((name) => `${name} ${a.get(name)! + 1}→${b.get(name)! + 1}`);
  console.log(`\nRace ${race + 1}: rank correlation with ratings ${(1 - (6 * d2) / (k * (k * k - 1))).toFixed(3)}; moved 3+ places: ${moved.join(", ") || "none"}`);
}
