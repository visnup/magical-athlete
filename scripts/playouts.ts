import { parseArgs } from "node:util";
import { mulberry32, NAMES, type Name, type Policy, Race, type Racer, shuffle } from "../src/game.ts";
import { parallel } from "../src/parallel.ts";
import { RACERS } from "../src/racers.ts";
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

/** A policy where `name` decides by playouts, each option played `k` times. */
function playing(name: Name, race: number, k: number): Partial<Policy> {
  return {
    choose: {
      [name]: (r: Race, me: Racer, ...args: unknown[]) => {
        const fallback = () => RACERS[name].choose!(r, me, ...args);
        if (!r.snapshot) return fallback();
        const opts = options[name]!(r, me);
        if (opts.length < 2) return fallback();
        let best = opts[0];
        let top = -Infinity;
        for (const o of opts) {
          const v = r.playout(me, name, o, k, (result, x) => points(result, x, race));
          if (v > top) [best, top] = [o, v];
        }
        return best;
      },
    },
  };
}

export function playoutTask(name: Name, playouts: number, race: number, players: number, seed: number, n: number) {
  const rng = mulberry32(seed);
  const others = NAMES.filter((x) => x !== name);
  const policy = playouts ? playing(name, race, playouts) : undefined;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const racers = shuffle([name, ...shuffle(others, rng).slice(0, players - 1)], rng);
    const result = new Race({ racers, track: trackFor(race), rng, policy, playouts: !!playouts }).run();
    total += points(result, result.racers.find((r) => r.name === name)!, race);
  }
  return total;
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
  for (const name of Object.keys(options) as Name[]) {
    if (args.racer && args.racer !== name) continue;
    for (const race of [0, 1]) {
      const base = (await parallel<number>(import.meta.url, "playoutTask", [name, 0, race, players], n)) / n;
      const better = (await parallel<number>(import.meta.url, "playoutTask", [name, k, race, players], n)) / n;
      console.log(`| ${name} | ${race + 1} | ${base.toFixed(2)} | ${better.toFixed(2)} | ${better - base >= 0 ? "+" : ""}${(better - base).toFixed(2)} |`);
    }
  }
}
