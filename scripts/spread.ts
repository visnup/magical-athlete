import { parseArgs } from "node:util";
import { GOLD, SILVER } from "../src/game.ts";
import { pointsSql, query, races } from "../src/results.ts";
import { trackFor } from "../src/tables.ts";

/**
 * How spread out each racer's points are in one race, not just the average: for picking a safe
 * racer when ahead or a swingy one when behind. From the 5-player race dataset; defaults to race 4.
 */
export const spreadSql = (race: number) => `
  select racer, avg(p) mean, stddev_pop(p) sd, avg((p <= 0)::int) zero,
    avg((p >= ${SILVER[race]})::int) silver, avg((p >= ${GOLD[race]})::int) gold
  from (select racer, ${pointsSql(race)} p from ${races(race)}) group by racer`;

if (import.meta.main) {
  const { values: args } = parseArgs({ options: { race: { type: "string", default: "4" } } });
  const race = Number(args.race) - 1;
  const pct = (x: number) => `${(100 * x).toFixed(0)}%`;
  console.log(`Race ${race + 1}, ${trackFor(race).name} (${GOLD[race]}/${SILVER[race]}):\n`);
  console.log("| racer | mean | sd | 0 points | at least silver | at least gold |");
  console.log("| --- | --- | --- | --- | --- | --- |");
  for (const r of await query(`${spreadSql(race)} order by sd desc`)) {
    console.log(`| ${r.racer} | ${r.mean.toFixed(2)} | ${r.sd.toFixed(2)} | ${pct(r.zero)} | ${pct(r.silver)} | ${pct(r.gold)} |`);
  }
}
