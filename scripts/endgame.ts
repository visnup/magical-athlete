import { parseArgs } from "node:util";
import { assign, mulberry32, type Name, playGame } from "../src/game.ts";
import { collect } from "../src/parallel.ts";
import RATINGS from "../src/ratings.json" with { type: "json" };
import { parquet, query, write } from "../src/results.ts";
import { gameRows } from "./draft.ts";
import { spreadSql } from "./spread.ts";

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
  return Array.from({ length: n }, () => {
    const me = Math.floor(rng() * players);
    const game = playGame({ ...strategies[label](stats, me), players, rng });
    // games where my M.O.U.T.H. raced an opponent's Scoocher
    const met = game.teams[me].some((x, race) => x === "M.O.U.T.H." && game.teams.some((t, q) => q !== me && t[race] === "Scoocher"));
    return gameRows(game, me).map((r) => ({ ...r, met: +(r.me && met) }));
  });
}

if (import.meta.main) {
  const { values: args } = parseArgs({
    options: { n: { type: "string", default: "100000" }, players: { type: "string", default: "5" } },
  });
  const n = Number(args.n);
  const players = Number(args.players);
  // Each racer's chance of 0 points and of at least gold in race 4.
  const stats = Object.fromEntries((await query(spreadSql(3))).map((r) => [r.racer, { zero: r.zero, gold: r.gold }])) as Stats;
  const rows = [];
  for (const label of Object.keys(strategies)) {
    for (const row of (await collect(import.meta.url, "endgameTask", [label, stats, players], n, "game")).map((r) => ({ strategy: label, ...r }))) rows.push(row);
  }
  const file = `endgame-${players}p`;
  await write(file, rows);
  console.log(`${n} games of ${players}; even odds of winning are ${(100 / players).toFixed(1)}%\n`);
  console.log("| my choices | wins | score | my M.O.U.T.H. met their Scoocher | wins then |\n| --- | --- | --- | --- | --- |");
  const means = await query(`
    select strategy, avg(won) won, avg(score) score, avg(met) met, sum(won * met) / nullif(sum(met), 0) won_met
    from ${parquet(file)} where me = 1 group by strategy`);
  for (const r of Object.keys(strategies).map((label) => means.find((m) => m.strategy === label)!)) {
    console.log(`| ${r.strategy} | ${(100 * r.won).toFixed(1)}% | ${r.score.toFixed(2)} | ${(100 * r.met).toFixed(1)}% of games | ${r.won_met === null ? "" : `${(100 * r.won_met).toFixed(1)}%`} |`);
  }
}
