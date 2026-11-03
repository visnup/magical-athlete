# Analysis

What the simulator says so far. Every number is from the model, which follows the rulebook as
`CLAUDE.md` reads it and plays optional powers with simple greedy choices. None of it has been
checked against real games yet.

## How racers are scored

Points per race = gold × P(1st) + silver × P(2nd) + bronze chips. Gold and silver are 3/2, 4/3,
4/3 and 5/4 for races 1 to 4, and races alternate Mild Mile and Wild Wilds. A fair share is
(gold + silver) / players.

Reproduce with `node sim.ts --n 100000 --race k` (5 players, seed 1). The tables below are from
2026-11-02.

## Points per race

Race 1, Mild Mile (3/2; a fair share is 1.00):

| racer | points | 1st | 2nd | bronze |
| --- | --- | --- | --- | --- |
| Lovable Loser | 3.08 | 4.1% | 9.0% | 2.78 |
| Sisyphus | 2.89 | 0.3% | 1.4% | 2.85 |
| Scoocher | 2.29 | 63.2% | 19.9% | 0 |
| Romantic | 2.22 | 61.3% | 19.0% | 0 |
| Dicemonger | 1.57 | 35.9% | 24.7% | 0 |
| Suckerfish | 1.57 | 26.3% | 38.9% | 0 |
| … | | | | |
| Blimp | 0.56 | 9.9% | 13.3% | 0 |
| Huge Baby | 0.52 | 8.3% | 13.8% | 0 |
| Centaur | 0.52 | 8.0% | 14.0% | 0 |
| Mastermind | 0.39 | 4.2% | 13.2% | 0 |
| Twin | 0.31 | 4.3% | 9.0% | 0 |

Race 2, Wild Wilds (4/3; a fair share is 1.40):

| racer | points | 1st | 2nd | bronze |
| --- | --- | --- | --- | --- |
| Scoocher | 6.94 | 48.2% | 22.0% | 4.35 |
| Sisyphus | 3.62 | 0.5% | 1.7% | 3.54 |
| Lovable Loser | 3.55 | 4.8% | 10.7% | 3.03 |
| Dicemonger | 3.42 | 26.1% | 22.7% | 1.70 |
| Suckerfish | 3.42 | 29.5% | 34.9% | 1.20 |
| Romantic | 3.06 | 51.0% | 20.5% | 0.41 |
| … | | | | |
| Centaur | 1.32 | 8.7% | 14.3% | 0.54 |
| Alchemist | 1.30 | 10.9% | 16.8% | 0.36 |
| Blimp | 1.26 | 13.8% | 15.8% | 0.24 |
| Mastermind | 1.23 | 5.2% | 16.2% | 0.54 |
| Twin | 1.08 | 5.3% | 10.5% | 0.55 |

## Findings

**Winning isn't the measure; points are.** Lovable Loser and Sisyphus almost never place but top
race 1, because each collects about 2.8 bronze chips a race whatever happens. Placing pays less
in race 1 than later, so they're worth the most early. Racers that win often are worth more in
later races.

**Scoocher and Romantic win most races.** Each wins about 60% of 5-player Mild Mile races.
Scoocher moves 1 after every other racer's power, including passive ones every turn, as its card
note says for Gunk's -1. That's about 18 extra spaces a race. Romantic moves 2 whenever any
racer stops next to exactly one other, which is constant early on while everyone is bunched up.
This is the first thing to check against real play: if real tables don't see it, the model reads
one of these powers too generously.

**Scoocher and Suckerfish carry each other to the finish.** When they share a space, Scoocher
moves, Suckerfish rides along, which is a power, so Scoocher moves again, all the way across the
line. The rulebook allows it ("You can keep doing those!"). On the Mild Mile, one of the two wins
82% of the races they're both in. Left as the rules make it.

**Suckerfish declining a ride doesn't pay for Suckerfish.** Staying put near the finish rather
than riding another player's Scoocher home raises Suckerfish's wins from 3% to 19%, but its
points stay the same in race 1 (1.74) and drop in race 4 (3.45 to 3.29). Gold beats silver by
only 1 point. It's kept because it costs Scoocher's owner a lot.

**The Wild Wilds has a cycle.** The arrow on 16 sends racers back to 12, so anything moving 1
space at a time circles 12–16 and crosses the star on 13 each lap. Scoocher averages 4.35 bronze
a race there. With Suckerfish too, the pair farmed about 21 a race until bronze was capped at the
43 points of chips in the box. The cap is shared across the whole game, so in full games the pair
also starves everyone else's stars.

**The Duelist should always duel.** It wins 58% of duels, ties included, and every alternative
scored lower (race-1 points over 200,000 races): always 0.99, declining against racers a loss
would carry across the line 0.88, also declining late in the race 0.76, never 0.32.

**Some racers look weak because of the simulation, not the card.**
- Twin has no previous winners to copy in a standalone race.
- Mastermind predicts itself by default.
- Egg and Copycat pick at random, because no rating is set yet.

The Twin rating pass in `TODO.md` fixes the first, and the same ratings fix the rest.

## Rules findings

- Sisyphus's rulebook note, "I still get my main move after warping", is a misprint copied from
  Third Wheel's. The designer confirmed you warp back instead of moving, which is what the model
  does.
- Some races can't end: four racers on space 29 with Coach (+1) and Stickler (exact finishes only).
- Without house rules, a Copycat ping-pongs forever with Hypnotist or Flip Flop, and a Hare left
  alone on the track never moves. The model avoids these.
- Huge Baby on 12 traps a racer between 11's arrow (+1) and 16's (−4). The rulebook's loop rule
  ends it after one pass.

## Next

`TODO.md` has the rest. In order:

1. Rule-reading sensitivity: flip each interpretation and rerun, starting with Scoocher's
   passive triggers.
2. Player count from 3 to 6 players.
3. Matchups between pairs of racers.
4. The Twin rating pass.
