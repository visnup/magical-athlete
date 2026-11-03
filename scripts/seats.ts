import { GOLD, SILVER } from "../src/game.ts";
import { pointsSql, query, races } from "../src/results.ts";
import { trackFor } from "../src/tables.ts";

/** What each seat in turn order is worth, the first player's especially, at 3 to 6 players. */
for (const race of [0, 1]) {
  const rows = await query(`
    select regexp_extract(filename, '(\\d)p\\.parquet$', 1)::int players, seat, avg(${pointsSql(race)}) points
    from ${races(race, "*")} group by all order by players, seat`);
  console.log(`\nRace ${race + 1}, ${trackFor(race).name} (${GOLD[race]}/${SILVER[race]}); points by seat, 1st going first:\n`);
  console.log("| players | " + [1, 2, 3, 4, 5, 6].map((s) => `seat ${s}`).join(" | ") + " | 1st seat − average |");
  console.log("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const players of [3, 4, 5, 6]) {
    const per = rows.filter((r) => r.players === players).map((r) => r.points);
    const mean = per.reduce((s, p) => s + p, 0) / players;
    const cells = [0, 1, 2, 3, 4, 5].map((s) => per[s]?.toFixed(2) ?? "");
    console.log(`| ${players} | ${cells.join(" | ")} | ${per[0] - mean >= 0 ? "+" : ""}${(per[0] - mean).toFixed(2)} |`);
  }
}
