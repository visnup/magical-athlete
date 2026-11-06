import * as Plot from "@observablehq/plot";
import { mkdirSync, writeFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { SECOND_WIND } from "../src/game.ts";
import { parquet, pointsSql, query, races } from "../src/results.ts";
import { spreadSql } from "./spread.ts";

/** Draws the charts in README.md into charts/, from the raw data in results/. */
type Row = Record<string, any>;

const dir = new URL("../charts/", import.meta.url);
const { document } = new JSDOM("").window;
const ns = "http://www.w3.org/2000/svg";

/** Inks from the box art and the board's spaces. */
const art = {
  blue: "#3fa4ff", // spaces
  red: "#fd4703", // spaces
  pink: "#d36465", // the striped shirt on the box
  green: "#4a671f",
  paper: "#ffffff",
  ink: "#381308",
  gray: "#9f7f75",
};
/** An interpolator from `low` through `mid` to `high`, in RGB. */
const between = (low: string, mid: string, high: string) => {
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [a, b, c] = [low, mid, high].map(rgb);
  return (t: number) => {
    const [from, to, u] = t < 0.5 ? [a, b, t * 2] : [b, c, t * 2 - 1];
    return `rgb(${from.map((x, i) => Math.round(x + (to[i] - x) * u)).join(",")})`;
  };
};

/** Renders a plot to charts/`name`.svg, with its color legend above it when `legend` is set. */
function save(name: string, options: Plot.PlotOptions, legend?: string) {
  const plot = Plot.plot({ document, style: { background: art.paper, color: art.ink }, ...options }) as unknown as SVGSVGElement;
  let svg = plot;
  if (legend) {
    const key = plot.legend("color", { label: legend, width: 480, tickFormat: "+~g" }) as unknown as SVGSVGElement;
    const [w, h] = ["width", "height"].map((a) => [plot, key].map((s) => +s.getAttribute(a)!));
    svg = document.createElementNS(ns, "svg") as unknown as SVGSVGElement;
    for (const [a, v] of [["width", Math.max(...w)], ["height", h[0] + h[1]], ["viewBox", `0 0 ${Math.max(...w)} ${h[0] + h[1]}`], ["style", `background: ${art.paper}; color: ${art.ink}`]]) {
      svg.setAttribute(a as string, String(v));
    }
    key.setAttribute("x", "20");
    plot.setAttribute("y", String(h[1]));
    svg.append(key, plot);
  }
  svg.setAttribute("xmlns", ns);
  // Dark mode flips lightness and keeps hue: paper goes dark, ink light, and blue and red stay put.
  const dark = document.createElementNS(ns, "style");
  dark.textContent = "@media (prefers-color-scheme: dark) { :root { filter: invert(1) hue-rotate(180deg); background: none !important } }";
  svg.prepend(dark);
  writeFileSync(new URL(`${name}.svg`, dir), svg.outerHTML + "\n");
}

mkdirSync(dir, { recursive: true });

// Blue and red only ever mean the tracks. A signed difference is pink to green on `change`. Dashed
// lines are a fair or even share, solid ones zero difference.
const tracks = ["Mild Mile", "Wild Wilds"];
const trackColor = { domain: tracks, range: [art.blue, art.red] };
const diverging = between(art.pink, art.paper, art.green);
const change = { type: "diverging-sqrt", interpolate: diverging } as const;
const trackOf = (race: number) => tracks[(race - 1) % 2];
const raceLabel = (race: number) => `Race ${race}, ${trackOf(race)}`;
const noise = art.gray;
const dashed = { stroke: art.ink, strokeDasharray: "3,3" };
const halo = { fill: "currentColor", stroke: art.paper };
const plus = (x: number, digits = 2) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(digits)}`;
const percent = (x: number) => `${(100 * x).toFixed(1)}%`;
/** A difference from a baseline: a rule from `x1` to `x2` and a dot at `x2`, both filled by `fill`. */
const lollipop = (data: Row[], { x1, x2, fill, ...options }: Plot.RuleYOptions & Plot.DotOptions) => [
  Plot.ruleY(data, { ...options, x1, x2, stroke: fill, strokeWidth: 2 }),
  Plot.dot(data, { ...options, x: x2, fill, stroke: "currentColor", strokeWidth: 0.5, r: 3 }),
];
/** Labels past the end of bars or arrows: right of those that go right, left of the rest. */
const ends = (data: Row[], right: (r: Row) => boolean, options: Plot.TextOptions) => [
  Plot.text(data.filter(right), { ...options, textAnchor: "start", dx: 4, fontSize: 8 }),
  Plot.text(data.filter((r) => !right(r)), { ...options, textAnchor: "end", dx: -4, fontSize: 8 }),
];

const players = (column = "filename") => `regexp_extract(${column}, '(\\d)p(-double)?\\.parquet$', 1)::int`;
const scored = (columns: string, n: number | "*" = 5) =>
  [0, 1].map((race) => `select '${tracks[race]}' track, ${columns}, ${pointsSql(race)} points from ${races(race, n)}`).join(" union all ");

/**
 * Moves text labels down, in pixels, until no two in a facet overlap, estimating each label's
 * width from its length. Labels at the same x stack, like line ends.
 */
const unclutter = <T extends Plot.MarkOptions>(options: T, { gap = 11, em = 6 } = {}) =>
  Plot.initializer(options, (data, facets, { x, y, text }, { x: sx, y: sy }) => {
    const xs = Float64Array.from(x!.value, (v) => sx!(v)!);
    const ys = Float64Array.from(y!.value, (v) => sy!(v)!);
    const width = (i: number) => String(text!.value[i]).length * em;
    for (const index of facets) {
      const placed: number[] = [];
      for (const i of [...index].sort((a, b) => ys[a] - ys[b])) {
        for (let moved = true; moved; ) {
          moved = false;
          for (const j of placed) {
            if (Math.abs(xs[i] - xs[j]) < (width(i) + width(j)) / 2 && Math.abs(ys[i] - ys[j]) < gap) (ys[i] = ys[j] + gap), (moved = true);
          }
        }
        placed.push(i);
      }
    }
    return { data, facets, channels: { x: { value: xs }, y: { value: ys } } };
  });

// Points per race: the chance of each score in a race of 5, with each racer's average, strongest racers first.
const distribution = await query(`
  with r as (${scored("racer")}),
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
  marginLeft: 100,
  x: { label: "points in one race of 5 (12 means 12 or more; | is the average)", domain: [-0.5, 12.5], ticks: [0, 2, 4, 6, 8, 10, 12] },
  y: { domain: order, label: null, grid: true },
  fx: { domain: tracks, label: null },
  color: trackColor,
  marks: [
    Plot.barX(distribution, { ...scores, fill: "track", fillOpacity: (r) => r.chance / peak[r.track] }),
    Plot.tickX(rows.map((rs) => rs[0]), { x: "mean", y: "racer", fx: "track", strokeWidth: 1.5 }),
    Plot.text(likeliest, { x: "points", y: "racer", fx: "track", text: (r) => `${Math.round(100 * r.chance)}%`, fontSize: 8 }),
  ],
});

