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
- [ ] Untested reading: Garfield queues triggers and resolves them even if the board has changed
      since; the engine re-checks each one. Testing it means splitting hooks into a condition and
      an effect.
- [ ] Compare against what players report on BoardGameGeek. Scoocher and Romantic winning over 60%
      of 5-player races is the first thing to explain.

## Analysis

- [x] Player count: the points table for 3 to 6 players (`players.ts`, in `ANALYSIS.md`).
- [x] Matchups: each racer's points with and without each other racer in the race (`matchups.ts`,
      in `ANALYSIS.md`).
- [ ] Better choices for optional powers: decide by playing out a few hundred random finishes per
      option, and compare against `defaultPolicy`.
- [x] Race order: a team's value is its best assignment of four racers to four races (24
      orderings). A draft pick's value is how much it raises that (`lineup.ts`).
- [ ] Use `lineup.ts`'s values in `playGame`: draft by draft value and play the best order, then
      check whole games against the estimate.
- [x] Points distributions per racer, not just averages, for when you need to catch up
      (`spread.ts`).
- [x] Seat order: what going first is worth, and so what the last-place-starts rule is worth
      (`seats.ts`).
- [x] Twin: rate racers by points per race, then give Twin k − 1 earlier winners drawn from the
      winner distribution and left out of the lineup (`twin.ts`). One pass; the order outside the
      pickers barely moves, so iterating further isn't worth it.
- [ ] Give `defaultPolicy.rating` a built-in table from these runs, so Egg, Mastermind, Copycat and
      Twin pick sensibly everywhere, and rerun the tables.
- [x] Wild Wilds: layout from the board.
