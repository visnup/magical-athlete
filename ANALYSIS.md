# Analysis

What the simulator says so far. Every number is from the model, which follows the August 2026
printing of the rulebook and the official rulings in `racers.ts`, and plays optional powers with
simple greedy choices. None of it has been checked against real games yet.

## How racers are scored

Points per race = gold × P(1st) + silver × P(2nd) + bronze chips. Gold and silver are 3/2, 4/3,
4/3 and 5/4 for races 1 to 4, and races alternate Mild Mile and Wild Wilds. A fair share is
(gold + silver) / players.

Reproduce with `node sim.ts --n 100000 --race k` (5 players, seed 1). The tables below are from
2026-11-03.

## Points per race

Race 1, Mild Mile (3/2; a fair share is 1.00):

| racer | points | 1st | 2nd | bronze |
| --- | --- | --- | --- | --- |
| Lovable Loser | 3.14 | 4.2% | 9.1% | 2.83 |
| Sisyphus | 2.88 | 0.3% | 1.3% | 2.85 |
| Scoocher | 2.37 | 66.4% | 18.8% | 0 |
| Romantic | 2.06 | 54.2% | 21.6% | 0 |
| Suckerfish | 1.62 | 30.9% | 34.8% | 0 |
| Dicemonger | 1.59 | 35.9% | 25.4% | 0 |
| … | | | | |
| Blimp | 0.57 | 10.1% | 13.4% | 0 |
| Centaur | 0.53 | 8.5% | 13.7% | 0 |
| Huge Baby | 0.50 | 8.0% | 13.1% | 0 |
| Mastermind | 0.39 | 4.3% | 13.1% | 0 |
| Twin | 0.29 | 4.0% | 8.5% | 0 |

Race 2, Wild Wilds (4/3; a fair share is 1.40):

| racer | points | 1st | 2nd | bronze |
| --- | --- | --- | --- | --- |
| Scoocher | 7.20 | 50.2% | 21.5% | 4.55 |
| Lovable Loser | 3.80 | 5.3% | 10.5% | 3.27 |
| Sisyphus | 3.67 | 0.6% | 1.7% | 3.59 |
| Suckerfish | 3.57 | 30.5% | 34.0% | 1.33 |
| Dicemonger | 3.48 | 26.4% | 22.6% | 1.75 |
| Heckler | 3.03 | 47.1% | 22.8% | 0.46 |
| … | | | | |
| Centaur | 1.37 | 9.2% | 14.7% | 0.56 |
| Alchemist | 1.31 | 10.6% | 16.9% | 0.38 |
| Mastermind | 1.28 | 5.5% | 16.1% | 0.58 |
| Blimp | 1.25 | 13.6% | 15.4% | 0.25 |
| Twin | 1.08 | 5.1% | 10.3% | 0.57 |

Whole games (`--mode game`, 20,000 games of 5): a team with Scoocher wins 44.9%, against a fair
share of 20%. Lovable Loser's teams win 32.6%, Romantic's 29.4% and Sisyphus's 28.8%.

## Player count

`node players.ts` (100,000 races at each count). Points per race as a multiple of a fair share,
so counts compare directly; selected racers:

| racer | Mild 3p | 4p | 5p | 6p | Wild 3p | 4p | 5p | 6p |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Lovable Loser | 3.35 | 3.25 | 3.14 | 2.98 | 2.86 | 2.79 | 2.72 | 2.67 |
| Sisyphus | 1.64 | 2.25 | 2.88 | 3.54 | 1.55 | 2.07 | 2.62 | 3.18 |
| Scoocher | 1.24 | 1.77 | 2.37 | 2.98 | 1.86 | 3.14 | 5.15 | 7.86 |
| Romantic | 1.15 | 1.55 | 2.06 | 2.53 | 1.27 | 1.62 | 2.07 | 2.57 |
| Legs | 1.50 | 1.60 | 1.52 | 1.37 | 1.36 | 1.47 | 1.44 | 1.39 |
| Stickler | 1.24 | 1.24 | 1.13 | 0.99 | 1.45 | 1.55 | 1.57 | 1.52 |
| Cheerleader | 1.26 | 1.03 | 0.76 | 0.57 | 1.46 | 1.37 | 1.29 | 1.25 |
| M.O.U.T.H. | 1.19 | 1.09 | 0.89 | 0.67 | 1.47 | 1.52 | 1.43 | 1.30 |
| Hypnotist | 1.16 | 1.12 | 0.94 | 0.78 | 1.53 | 1.65 | 1.64 | 1.60 |
| Third Wheel | 0.71 | 0.71 | 0.82 | 0.86 | 0.99 | 1.06 | 1.23 | 1.40 |
| Mastermind | 0.76 | 0.50 | 0.39 | 0.30 | 1.04 | 0.92 | 0.91 | 0.92 |