// Chances of 1st and 2nd, by chance of either.
const medals = await query(`
  ${[0, 1].map((race) => `
    select racer, '${tracks[race]}' track, '1st' place, avg(gold) p from ${races(race)} group by racer
    union all
    select racer, '${tracks[race]}' track, '2nd' place, avg(silver) p from ${races(race)} group by racer`).join(" union all ")}
  order by place`);
const byMedal = [...Map.groupBy(medals, (r) => r.racer)].map(([racer, rs]) => [racer, rs.reduce((s, r) => s + r.p, 0)] as const);
save("places", {
  marginLeft: 100,
  x: { label: "chance of 1st (solid) and 2nd (faded) in one race of 5", percent: true, grid: true },
  y: { domain: byMedal.toSorted((a, b) => b[1] - a[1]).map(([racer]) => racer), label: null, grid: true },
  fx: { domain: tracks, label: null },
  color: trackColor,
  marks: [
    Plot.barX(medals, { x: "p", y: "racer", fx: "track", fill: "track", fillOpacity: (r) => (r.place === "1st" ? 1 : 0.4) }),
    Plot.text(medals, Plot.stackX({ x: "p", y: "racer", fx: "track", text: (r) => (r.p >= 0.1 ? `${Math.round(100 * r.p)}%` : ""), fontSize: 8 })),
  ],
});

// Player count: fair shares per race by number of players, for the racers that rise or fall most.
const byPlayers = await query(`
  select track, players, racer, avg(points) * players / if(track = 'Mild Mile', 5, 7) shares
  from (${scored(`${players()} players, racer`, "*")})
  where racer in ('Scoocher', 'Sisyphus', 'Romantic', 'Suckerfish', 'Dicemonger', 'Lovable Loser', 'M.O.U.T.H.', 'Alchemist', 'Hypnotist')
  group by track, players, racer order by players`);
