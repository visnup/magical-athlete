# TODO

## Check the model

- [x] Check every racer against its card and the rulebook's notes, with a test per racer
      (`racers.test.ts`). Fixed Duelist at the Start and Romantic with Suckerfish.
- [x] Settle Sisyphus: no main move after a 6 warps it to Start. The note saying otherwise is a
      misprint, per the designer.
- [x] A better default duel policy: always dueling beat every alternative tried.
- [x] Official rulings: the August 2026 printing and Garfield's and Hague's BoardGameGeek posts
      settled Scoocher's triggers, tripping, Heckler, Copycat and trigger order (see `racers.ts`).
- [x] Rule-reading sensitivity (`sensitivity.ts`): of what's still open, backward main moves move
      no racer by 0.1 points. Settled: Duelist duels on the Start (worth 0.15 to it), and Blimp's
      second corner is 15 (12 would cost it about 0.2).
- [x] Garfield's queued triggers (`Rules.queue`): only Romantic moves, by 0.1 points a race.
- [x] Compare against real play: BoardGameGeek players and an independent simulator (MagSim) agree
      on the ranking, Scoocher's dominance at bigger tables, and the Wild Wilds star farm. In
      `README.md`.
- [x] Compare per-racer numbers with MagSim's published dataset: rank correlation 0.85–0.87, and
      the big gaps (Twin, Copycat) come from how each simulator sets up races.
- [ ] Log some real games and compare.

## Analysis

- [x] Player count: the points table for 3 to 6 players (`players.ts`, in `README.md`).
- [x] Matchups: each racer's points with and without each other racer in the race (`matchups.ts`,
      in `README.md`).
- [x] Better choices for optional powers (`choices.ts`): compared head to head against
      alternatives. Cheerleader now always cheers, Hypnotist pulls back anyone ahead, and Genius guesses 1
      when leading.
- [x] Race order: a team's value is its best assignment of four racers to four races (24
      orderings). A draft pick's value is how much it raises that (`lineup.ts`).
- [x] Whole games played well (`games.ts`, `endgame.ts`): drafting by rating and playing the best
      race order. Choosing a safe or swingy racer by score loses a tenth of a point a game.
- [x] Draft simulation (`games.ts`, `draft.ts`): the first two picks win 59% of games between them,
      and no strategy tried beats taking the highest-rated racer left by more than 0.1 points a
      game.
- [x] Counter-drafting (`endgame.ts`): M.O.U.T.H. against a Scoocher player wins less, not more.
- [x] The 2-player and 3-player double-racer variants (`playGame({ double: true })`,
      `games.ts --double`): the 2-player draft is fair, the 3-player one gives the first pick
      41.4% of wins.
- [x] Smarter choices by playing out each option (`Race.playout`, `playouts.ts`): close to the
      hand-written choices on the Mild Mile, far better on the Wild Wilds.
- [x] Track-aware choices (`landing` in `racers.ts`) for Legs, Alchemist, Rocket Scientist,
      Cheerleader and Flip Flop: +0.1 to +0.6 points a race on the Wild Wilds. Suckerfish is
      better off ignoring them.
- [x] `sim.ts` on every core, like the other scripts. `--csv` and `--log` still run on one core.
- [x] Points distributions per racer, not just averages, for when you need to catch up
      (`spread.ts`).
- [x] Seat order: what going first is worth, and so what the last-place-starts rule is worth
      (`seats.ts`).
- [x] Twin: rate racers by points per race, then give Twin k − 1 earlier winners drawn from the
      winner distribution and left out of the lineup (`twin.ts`). One pass; the order outside the
      pickers barely moves, so iterating further isn't worth it.
- [x] Give `defaultPolicy.rating` a built-in table from these runs, so Egg, Mastermind, Copycat and
      Twin pick sensibly everywhere (`ratings.json`).
- [x] Raw data for every analysis as Parquet in `results/` (on Hugging Face), summarized with
      DuckDB, and charts with Observable Plot (`charts.ts`).
- [x] Wild Wilds: layout from the board.
