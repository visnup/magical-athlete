import { GOLD, SILVER } from "../src/game.ts";
import { playersSql, pointsSql, query, races } from "../src/results.ts";
import { raceTitle } from "../src/tables.ts";

/**
 * Each racer's points per race at 3 to 6 players from the race dataset, as a multiple of a fair
 * share, so counts compare directly. Prints a markdown table per track.
 */
const counts = [3, 4, 5, 6];
for (const race of [0, 1]) {
  const rows = await query(`
    pivot (
      select racer, ${playersSql} players, ${pointsSql(race)} * ${playersSql} / ${GOLD[race] + SILVER[race]} share
      from ${races(race, "*")}
    ) on players using avg(share) order by ${counts.map((c) => `"${c}"`).join(" + ")} desc`);
  console.log(`\n${raceTitle(race)}, points ÷ a fair share:\n`);
  console.log(`| racer | ${counts.map((c) => `${c}p`).join(" | ")} | 6p ÷ 3p |`);
  console.log(`| --- | ${counts.map(() => "---").join(" | ")} | --- |`);
  for (const r of rows) console.log(`| ${r.racer} | ${counts.map((c) => r[c].toFixed(2)).join(" | ")} | ${(r[6] / r[3]).toFixed(2)} |`);
}
