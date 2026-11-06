import { parseArgs } from "node:util";
import { pointsSql, query, races } from "../src/results.ts";
import { raceTitle } from "../src/tables.ts";

/**
 * How each racer's points per race change when another racer is in the race, against when it
 * isn't, from the 5-player race dataset. Prints the biggest effects per track.
 */
export const matchupsSql = (race: number) => `
  with r as (select race, racer, ${pointsSql(race)} p from ${races(race)}),
  overall as (select racer, sum(p) s, count(*) k from r group by racer)
  select a.racer, b.racer other, count(*)::int races_with, avg(a.p) "with",
    (any_value(o.s) - sum(a.p)) / (any_value(o.k) - count(*)) "without"
  from r a join r b on a.race = b.race and a.racer <> b.racer join overall o on o.racer = a.racer
  group by a.racer, b.racer`;

if (import.meta.main) {
  const { values: args } = parseArgs({ options: { top: { type: "string", default: "15" } } });
  for (const race of [0, 1]) {
    const rows = await query(`select *, "with" - "without" effect from (${matchupsSql(race)})`);
    const show = (title: string, xs: typeof rows) => {
      console.log(`\n${title}\n\n| racer | with | points with | without | effect |\n| --- | --- | --- | --- | --- |`);
      for (const r of xs) console.log(`| ${r.racer} | ${r.other} | ${r.with.toFixed(2)} | ${r.without.toFixed(2)} | ${r.effect > 0 ? "+" : ""}${r.effect.toFixed(2)} |`);
    };
    const top = Number(args.top);
    console.log(`\n## ${raceTitle(race)}`);
    show("Helped most by", rows.toSorted((a, b) => b.effect - a.effect).slice(0, top));
    show("Hurt most by", rows.toSorted((a, b) => a.effect - b.effect).slice(0, top));
  }
}
