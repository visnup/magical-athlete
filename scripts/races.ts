import { parseArgs } from "node:util";
import { write } from "../src/results.ts";
import { tableRows } from "../src/tables.ts";

/**
 * The shared race dataset: random lineups of 3 to 6 racers on each track, a row per racer per race,
 * written to results/races-<track>-<players>p.parquet. Races 1 and 3 are on the Mild Mile and 2 and
 * 4 on the Wild Wilds; they differ only in chip values, so the readers score a row by race. Runs in
 * batches of `--batch` races to keep memory down.
 */
const { values: args } = parseArgs({ options: { n: { type: "string", default: "1000000" }, batch: { type: "string", default: "100000" } } });
const n = Number(args.n);
const size = Math.min(n, Number(args.batch));
for (const [r, track] of [[0, "mild"], [1, "wild"]] as const) {
  for (const players of [3, 4, 5, 6]) {
    await write(`races-${track}-${players}p`, (async function* () {
      for (let batch = 0; batch * size < n; batch++) {
        const rows = await tableRows(r, { n: Math.min(size, n - batch * size), players, batch });
        yield rows.map((row) => ({ ...row, race: row.race + batch * size }));
      }
    })());
  }
}