save("players", {
  marginRight: 90,
  x: { label: "players", ticks: [3, 4, 5, 6], tickFormat: "d" },
  y: { label: "fair shares per race", grid: true, type: "sqrt" },
  fx: { domain: tracks, label: null, padding: 0.3 },
  color: trackColor,
  marks: [
    Plot.ruleY([1], dashed),
    Plot.lineY(byPlayers, { x: "players", y: "shares", fx: "track", z: "racer", stroke: "track", marker: true }),
    Plot.text(byPlayers, unclutter(Plot.selectLast({ x: "players", y: "shares", fx: "track", z: "racer", text: "racer", textAnchor: "start", dx: 6, ...halo }))),
  ],
});

// Matchups: the row racer's points minus the column racer's, in the same race of 6.
async function matchupChart(name: string, from: string, race: number, options: Plot.PlotOptions = {}) {
  const matchups = await query(`
    with r as (select race, racer, ${pointsSql(race)} p from ${from})
    select a.racer, b.racer opponent, avg(a.p - b.p) diff from r a join r b on a.race = b.race and a.racer <> b.racer group by all`);
  const limit = Math.max(...matchups.map((r) => Math.abs(r.diff)));
  // The cells furthest from what each racer's overall strength predicts (its average row difference).
  const strength = Object.fromEntries([...Map.groupBy(matchups, (r) => r.racer)].map(([racer, rs]) => [racer, rs.reduce((s, r) => s + r.diff, 0) / rs.length]));
  const surprise = (r: Row) => Math.abs(r.diff - (strength[r.racer] - strength[r.opponent]));
  const extremes = matchups.filter((r) => r.diff > 0).toSorted((a, b) => surprise(b) - surprise(a)).slice(0, 12);
  save(name, {
    ...options,
    marginLeft: 100,
    marginTop: 100,
    aspectRatio: 1,
    x: { label: "opponent", tickRotate: -90, axis: "top", padding: 0, round: false },
    y: { label: "racer", padding: 0, round: false },
    color: { type: "quantize", interpolate: diverging, domain: [-limit, limit], n: 10 }, // a continuous legend needs a canvas, which jsdom lacks
    marks: [
      Plot.cell(matchups, { x: "opponent", y: "racer", fill: "diff", inset: 1, sort: { x: "fill", y: "-fill", reduce: "mean" } }),
      Plot.text(extremes, { x: "opponent", y: "racer", text: (r) => plus(r.diff, Math.abs(r.diff) < 10 ? 1 : 0), fill: (r) => (Math.abs(r.diff) > limit / 2 ? art.paper : "currentColor"), fontSize: 7 }),
    ],
  }, `${tracks[race]}: row racer's points minus the column opponent's per race`);
}
for (const race of [0, 1]) await matchupChart(`matchups-race${race + 1}`, races(race, 6), race);

// Draft value, and the race each racer is usually played in.
const draft = await query(`
  select racer, value, [in_race1, in_race2, in_race3, in_race4].list_position(greatest(in_race1, in_race2, in_race3, in_race4)) race
  from ${parquet("lineup-draft")} order by value desc`);
save("draft-value", {
  marginLeft: 100,
  marginRight: 60,
  x: { label: "points per game over an average pick", grid: true },
  y: { domain: draft.map((r) => r.racer), label: null, grid: true },
  color: change,
  marks: [
    Plot.ruleX([0], dashed),
    Plot.dot(draft, { y: "racer", x: "value", fill: "value", stroke: "currentColor", strokeWidth: 0.5, r: 3 }),
    Plot.text(draft, { y: "racer", x: "value", text: (r) => `${plus(r.value)}, race ${r.race}`, textAnchor: "start", dx: 6, fontSize: 8 }),
  ],
});

// Optional powers: each alternative's points against the current choice. Never using the power is off the chart.
const choices = await query(`
  with p as (
    ${[0, 1].map((race) => `select racer, game_race, choice, ${pointsSql(race)} p from ${parquet("choices-*")} where game_race = ${race + 1}`).join(" union all ")}
  ), m as (select racer, game_race, choice, avg(p) points, stddev_samp(p) / sqrt(count(*)) se from p group by all)
  select m.*, m.points - c.points change, sqrt(m.se ^ 2 + c.se ^ 2) change_se
  from m join m c on c.racer = m.racer and c.game_race = m.game_race and c.choice = 'current'
  where m.choice <> 'current' order by m.racer, m.choice`);
