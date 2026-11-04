import * as Plot from "@observablehq/plot";
import { mkdirSync, writeFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { parquet, pointsSql, query, races } from "../src/results.ts";
import { spreadSql } from "./spread.ts";

/** Draws the charts in README.md into charts/, from the raw data in results/. */
type Row = Record<string, any>;

const dir = new URL("../charts/", import.meta.url);
const { document } = new JSDOM("").window;
const ns = "http://www.w3.org/2000/svg";

/** Renders a plot to charts/`name`.svg, with its color legend above it when `legend` is set. */
function save(name: string, options: Plot.PlotOptions, legend?: string) {
  const plot = Plot.plot({ document, style: { background: "white", color: "#222" }, ...options }) as unknown as SVGSVGElement;
  let svg = plot;
  if (legend) {
    const key = plot.legend("color", { label: legend, width: 480, tickFormat: "+~g" }) as unknown as SVGSVGElement;
    const [w, h] = ["width", "height"].map((a) => [plot, key].map((s) => +s.getAttribute(a)!));
    svg = document.createElementNS(ns, "svg") as unknown as SVGSVGElement;
    for (const [a, v] of [["width", Math.max(...w)], ["height", h[0] + h[1]], ["viewBox", `0 0 ${Math.max(...w)} ${h[0] + h[1]}`], ["style", "background: white; color: #222"]]) {
      svg.setAttribute(a as string, String(v));
    }
    key.setAttribute("x", "20");
    plot.setAttribute("y", String(h[1]));
    svg.append(key, plot);
  }
  svg.setAttribute("xmlns", ns);
  writeFileSync(new URL(`${name}.svg`, dir), svg.outerHTML + "\n");
}

mkdirSync(dir, { recursive: true });
const tracks = ["Mild Mile", "Wild Wilds"];
const trackColors = ["rgb(128, 159, 200)", "rgb(235, 91, 103)"];
const raceLabel = (race: number) => `Race ${race}, ${tracks[(race - 1) % 2]}`;
const blue = "#3a7bbf";
const red = "#c0504d";
const players = (column = "filename") => `regexp_extract(${column}, '(\\d)p(-double)?\\.parquet$', 1)::int`;
const scored = (columns: string, n: number | "*" = 6) =>
  [0, 1].map((race) => `select '${tracks[race]}' track, ${columns}, ${pointsSql(race)} points from ${races(race, n)}`).join(" union all ");

// Points per race: the chance of each score in a race of 5, with each racer's average, strongest racers first.
const distribution = await query(`
  with r as (${scored("racer", 5)}),
  means as (select track, racer, avg(points) mean from r group by all),
  ranked as (select racer, avg(mean) rank from means group by racer),
  counts as (select track, racer, least(points, 12) points, count(*) n from r group by all)
  select track, racer, points, n / sum(n) over (partition by track, racer) chance, mean, rank
  from counts join means using (track, racer) join ranked using (racer)`);
const order = [...new Map(distribution.toSorted((a, b) => b.rank - a.rank).map((r) => [r.racer, r])).keys()];
const rows = [...Map.groupBy(distribution, (r) => `${r.track}\0${r.racer}`).values()];
const likeliest = rows.flatMap((rs) => rs.toSorted((a, b) => b.chance - a.chance).slice(0, 2));
const peak = Object.fromEntries(tracks.map((t) => [t, Math.max(...distribution.filter((r) => r.track === t).map((r) => r.chance))]));
const scores = { x1: (r: Row) => r.points - 0.5, x2: (r: Row) => r.points + 0.5, y: "racer", fx: "track", inset: 0.5 };
save("points", {
  width: 720,
  marginLeft: 100,
  marginTop: 25,
  x: { label: "points in one race of 5 (12 means 12 or more; | is the average)", domain: [-0.5, 12.5], ticks: [0, 2, 4, 6, 8, 10, 12] },
  y: { domain: order, label: null, grid: true },
  fx: { domain: tracks, label: null, axis: "top" },
  marks: [
    Plot.barX(distribution, { ...scores, fill: (r) => (r.track === tracks[0] ? "#1f4e8c" : "#b51f30"), fillOpacity: (r) => r.chance / peak[r.track] }),
    Plot.tickX(rows.map((rs) => rs[0]), { x: "mean", y: "racer", fx: "track", stroke: "#222", strokeWidth: 1.5 }),
    Plot.text(likeliest, { x: "points", y: "racer", fx: "track", text: (r) => `${Math.round(100 * r.chance)}%`, fill: "black", stroke: "white", fontSize: 8 }),
  ],
});

// Chances of 1st and 2nd, both tracks in each racer's row.
const places = await query(`
  ${[0, 1].map((race) => `
    select racer, ${race} "group", '1st' place, avg(gold) p, count(*)::int n from ${races(race)} group by racer
    union all
    select racer, ${race} "group", '2nd' place, avg(silver) p, count(*)::int n from ${races(race)} group by racer`).join(" union all ")}`);
const medals = places.map((r) => ({ ...r, track: tracks[r.group] })).toSorted((a, b) => a.place.localeCompare(b.place));
const byMedal = [...Map.groupBy(medals, (r) => r.racer)].map(([racer, rs]) => [racer, rs.reduce((s, r) => s + r.p, 0)] as const);
save("places", {
  width: 720,
  height: 720,
  marginLeft: 100,
  x: { label: "chance of 1st (dark) and 2nd (light) in one race of 5", percent: true, grid: true },
  y: { domain: byMedal.toSorted((a, b) => b[1] - a[1]).map(([racer]) => racer), label: null, padding: 0.15, grid: true },
  fx: { domain: tracks, label: null, axis: "top", padding: 0.1 },
  color: { domain: tracks, range: trackColors },
  marks: [Plot.barX(medals, { x: "p", y: "racer", fx: "track", fill: "track", fillOpacity: (r) => (r.place === "1st" ? 1 : 0.4) })],
});

// Player count: fair shares per race by number of players, for the racers that rise or fall most.
const byPlayers = await query(`
  select track, players, racer, avg(points) * players / if(track = 'Mild Mile', 5, 7) shares
  from (${scored(`${players()} players, racer`, "*")})
  where racer in ('Scoocher', 'Sisyphus', 'Romantic', 'Suckerfish', 'Dicemonger', 'Lovable Loser', 'M.O.U.T.H.', 'Alchemist', 'Hypnotist')
  group by track, players, racer order by players`);
/** Spreads labels apart vertically, in pixels, so they're at least `gap` apart in each facet. */
const spreadY = <T extends Plot.MarkOptions>(options: T, gap = 9) =>
  Plot.initializer(options, (_data, facets, { y }, { y: scale }) => {
    const ys = Float64Array.from(y!.value, (v) => scale!(v)!);
    for (const index of facets) {
      const sorted = [...index].sort((a, b) => ys[a] - ys[b]);
      for (let i = 1; i < sorted.length; i++) ys[sorted[i]] = Math.max(ys[sorted[i]], ys[sorted[i - 1]] + gap);
    }
    return { data: _data, facets, channels: { y: { value: ys } } };
  });
save("players", {
  width: 720,
  marginRight: 90,
  x: { label: "players", inset: 8 },
  y: { label: "fair shares per race", grid: true, type: "sqrt" },
  fx: { domain: tracks, label: null, axis: "top", padding: 0.3 },
  color: { domain: tracks, range: trackColors },
  marks: [
    Plot.ruleY([1], { stroke: "#222", strokeDasharray: "3,3" }),
    Plot.lineY(byPlayers, { x: "players", y: "shares", fx: "track", z: "racer", stroke: "track", marker: true }),
    Plot.text(byPlayers, spreadY(Plot.selectLast({ x: "players", y: "shares", fx: "track", z: "racer", text: "racer", textAnchor: "start", stroke: "white", fill: "black", dx: 6, fontSize: 8 }))),
  ],
});

// Matchups: the row racer's points minus the column racer's, in the same race of 6.
for (const race of [0, 1]) {
  const matchups = await query(`
    with r as (select race, racer, ${pointsSql(race)} p from ${races(race, 6)})
    select a.racer, b.racer opponent, avg(a.p - b.p) diff from r a join r b on a.race = b.race and a.racer <> b.racer group by all`);
  const limit = Math.max(...matchups.map((r) => Math.abs(r.diff)));
  save(`matchups-race${race + 1}`, {
    width: 720,
    height: 720,
    marginLeft: 100,
    marginTop: 100,
    x: { label: "opponent", tickRotate: -90, axis: "top", tickSize: 0 },
    y: { label: "racer", tickSize: 0 },
    color: { type: "quantize", scheme: "prgn", domain: [-limit, limit], n: 10 },
    marks: [Plot.cell(matchups, { x: "opponent", y: "racer", fill: "diff", sort: { x: "fill", y: "-fill", reduce: "mean" } })],
  }, `${tracks[race]}: row racer's points minus the column opponent's per race`);
}

// Draft value.
const draft = await query(`select racer, value from ${parquet("lineup-draft")} order by value desc`);
save("draft-value", {
  width: 720,
  height: 600,
  marginLeft: 100,
  x: { label: "draft value: points a game over an average pick", grid: true },
  y: { domain: draft.map((r) => r.racer), label: null },
  marks: [Plot.barX(draft, { x: "value", y: "racer", fill: (r) => (r.value > 0 ? blue : red) }), Plot.ruleX([0])],
});

// Optional powers: each alternative's points against the current choice, with 95% intervals.
const choices = await query(`
  with p as (
    ${[0, 1].map((race) => `select racer, game_race, choice, ${pointsSql(race)} p from ${parquet("choices-*")} where game_race = ${race + 1}`).join(" union all ")}
  ), m as (select racer, game_race, choice, avg(p) points, stddev_samp(p) / sqrt(count(*)) se from p group by all)
  select m.*, m.points - c.points change, sqrt(m.se ^ 2 + c.se ^ 2) change_se
  from m join m c on c.racer = m.racer and c.game_race = m.game_race and c.choice = 'current'
  where m.choice <> 'current' order by m.racer, m.choice`);
const label = (r: Row) => `${r.racer}: ${r.choice}`;
save("choices", {
  width: 720,
  height: 640,
  marginLeft: 260,
  x: { label: "points per race against the current choice (95% interval)", grid: true },
  y: { domain: [...new Set(choices.map(label))], label: null },
  fx: { tickFormat: raceLabel, label: null },
  marks: [
    Plot.ruleX([0]),
    Plot.ruleY(choices, { fx: "game_race", y: label, x1: (r) => r.change - 1.96 * r.change_se, x2: (r) => r.change + 1.96 * r.change_se, stroke: "#999" }),
    Plot.dot(choices, { fx: "game_race", y: label, x: "change", fill: (r) => (r.change > 0 ? blue : red), r: 3 }),
  ],
});

// Playouts against the hand-written choices.
const playouts = await query(`
  with p as (${[0, 1].map((race) => `select racer, game_race, playouts, ${pointsSql(race)} p from ${parquet("playouts")} where game_race = ${race + 1}`).join(" union all ")}),
  m as (select racer, game_race, playouts, avg(p) points, stddev_samp(p) / sqrt(count(*)) se from p group by all)
  select a.racer, a.game_race, a.points hand, b.points playouts, b.points - a.points change, sqrt(a.se ^ 2 + b.se ^ 2) change_se
  from m a join m b on a.racer = b.racer and a.game_race = b.game_race and a.playouts = 0 and b.playouts > 0`);
save("playouts", {
  width: 720,
  height: 340,
  marginLeft: 110,
  x: { label: "points per race: hand-written choice → by playouts", grid: true },
  y: { domain: playouts.filter((r) => r.game_race === 2).toSorted((a, b) => b.change - a.change).map((r) => r.racer), label: null },
  fx: { tickFormat: raceLabel, label: null },
  marks: [
    Plot.arrow(playouts, { fx: "game_race", y: "racer", x1: "hand", x2: "playouts", headLength: 6, stroke: (r) => (r.change > 2 * r.change_se ? blue : r.change < -2 * r.change_se ? red : "#999") }),
  ],
});

// Racers that pick racers.
const twin = await query(`
  ${[0, 1, 2, 3].map((race) => `
    select t.racer, ${race + 1} game_race, b.points before, avg(${pointsSql(race, "t.")}) after
    from ${parquet("twin")} t join (select racer, avg(${pointsSql(race)}) points from ${races(race)} group by racer) b using (racer)
    where t.game_race = ${race + 1} group by t.racer, b.points`).join(" union all ")}`);
save("twin", {
  width: 720,
  height: 200,
  marginLeft: 90,
  x: { label: "points per race: random picks → by ratings, with earlier winners", grid: true },
  y: { label: null },
  fx: { tickFormat: (race) => `Race ${race}`, label: null },
  marks: [Plot.arrow(twin, { fx: "game_race", y: "racer", x1: "before", x2: "after", stroke: blue, headLength: 6 })],
});

// Whole games: wins by draft position, with 95% intervals.
const games = await query(`
  select ${players()} players, filename like '%-double%' double, pick, avg(won) won, stddev_samp(won) / sqrt(count(*)) se
  from ${parquet("games-*", true)} group by all order by players desc, double, pick`);
const gameLabel = (r: Row) => `${r.players} players${r.double ? ", two racers each" : ""}: pick ${r.pick}`;
save("games", {
  width: 720,
  height: 420,
  marginLeft: 240,
  x: { label: "chance of winning (95% interval); dashed: an even share", percent: true, grid: true },
  y: { domain: games.map(gameLabel), label: null },
  marks: [
    Plot.barX(games, { x: "won", y: gameLabel, fill: blue }),
    Plot.ruleY(games, { y: gameLabel, x1: (r) => r.won - 1.96 * r.se, x2: (r) => r.won + 1.96 * r.se, stroke: "#222" }),
    Plot.tickX(games, { y: gameLabel, x: (r) => 1 / r.players, stroke: "#222", strokeDasharray: "2,2" }),
  ],
});

// Drafting and in-game strategies against the field.
const strategies = await query(`
  select 'drafting' kind, strategy, avg(won) won, stddev_samp(won) / sqrt(count(*)) se from ${parquet("draft-5p")} where me = 1 group by strategy
  union all
  select 'choosing racers', strategy, avg(won), stddev_samp(won) / sqrt(count(*)) from ${parquet("endgame-5p")} where me = 1 group by strategy
  order by kind desc, strategy not like '%as opponents do%', strategy`).then((rows) => rows.map((r) => ({ ...r, strategy: `${r.kind}: ${r.strategy}` })));
save("strategies", {
  width: 720,
  height: 220,
  marginLeft: 400,
  x: { label: "chance of winning (95% interval); dashed: an even share", percent: true, grid: true },
  y: { domain: strategies.map((r) => r.strategy), label: null },
  marks: [
    Plot.ruleX([0.2], { stroke: "#222", strokeDasharray: "3,3" }),
    Plot.ruleY(strategies, { y: "strategy", x1: (r) => r.won - 1.96 * r.se, x2: (r) => r.won + 1.96 * r.se, stroke: "#999" }),
    Plot.dot(strategies, { y: "strategy", x: "won", fill: blue, r: 4 }),
  ],
});

// Spread: safe against swingy in race 4.
const spread = await query(spreadSql(3));
save("spread", {
  width: 720,
  height: 480,
  x: { label: "chance of scoring nothing in race 4 →", percent: true, grid: true },
  y: { label: "↑ chance of at least gold", percent: true, grid: true },
  marks: [
    Plot.dot(spread, { x: "zero", y: "gold", r: "sd", fill: blue, fillOpacity: 0.5 }),
    Plot.text(spread, { x: "zero", y: "gold", text: "racer", fontSize: 9, dy: -10 }),
  ],
});

// Seats.
const seats = await query(`
  ${[0, 1].map((race) => `
    select ${race + 1} race, ${players()} players, seat + 1 seat, avg(${pointsSql(race)}) points, stddev_samp(${pointsSql(race)}) / sqrt(count(*)) se
    from ${races(race, "*")} group by all`).join(" union all ")} order by race, players, seat`);
save("seats", {
  width: 720,
  height: 320,
  marginRight: 40,
  x: { label: "seat (1 goes first)", ticks: [1, 2, 3, 4, 5, 6] },
  y: { label: "points per race (95% interval)", grid: true },
  fx: { tickFormat: raceLabel, label: null },
  marks: [
    Plot.ruleX(seats, { x: "seat", fx: "race", y1: (r) => r.points - 1.96 * r.se, y2: (r) => r.points + 1.96 * r.se, stroke: "#999" }),
    Plot.line(seats, { x: "seat", y: "points", z: "players", fx: "race", stroke: blue }),
    Plot.text(seats, Plot.selectLast({ x: "seat", y: "points", z: "players", fx: "race", text: (r) => `${r.players}p`, textAnchor: "start", dx: 5, fontSize: 9 })),
  ],
});

// Sensitivity to unsettled rules.
const readings = { backwards: "main moves can go backwards", queue: "triggers queue even if the board changed" };
const sensitivity = await query(`
  ${[0, 1].flatMap((race) => Object.entries(readings).map(([k, reading]) => `
    select ${race + 1} race, '${reading}' reading, racer, avg(${pointsSql(race, "v.")}) - any_value(b.points) change
    from ${parquet(`sensitivity-${k}-${["mild", "wild"][race]}`)} v
    join (select racer, avg(${pointsSql(race)}) points from ${races(race)} group by racer) b using (racer) group by racer`)).join(" union all ")}`);
save("sensitivity", {
  width: 720,
  height: 200,
  marginLeft: 260,
  x: { label: "change in a racer's points per race (each dot a racer)", grid: true },
  y: { label: null },
  fx: { tickFormat: raceLabel, label: null },
  marks: [
    Plot.ruleX([0]),
    Plot.dot(sensitivity, { x: "change", y: "reading", fx: "race", stroke: blue, r: 3 }),
    Plot.text(sensitivity.filter((r) => Math.abs(r.change) >= 0.1), { x: "change", y: "reading", fx: "race", text: "racer", dy: -10, fontSize: 9 }),
  ],
});
