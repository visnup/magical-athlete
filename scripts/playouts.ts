import { parseArgs } from "node:util";
import { mulberry32, NAMES, type Name, type Policy, Race, type Racer, shuffle } from "../src/game.ts";
import { collect } from "../src/parallel.ts";
import { RACERS } from "../src/racers.ts";
import { racerRows, type RacerRow, rowPoints, write } from "../src/results.ts";
import { points, trackFor } from "../src/tables.ts";

/**
 * Each optional power decided by playing out every option to the end of the race, against its
 * hand-written choice (`choose` in racers.ts), with that racer in every race. Shows how much
 * better a choice can get than the current heuristic. Rerolls (Magician) and before-race picks
 * (Egg, Twin) aren't covered: they happen outside a turn's snapshot or outside `choose`.
 */
const options: Partial<Record<Name, (race: Race, me: Racer) => unknown[]>> = {
  "Alchemist": () => [true, false],
  "Cheerleader": () => [true, false],
  "Duelist": () => [true, false],
  "Flip Flop": (race, me) => [null, ...race.onTrack().filter((o) => o !== me)],
  "Genius": () => [1, 2, 3, 4, 5, 6],
  "Hypnotist": (race, me) => [null, ...race.onTrack().filter((o) => o.player !== me.player && o.pos !== me.pos)],
  "Legs": () => [true, false],
  "Mastermind": (race) => race.racers.map((r) => r.name),
  "Rocket Scientist": () => [true, false],
  "Suckerfish": () => [true, false],
  "Third Wheel": (race) => {
    const counts = new Map<number, number>();
    for (const o of race.onTrack()) counts.set(o.pos, (counts.get(o.pos) ?? 0) + 1);
    return [null, ...[...counts].filter(([, c]) => c === 2).map(([pos]) => pos)];
  },
};

/**
 * A policy where `name` decides by playouts, each option played `k` times. A decision repeats
 * within a turn when the board does: Suckerfish riding Scoocher around the Wild Wilds' 12–16 cycle
 * decides hundreds of times in one turn, and each playout replays every decision before it.
 */
function playing(name: Name, race: number, k: number): Partial<Policy> {
  const decided = new WeakMap<Race, Map<string, unknown>>();
  return {
    choose: {
      [name]: (r: Race, me: Racer, ...args: unknown[]) => {
        const fallback = () => RACERS[name].choose!(r, me, ...args);
        if (!r.snapshot) return fallback();
        const opts = options[name]!(r, me);
        if (opts.length < 2) return fallback();
        if (!decided.has(r)) decided.set(r, new Map());
        const key = [r.turns, r.racers.map((x) => x.pos), args.map((a) => (a && typeof a === "object" && "seat" in a ? `seat ${a.seat}` : a))].join("|");
        const memo = decided.get(r)!;
        if (memo.has(key)) return memo.get(key);
        let best = opts[0];
        let top = -Infinity;
        for (const o of opts) {
          const v = r.playout(me, name, o, k, (result, x) => points(result, x, race));
          if (v > top) [best, top] = [o, v];
        }
        memo.set(key, best);
        return best;
      },
    },
  };
}

export function playoutTask(name: Name, playouts: number, race: number, players: number, seed: number, n: number) {
  const rng = mulberry32(seed);
  const others = NAMES.filter((x) => x !== name);
  const policy = playouts ? playing(name, race, playouts) : undefined;
  return Array.from({ length: n }, () => {
    const racers = shuffle([name, ...shuffle(others, rng).slice(0, players - 1)], rng);
    return racerRows(new Race({ racers, track: trackFor(race), rng, policy, playouts: !!playouts }).run()).filter((r) => r.racer === name);
  });
}

if (import.meta.main) {
  const { values: args } = parseArgs({
    options: {
      n: { type: "string", default: "4000" },
      k: { type: "string", default: "20" },
      players: { type: "string", default: "5" },
      racer: { type: "string" },
    },
  });
  const n = Number(args.n);
  const k = Number(args.k);
  const players = Number(args.players);
  console.log(`${n} races of ${players} each, ${k} playouts per option:\n`);
  console.log("| racer | race | hand-written choice | by playouts | change |\n| --- | --- | --- | --- | --- |");
  const rows = [];
  for (const name of Object.keys(options) as Name[]) {
    if (args.racer && args.racer !== name) continue;
    for (const race of [0, 1]) {
      const run = async (playouts: number) => {
        const xs = await collect<RacerRow>(import.meta.url, "playoutTask", [name, playouts, race, players], n);
        for (const row of xs.map((r) => ({ game_race: race + 1, playouts, ...r }))) rows.push(row);
        return xs.reduce((s, r) => s + rowPoints(r, race), 0) / n;
      };
      const base = await run(0);
      const better = await run(k);
      console.log(`| ${name} | ${race + 1} | ${base.toFixed(2)} | ${better.toFixed(2)} | ${better - base >= 0 ? "+" : ""}${(better - base).toFixed(2)} |`);
    }
  }
  if (!args.racer) await write("playouts", rows);
}
