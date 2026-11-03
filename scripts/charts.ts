import * as Plot from "@observablehq/plot";
import { mkdirSync, writeFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { GOLD, SILVER } from "../src/game.ts";
import { parquet, pointsSql, query, races } from "../src/results.ts";
import { matchupsSql } from "./matchups.ts";
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
const trackColors = ["#4a9a5b", "#d9822b"];
const raceLabel = (race: number) => `Race ${race}, ${tracks[(race - 1) % 2]}`;
const blue = "#3a7bbf";
const red = "#c0504d";
const players = (column = "filename") => `regexp_extract(${column}, '(\\d)p(-double)?\\.parquet$', 1)::int`;
const order: string[] = (await query(`select racer from ${races(0)} group by racer order by avg(${pointsSql(0)}) desc`)).map((r) => r.racer);

/** Tukey box plot statistics from [value, count] pairs sorted by value. */
function box(counts: [number, number][]) {
  const total = counts.reduce((s, [, k]) => s + k, 0);
  const quantile = (q: number) => {
    let seen = 0;
    for (const [v, k] of counts) if ((seen += k) >= q * total) return v;
    return counts.at(-1)![0];
  };
  const [q1, median, q3] = [0.25, 0.5, 0.75].map(quantile);
  const values = counts.map(([v]) => v);
  const inside = values.filter((v) => v >= q1 - 1.5 * (q3 - q1) && v <= q3 + 1.5 * (q3 - q1));
  return {
    q1,
    median,
    q3,
    lo: Math.min(...inside),
    hi: Math.max(...inside),
    mean: counts.reduce((s, [v, k]) => s + v * k, 0) / total,
    outliers: values.filter((v) => !inside.includes(v)),
  };
}

/** Box plot rows from rows of (racer, group, value, k) counts, plus `extra` columns per box. */
function boxRows(counts: Row[], keys: string[]) {
  const groups = Map.groupBy(counts, (r) => keys.map((k) => r[k]).join("\0"));
  return [...groups.values()].map((rows) => ({
    ...Object.fromEntries(keys.map((k) => [k, rows[0][k]])),
    ...box(rows.toSorted((a, b) => a.value - b.value).map((r) => [r.value, r.k])),
  }));
}

/**
 * Box plots with racers down y and `colors.length` boxes side by side in each racer's band, the
 * `group` column picking each box's place and color. `band` is the height of a racer's band.
 */
function boxes(rows: Row[], colors: string[], band: number, facet: Plot.MarkOptions = {}) {
  return colors.flatMap((fill, i) => {
    const data = rows.filter((r) => r.group === i);
    const step = band / colors.length;
    const [top, bottom] = [i * step + 1, (colors.length - 1 - i) * step + 1];
    const dy = -band / 2 + (i + 0.5) * step;
    return [
      Plot.ruleY(data, { ...facet, y: "racer", x1: "lo", x2: "hi", dy, stroke: fill }),
      Plot.barX(data, { ...facet, y: "racer", x1: "q1", x2: "q3", insetTop: top, insetBottom: bottom, fill, fillOpacity: 0.35, stroke: fill }),
      Plot.tickX(data, { ...facet, y: "racer", x: "median", insetTop: top, insetBottom: bottom, stroke: fill, strokeWidth: 2 }),
      Plot.dot(data.flatMap((r) => r.outliers.map((x: number) => ({ ...r, x }))), { ...facet, y: "racer", x: "x", dy, r: 1.5, fill }),
      Plot.dot(data, { ...facet, y: "racer", x: "mean", dy, r: 2.5, symbol: "diamond", fill: "white", stroke: "#222" }),
    ];
  });
}

/** A legend of colored swatches in the top margin of the first facet. */
const key = (labels: string[], colors: string[], width = 100) =>
  labels.flatMap((label, i) => [
    Plot.dot([0], { frameAnchor: "top-left", dx: i * width + 4, dy: -42, r: 4, fill: colors[i], facetAnchor: "top-left" }),
    Plot.text([0], { frameAnchor: "top-left", dx: i * width + 12, dy: -42, text: () => label, textAnchor: "start", facetAnchor: "top-left" }),
  ]);

/** The height of one of `n` bands with padding 0.2 over `range` pixels. */
const bandwidth = (range: number, n: number) => (range / (n + 0.2)) * 0.8;

const both = ["race 1, Mild Mile", "race 2, Wild Wilds"];

// Points per race: points and bronze in one race of 5, both tracks in each racer's band.
const pointCounts = await query(`
  ${[0, 1].map((race) => `
    select racer, ${race} "group", 'points' measure, ${pointsSql(race)} value, count(*)::int k from ${races(race)} group by all
    union all
    select racer, ${race} "group", 'bronze' measure, bronze value, count(*)::int k from ${races(race)} group by all`).join(" union all ")}`);
const tall = 900;
save("points", {
  width: 720,
  height: tall,
  marginLeft: 100,
  marginTop: 58,
  x: { label: "points in one race of 5 (◇ the average)", grid: true },
  y: { domain: order, label: null, padding: 0.2 },
  fx: { domain: ["points", "bronze"], label: null },
  marks: [...boxes(boxRows(pointCounts, ["racer", "group", "measure"]), trackColors, bandwidth(tall - 88, order.length), { fx: "measure" }), ...key(both, trackColors, 120)],
});

// Chances of 1st and 2nd, both tracks in each racer's band.
const places = await query(`
  ${[0, 1].map((race) => `
    select racer, ${race} "group", '1st' place, avg(gold) p, count(*)::int n from ${races(race)} group by racer
    union all
    select racer, ${race} "group", '2nd' place, avg(silver) p, count(*)::int n from ${races(race)} group by racer`).join(" union all ")}`);
const band = bandwidth(tall - 88, order.length);
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
    ...key(both, trackColors, 120),
  ],
});

