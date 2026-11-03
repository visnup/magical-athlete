import { parseArgs } from "node:util";
import { type Rules } from "../src/game.ts";
import { parquet, pointsSql, query, races, write } from "../src/results.ts";
import { tableRows, trackFor } from "../src/tables.ts";

/**
 * Reruns the 5-player races with each unsettled rule read the other way, writing them to
 * results/sensitivity-<reading>-<track>.parquet, and prints what moves against the race dataset.
 */
const { values: args } = parseArgs({
  options: {
    n: { type: "string", default: "100000" },
    threshold: { type: "string", default: "0.1" },
  },
});
const variants: { name: string; key: keyof Rules }[] = [
  { name: "main moves can go backwards", key: "backwards" },
  { name: "triggers queue and resolve even if the board changed", key: "queue" },
];

for (const race of [0, 1]) {
  console.log(`\nRace ${race + 1} on the ${trackFor(race).name}:`);
  for (const v of variants) {
    const file = `sensitivity-${v.key}-${["mild", "wild"][race]}`;
    await write(file, await tableRows(race, { n: Number(args.n), rules: { [v.key]: true } }));
    const moved = await query(`
      select racer, a.points base, b.points - a.points change
      from (select racer, avg(${pointsSql(race)}) points from ${races(race)} group by racer) a
      join (select racer, avg(${pointsSql(race)}) points from ${parquet(file)} group by racer) b using (racer)
      where abs(b.points - a.points) >= ${Number(args.threshold)} order by abs(change) desc`);
    const list = moved.map((r) => `${r.racer} ${r.change > 0 ? "+" : ""}${r.change.toFixed(2)} (${r.base.toFixed(2)})`);
    console.log(`  ${v.name}: ${list.join(", ") || "nothing moves"}`);
  }
}
