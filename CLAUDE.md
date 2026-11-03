# magical-athlete

A simulator of the CMYK board game Magical Athlete. No dependencies; Node 24 runs the TypeScript
directly.

The rules are the August 2026 printing, `magical-athlete-2026-08.pdf` (from the game's
BoardGameGeek files). `magical-athlete.pdf` is the 2025 first printing
(https://bghub.org/r/magical-athlete.pdf). Neither is committed. Where they differ, the 2026
printing wins: it rewrote tripping, "before my main move" powers, backward passing and
simultaneous arrivals, and fixed Sisyphus's misprinted note.

- `racers.ts`: each racer's rules as hooks, with its default choice and everything the rulebook
  says about it (flavor text, card, notes, and passages elsewhere that name it), plus official
  rulings from BoardGameGeek with links.
- `game.ts`: the engine, which calls those hooks. `Race` runs one race, `playGame` drafts and
  runs four.
- `sim.ts`: Monte Carlo. `node sim.ts --n 100000 --players 5` prints per-racer odds;
  `--mode game` runs whole games; `--csv` prints one row per racer per race (or per player per
  game) instead; `--log` prints every event.
- `players.ts`: each racer's points as a multiple of a fair share at 3 to 6 players.
- `matchups.ts`: how each racer's points change with each other racer in the race; `--csv` for
  every pair.
- `sensitivity.ts`: reruns the points table with each unsettled rule (`Rules` in `game.ts`) read
  the other way and lists the racers that move.
- `node --test` runs `game.test.ts`, which includes the rulebook's Romantic/Scoocher/Banana
  example, `racers.test.ts`, one test per card named for its text, plus the rulebook's notes, and
  `terms.test.ts`, the terms, fiddly details and track spaces on p. 23.
- `TODO.md` is the plan: checking the model first, then the analysis.
- `ANALYSIS.md` is what the simulator has shown so far. Update its tables when the model changes.

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
