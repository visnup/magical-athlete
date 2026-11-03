import { GOLD, MILD_MILE, mulberry32, NAMES, type Name, Race, type RaceResult, type Racer, type Rules, shuffle, SILVER, WILD_WILDS } from "./game.ts";
import { parallel } from "./parallel.ts";

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

function race(o: Options, race: number, racers: Name[], rng: () => number) {
  const ratings = o.ratings;
  return new Race({
    racers,
    track: trackFor(race),
    rng,
    rules: o.rules,
    policy: ratings ? { rating: (name) => ratings[name] ?? 0 } : undefined,
    winners: o.earlier ? winners(o.earlier, racers, rng) : [],
  }).run();
}

export function tableTask(r: number, o: Options, seed: number, n: number) {
  const rng = mulberry32(seed);
  const players = o.players ?? 5;
  const sums = Object.fromEntries(NAMES.map((name) => [name, [0, 0, 0]])) as Record<Name, number[]>;
  for (let i = 0; i < n; i++) {
    const result = race(o, r, shuffle([...NAMES], rng).slice(0, players), rng);
    for (const x of result.racers) {
      const s = sums[x.name];
      s[0] += points(result, x, r);
      s[1] += +(result.finishers[0] === x.seat);
      s[2]++;
    }
  }
  return sums;
}

/** Each racer's average points and chance of 1st in race `race` (0–3), from random lineups. */
export async function table(r: number, o: Options = {}) {
  const sums = await parallel<Record<Name, number[]>>(import.meta.url, "tableTask", [r, o], o.n ?? 100000);
  return new Map<Name, Row>(NAMES.map((name) => {
    const [p, f, k] = sums[name];
    return [name, { points: p / k, first: f / k }];
  }));
}

export function forcedTask(name: Name, r: number, o: Options, seed: number, n: number) {
  const rng = mulberry32(seed);
  const others = NAMES.filter((x) => x !== name);
  let total = 0;
  for (let i = 0; i < n; i++) {
    const result = race(o, r, shuffle([name, ...shuffle(others, rng).slice(0, (o.players ?? 5) - 1)], rng), rng);
    total += points(result, result.racers.find((x) => x.name === name)!, r);
  }
  return total;
}

/** `name`'s average points in race `race` (0–3), racing in every race. */
export async function forced(name: Name, r: number, o: Options = {}) {
  const n = o.n ?? 100000;
  return (await parallel<number>(import.meta.url, "forcedTask", [name, r, o], n)) / n;
}
