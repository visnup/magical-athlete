import { parseArgs } from "node:util";
import { defaultPolicy, mulberry32, NAMES, type Name, type Policy, Race, type Racer, shuffle } from "../src/game.ts";
import { collect } from "../src/parallel.ts";
import { landing, pairs, RACERS, rolled, settle } from "../src/racers.ts";
import { parquet, pointsSql, query, racerRows, type RacerRow, slug, write } from "../src/results.ts";
import { trackFor } from "../src/tables.ts";

/**
 * Compares each optional power's current choice (`choose` in racers.ts) with alternatives, over the
 * same seeded races with that racer in every one.
 */
const farthest = (race: Race, me: Racer, gap: (o: Racer) => boolean) =>
  race.onTrack().filter((o) => o.player !== me.player && gap(o)).sort((a, b) => b.pos - a.pos)[0] ?? null;

const cheer = (race: Race, me: Racer) => {
  if (!race.last().includes(me)) return landing(race, me.pos + 1) >= me.pos;
  const star = race.track.spaces[me.pos + 2]?.star ? 3 : 0;
  return landing(race, settle(race, me.pos + 2) + 1) + star >= me.pos;
};

const variants: Partial<Record<Name, Record<string, Partial<Policy>>>> = {
  "Alchemist": {
    "always (previous)": { choose: { Alchemist: () => true } },
    never: { choose: { Alchemist: () => false } },
    "star worth 15 spaces": { choose: { Alchemist: (race, me, roll: number) => landing(race, me.pos + 4, 15) >= landing(race, me.pos + roll, 15) } },
  },
  "Cheerleader": {
    always: { choose: { Cheerleader: () => true } },
    never: { choose: { Cheerleader: () => false } },
    "one move of 3 when last (previous)": { choose: { Cheerleader: (race, me) => landing(race, (race.last().includes(me) ? me.pos + 2 : me.pos) + 1) >= me.pos } },
    "for an opponent's M.O.U.T.H. too (previous)": { choose: { Cheerleader: cheer } },
    "not for an opponent's M.O.U.T.H. only if it would eat": { choose: { Cheerleader: (race, me) => {
      const last = race.last();
      const [o] = last;
      if (last.length === 1 && o.player !== me.player && race.powers(o).includes("M.O.U.T.H.")) {
        const to = settle(race, o.pos + 2);
        if (race.onTrack().filter((x) => x !== o && x.pos === to).length === 1) return false;
      }
      return cheer(race, me);
    } } },
  },
  "Flip Flop": {
    "farthest 4+ ahead (previous)": { choose: { "Flip Flop": (race, me) => farthest(race, me, (o) => o.pos - me.pos >= 4 && !race.powers(o).includes("Copycat")) } },
    "2 or more ahead": { choose: { "Flip Flop": (race, me) => farthest(race, me, (o) => o.pos - me.pos >= 2 && !race.powers(o).includes("Copycat")) } },
    "6 or more ahead": { choose: { "Flip Flop": (race, me) => farthest(race, me, (o) => o.pos - me.pos >= 6 && !race.powers(o).includes("Copycat")) } },
    never: { choose: { "Flip Flop": () => null } },
    "never with a Copycat (previous)": { choose: { "Flip Flop": (race, me) => {
      const roll = rolled(race, me.pos, 15);
      const better = race.onTrack().filter((o) => o.pos !== me.pos && landing(race, o.pos, 15) > roll && !race.powers(o).includes("Copycat"));
      return better.sort((a, b) => landing(race, b.pos, 15) - landing(race, a.pos, 15))[0] ?? null;
    } } },
    ...Object.fromEntries([3, 6, 30].map((star) => [`star worth ${star} spaces${star === 3 ? " (previous)" : ""}`, { choose: { "Flip Flop": (race, me) => {
      const roll = rolled(race, me.pos, star);
      const better = race.onTrack().filter((o) => o !== me && o.pos !== me.pos && landing(race, o.pos, star) > roll);
      return better.sort((a, b) => landing(race, b.pos, star) - landing(race, a.pos, star))[0] ?? null;
    } } }])),
  },
  "Genius": {
    ...Object.fromEntries([1, 2, 3, 4, 5, 6].map((g) => [`guess ${g}${g === 6 ? " (previous)" : ""}`, { choose: { Genius: () => g } }])),
    "1 when in the top two, else 6": { choose: { Genius: (race, me) => (race.onTrack().filter((o) => o.pos > me.pos).length + race.finishers.length < 2 ? 1 : 6) } },
  },
  "Hypnotist": {
    "anyone ahead": { choose: { Hypnotist: (race, me) => farthest(race, me, (o) => o.pos > me.pos && !race.powers(o).includes("Copycat")) } },
    "7 or more ahead": { choose: { Hypnotist: (race, me) => farthest(race, me, (o) => o.pos - me.pos > 6) } },
    never: { choose: { Hypnotist: () => null } },
  },
  "Legs": {
    "always (previous)": { choose: { Legs: () => true } },
    never: { choose: { Legs: () => false } },
    "star worth 15 spaces": { choose: { Legs: (race, me) => landing(race, me.pos + 5, 15) >= rolled(race, me.pos, 15) } },
  },
  "Mastermind": {
    "best-rated racer (previous)": { choose: { Mastermind: (race: Race, me: Racer) => race.best([me.name, ...race.racers.map((o) => o.name)]) } },
  },
  "Magician": {
    "reroll 1–4, then 1–3 (previous)": { reroll: (race, r, roll, left) => (race.has(r, "Magician") ? roll <= (left >= 2 ? 4 : 3) : defaultPolicy.reroll(race, r, roll, left)) },
    "where it lands, star worth 3": {
      reroll: (race, r, roll, left) => (race.has(r, "Magician") ? landing(race, r.pos + roll) < rolled(race, r.pos) : defaultPolicy.reroll(race, r, roll, left)),
    },
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
    ...Object.fromEntries([0, 3, 9].map((k) => [k ? `not to within ${k} of the finish without crossing` : "even to just short of the finish (previous)", {
      choose: { "Rocket Scientist": (race: Race, me: Racer, roll: number) => {
        const left = race.track.length - (me.pos + 2 * roll);
        return landing(race, me.pos + 2 * roll) - 3.5 >= landing(race, me.pos + roll) && !(left > 0 && left <= k);
      } },
    }])),
    ...Object.fromEntries([2, 5].map((trip) => [`tripping costs ${trip} spaces`, {
      choose: { "Rocket Scientist": (race: Race, me: Racer, roll: number) => landing(race, me.pos + 2 * roll) - trip >= landing(race, me.pos + roll) },
    }])),
  },
  "Suckerfish": {
    "always ride": { choose: { Suckerfish: (_race, me, to: number) => to > me.pos } },
    never: { choose: { Suckerfish: () => false } },
  },
  "Third Wheel": {
    "nearest pair ahead": {
      choose: {
        "Third Wheel": (race, me) => {
          const ahead = pairs(race).filter((pos) => pos > me.pos);
          return ahead.length ? Math.min(...ahead) : null;
        },
      },
    },
    never: { choose: { "Third Wheel": () => null } },
  },
};


