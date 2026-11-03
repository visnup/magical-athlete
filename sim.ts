import { parseArgs } from "node:util";
import { GOLD, mulberry32, NAMES, type Name, playGame, Race, shuffle, SILVER } from "./game.ts";

const { values: args } = parseArgs({
  options: {
    mode: { type: "string", default: "race" },
    n: { type: "string", default: "100000" },
    players: { type: "string", default: "5" },
    race: { type: "string", default: "1" },
    seed: { type: "string", default: "1" },
    csv: { type: "boolean", default: false },
    log: { type: "boolean", default: false },
  },
});
const n = Number(args.n);
const players = Number(args.players);
const rng = mulberry32(Number(args.seed));
const gold = GOLD[Number(args.race) - 1];
const silver = SILVER[Number(args.race) - 1];

type Stats = { n: number; first: number; second: number; bronze: number; trips: number; uses: number; out: number; turns: number; score: number; wins: number };
const stats = new Map<Name, Stats>(
  NAMES.map((name) => [name, { n: 0, first: 0, second: 0, bronze: 0, trips: 0, uses: 0, out: 0, turns: 0, score: 0, wins: 0 }]),
);
let loops = 0;
let stalled = 0;

if (args.csv) {
  console.log(args.mode === "race"
    ? "race,seat,racer,place,pos,bronze,points,trips,uses,eliminated,turns,stalled"
    : "game,seat,racers,score,won");
}

for (let i = 0; i < n; i++) {
  if (args.mode === "race") {
    const race = new Race({ racers: shuffle([...NAMES], rng).slice(0, players), rng, first: 0, log: args.log });
    const result = race.run();
    if (args.log) console.log(race.log!.join("\n"));
    loops += result.loops;
    stalled += +result.stalled;
    for (const r of result.racers) {
      const s = stats.get(r.name)!;
      const first = +(result.finishers[0] === r.seat);
      const second = +(result.finishers[1] === r.seat);
      const points = first * gold + second * silver + r.bronze;
      s.n++;
      s.first += first;
      s.second += second;
      s.bronze += r.bronze;
      s.score += points;
      s.trips += r.trips;
      s.uses += r.uses;
      s.out += +(r.eliminated !== null);
      s.turns += r.turns;
      if (args.csv) {
        console.log([i, r.seat, r.name, r.place ?? "", r.pos, r.bronze, points, r.trips, r.uses, +(r.eliminated !== null), r.turns, +result.stalled].join(","));
      }
    }
  } else {
    const game = playGame({ players, rng });
    const top = Math.max(...game.scores);
    game.teams.forEach((team, seat) => {
      const won = +(game.scores[seat] === top);
      for (const name of team) {
        const s = stats.get(name)!;
        s.n++;
        s.score += game.scores[seat];
        s.wins += won;
      }
      if (args.csv) console.log([i, seat, team.join("|"), game.scores[seat], won].join(","));
    });
    for (const r of game.races) {
      loops += r.loops;
      stalled += +r.stalled;
    }
  }
}

if (!args.csv && !args.log) {
  const pct = (x: number, d: number) => `${((100 * x) / d).toFixed(1)}%`.padStart(6);
  const avg = (x: number, d: number) => (x / d).toFixed(2).padStart(6);
  const rows = [...stats].filter(([, s]) => s.n);
  if (args.mode === "race") {
    console.log(`${n} races of ${players}, scored as race ${args.race} (${gold}/${silver}); an even share is ${avg((gold + silver) / players, 1)} points\n`);
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
