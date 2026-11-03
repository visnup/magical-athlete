import { parseArgs } from "node:util";
import { assign, mulberry32, type Name, playGame } from "../src/game.ts";
import { collect } from "../src/parallel.ts";
import RATINGS from "../src/ratings.json" with { type: "json" };
import { parquet, query, write } from "../src/results.ts";

/**
 * Drafting strategies for one player, against opponents who take the highest-rated racer left.
 * The test player's seat is random each game, so its win rate compares with 1 / players.
 */
type Pick = (row: Name[], mine: Name[], others: Name[][]) => Name;

const average = [0, 1, 2, 3].map((race) => {
  const ps = Object.values(RATINGS.points);
  return ps.reduce((s, p) => s + p[race], 0) / ps.length;
});
const points = { ...RATINGS.points, "": average } as Record<Name, number[]>;

/** How much a racer adds to a team's best race order, filling missing racers with average ones. */
function gain(team: Name[], x: Name) {
  if (team.length >= 4) return 0;
  const fill = (t: Name[]) => [...t, ...Array(4 - t.length).fill("" as Name)];
  return assign(fill([...team, x]), points).value - assign(fill(team), points).value;
}

const strategies: Record<string, Pick> = {
  "highest rating (as opponents do)": (row) => row.reduce((a, b) => (RATINGS.draft[b] > RATINGS.draft[a] ? b : a)),
  "most added to my best race order": (row, mine) => row.reduce((a, b) => (gain(mine, b) > gain(mine, a) ? b : a)),
  "deny: my gain plus the most it adds to an opponent": (row, mine, others) => {
    const score = (x: Name) => gain(mine, x) + Math.max(...others.map((t) => gain(t, x)));
    return row.reduce((a, b) => (score(b) > score(a) ? b : a));
  },
};

export function draftTask(label: string, players: number, seed: number, n: number) {
  const rng = mulberry32(seed);
  const strategy = strategies[label];
  return Array.from({ length: n }, () => {
    const me = Math.floor(rng() * players);
    const game = playGame({
      players,
      rng,
      pick: (p, row, teams) => (p === me ? strategy(row, teams[p], teams.filter((_, q) => q !== p)) : undefined),
    });
    return gameRows(game, me);
  });
}

/** A row per player in `game`, marking the test player `me`. */
export function gameRows(game: ReturnType<typeof playGame>, me: number) {
  const top = Math.max(...game.scores);
  return game.scores.map((score, player) => ({
    player,
    me: +(player === me),
    pick: game.drafters.indexOf(player) + 1,
    team: game.teams[player].join("|"),
    score,
    won: score === top ? 1 / game.scores.filter((s) => s === top).length : 0,
  }));
}

if (import.meta.main) {
  const { values: args } = parseArgs({
    options: { n: { type: "string", default: "100000" }, players: { type: "string", default: "5" } },
  });
  const n = Number(args.n);
  const players = Number(args.players);
  const rows = [];
  for (const label of Object.keys(strategies)) {
    for (const row of (await collect(import.meta.url, "draftTask", [label, players], n, "game")).map((r) => ({ strategy: label, ...r }))) rows.push(row);
  }
  const file = `draft-${players}p`;
  await write(file, rows);
  console.log(`${n} games of ${players}; even odds of winning are ${(100 / players).toFixed(1)}%\n`);
  console.log("| my draft | wins | score |\n| --- | --- | --- |");
  const means = await query(`select strategy, avg(won) won, avg(score) score from ${parquet(file)} where me = 1 group by strategy`);
  for (const r of Object.keys(strategies).map((label) => means.find((m) => m.strategy === label)!)) {
    console.log(`| ${r.strategy} | ${(100 * r.won).toFixed(1)}% | ${r.score.toFixed(2)} |`);
  }
}
