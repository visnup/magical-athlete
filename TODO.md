# TODO

## Check the model

- [x] Check every racer against its card and the rulebook's notes, with a test per racer
      (`racers.test.ts`). Fixed Duelist at the Start and Romantic with Suckerfish.
- [x] Settle Sisyphus: no main move after a 6 warps it to Start. The note saying otherwise is a
      misprint, per the designer.
- [x] A better default duel policy: always dueling beat every alternative tried.
- [ ] Rule-reading sensitivity: flip each interpretation in `CLAUDE.md` one at a time and rerun
      the points table. Any reading that moves a racer a lot needs settling.
- [ ] Compare against what players report on BoardGameGeek. Scoocher and Romantic winning over 60%
      of 5-player races is the first thing to explain.

## Analysis

- [ ] Player count: the points table for 3 to 6 players.
- [ ] Matchups: each racer's points with and without each other racer in the race (630 pairs).
- [ ] Better choices for optional powers: decide by playing out a few hundred random finishes per
      option, and compare against `defaultPolicy`.
- [ ] Race order: a team's value is its best assignment of four racers to four races (24
      orderings). A draft pick's value is how much it raises that.
- [ ] Points distributions per racer, not just averages, for when you need to catch up.
- [ ] Seat order: what going first is worth, and so what the last-place-starts rule is worth.
- [ ] Twin: rate racers by points per race, then give Twin k − 1 earlier winners drawn from the
      winner distribution and left out of the lineup. Iterate until the order stops changing.
- [x] Wild Wilds: layout from the board.