const alternatives = choices.filter((r) => r.choice !== "never");
const never = choices.filter((r) => r.choice === "never").map((r) => r.change);
const label = (r: Row) => `${r.racer}: ${r.choice}`;
save("choices", {
  marginLeft: 330,
  marginRight: 30,
  x: { label: "points per race against the current choice", grid: true },
  y: { domain: [...new Set(alternatives.map(label))], label: null, grid: true },
  fx: { tickFormat: raceLabel, label: null },
  color: change,
  marks: [
    Plot.ruleX([0]),
    ...lollipop(alternatives, { fx: "game_race", y: label, x1: 0, x2: "change", fill: "change" }),
    ...ends(alternatives, (r) => r.change >= 0, { fx: "game_race", y: label, x: "change", text: (r) => plus(r.change) }),
    Plot.text([{ game_race: 1 }], { fx: "game_race", frameAnchor: "bottom-left", textAnchor: "start", dx: 4, dy: -4, fill: noise, text: () => `never using it: ${plus(Math.max(...never), 1)} to ${plus(Math.min(...never), 1)}, off the chart` }),
  ],
});

// Playouts against the hand-written choices.
const playouts = await query(`
  with p as (${[0, 1].map((race) => `select racer, game_race, playouts, ${pointsSql(race)} p from ${parquet("playouts")} where game_race = ${race + 1}`).join(" union all ")}),
  m as (select racer, game_race, playouts, avg(p) points, stddev_samp(p) / sqrt(count(*)) se from p group by all)
  select a.racer, a.game_race, a.points hand, b.points playouts, b.points - a.points change, sqrt(a.se ^ 2 + b.se ^ 2) change_se
  from m a join m b on a.racer = b.racer and a.game_race = b.game_race and a.playouts = 0 and b.playouts > 0`);
save("playouts", {
  marginLeft: 110,
  marginRight: 40,
  x: { label: "points per race: hand-written choice → by playouts", grid: true, insetLeft: 30 },
  y: { domain: playouts.filter((r) => r.game_race === 2).toSorted((a, b) => b.change - a.change).map((r) => r.racer), label: null, grid: true },
  fx: { tickFormat: raceLabel, label: null },
  color: change,
  marks: [
    Plot.arrow(playouts, { fx: "game_race", y: "racer", x1: "hand", x2: "playouts", headLength: 6, stroke: "change" }),
    ...ends(playouts.filter((r) => Math.abs(r.change) > 2 * r.change_se), (r) => r.change > 0, { fx: "game_race", y: "racer", x: "playouts", text: (r) => plus(r.change) }),
  ],
});

// Racers that pick racers.
const twin = await query(`
  ${[0, 1, 2, 3].map((race) => `
    select t.racer, ${race + 1} game_race, '${trackOf(race + 1)}' track, b.points before, avg(${pointsSql(race, "t.")}) after
    from ${parquet("twin")} t join (select racer, avg(${pointsSql(race)}) points from ${races(race)} group by racer) b using (racer)
    where t.game_race = ${race + 1} group by t.racer, b.points`).join(" union all ")}`);
save("twin", {
  marginLeft: 90,
  marginRight: 30,
  x: { label: "points per race: built-in ratings → this race's ratings and earlier winners", grid: true },
  y: { domain: ["Twin", "Egg", "Copycat", "Mastermind"], label: null, grid: true },
  fx: { tickFormat: raceLabel, label: null },
  color: trackColor,
  marks: [
    Plot.arrow(twin, { fx: "game_race", y: "racer", x1: "before", x2: "after", stroke: "track", headLength: 6 }),
    Plot.text(twin, { fx: "game_race", y: "racer", x: "after", text: (r) => r.after.toFixed(2), dy: -8, fontSize: 8 }),
  ],
});

// Whole games: wins by draft position, against an even share.
const games = await query(`
  select ${players()} players, filename like '%-double%' double, pick, avg(won) won
  from ${parquet("games-*", true)} group by all order by players desc, double, pick`);
