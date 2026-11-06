import { parseArgs } from "node:util";
import { GOLD, mulberry32, NAMES, type Name, playGame, Race, shuffle, SILVER } from "../src/game.ts";
import { parallel } from "../src/parallel.ts";
import { trackFor } from "../src/tables.ts";

type Stats = { n: number; first: number; second: number; bronze: number; trips: number; uses: number; out: number; turns: number; score: number; wins: number };

/** Runs `n` races (or games) and tallies each racer; `emit` gets --csv and --log lines in order. */
export function simulate(mode: string, players: number, race: number, seed: number, n: number, emit?: { csv?: boolean; log?: boolean }) {
  const rng = mulberry32(seed);
  const track = trackFor(race);
  const stats = Object.fromEntries(
    NAMES.map((name) => [name, { n: 0, first: 0, second: 0, bronze: 0, trips: 0, uses: 0, out: 0, turns: 0, score: 0, wins: 0 }]),
  ) as Record<Name, Stats>;
  let loops = 0;
  let stalled = 0;
  for (let i = 0; i < n; i++) {
    if (mode === "race") {
      const r = new Race({ racers: shuffle([...NAMES], rng).slice(0, players), track, rng, first: 0, log: emit?.log });
      const result = r.run();
      if (emit?.log) console.log(r.log!.join("\n"));
      loops += result.loops;
      stalled += +result.stalled;
      for (const x of result.racers) {
        const s = stats[x.name];
        const first = +(result.finishers[0] === x.seat);
        const second = +(result.finishers[1] === x.seat);
        const points = first * GOLD[race] + second * SILVER[race] + x.bronze;
        s.n++;
        s.first += first;
        s.second += second;
        s.bronze += x.bronze;
        s.score += points;
        s.trips += x.trips;
        s.uses += x.uses;
        s.out += +(x.eliminated !== null);
        s.turns += x.turns;
        if (emit?.csv) {
          console.log([i, x.seat, x.name, x.place ?? "", x.pos, x.bronze, points, x.trips, x.uses, +(x.eliminated !== null), x.turns, +result.stalled].join(","));
        }
      }
    } else {
      const game = playGame({ players, rng, log: emit?.log });
      if (emit?.log) console.log(game.logs.flat().join("\n"));
      const top = Math.max(...game.scores);
      game.teams.forEach((team, seat) => {
        const won = +(game.scores[seat] === top);
        for (const name of team) {
          const s = stats[name];
          s.n++;
          s.score += game.scores[seat];
          s.wins += won;
        }
        if (emit?.csv) console.log([i, seat, team.join("|"), game.scores[seat], won].join(","));
      });
      for (const r of game.races) {
        loops += r.loops;
        stalled += +r.stalled;
      }
    }
  }
  return { stats, loops, stalled };
}

if (import.meta.main) {
  const { values: args } = parseArgs({
    options: {
      mode: { type: "string", default: "race" },
      n: { type: "string", default: "100000" },
      players: { type: "string", default: "5" },
      race: { type: "string", default: "1" },
      // Only for --csv and --log, which run on one core; otherwise each chunk has its own seed.
      seed: { type: "string", default: "1" },
      csv: { type: "boolean", default: false },
      log: { type: "boolean", default: false },
    },
  });
  const n = Number(args.n);
  const players = Number(args.players);
  const race = Number(args.race) - 1;
  if (args.csv || args.log) {
    if (args.csv) {
      console.log(args.mode === "race"
        ? "race,seat,racer,place,pos,bronze,points,trips,uses,eliminated,turns,stalled"
        : "game,seat,racers,score,won");
    }
    simulate(args.mode, players, race, Number(args.seed), n, { csv: args.csv, log: args.log });
  } else {
    const { stats, loops, stalled } = await parallel<ReturnType<typeof simulate>>(import.meta.url, "simulate", [args.mode, players, race], n);
    const pct = (x: number, d: number) => `${((100 * x) / d).toFixed(1)}%`.padStart(6);
    const avg = (x: number, d: number) => (x / d).toFixed(2).padStart(6);
    const rows = Object.entries(stats).filter(([, s]) => s.n);
    if (args.mode === "race") {
      console.log(`${n} races of ${players} on the ${trackFor(race).name}, scored as race ${race + 1} (${GOLD[race]}/${SILVER[race]}); an even share is ${avg((GOLD[race] + SILVER[race]) / players, 1)} points\n`);
      console.log(`${"racer".padEnd(17)}points   1st    2nd  bronze  trips   uses  out  turns`);
      for (const [name, s] of rows.sort(([, a], [, b]) => b.score / b.n - a.score / a.n)) {
        console.log(`${name.padEnd(17)}${avg(s.score, s.n)}${pct(s.first, s.n)} ${pct(s.second, s.n)} ${avg(s.bronze, s.n)} ${avg(s.trips, s.n)} ${avg(s.uses, s.n)} ${pct(s.out, s.n)} ${avg(s.turns, s.n)}`);
      }
    } else {
      console.log(`${n} games of ${players}; even odds of winning are ${pct(1, players)}\n`);
      console.log(`${"racer".padEnd(17)}   win  score`);
      for (const [name, s] of rows.sort(([, a], [, b]) => b.wins / b.n - a.wins / a.n)) {
        console.log(`${name.padEnd(17)}${pct(s.wins, s.n)} ${avg(s.score, s.n)}`);
      }
    }
    console.log(`\nloops cut short: ${loops}, stalled: ${stalled}`);
  }
}