/** `name`'s row in every race, choosing by variant `label` (or as now). */
export function choiceTask(name: Name, label: string | null, race: number, players: number, seed: number, n: number) {
  const policy = label ? variants[name]![label] : undefined;
  const rng = mulberry32(seed);
  const others = NAMES.filter((x) => x !== name);
  return Array.from({ length: n }, () => {
    const racers = shuffle([name, ...shuffle(others, rng).slice(0, players - 1)], rng);
    return racerRows(new Race({ racers, track: trackFor(race), rng, policy }).run()).filter((r) => r.racer === name);
  });
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
  for (const [name, vs] of Object.entries(variants) as [Name, Record<string, Partial<Policy>>][]) {
    if (args.racer && args.racer !== name) continue;
    const rows = [];
    for (const race of [0, 1]) {
      for (const label of [null, ...Object.keys(vs)]) {
        const xs = await collect<RacerRow>(import.meta.url, "choiceTask", [name, label, race, players], n);
        for (const row of xs.map((r) => ({ game_race: race + 1, choice: label ?? "current", ...r }))) rows.push(row);
      }
    }
    const file = `choices-${slug(name)}`;
    await write(file, rows);
    console.log(`\n${name}${RACERS[name].choose ? "" : " (choice in Policy.reroll)"}:`);
    for (const race of [0, 1]) {
      const means = await query(`
        select choice, avg(p) points, stddev_pop(p) / sqrt(count(*)) se from (
          select choice, ${pointsSql(race)} p from ${parquet(file)} where game_race = ${race + 1}
        ) group by choice`);
      const base = means.find((m) => m.choice === "current")!;
      const cells = [`current ${base.points.toFixed(2)} ±${base.se.toFixed(2)}`];
      for (const label of Object.keys(vs)) {
        const m = means.find((x) => x.choice === label)!.points;
        cells.push(`${label} ${m.toFixed(2)} (${m >= base.points ? "+" : ""}${(m - base.points).toFixed(2)})`);
      }
      console.log(`  race ${race + 1}, ${trackFor(race).name}: ${cells.join(", ")}`);
    }
  }
}