**Scoocher's dominance is a big-table effect.** At 3 players it earns 1.24 fair shares on the
Mild Mile, behind Lovable Loser, Sisyphus, Legs, Flip Flop and Cheerleader. Each extra racer is
another power going off every turn, so by 6 players it's 3 fair shares on the Mild Mile and 7.9
on the Wild Wilds. Romantic, Suckerfish, Dicemonger and Heckler also feed on traffic and climb
with the count.

**Bronze racers look better at big tables partly by arithmetic.** Sisyphus's 4 chips are worth
the same at any count while a fair share of gold and silver shrinks, so its multiple doubles from
3 to 6 players. Lovable Loser slips slightly instead: being alone in last gets harder in a crowd.

**Some racers want small tables.** Cheerleader, M.O.U.T.H., Hypnotist, Banana, Alchemist,
Coach, Magician and Gunk all lose ground as the count rises. Cheerleader is the starkest on the
Mild Mile (1.26 to 0.57), since with more racers it's rarely the one in last place.

**At 3 players the field flattens.** Most racers sit between 0.8 and 1.3 fair shares. Only Lovable
Loser stands out, and Twin, Mastermind, Third Wheel and Huge Baby trail.

## Findings

**Winning isn't the measure; points are.** Lovable Loser and Sisyphus almost never place but top
race 1, because each collects about 2.8 bronze chips a race whatever happens. Placing pays less
in race 1 than later, so they're worth the most early. Racers that win often are worth more in
later races.

**Scoocher wins most races.** It wins 66% of 5-player Mild Mile races. It moves 1 after every other
racer's power, including passive ones every turn, which Richard Garfield's rule of thumb supports:
anything that changes the board versus a racer with no power is a power happening. That's about
18 extra spaces a race. This is the first thing to check against real play.

**Romantic is strong but less so under the 2026 printing.** It moves 2 whenever any racer stops
next to exactly one other, which is constant while everyone is bunched up early. The 2026
printing stops it triggering for racers that arrive together, as with Suckerfish or Party Animal,
which took its Mild Mile wins from 61% to 54%.

**Scoocher and Suckerfish carry each other to the finish.** When they share a space, Scoocher
moves, Suckerfish moves with it, which is a power, so Scoocher moves again, all the way across
the line. The rulebook allows it ("Some powers can interact many times but aren't a loop, like
Scoocher/Suckerfish"). Left as the rules make it.

**Suckerfish declining a ride doesn't pay for Suckerfish.** Staying put near the finish rather
than riding another player's Scoocher home raises Suckerfish's wins from 3% to 19%, but its
points stay the same in race 1 (1.74) and drop in race 4 (3.45 to 3.29). Gold beats silver by
only 1 point. It's kept because it costs Scoocher's owner a lot. (Measured under the 2025
printing.)

**The Wild Wilds has a cycle.** The arrow on 16 sends racers back to 12, so anything moving 1
space at a time circles 12–16 and crosses the star on 13 each lap. Scoocher averages 4.55 bronze
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

## What's still unsettled, and how much it matters

`node sensitivity.ts` reruns races 1 and 2 with each open reading flipped. None matters beyond its
own racer:

| reading | race 1 | race 2 |
| --- | --- | --- |
| main moves pushed below 0 go backwards (Hague yes, Garfield no) | under 0.1 for everyone | under 0.1 for everyone |

Two more were settled rather than left open:
- Duelist duels everyone on the Start before the first turn, worth about 0.15 points a race to it.
- Blimp's second corner is space 15, where the track turns the second time. Counting Start's
  rounded end as the first corner would make it 12 and cost Blimp about 0.2 points a race.

Untested: Garfield's description of queuing triggers and resolving them even after the board
changes. The engine re-checks each trigger when it resolves.

## Rules findings

- The 2025 printing's note under Sisyphus, "I still get my main move after warping", was a
  misprint; the 2026 printing says "I don't get my main move after warping."
- Some races can't end, like four racers on space 29 with Coach (+1) and Stickler (exact finishes
  only). The 2026 printing ends such a race with no further points.
- A Copycat ping-pongs forever with Hypnotist or Flip Flop if they keep targeting each other. The
  model's choices avoid it.
- Huge Baby on 12 traps a racer between 11's arrow (+1) and 16's (−4). The loop rule ends it
  after one pass.

## Next

`TODO.md` has the rest. In order:

1. Player count from 3 to 6 players.
2. Matchups between pairs of racers.
3. The Twin rating pass.