// Player count: points in one race as a multiple of a fair share, a box per count.
const counts = [3, 4, 5, 6];
const countColors = ["#c6dbef", "#6baed6", "#2171b5", "#08306b"];
const shareCounts = await query(`
  ${[0, 1].map((race) => `
    select racer, ${race + 1} race, ${players()} - 3 "group", ${pointsSql(race)} * ${players()} / ${GOLD[race] + SILVER[race]} value, count(*)::int k
    from ${races(race, "*")} group by all`).join(" union all ")}`);
const taller = 1400;
save("players", {
  width: 720,
  height: taller,
  marginLeft: 100,
  marginTop: 58,
  x: { label: "points in one race ÷ a fair share (◇ the average)", grid: true },
  y: { domain: order, label: null, padding: 0.2 },
  fx: { tickFormat: raceLabel, label: null },
  marks: [
    Plot.ruleX([1], { stroke: "#999" }),
    ...boxes(boxRows(shareCounts, ["racer", "race", "group"]), countColors, bandwidth(taller - 88, order.length), { fx: "race" }),
    ...key(counts.map((c) => `${c} players`), countColors, 80),
  ],
});

// Matchups: each racer's points with another racer in the race, minus without.
for (const race of [0, 1]) {
  const limit = race === 0 ? 1 : 3;
  save(`matchups-race${race + 1}`, {
    width: 720,
    height: 720,
    marginLeft: 100,
    marginBottom: 100,
    x: { domain: order, tickRotate: -90, label: "with this racer in the race →", labelAnchor: "left" },
    y: { domain: order, label: null },
    color: { type: "threshold", scheme: "rdbu", domain: [-1, -0.5, -0.25, -0.1, 0.1, 0.25, 0.5, 1].map((t) => t * limit) },
    marks: [Plot.cell(await query(`select racer, other, "with" - "without" effect from (${matchupsSql(race)})`), { x: "other", y: "racer", fill: "effect", inset: 0.5 })],
  }, `${raceLabel(race + 1)}: change in the row racer's points per race`);
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
