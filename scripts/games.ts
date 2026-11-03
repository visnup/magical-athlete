import { parseArgs } from "node:util";
import { assign, mulberry32, playGame } from "../src/game.ts";
import { collect } from "../src/parallel.ts";
import { parquet, query, write } from "../src/results.ts";

/**
 * Whole games, drafted by rating and played in each team's best race order: what each draft
 * position is worth, and how well a team's estimated value (`ratings.json`) predicts its score.
 * Writes a row per player per game to results/games-<players>p[-double].parquet.
 */
export function gamesTask(players: number, double: boolean, seed: number, n: number) {
  const rng = mulberry32(seed);
  const races = [0, 1, 2, 3].flatMap((race) => (double ? [race, race] : [race]));
  return Array.from({ length: n }, () => {
    const game = playGame({ players, double, rng });
    const top = Math.max(...game.scores);
    return game.scores.map((score, player) => ({
      player,
      pick: game.drafters.indexOf(player) + 1,
      team: game.teams[player].join("|"),
      estimate: assign(game.teams[player], undefined, races).value,
      score,
      won: score === top ? 1 / game.scores.filter((s) => s === top).length : 0,
    }));
  });
}

if (import.meta.main) {
  const { values: args } = parseArgs({
    options: {
      n: { type: "string", default: "100000" },
      players: { type: "string", default: "5" },
      double: { type: "boolean", default: false },
    },
  });
  const n = Number(args.n);
  const players = Number(args.players);
  const file = `games-${players}p${args.double ? "-double" : ""}`;
  await write(file, await collect(import.meta.url, "gamesTask", [players, args.double], n, "game"));
  const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
  console.log(`${n} games of ${players}${args.double ? ", two racers each" : ""}; even odds of winning are ${(100 / players).toFixed(1)}%\n`);
  console.log("| first-round pick | score | wins |\n| --- | --- | --- |");
  for (const r of await query(`select pick, avg(score) score, avg(won) won from ${parquet(file)} group by pick order by pick`)) {
    console.log(`| ${r.pick} | ${r.score.toFixed(2)} | ${pct(r.won)} |`);
  }
  console.log("\n| team's estimated rank | wins |\n| --- | --- |");
  const ranked = `select *, row_number() over (partition by game order by estimate desc) rank from ${parquet(file)}`;
  for (const r of await query(`select rank::int rank, avg(won) won from (${ranked}) group by rank order by rank`)) console.log(`| ${r.rank} | ${pct(r.won)} |`);
  const [fit] = await query(`select avg(estimate) estimate, avg(score) score, corr(estimate, score) r from ${parquet(file)}`);
  console.log(`\nEstimated team value averages ${fit.estimate.toFixed(2)}, actual score ${fit.score.toFixed(2)}; correlation ${fit.r.toFixed(2)}.`);
}
