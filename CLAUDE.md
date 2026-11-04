# magical-athlete

A simulator of the CMYK board game Magical Athlete. Node 24 runs the TypeScript directly. The
engine has no dependencies; the analysis scripts need `pnpm install` (DuckDB, hyparquet-writer,
Observable Plot and jsdom).

The rules are the August 2026 printing, `rules/magical-athlete-2026-08.pdf` (from the game's
BoardGameGeek files). `rules/magical-athlete.pdf` is the 2025 first printing
(https://bghub.org/r/magical-athlete.pdf). Neither is committed. Where they differ, the 2026
printing wins: it rewrote tripping, "before my main move" powers, backward passing and
simultaneous arrivals, and fixed Sisyphus's misprinted note.

The engine and its tests are in `src/`, scripts to run in `scripts/`, their raw data in
`results/` and charts in `charts/`.

- `racers.ts`: each racer's rules as hooks, with its default choice and everything the rulebook
  says about it (flavor text, card, notes, and passages elsewhere that name it), plus official
  rulings from BoardGameGeek with links.
- `second-wind.ts`: the Second Wind expansion's 36 racers, from the card list at
  https://johnnlds.github.io/Magical-Athlete-Racers/. There's no rulebook for them, so each card's
  comment gives our reading. They stay out of the base game's datasets and analysis: `NAMES` is
  the base 36, `SECOND_WIND` the expansion and `ALL` both. The engine's hooks for them only run when one
  could be in play (`Race.extended`), so `engine.sha` doesn't move. `scripts/second-wind.ts`
  races lineups of 5 from all 72 (`results/second-wind-<mild|wild>-5p.parquet`, a row per
  player, so Switcharoo's swaps count) and writes `second-wind.json`, the ratings its next run
  plays by. It has its own section in `README.md`.
- `game.ts`: the engine, which calls those hooks. `Race` runs one race, `playGame` drafts and
  runs four.
- `sim.ts`: quick Monte Carlo. `node scripts/sim.ts --n 100000 --players 5` prints per-racer
  odds; `--mode game` runs whole games; `--log` prints every event and `--csv` a row per racer
  per race, both on one core with `--seed`.
- `ratings.json`: each racer's points, chance of 1st and draft value by race, and points per race
  on each track at 3 to 6 racers, from `lineup.ts --write`. The engine drafts and orders races by
  it, and picks racers (Egg, Twin, Copycat) by the points on the race's own track and size.
  Mastermind predicts by chance of 1st on the track, and standalone races draw Twin's earlier
  winners from it too. It comes from the previous dataset, so it's one pass behind; refresh it
  with `lineup.ts --write` and rerun `make` after a change that moves racers' points.
- `results/` holds raw data as Parquet, a row per racer per race or per player per game, never
  averages. `races.ts` writes the shared race dataset: a million races of random lineups at each
  track and player count (`races-<mild|wild>-<n>p.parquet`), in batches of 100,000 that `write`
  joins with DuckDB and zstd. Races 1 and 3 are on the Mild Mile and 2 and 4 on the Wild Wilds,
  and differ only in chip values, so a row is scored by the race it stands for (`pointsSql`,
  `rowPoints`). For Twin, each race gets the earlier winners of one of its track's two races at
  random (0 or 2 on the Mild Mile, 1 or 3 on the Wild Wilds), so Twin averages over them.
  Scripts summarize with DuckDB (`query` in `results.ts`), which reads the files directly; so can
  `duckdb` or pandas. `results/README.md` is the Hugging Face dataset card.
- `make` reruns whatever a change in `scripts/` made stale, then the charts (about 20 minutes
  from scratch). For `src/`, it first hashes the engine's results on a fixed sample
  (`fingerprint.ts`, into `engine.sha`) and reruns only if they changed, so a refactor that
  leaves results alone reruns nothing. A fresh clone's file times are arbitrary, so it may rerun
  everything.
- Scripts that read the race dataset, each run as `node scripts/<script>.ts`:
  - `points.ts --race k`: the headline points table.
  - `players.ts`: each racer's points as a multiple of a fair share at 3 to 6 players.
  - `matchups.ts`: how each racer's points change with each other racer in the race.
  - `spread.ts`: how spread out each racer's points are in one race.
  - `seats.ts`: what each seat in turn order is worth.
- Scripts that run their own races and write them to `results/`:
  - `lineup.ts`: which race to play each racer in, and draft value.
  - `twin.ts`: Twin, Egg, Mastermind and Copycat with ratings and earlier winners.
  - `choices.ts`: each optional power's current choice against alternatives.
  - `playouts.ts`: each optional power decided by playing out every option (`Race.playout`). A
    decision on the same board in the same turn, with bronze left in the box or not, is reused:
    Suckerfish riding Scoocher around the 12–16 loop decides hundreds of times a turn, and each
    playout replays the turn so far.
  - `games.ts`: whole games, by draft position and estimated team value.
  - `draft.ts`: drafting strategies for one player against greedy opponents.
  - `endgame.ts`: choosing racers during a game by score, and countering Scoocher.
  - `sensitivity.ts`: the races rerun with each unsettled rule (`Rules` in `game.ts`) read the
    other way.
- Scripts for digging, not part of `make`:
  - `decisions.ts --racer X --race k`: logs each of a racer's decisions against playouts and lists
    where playouts clearly disagree.
  - `dicemonger.ts`: whether to decline Dicemonger's reroll so it doesn't move.
- `charts.ts` draws `charts/*.svg` for `README.md` from `results/`.
- `parallel.ts` splits a script's races into up to 256 seeded chunks that a worker thread per core
  (`worker.ts`) takes in turn, so one slow chunk doesn't hold up the rest and results don't
  depend on the core count. It adds up the results, or `collect`s their rows. A task is an
  exported function of a module that does nothing at the top level, so scripts guard their main
  code with `if (import.meta.main)`. `tables.ts` runs races of random lineups.
- `node --test` runs `game.test.ts`, which includes the rulebook's Romantic/Scoocher/Banana
  example, `racers.test.ts` and `second-wind.test.ts`, one test per card named for its text, plus the rulebook's notes, and
  `terms.test.ts`, the terms, fiddly details and track spaces on p. 23.
- `TODO.md` is the plan: checking the model first, then the analysis.
- `README.md` is what the simulator has shown so far.

## Publishing a change

1. `make`, in the background.
2. Update `README.md`: each section names the script behind its tables. The dataset readers
   (`points.ts --race 1` and `--race 2`, `players.ts`, `matchups.ts`, `spread.ts`, `seats.ts`)
   print theirs; `make` prints the rest.
3. `uvx --from huggingface_hub hf upload visnup/magical-athlete results . --repo-type dataset`
4. Commit and push.

Pitfalls:

- Don't edit `src/` while `make` runs: each batch's workers load the engine fresh, so one
  dataset would mix two engines. Scripts that only read `src/` can run alongside.
- `choices.ts --racer X` rewrites `results/choices-<x>.parquet`, so run it before or after
  `make`, not during, and rerun it with the final options before publishing.
- DuckDB's `group by` returns rows in a different order each run. Sort anything that feeds a
  simulation, like the odds Twin's earlier winners are drawn from, or the same seed gives
  different results.
- A change to `src/` that doesn't change the engine's results, like how results are written,
  needs `make -B`.

## Charts

`scripts/charts.ts` follows these, so every chart reads the same way:

- **Color has two jobs, both from the game's art (`art`).** The board's blue and orange-red
  spaces (`trackColor`) only ever mean the Mild Mile and the Wild Wilds; a chart faceted by track
  or race colors its marks by track. A signed difference (a gain or loss, one racer against
  another) runs from the pink to the green of the box's striped shirt, through white, on one
  diverging square-root scale (`change`), symmetric around 0, so small differences still show. The
  matchups heatmaps are the exception: they step the same colors into 10 bins, since a continuous
  legend needs a canvas and jsdom has none.
- **Marks by what they show.** When the measure is a change from each row's own baseline (an
  alternative against the current choice, a seat's wins against an even share), it's a lollipop
  (`lollipop`: a rule from the baseline and a dot at the value), so near-zero values stay small
  and outliers don't swamp the ink: choices, games. When rows are positions on one shared scale
  and the reference is only a landmark, it's a dot (draft value). The same thing measured two ways
  is an arrow (playouts, twin). Bars are for amounts that add up (places). Lines for a trend across
  an ordered quantity (players, seats). Cells for two categories crossed (matchups) or a
  distribution over discrete values (points). Ticks for a reference inside another mark, or many
  values sharing a row (sensitivity). Dots also for an estimate with an interval (strategies) or a
  scatter (spread).
- **Double-encode differences.** A mark that shows a difference by length or position is also
  colored by it. Strategies, where every difference is within noise, stays plain.
- **Reference lines.** Dashed is a fair or even share, or an average (players, games, seats,
  strategies, draft value); solid is zero difference.
- **Uncertainty only where it's as big as the effect.** Strategies shows 95% intervals. Elsewhere
  the noise is far below what the chart shows, so intervals would be invisible; the text says
  how big the noise is.
- **Label the data directly**, in place of legends: values next to bars, dots, arrows and line ends
  at 8px, series names at Plot's default size with a white halo. Differences carry a sign
  (`plus`), percentages a %. Text on the dark end of `change` is white; on the bright track colors it stays dark. `unclutter` nudges overlapping labels
  apart, since Plot has no label collision of its own.
- **Tie a chart to its text.** Show what the paragraphs around it claim. Label the numbers they
  quote, add a short note in the plot where it helps a reader find the point (spread's corners),
  and show any part the text says is left out (choices' "never").
- **Plot's defaults** for width, height, facet axes, axis arrows and tick padding. Line marks
  use `marker: true`. Set margins only for long labels.

## Finding better choices

Each optional power's `choose` in `racers.ts` is a hand-written rule. To improve one:

1. `playouts.ts` shows how far each rule trails deciding by playouts, the upper bound on what a
   better rule could gain.
2. `decisions.ts --racer X --race k` lists where playouts clearly beat the rule, by 1+ points.
   Only clear disagreements count: picking the best of several noisy estimates (40 playouts
   each, ±0.4) overstates it. Look for a pattern in positions and rolls, like Flip Flop's best
   swaps landing on stars.
3. Write the pattern as an option in `choices.ts` and run `choices.ts --racer X`: 100,000 races
   per track, all options on the same seeds, ±0.01.
4. Adopt it if it beats the current rule beyond that noise. Its comment in `racers.ts` gives the
   gain, and the old rule stays in `choices.ts` marked "(previous)". Rejected options go in
   `README.md` with their cost.
5. Refresh `ratings.json` and run `make`.

Rules found this way: a star is worth about 15 spaces (`landing`), not 3. A decision that's good
in one turn's playouts isn't always a rule: declining Suckerfish's rides in the 12–16 loop looked
better there and cost 0.9 a race. Defensive play against a strong racer, like declining
Dicemonger's reroll or countering Scoocher with M.O.U.T.H., costs the player more than it costs
the racer.

## Official rulings

Richard Garfield (designer, BGG `Phelddagrif`) and Alex Hague (CMYK, `AlxHague`) answer rules
questions on BoardGameGeek. RulesPal (https://rulespal.com/magical-athlete/faq) indexes them; read
the linked post itself before relying on one, since RulesPal's summaries sometimes go further than
the post. `/api/articles?threadid=N` on boardgamegeek.com returns a thread's posts as JSON without
a login.

## Not in the rulebook

- **Wild Wilds layout.** `WILD_WILDS` is read from a photo of the board. Games alternate Mild,
  Wild, Mild, Wild, and `sim.ts --race k` races on race k's track.
- **Chip values.** Gold 3/4/4/5 and silver 2/3/3/4 by race, from the physical chips.
- **Mild Mile geometry.** Start is space 0, 29 is the last space, and 30 is across the finish.
  Blimp's second corner is space 15, where the track turns the second time (not 12, which would
  count Start's rounded end as the first). The first corner, where Nepo Baby starts, is 12.

## Interpretations

- Simultaneous triggers resolve racetrack spaces first, then racers starting with the current
  player and going clockwise, each resolving fully (depth-first) before the next. Garfield
  describes queuing triggers and resolving them even if the board has since changed; here each
  trigger re-checks its condition when it resolves.
- A trigger reaches the powers racers hold when it happens, so a Copycat can't switch powers
  mid-action.
- Scoocher moves after every other racer's power, including passive ones every turn, per
  Garfield's rule of thumb: anything that changes the board versus a racer with no power.
- An infinite loop is a power or track arrow repeating with identical positions within its own
  chain of triggers. That's cut after one pass (`loops` counts them).
- Bronze chips run out: the box holds 43 points of them (16 ones, 9 threes) for the whole game,
  and Sisyphus's lost chips go back. Without the cap, Scoocher and Suckerfish riding each other
  around the Wild Wilds' 12–16 cycle (16's arrow goes back to 12) farm the star on 13 for about
  21 bronze per race. Game-breaking pairs like that one stay as the rules make them, not tuned.
- Skipper "steals" a correct Genius's extra turn: the Genius doesn't get it afterwards.
- Duelist duels everyone it shares the Start with before the first turn, since it "just needs to
  be sharing a space."
- A loop where no one can finish ends the race (fiddly details 5), and only racers already across
  score. It's detected as the same board on the same racer's turn with no dice rolled since, like
  Flip Flop and Copycat as the last two left. A deadlock that still rolls, like four racers on
  space 29 with Coach (+1) and Stickler (exact finishes only), stops after 1,000 turns. Both
  count as `stalled`.
- Optional powers follow each racer's `choose`, a hand-written rule tuned against playouts (see
  "Finding better choices"). Hypnotist avoids targets that would ping-pong forever with a
  Copycat. Flip Flop doesn't, since trading places with one pays on balance, so Flip Flop and
  Copycat as the last two left never finish.
