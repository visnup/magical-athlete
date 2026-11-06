import { mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { GOLD, type RaceResult, SILVER } from "./game.ts";

/** results/, where scripts write their raw data as Parquet. */
const dir = new URL("../results/", import.meta.url);
const path = (name: string) => fileURLToPath(new URL(`${name}.parquet`, dir));

/** One row per racer in a race: the raw data most scripts write, numbered by `collect`. */
export function racerRows(result: RaceResult) {
  return result.racers.map((x) => ({
    seat: x.seat,
    racer: x.name as string,
    gold: +(result.finishers[0] === x.seat),
    silver: +(result.finishers[1] === x.seat),
    bronze: x.bronze,
    pos: x.pos,
    trips: x.trips,
    uses: x.uses,
    eliminated: +(x.eliminated !== null),
    turns: x.turns,
    stalled: +result.stalled,
  }));
}

export type RacerRow = ReturnType<typeof racerRows>[number] & { race: number };

/** A racer row's points, scored as race `race` (0–3) of a game. */
export const rowPoints = (r: { gold: number; silver: number; bronze: number }, race: number) =>
  r.gold * GOLD[race] + r.silver * SILVER[race] + r.bronze;

type Value = string | number | null;

/** A racer's name as part of a file name: "M.O.U.T.H." is "m-o-u-t-h". */
export const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type Rows = Record<string, Value>[];

/**
 * Writes `rows`, or batches of them one at a time, to results/`name`.parquet with columns in the
 * first row's key order. Each batch goes to its own file first, then DuckDB joins them with zstd.
 */
export async function write(name: string, rows: Rows | AsyncIterable<Rows>) {
  const { parquetWriteFile } = await import("hyparquet-writer");
  mkdirSync(dir, { recursive: true });
  const parts: string[] = [];
  for await (const batch of Array.isArray(rows) ? [rows] : rows) {
    const columnData = Object.keys(batch[0]).map((column) => {
      const data = batch.map((r) => r[column] ?? null);
      const sample = data.find((x) => x !== null);
      const type = typeof sample === "string" ? "STRING" : data.every((x) => x === null || Number.isInteger(x)) ? "INT32" : "DOUBLE";
      return { name: column, data, type } as const;
    });
    parts.push(path(`${name}.${parts.length}.tmp`));
    parquetWriteFile({ filename: parts.at(-1)!, columnData });
  }
  await query(`copy (select * from read_parquet([${parts.map((p) => `'${p}'`).join(", ")}])) to '${path(name)}' (format parquet, compression zstd)`);
  for (const p of parts) rmSync(p);
}

/** SQL for results/`name`.parquet, which may be a glob; `filename` adds a column of each row's file. */
export const parquet = (name: string, filename = false) => `read_parquet('${path(name)}'${filename ? ", filename = true" : ""})`;

/** SQL for the race dataset `races.ts` writes, for race `race` (0–3)'s track and `players`. */
export const races = (race: number, players: number | "*" = 5) => parquet(`races-${["mild", "wild"][race % 2]}-${players}p`, players === "*");

/** SQL for the player count in a `filename` column, from names like races-mild-5p or games-3p-double. */
export const playersSql = `regexp_extract(filename, '(\\d)p(-double)?\\.parquet$', 1)::int`;

/** SQL for a row's points scored as race `race` (0–3), with an optional table alias. */
export const pointsSql = (race: number, t = "") => `(${t}gold * ${GOLD[race]} + ${t}silver * ${SILVER[race]} + ${t}bronze)`;

let connection: import("@duckdb/node-api").DuckDBConnection | undefined;

/** Runs `sql` in DuckDB and returns its rows as objects. */
export async function query<T = Record<string, any>>(sql: string): Promise<T[]> {
  if (!connection) {
    const { DuckDBInstance } = await import("@duckdb/node-api");
    connection = await (await DuckDBInstance.create()).connect();
  }
  return (await connection.runAndReadAll(sql)).getRowObjectsJson() as T[];
}
