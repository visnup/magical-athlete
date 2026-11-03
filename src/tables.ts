import { GOLD, MILD_MILE, mulberry32, NAMES, type Name, Race, type RaceResult, type Racer, type Rules, shuffle, SILVER, WILD_WILDS } from "./game.ts";
import { collect } from "./parallel.ts";
import RATINGS from "./ratings.json" with { type: "json" };
import { racerRows, type RacerRow, rowPoints } from "./results.ts";

/** Points `r` scored in `result`, if it was race `race` (0–3) of a game. */
export function points(result: RaceResult, r: Racer, race: number) {
  return +(result.finishers[0] === r.seat) * GOLD[race] + +(result.finishers[1] === r.seat) * SILVER[race] + r.bronze;
}

export const trackFor = (race: number) => [MILD_MILE, WILD_WILDS][race % 2];

export type Row = { points: number; first: number };

/** Options that can cross to a worker thread: plain data, no functions. */
export type Options = {
  n?: number;
  players?: number;
  rules?: Partial<Rules>;
  /** Ratings for racers that pick other racers (Twin, Egg, Mastermind, Copycat). */
  ratings?: Partial<Record<Name, number>>;
  /** Each earlier race's chance of 1st per racer, to draw earlier winners for Twin from. */
  earlier?: Partial<Record<Name, number>>[];
  /** Which batch of `n` races this is, so batches don't repeat each other's seeds. */
  batch?: number;
};

/** One earlier winner per earlier race, drawn by chance of 1st, none of them in `lineup`. */
export function winners(earlier: Partial<Record<Name, number>>[], lineup: Name[], rng: () => number) {
  const ws: Name[] = [];
  for (const odds of earlier) {
    const xs = Object.entries(odds).filter(([name]) => !lineup.includes(name as Name) && !ws.includes(name as Name));
    let x = rng() * xs.reduce((s, [, p]) => s + p!, 0);
    const w = xs.find(([, p]) => (x -= p!) <= 0);
    if (w) ws.push(w[0] as Name);
  }
  return ws;
}

/**
 * Earlier winners for a race that stands for either race on its track: races 1 and 3 on the Mild
 * Mile (0 or 2 earlier races), or 2 and 4 on the Wild Wilds (1 or 3), drawn by `ratings.json`'s
 * chances of 1st. So Twin averages over the races it could be in.
 */
function standalone(race: number, lineup: Name[], rng: () => number) {
  const k = race % 2 + 2 * Math.floor(rng() * 2);
  const first = RATINGS.first as Record<Name, number[]>;
  return winners([0, 1, 2].slice(0, k).map((i) => Object.fromEntries(NAMES.map((name) => [name, first[name][i]]))), lineup, rng);
}

function race(o: Options, race: number, racers: Name[], rng: () => number) {
  const ratings = o.ratings;
  return new Race({
    racers,
    track: trackFor(race),
    rng,
    rules: o.rules,
    policy: ratings ? { rating: (name) => ratings[name] ?? 0 } : undefined,
    winners: o.earlier ? winners(o.earlier, racers, rng) : racers.includes("Twin") ? standalone(race, racers, rng) : [],
  }).run();
}

export function tableTask(r: number, o: Options, seed: number, n: number) {
  const rng = mulberry32(seed + 1000 * (o.batch ?? 0));
  const players = o.players ?? 5;
  return Array.from({ length: n }, () => racerRows(race(o, r, shuffle([...NAMES], rng).slice(0, players), rng)));
}

/** A row per racer per race in race `r` (0–3), from random lineups. */
export const tableRows = (r: number, o: Options = {}) => collect<RacerRow>(import.meta.url, "tableTask", [r, o], o.n ?? 100000);

/** Each racer's average points and chance of 1st from `rows`, scored as race `r` (0–3). */
export function summarize(rows: Pick<RacerRow, "racer" | "gold" | "silver" | "bronze">[], r: number) {
  const sums = new Map(NAMES.map((name) => [name, [0, 0, 0]]));
  for (const row of rows) {
    const s = sums.get(row.racer as Name)!;
    s[0] += rowPoints(row, r);
    s[1] += row.gold;
    s[2]++;
  }
  return new Map<Name, Row>([...sums].map(([name, [p, f, k]]) => [name, { points: p / k, first: f / k }]));
}

/** Each racer's average points and chance of 1st in race `r` (0–3), from random lineups. */
export const table = async (r: number, o: Options = {}) => summarize(await tableRows(r, o), r);

export function forcedTask(name: Name, r: number, o: Options, seed: number, n: number) {
  const rng = mulberry32(seed);
  const others = NAMES.filter((x) => x !== name);
  return Array.from({ length: n }, () => {
    const result = race(o, r, shuffle([name, ...shuffle(others, rng).slice(0, (o.players ?? 5) - 1)], rng), rng);
    return racerRows(result).filter((x) => x.racer === name);
  });
}

/** `name`'s row in each race of race `r` (0–3), racing in every race. */
export const forcedRows = (name: Name, r: number, o: Options = {}) => collect<RacerRow>(import.meta.url, "forcedTask", [name, r, o], o.n ?? 100000);
