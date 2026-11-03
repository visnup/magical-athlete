import { parseArgs } from "node:util";
import { GOLD, SILVER } from "../src/game.ts";
import { pointsSql, query, races } from "../src/results.ts";
import { trackFor } from "../src/tables.ts";

/** Each racer's points per race from the race dataset, scored as race k: the headline table. */
const { values: args } = parseArgs({ options: { race: { type: "string", default: "1" }, players: { type: "string", default: "5" } } });
const race = Number(args.race) - 1;
const players = Number(args.players);
const rows = await query(`
  select racer, (select count(distinct race) from ${races(race, players)})::int races, avg(${pointsSql(race)}) points, avg(gold) first, avg(silver) "second", avg(bronze) bronze
  from ${races(race, players)} group by racer order by points desc`);
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
console.log(`Race ${race + 1}, ${trackFor(race).name} (${GOLD[race]}/${SILVER[race]}), ${rows[0].races} races of ${players} each; a fair share is ${((GOLD[race] + SILVER[race]) / players).toFixed(2)}:\n`);
console.log("| racer | points | 1st | 2nd | bronze |\n| --- | --- | --- | --- | --- |");
for (const r of rows) console.log(`| ${r.racer} | ${r.points.toFixed(2)} | ${pct(r.first)} | ${pct(r.second)} | ${r.bronze.toFixed(2)} |`);
