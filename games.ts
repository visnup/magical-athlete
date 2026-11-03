import { parseArgs } from "node:util";
import { assign, mulberry32, playGame } from "./game.ts";
import { parallel } from "./parallel.ts";

/**
 * Whole games, drafted by rating and played in each team's best race order: what each draft
 * position is worth, and how well a team's estimated value (`ratings.json`) predicts its score.
 */
export function gamesTask(players: number, double: boolean, seed: number, n: number) {
  const rng = mulberry32(seed);
  // per draft position: [score, wins]; per estimate rank: [wins]; and sums for the correlation
  const byPick = Array.from({ length: players }, () => [0, 0]);
  const byRank = Array(players).fill(0);
  const fit = [0, 0, 0, 0, 0, 0]; // n, Σx, Σy, Σxx, Σyy, Σxy
  for (let i = 0; i < n; i++) {
    const game = playGame({ players, double, rng });
    const top = Math.max(...game.scores);
    const wins = game.scores.map((s) => (s === top ? 1 / game.scores.filter((t) => t === top).length : 0));
    game.drafters.forEach((p, pick) => {
      byPick[pick][0] += game.scores[p];
      byPick[pick][1] += wins[p];
    });
    const races = [0, 1, 2, 3].flatMap((race) => (double ? [race, race] : [race]));
    const estimates = game.teams.map((t) => assign(t, undefined, races).value);
    const ranked = estimates.map((_, p) => p).sort((a, b) => estimates[b] - estimates[a]);
    ranked.forEach((p, rank) => (byRank[rank] += wins[p]));
    estimates.forEach((x, p) => {
      const y = game.scores[p];
      fit[0]++;
      fit[1] += x;
      fit[2] += y;
      fit[3] += x * x;
      fit[4] += y * y;
      fit[5] += x * y;
    });
  }
  return { byPick, byRank, fit };
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
  const { byPick, byRank, fit } = await parallel<ReturnType<typeof gamesTask>>(import.meta.url, "gamesTask", [players, args.double], n);
  const pct = (x: number) => `${((100 * x) / n).toFixed(1)}%`;
  console.log(`${n} games of ${players}${args.double ? ", two racers each" : ""}; even odds of winning are ${(100 / players).toFixed(1)}%\n`);
  console.log("| first-round pick | score | wins |\n| --- | --- | --- |");
  byPick.forEach(([s, w], i) => console.log(`| ${i + 1} | ${(s / n).toFixed(2)} | ${pct(w)} |`));
  console.log("\n| team's estimated rank | wins |\n| --- | --- |");
  byRank.forEach((w, i) => console.log(`| ${i + 1} | ${pct(w)} |`));
  const [k, sx, sy, sxx, syy, sxy] = fit;
  const r = (k * sxy - sx * sy) / Math.sqrt((k * sxx - sx * sx) * (k * syy - sy * sy));
  console.log(`\nEstimated team value averages ${(sx / k).toFixed(2)}, actual score ${(sy / k).toFixed(2)}; correlation ${r.toFixed(2)}.`);
}
