import { parseArgs } from "node:util";
import { assign, mulberry32, type Name, NAMES, playGame } from "./game.ts";
import { parallel } from "./parallel.ts";
import RATINGS from "./ratings.json" with { type: "json" };
import { spreadTask } from "./spread.ts";

/**
 * Choosing racers during a game, for one randomly seated player against opponents who play their
 * best race order:
 * - by score: with two racers left, save the safer one for race 4 when ahead, or the one likelier
 *   to win when behind;
 * - counter: draft M.O.U.T.H. once an opponent has Scoocher, and race it in Scoocher's race.
 */
type Stats = Record<Name, { zero: number; gold: number }>;

const planned = (hand: Name[], race: number) => hand[assign(hand, RATINGS.points, [0, 1, 2, 3].slice(race)).order.indexOf(race)];

const strategies: Record<string, (stats: Stats, me: number) => Parameters<typeof playGame>[0]> = {
  "best race order (as opponents do)": () => ({ players: 0 }),
  "by score in the last two races": (stats, me) => ({
    players: 0,
    choose: (p, hands, race, scores) => {
      if (p !== me || race !== 2) return undefined;
      const [a, b] = hands[p];
      const ahead = scores.every((s, q) => q === p || scores[p] >= s);
      const keep = ahead ? (stats[a].zero <= stats[b].zero ? a : b) : stats[a].gold >= stats[b].gold ? a : b;
      return keep === a ? b : a;
    },
  }),
  "counter Scoocher with M.O.U.T.H.": (_stats, me) => ({
    players: 0,
    pick: (p, row, teams) =>
      p === me && row.includes("M.O.U.T.H.") && teams.some((t, q) => q !== p && t.includes("Scoocher")) ? "M.O.U.T.H." : undefined,
    choose: (p, hands, race) => {
      if (p !== me || !hands[p].includes("M.O.U.T.H.")) return undefined;
      const rival = hands.findIndex((h, q) => q !== p && h.includes("Scoocher"));
      return rival >= 0 && planned(hands[rival], race) === "Scoocher" ? "M.O.U.T.H." : undefined;
    },
  }),
};

export function endgameTask(label: string, stats: Stats, players: number, seed: number, n: number) {
  const rng = mulberry32(seed);
  // wins, score, games where my M.O.U.T.H. met an opponent's Scoocher, my wins in those
  const sums = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    const me = Math.floor(rng() * players);
    const game = playGame({ ...strategies[label](stats, me), players, rng });
    const top = Math.max(...game.scores);
    const won = game.scores[me] === top ? 1 / game.scores.filter((s) => s === top).length : 0;
    sums[0] += won;
    sums[1] += game.scores[me];
    const met = game.teams[me].some((x, race) => x === "M.O.U.T.H." && game.teams.some((t, q) => q !== me && t[race] === "Scoocher"));
    sums[2] += +met;
    sums[3] += met ? won : 0;
  }
  return sums;
}

if (import.meta.main) {
  const { values: args } = parseArgs({
    options: { n: { type: "string", default: "100000" }, players: { type: "string", default: "5" } },
  });
  const n = Number(args.n);
  const players = Number(args.players);
  // Each racer's chance of 0 points and of at least gold in race 4.
  const sums = await parallel<Record<Name, number[]>>(new URL("./spread.ts", import.meta.url).href, "spreadTask", [3, players], 100000);
  const stats = Object.fromEntries(NAMES.map((name) => {
    const [k, , , zero, , gold] = sums[name];
    return [name, { zero: zero / k, gold: gold / k }];
  })) as Stats;
  console.log(`${n} games of ${players}; even odds of winning are ${(100 / players).toFixed(1)}%\n`);
  console.log("| my choices | wins | score | my M.O.U.T.H. met their Scoocher | wins then |\n| --- | --- | --- | --- | --- |");
  for (const label of Object.keys(strategies)) {
    const [wins, score, met, metWins] = await parallel<number[]>(import.meta.url, "endgameTask", [label, stats, players], n);
    const then = met ? `${((100 * metWins) / met).toFixed(1)}%` : "";
    console.log(`| ${label} | ${((100 * wins) / n).toFixed(1)}% | ${(score / n).toFixed(2)} | ${((100 * met) / n).toFixed(1)}% of games | ${then} |`);
  }
}
