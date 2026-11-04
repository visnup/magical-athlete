import { parseArgs } from "node:util";
import { mulberry32, NAMES, type Name, Race, type Racer, shuffle } from "../src/game.ts";
import { collect } from "../src/parallel.ts";
import { RACERS } from "../src/racers.ts";
import { points, trackFor } from "../src/tables.ts";
import { options } from "./playouts.ts";

/**
 * Logs every decision one racer's optional power makes against playouts, then lists the kinds of
 * decision where playouts clearly beat the hand-written choice: a pattern there is a candidate for
 * `choices.ts`. Picking the best of several noisy estimates overstates it, so a disagreement only
 * counts if it survives 10 times the playouts on just the two options.
 */
type Decision = { me: number; place: number; last: string; args: string[]; hand: string; best: string; gain: number };

/** An option as a kind of choice: a racer by its power and where it is, anything else as itself. */
function kind(x: unknown, me: Racer) {
  if (!(x && typeof x === "object" && "seat" in x)) return String(x);
  const o = x as Racer;
  return `${o.name} ${o.pos > me.pos ? "ahead" : o.pos < me.pos ? "behind" : "on my space"}`;
}

export function decisionsTask(name: Name, race: number, players: number, k: number, margin: number, seed: number, n: number) {
  const rng = mulberry32(seed);
  const others = NAMES.filter((x) => x !== name);
  return Array.from({ length: n }, () => {
    const decisions: Decision[] = [];
    const policy = {
      choose: {
        [name]: (r: Race, me: Racer, ...args: unknown[]) => {
          const hand = RACERS[name].choose!(r, me, ...args);
          const opts = options[name]!(r, me);
          if (!r.snapshot || opts.length < 2) return hand;
          const value = (o: unknown, k: number) => r.playout(me, name, o, k, (result, x) => points(result, x, race));
          const values = opts.map((o) => value(o, k));
          const i = values.indexOf(Math.max(...values));
          const h = Math.max(0, opts.findIndex((o) => o === hand || (o && hand && typeof o === "object" && (o as Racer).seat === (hand as Racer).seat)));
          let gain = 0;
          if (i !== h && values[i] - values[h] >= margin) gain = value(opts[i], 10 * k) - value(opts[h], 10 * k);
          const ahead = r.onTrack().filter((o) => o.pos > me.pos).length + r.finishers.length;
          const last = r.last().map((o) => (o === me ? "me" : o.name)).sort().join("+");
          decisions.push({ me: me.pos, place: ahead + 1, last, args: args.map((a) => kind(a, me)), hand: kind(opts[h], me), best: kind(opts[i], me), gain });
          return hand;
        },
      },
    };
    const racers = shuffle([name, ...shuffle(others, rng).slice(0, players - 1)], rng);
    new Race({ racers, track: trackFor(race), rng, policy, playouts: true }).run();
    return decisions;
  });
}

if (import.meta.main) {
  const { values: args } = parseArgs({
    options: {
      racer: { type: "string" },
      race: { type: "string", default: "2" },
      n: { type: "string", default: "2000" },
      k: { type: "string", default: "40" },
      players: { type: "string", default: "5" },
      margin: { type: "string", default: "1" },
    },
  });
  const name = args.racer as Name;
  if (!options[name]) throw new Error(`--racer is one of ${Object.keys(options).join(", ")}`);
  const race = Number(args.race) - 1;
  const margin = Number(args.margin);
  const decisions = await collect<Decision>(import.meta.url, "decisionsTask", [name, race, Number(args.players), Number(args.k), margin], Number(args.n));
  const confirmed = decisions.filter((d) => d.gain >= margin / 2);
  const total = confirmed.reduce((s, d) => s + d.gain, 0) / Number(args.n);
  console.log(`${name}, race ${race + 1}: ${decisions.length} decisions, ${confirmed.length} where playouts confirmably beat the rule, worth ${total.toFixed(2)} points a race:\n`);
  const show = (title: string, key: (d: Decision) => string) => {
    const tally = new Map<string, { n: number; gain: number }>();
    for (const d of confirmed) {
      const t = tally.get(key(d)) ?? { n: 0, gain: 0 };
      t.n++;
      t.gain += d.gain;
      tally.set(key(d), t);
    }
    console.log(`${title}:`);
    for (const [k, t] of [...tally].sort((a, b) => b[1].gain - a[1].gain).slice(0, 15)) console.log(`${String(t.n).padStart(5)}  ${(t.gain / Number(args.n)).toFixed(3)}/race  ${k}`);
    console.log();
  };
  const where = (s: string) => s.replace(/^.* (ahead|behind|on my space)$/, "a racer $1");
  show("rule → playouts", (d) => `${where(d.hand)} → ${where(d.best)}`);
  show("playouts' choice", (d) => d.best);
  const passes = (s: string) => s === "null" || s === "false";
  show("by position and place", (d) => `${passes(d.hand) ? "rule passes" : "rule acts"}, playouts ${passes(d.best) ? "pass" : "act"} | from ${d.me}, place ${d.place}${d.args.length ? ` | ${d.args.join(", ")}` : ""}`);
  show("by who's in last", (d) => `${passes(d.hand) ? "rule passes" : "rule acts"}, playouts ${passes(d.best) ? "pass" : "act"} | last: ${d.last.includes("+") ? `${d.last.split("+").length} racers${d.last.includes("me") ? " with me" : ""}` : d.last}`);
}
