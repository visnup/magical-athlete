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
- `game.ts`: the engine, which calls those hooks. `Race` runs one race, `playGame` drafts and
  runs four.
- `sim.ts`: quick Monte Carlo. `node scripts/sim.ts --n 100000 --players 5` prints per-racer
  odds; `--mode game` runs whole games; `--log` prints every event and `--csv` a row per racer
  per race, both on one core with `--seed`.
- `ratings.json`: each racer's points, chance of 1st and draft value by race, from
  `lineup.ts --write`. The engine drafts, orders races and picks racers (Egg, Twin, Mastermind,
  Copycat) by it, and standalone races draw Twin's earlier winners from its chances of 1st, so
  regenerate it after a change that moves racers' points. It comes from the previous dataset, so
  it's one pass behind; one pass is close enough.
- `results/` holds raw data as Parquet, a row per racer per race or per player per game, never
  averages. `races.ts` writes the shared race dataset: a million races of random lineups at each
  track and player count (`races-<mild|wild>-<n>p.parquet`), in batches of 100,000 that `write`
  joins with DuckDB and zstd. Races 1 and 3 are on the Mild Mile and 2 and 4 on the Wild Wilds,
  and differ only in chip values, so a row is scored by the race it stands for (`pointsSql`,
  `rowPoints`). For Twin, each race gets the earlier winners of one of its track's two races at
  random (0 or 2 on the Mild Mile, 1 or 3 on the Wild Wilds), so Twin averages over them. Scripts summarize with DuckDB (`query` in
  `results.ts`), which reads the files directly; so can `duckdb` or pandas.
  `make` reruns whatever a change in `src/` or `scripts/` made stale, then the charts (about an
  hour from scratch). A fresh clone's file times are arbitrary, so it may rerun everything.
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
  - `playouts.ts`: each optional power decided by playing out every option (`Race.playout`).
  - `games.ts`: whole games, by draft position and estimated team value.
  - `draft.ts`: drafting strategies for one player against greedy opponents.
  - `endgame.ts`: choosing racers during a game by score, and countering Scoocher.
  - `sensitivity.ts`: the races rerun with each unsettled rule (`Rules` in `game.ts`) read the
    other way.
- `charts.ts` draws `charts/*.svg` for `README.md` from `results/`.
- `parallel.ts` splits a script's races into up to 256 seeded chunks that a worker thread per core
  (`worker.ts`) takes in turn, so one slow chunk doesn't hold up the rest and results don't
  depend on the core count. It adds up the results, or `collect`s their rows. A task is an
  exported function of a module that does nothing at the top level, so scripts guard their main
  code with `if (import.meta.main)`. `tables.ts` runs races of random lineups.
- `node --test` runs `game.test.ts`, which includes the rulebook's Romantic/Scoocher/Banana
  example, `racers.test.ts`, one test per card named for its text, plus the rulebook's notes, and
  `terms.test.ts`, the terms, fiddly details and track spaces on p. 23.
- `TODO.md` is the plan: checking the model first, then the analysis.
- `README.md` is what the simulator has shown so far. Run `make` and update its tables
  when the model changes.

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
  count Start's rounded end as the first).

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
- A race no one can finish, like four racers on space 29 with Coach (+1) and Stickler (exact
  finishes only), stops after 1,000 turns as `stalled`, and only racers already across score.
- Optional powers follow each racer's `choose`, a greedy guess. Hypnotist and Flip Flop avoid
  targets that would ping-pong forever with a Copycat. Mastermind predicts itself unless `rating`
  says otherwise, and with no ratings, drafts, Egg and Twin picks are random.
