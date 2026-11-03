import { parseArgs } from "node:util";
import { GOLD, MILD_MILE, mulberry32, NAMES, Race, shuffle, SILVER, WILD_WILDS } from "./game.ts";

/**
 * How each racer's points per race change when another racer is in the race, against when it
 * isn't. Prints the biggest effects per track, or every pair with --csv.
 */
const { values: args } = parseArgs({
  options: {
    n: { type: "string", default: "1000000" },
    players: { type: "string", default: "5" },
    top: { type: "string", default: "15" },
    csv: { type: "boolean", default: false },
  },
});
const n = Number(args.n);
const players = Number(args.players);
const k = NAMES.length;

if (args.csv) console.log("track,racer,other,with,without,effect,races_with");
for (const race of [0, 1]) {
  const track = [MILD_MILE, WILD_WILDS][race];
  const rng = mulberry32(1);
  // [racer][other] = [points, races] while together
  const together = NAMES.map(() => NAMES.map(() => [0, 0]));
  const alone = NAMES.map(() => [0, 0]);
  const index = new Map(NAMES.map((name, i) => [name, i]));
  for (let i = 0; i < n; i++) {
    const result = new Race({ racers: shuffle([...NAMES], rng).slice(0, players), track, rng }).run();
    const ids = result.racers.map((r) => index.get(r.name)!);
    for (const r of result.racers) {
      const a = index.get(r.name)!;
      const p = +(result.finishers[0] === r.seat) * GOLD[race] + +(result.finishers[1] === r.seat) * SILVER[race] + r.bronze;
      alone[a][0] += p;
      alone[a][1]++;
      for (const b of ids) {
        if (b === a) continue;
        together[a][b][0] += p;
        together[a][b][1]++;
      }
    }
  }
  const rows = [];
  for (let a = 0; a < k; a++) {
    for (let b = 0; b < k; b++) {
      if (a === b) continue;
      const [tp, tn] = together[a][b];
      const withB = tp / tn;
      const without = (alone[a][0] - tp) / (alone[a][1] - tn);
      rows.push({ racer: NAMES[a], other: NAMES[b], withB, without, effect: withB - without, tn });
    }
  }
  if (args.csv) {
    for (const r of rows) console.log([track.name, r.racer, r.other, r.withB.toFixed(3), r.without.toFixed(3), r.effect.toFixed(3), r.tn].join(","));
    continue;
  }
  const show = (title: string, xs: typeof rows) => {
    console.log(`\n${title}\n\n| racer | with | points with | without | effect |\n| --- | --- | --- | --- | --- |`);
    for (const r of xs) console.log(`| ${r.racer} | ${r.other} | ${r.withB.toFixed(2)} | ${r.without.toFixed(2)} | ${r.effect > 0 ? "+" : ""}${r.effect.toFixed(2)} |`);
  };
  const top = Number(args.top);
  console.log(`\n## Race ${race + 1}, ${track.name} (${GOLD[race]}/${SILVER[race]}), ${n} races of ${players}`);
  show("Helped most by", [...rows].sort((a, b) => b.effect - a.effect).slice(0, top));
  show("Hurt most by", [...rows].sort((a, b) => a.effect - b.effect).slice(0, top));
}
