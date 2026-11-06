import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { ALL, GOLD, MILD_MILE, mulberry32, type Name, Race, SECOND_WIND, shuffle, SILVER, WILD_WILDS } from "../src/game.ts";
import { collect } from "../src/parallel.ts";
import RATINGS from "../src/ratings.json" with { type: "json" };
import { parquet, pointsSql, query, racerRows, races, write } from "../src/results.ts";
import { winners } from "../src/tables.ts";

const tracks = [MILD_MILE, WILD_WILDS];
type Ratings = Record<"points" | "first", Record<string, Record<string, number>>>;
const file = new URL("../src/second-wind.json", import.meta.url);

/**
 * Races of 5 drawn from all 72 racers, base and Second Wind, a row per player: a Switcharoo's
 * player scores whatever racer it ends up controlling. Racers that pick racers go by `ratings`,
 * the previous run's points and chances of 1st in this dataset.
 */
export function task(track: number, ratings: Ratings, seed: number, n: number) {
  const rng = mulberry32(seed);
  const t = tracks[track];
  const points = ratings.points[t.name];
  const first = ratings.first[t.name];
  return Array.from({ length: n }, () => {
    const lineup = shuffle([...ALL], rng).slice(0, 5);
    // Twin's earlier winners, for either race on this track (0 or 2 earlier on the Mild Mile, 1 or 3 on the Wild Wilds).
    const k = track + 2 * Math.floor(rng() * 2);
    const earlier = [0, 1, 2].slice(0, k).map((i) => ratings.first[tracks[i % 2].name]);
    const result = new Race({
      racers: lineup,
      track: t,
      rng,
      deck: ALL.filter((x) => !lineup.includes(x)),
      winners: lineup.includes("Twin") ? winners(earlier, lineup, rng) : [],
      policy: {
        rating: (name) => points[name] ?? 0,
        choose: { Mastermind: (race) => race.racers.map((o) => o.name).reduce((a, b) => ((first[b] ?? 0) > (first[a] ?? 0) ? b : a)) },
      },
    }).run();
    return racerRows(result).map((row) => {
      const mine = result.racers.filter((r) => r.player === row.seat);
      return {
        ...row,
        gold: +mine.some((r) => result.finishers[0] === r.seat),
        silver: +mine.some((r) => result.finishers[1] === r.seat),
        bronze: mine.reduce((s, r) => s + r.bronze, 0),
      };
    });
  });
}

function previous(): Ratings {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    // The first run: base racers by the base dataset, Second Wind ones at the base average.
    const by = (table: Record<string, Record<string, number>>) => {
      const avg = Object.values(table).reduce((s, v) => s + v, 0) / Object.keys(table).length;
      return Object.fromEntries(ALL.map((n) => [n, table[n] ?? avg]));
    };
    const races5 = RATINGS.races as Record<string, Record<string, Record<string, number>>>;
    const first = RATINGS.first as Record<string, number[]>;
    return {
      points: Object.fromEntries(tracks.map((t) => [t.name, by(races5[t.name][5])])),
      first: Object.fromEntries(tracks.map((t, i) => [t.name, by(Object.fromEntries(Object.entries(first).map(([n, f]) => [n, f[i]])))])),
    };
  }
}

if (import.meta.main) {
  const { values: args } = parseArgs({ options: { n: { type: "string", default: "1000000" } } });
  const ratings = previous();
  const sets = tracks.map((_, i) => parquet(`second-wind-${["mild", "wild"][i]}-5p`));
  for (const [i, track] of ["mild", "wild"].entries()) {
    await write(`second-wind-${track}-5p`, await collect(import.meta.url, "task", [i, ratings], Number(args.n)));
  }
  const rows = await Promise.all([0, 1].map((race) =>
    query(`select racer, avg(${pointsSql(race)}) points, avg(gold) first from ${sets[race]} group by racer order by racer`)));
  const next: Ratings = { points: {}, first: {} };
  tracks.forEach((t, i) => {
    next.points[t.name] = Object.fromEntries(rows[i].map((r) => [r.racer, +r.points.toFixed(3)]));
    next.first[t.name] = Object.fromEntries(rows[i].map((r) => [r.racer, +r.first.toFixed(4)]));
  });
  writeFileSync(file, JSON.stringify(next, null, 2) + "\n");

  const base = await Promise.all([0, 1].map((race) =>
    query(`select racer, avg(${pointsSql(race)}) points from ${races(race)} group by racer`)));
  const sw = new Set<string>(SECOND_WIND);
  const all = rows[0].map((r) => ({ racer: r.racer as Name, mild: r.points, wild: rows[1].find((w) => w.racer === r.racer)!.points }));
  all.sort((a, b) => b.mild + b.wild - a.mild - a.wild);
  console.log(`Races of 5 from all ${ALL.length} racers; a fair share is ${((GOLD[0] + SILVER[0]) / 5).toFixed(2)} in race 1 and ${((GOLD[1] + SILVER[1]) / 5).toFixed(2)} in race 2:\n`);
  console.log("| racer | race 1 | race 2 | against base racers only |\n| --- | --- | --- | --- |");
  for (const r of all) {
    const b = base.map((rs) => rs.find((x) => x.racer === r.racer)?.points);
    const vs = sw.has(r.racer) ? "" : `${b[0]!.toFixed(2)} / ${b[1]!.toFixed(2)}`;
    console.log(`| ${sw.has(r.racer) ? `**${r.racer}**` : r.racer} | ${r.mild.toFixed(2)} | ${r.wild.toFixed(2)} | ${vs} |`);
  }
}
