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

// Points per race: the chance of each score in a race of 6, strongest racers first.
const distribution = await query(`
  with r as (${scored("racer")}),
  ranked as (select racer, avg(m) mean from (select track, racer, avg(points) m from r group by all) group by racer),
  counts as (select track, racer, least(points, 12) points, count(*) n from r group by all)
  select track, racer, points, n / sum(n) over (partition by track, racer) chance, mean
  from counts join ranked using (racer)`);
const order = [...new Map(distribution.toSorted((a, b) => b.mean - a.mean).map((r) => [r.racer, r])).keys()];
const likeliest = [...Map.groupBy(distribution, (r) => `${r.track}\0${r.racer}`).values()].map((rows) => rows.reduce((a, b) => (b.chance > a.chance ? b : a)));
save("points", {
  width: 720,
  marginLeft: 100,
  marginTop: 25,
  grid: true,
  x: { label: "points in one race of 6 (12 means 12 or more)", domain: Array.from({ length: 13 }, (_, i) => i) },
  y: { domain: order, label: null },
  fx: { domain: tracks, label: null, axis: "top" },
  color: { scheme: "turbo", type: "sqrt" },
  marks: [
    Plot.cell(distribution, { x: "points", y: "racer", fx: "track", fill: "chance" }),
    Plot.text(likeliest, { x: "points", y: "racer", fx: "track", text: (r) => `${Math.round(100 * r.chance)}%`, fill: "white", stroke: "black", strokeOpacity: 0.5, fontSize: 8 }),
  ],
});

// Chances of 1st and 2nd, both tracks in each racer's row.
const places = await query(`
  ${[0, 1].map((race) => `
    select racer, ${race} "group", '1st' place, avg(gold) p, count(*)::int n from ${races(race)} group by racer
    union all
    select racer, ${race} "group", '2nd' place, avg(silver) p, count(*)::int n from ${races(race)} group by racer`).join(" union all ")}`);
const tall = 900;
const band = ((tall - 88) / (order.length + 0.2)) * 0.8;
save("places", {
  width: 720,
  height: tall,
  marginLeft: 100,
  marginTop: 58,
  x: { label: "chance in one race of 5 (with 95% interval)", percent: true, grid: true },
  y: { domain: order, label: null, padding: 0.2 },
  fx: { domain: ["1st", "2nd"], label: null },
  marks: [
    ...[0, 1].flatMap((group) => {
      const dy = -band / 2 + (group + 0.5) * (band / 2);
      const data = places.filter((r) => r.group === group);
      const ci = (sign: number) => (r: Row) => r.p + sign * 1.96 * Math.sqrt((r.p * (1 - r.p)) / r.n);
      return [
        Plot.ruleY(data, { fx: "place", y: "racer", x1: ci(-1), x2: ci(1), dy, stroke: trackColors[group] }),
        Plot.dot(data, { fx: "place", y: "racer", x: "p", dy, r: 3, fill: trackColors[group] }),
      ];
    }),
    ...["race 1, Mild Mile", "race 2, Wild Wilds"].flatMap((label, i) => [
      Plot.dot([0], { frameAnchor: "top-left", dx: i * 120 + 4, dy: -42, r: 4, fill: trackColors[i], facetAnchor: "top-left" }),
      Plot.text([0], { frameAnchor: "top-left", dx: i * 120 + 12, dy: -42, text: () => label, textAnchor: "start", facetAnchor: "top-left" }),
    ]),
  ],
});

// Player count: average points per race by number of players, for selected racers.
const byPlayers = await query(`
  select track, players, racer, avg(points) mean
  from (${scored(`${players()} players, racer`, "*")})
  where racer in ('Scoocher', 'Lovable Loser', 'Sisyphus', 'Romantic', 'Suckerfish', 'Dicemonger', 'Legs', 'Alchemist', 'Huge Baby')
  group by all order by players`);
save("players", {
  width: 720,
  marginRight: 90,
  x: { label: "players", inset: 8 },
  y: { label: "points per race", grid: true, type: "sqrt" },
  fx: { domain: tracks, label: null, axis: "top", padding: 0.3 },
  color: { domain: tracks, range: trackColors },
  marks: [
    Plot.lineY(byPlayers, { x: "players", y: "mean", fx: "track", z: "racer", stroke: "track", marker: true }),
    Plot.text(byPlayers, Plot.selectLast({ x: "players", y: "mean", fx: "track", z: "racer", text: "racer", textAnchor: "start", stroke: "white", fill: "black", dx: 6, fontSize: 8 })),
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
    x: { label: "opponent", tickRotate: -90, axis: "top" },
    y: { label: "racer" },
    color: { type: "quantize", scheme: "rdbu", domain: [-limit, limit], n: 10 },
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