const gameLabel = (r: Row) => `${r.players} players${r.double ? ", two racers each" : ""}: pick ${r.pick}`;
save("games", {
  marginLeft: 220,
  marginRight: 40,
  x: { label: "chance of winning; dashed: an even share", percent: true, grid: true, zero: true },
  y: { domain: games.map(gameLabel), label: null },
  color: change,
  marks: [
    Plot.tickX(games, { y: gameLabel, x: (r) => 1 / r.players, ...dashed }),
    ...lollipop(games, { y: gameLabel, x1: (r) => 1 / r.players, x2: "won", fill: (r) => r.won - 1 / r.players }),
    ...ends(games, (r) => r.won > 1 / r.players, { y: gameLabel, x: "won", text: (r) => percent(r.won) }),
  ],
});

// Drafting and in-game strategies against the field.
const strategies = await query(`
  select 'drafting' kind, strategy, avg(won) won, stddev_samp(won) / sqrt(count(*)) se, avg(score) score from ${parquet("draft-5p")} where me = 1 group by strategy
  union all
  select 'choosing racers', strategy, avg(won), stddev_samp(won) / sqrt(count(*)), avg(score) from ${parquet("endgame-5p")} where me = 1 group by strategy
  order by kind desc, strategy not like '%as opponents do%', strategy`).then((rows) => rows.map((r) => ({ ...r, strategy: `${r.kind}: ${r.strategy}` })));
save("strategies", {
  marginLeft: 400,
  marginRight: 20,
  x: { label: "chance of winning (95% interval); dashed: an even share", percent: true, grid: true },
  y: { domain: strategies.map((r) => r.strategy), label: null, grid: true },
  marks: [
    Plot.ruleX([0.2], dashed),
    Plot.ruleY(strategies, { y: "strategy", x1: (r) => r.won - 1.96 * r.se, x2: (r) => r.won + 1.96 * r.se, stroke: noise }),
    Plot.dot(strategies, { y: "strategy", x: "won", fill: "currentColor", r: 3 }),
    Plot.text(strategies, { y: "strategy", x: "won", text: (r) => `${percent(r.won)}, ${r.score.toFixed(2)} points`, dy: -8, fontSize: 8 }),
  ],
});

// Spread: safe against swingy in race 4.
const spread = await query(spreadSql(3));
save("spread", {
  inset: 10,
  x: { label: "chance of scoring nothing in race 4", percent: true, grid: true },
  y: { label: "chance of at least gold", percent: true, grid: true },
  r: { label: "standard deviation" },
  marks: [
    Plot.dot(spread, { x: "zero", y: "gold", r: "sd", fill: trackColor.range[1], fillOpacity: 0.5 }),
    Plot.text(spread, unclutter({ x: "zero", y: "gold", text: "racer", dy: -10, fontSize: 8, ...halo }, { gap: 9, em: 5 })),
    Plot.text(["← protecting a lead: rarely nothing"], { frameAnchor: "bottom-left", textAnchor: "start", dx: 4, dy: -4, fill: noise }),
    Plot.text(["catching up: often gold ↑"], { frameAnchor: "top-right", textAnchor: "end", dx: -4, dy: 4, fill: noise }),
  ],
});

// Seats: each seat's points against the average seat at its table.
const seats = await query(`
  select *, points / avg(points) over (partition by race, players) - 1 edge from (
    ${[0, 1].map((race) => `
      select ${race + 1} race, '${tracks[race]}' track, ${players()} players, seat + 1 seat, avg(${pointsSql(race)}) points
      from ${races(race, "*")} group by all`).join(" union all ")}
  ) order by race, players, seat`);
save("seats", {
  marginRight: 30,
  x: { label: "seat (1 goes first)", ticks: [1, 2, 3, 4, 5, 6], tickFormat: "d" },
  y: { label: "points against an average seat at the table", grid: true, tickFormat: "+.0%" },
  fx: { tickFormat: raceLabel, label: null },
  color: trackColor,
  marks: [
    Plot.ruleY([0], dashed),
    Plot.lineY(seats, { x: "seat", y: "edge", z: "players", fx: "race", stroke: "track", marker: true }),
    Plot.text(seats, unclutter(Plot.selectLast({ x: "seat", y: "edge", z: "players", fx: "race", text: (r) => `${r.players}p`, textAnchor: "start", dx: 6, ...halo }))),
  ],
});

