import { parseArgs } from "node:util";
import { defaultPolicy, mulberry32, NAMES, type Name, type Policy, Race, type Racer, shuffle } from "../src/game.ts";
import { parallel } from "../src/parallel.ts";
import { RACERS } from "../src/racers.ts";
import { points, trackFor } from "../src/tables.ts";

/**
 * Compares each optional power's current choice (`choose` in racers.ts) with alternatives, over the
 * same seeded races with that racer in every one.
 */
const farthest = (race: Race, me: Racer, gap: (o: Racer) => boolean) =>
  race.onTrack().filter((o) => o.player !== me.player && gap(o)).sort((a, b) => b.pos - a.pos)[0] ?? null;

const variants: Partial<Record<Name, Record<string, Partial<Policy>>>> = {
  "Alchemist": { "always (previous)": { choose: { Alchemist: () => true } }, never: { choose: { Alchemist: () => false } } },
  "Cheerleader": {
    always: { choose: { Cheerleader: () => true } },
    never: { choose: { Cheerleader: () => false } },
  },
  "Flip Flop": {
    "farthest 4+ ahead (previous)": { choose: { "Flip Flop": (race, me) => farthest(race, me, (o) => o.pos - me.pos >= 4 && !race.powers(o).includes("Copycat")) } },
    "2 or more ahead": { choose: { "Flip Flop": (race, me) => farthest(race, me, (o) => o.pos - me.pos >= 2 && !race.powers(o).includes("Copycat")) } },
    "6 or more ahead": { choose: { "Flip Flop": (race, me) => farthest(race, me, (o) => o.pos - me.pos >= 6 && !race.powers(o).includes("Copycat")) } },
    never: { choose: { "Flip Flop": () => null } },
  },
  "Genius": Object.fromEntries([1, 2, 3, 4, 5].map((g) => [`guess ${g}`, { choose: { Genius: () => g } }])),
  "Hypnotist": {
    "anyone ahead": { choose: { Hypnotist: (race, me) => farthest(race, me, (o) => o.pos > me.pos && !race.powers(o).includes("Copycat")) } },
    "7 or more ahead": { choose: { Hypnotist: (race, me) => farthest(race, me, (o) => o.pos - me.pos > 6) } },
    never: { choose: { Hypnotist: () => null } },
  },
  "Legs": { "always (previous)": { choose: { Legs: () => true } }, never: { choose: { Legs: () => false } } },
  "Magician": {
    "reroll 1–3": { reroll: (race, r, roll, left) => (race.has(r, "Magician") ? roll <= 3 : defaultPolicy.reroll(race, r, roll, left)) },
    "reroll 1–2": { reroll: (race, r, roll, left) => (race.has(r, "Magician") ? roll <= 2 : defaultPolicy.reroll(race, r, roll, left)) },
    "reroll 1–5, then 1–3": { reroll: (race, r, roll, left) => (race.has(r, "Magician") ? roll <= (left >= 2 ? 5 : 3) : defaultPolicy.reroll(race, r, roll, left)) },
  },
  "Rocket Scientist": {
    "4 or more (previous)": { choose: { "Rocket Scientist": (race, me, roll: number) => roll >= 4 || me.pos + 2 * roll >= race.track.length } },
    always: { choose: { "Rocket Scientist": () => true } },
    "3 or more": { choose: { "Rocket Scientist": (race, me, roll: number) => roll >= 3 || me.pos + 2 * roll >= race.track.length } },
    "5 or more": { choose: { "Rocket Scientist": (race, me, roll: number) => roll >= 5 || me.pos + 2 * roll >= race.track.length } },
    "only to finish": { choose: { "Rocket Scientist": (race, me, roll: number) => me.pos + 2 * roll >= race.track.length } },
  },
  "Suckerfish": {
    "always ride": { choose: { Suckerfish: (_race, me, to: number) => to > me.pos } },
    never: { choose: { Suckerfish: () => false } },
  },
  "Third Wheel": {
    "nearest pair ahead": {
      choose: {
        "Third Wheel": (race, me) => {
          const counts = new Map<number, number>();
          for (const o of race.onTrack()) counts.set(o.pos, (counts.get(o.pos) ?? 0) + 1);
          const pairs = [...counts].filter(([pos, c]) => c === 2 && pos > me.pos).map(([pos]) => pos);
          return pairs.length ? Math.min(...pairs) : null;
        },
      },
    },
    never: { choose: { "Third Wheel": () => null } },
  },
};


/** [points, points squared] for `name` in every race, choosing by variant `label` (or as now). */
export function choiceTask(name: Name, label: string | null, race: number, players: number, seed: number, n: number) {
  const policy = label ? variants[name]![label] : undefined;
  const rng = mulberry32(seed);
  const others = NAMES.filter((x) => x !== name);
  const sums = [0, 0];
  for (let i = 0; i < n; i++) {
    const racers = shuffle([name, ...shuffle(others, rng).slice(0, players - 1)], rng);
    const result = new Race({ racers, track: trackFor(race), rng, policy }).run();
    const p = points(result, result.racers.find((r) => r.name === name)!, race);
    sums[0] += p;
    sums[1] += p * p;
  }
  return sums;
}

if (import.meta.main) {
  const { values: args } = parseArgs({
    options: {
      n: { type: "string", default: "100000" },
      players: { type: "string", default: "5" },
      racer: { type: "string" },
    },
  });
  const n = Number(args.n);
  const players = Number(args.players);
  const mean = async (name: Name, label: string | null, race: number) => {
    const [sum, sq] = await parallel<number[]>(import.meta.url, "choiceTask", [name, label, race, players], n);
    return { mean: sum / n, se: Math.sqrt((sq / n - (sum / n) ** 2) / n) };
  };
  for (const [name, vs] of Object.entries(variants) as [Name, Record<string, Partial<Policy>>][]) {
    if (args.racer && args.racer !== name) continue;
    console.log(`\n${name}${RACERS[name].choose ? "" : " (choice in Policy.reroll)"}:`);
    for (const race of [0, 1]) {
      const base = await mean(name, null, race);
      const cells = [`current ${base.mean.toFixed(2)} ±${base.se.toFixed(2)}`];
      for (const label of Object.keys(vs)) {
        const { mean: m } = await mean(name, label, race);
        cells.push(`${label} ${m.toFixed(2)} (${m >= base.mean ? "+" : ""}${(m - base.mean).toFixed(2)})`);
      }
      console.log(`  race ${race + 1}, ${trackFor(race).name}: ${cells.join(", ")}`);
    }
  }
}