// Second Wind: every racer's points on each track in races drawn from all 72, the expansion's in ink
// and the standouts named.
const sw = `(${SECOND_WIND.map((n) => `'${n.replaceAll("'", "''")}'`).join(", ")})`;
const mixed = (race: number) => parquet(`second-wind-${["mild", "wild"][race]}-5p`);
const expansion = await query(`
  select racer, racer in ${sw} new, m.points mild, w.points wild from
  (select racer, avg(${pointsSql(0)}) points from ${mixed(0)} group by racer) m
  join (select racer, avg(${pointsSql(1)}) points from ${mixed(1)} group by racer) w using (racer)`);
const standouts = ["Streaker", "Understudy", "Penguin", "Nemesis", "Stepdad", "Party Pooper", "Hotel", "Icarus", "Re-Runner", "Speed Demon", "Cheatah", "Scoocher", "Sisyphus", "Lovable Loser", "Dicemonger"];
save("second-wind", {
  inset: 10,
  marginRight: 50,
  x: { label: "race 1 points, Mild Mile", grid: true },
  y: { label: "race 2 points, Wild Wilds", grid: true },
  marks: [
    Plot.ruleX([1], dashed),
    Plot.ruleY([1.4], dashed),
    Plot.dot(expansion.filter((r) => !r.new), { x: "mild", y: "wild", stroke: noise, r: 3 }),
    Plot.dot(expansion.filter((r) => r.new), { x: "mild", y: "wild", fill: "currentColor", r: 3 }),
    Plot.text(expansion.filter((r) => standouts.includes(r.racer)), unclutter({
      x: "mild", y: "wild", text: "racer", textAnchor: "start", dx: 6, fill: (r: Row) => (r.new ? "currentColor" : noise), stroke: art.paper, fontSize: 8,
    }, { gap: 9, em: 5 })),
    Plot.text(["filled: Second Wind; dashed: a fair share"], { frameAnchor: "bottom-right", textAnchor: "end", dx: -4, dy: -4, fill: noise }),
  ],
});

for (const race of [0, 1]) await matchupChart(`second-wind-matchups-race${race + 1}`, mixed(race), race, { width: 1200 });

// Second Wind: each base racer's points in races drawn from all 72, against base racers only.
const shift = await query(`
  ${[0, 1].map((race) => `
    select ${race + 1} race, racer, avg(${pointsSql(race, "m.")}) - any_value(b.points) change
    from ${mixed(race)} m join (select racer, avg(${pointsSql(race)}) points from ${races(race)} group by racer) b using (racer)
    group by racer`).join(" union all ")}`);
save("second-wind-shift", {
  marginLeft: 100,
  marginRight: 40,
  x: { label: "points per race with Second Wind racers in the field", grid: true },
  y: { domain: shift.filter((r) => r.race === 2).toSorted((a, b) => b.change - a.change).map((r) => r.racer), label: null, grid: true },
  fx: { tickFormat: raceLabel, label: null },
  color: change,
  marks: [
    Plot.ruleX([0]),
    ...lollipop(shift, { fx: "race", y: "racer", x1: 0, x2: "change", fill: "change" }),
    ...ends(shift.filter((r) => Math.abs(r.change) >= 0.1), (r) => r.change >= 0, { fx: "race", y: "racer", x: "change", text: (r) => plus(r.change) }),
  ],
});

// Sensitivity to unsettled rules.
const readings = { backwards: "main moves can go backwards", queue: "triggers queue even if the board changed" };
const sensitivity = await query(`
  ${[0, 1].flatMap((race) => Object.entries(readings).map(([k, reading]) => `
    select ${race + 1} race, '${tracks[race]}' track, '${reading}' reading, racer, avg(${pointsSql(race, "v.")}) - any_value(b.points) change
    from ${parquet(`sensitivity-${k}-${["mild", "wild"][race]}`)} v
    join (select racer, avg(${pointsSql(race)}) points from ${races(race)} group by racer) b using (racer) group by racer`)).join(" union all ")}`);
save("sensitivity", {
  marginLeft: 260,
  marginRight: 50,
  x: { label: "change in a racer's points per race (each tick a racer)", grid: true },
  y: { label: null },
  fx: { tickFormat: raceLabel, label: null },
  color: trackColor,
  marks: [
    Plot.ruleX([0]),
    Plot.tickX(sensitivity, { x: "change", y: "reading", fx: "race", stroke: "track" }),
    Plot.text(sensitivity.filter((r) => Math.abs(r.change) >= 0.1), { x: "change", y: "reading", fx: "race", text: (r) => `${r.racer} ${plus(r.change)}`, dy: -10, fontSize: 8 }),
  ],
});
