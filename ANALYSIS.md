# Analysis

What the simulator says so far. Every number is from the model, which follows the August 2026
printing of the rulebook and the official rulings in `racers.ts`, and plays optional powers with
simple greedy choices. It agrees with an independent simulator and with what players report (see
"Against real play"), but hasn't been checked against logged real games.

The points-per-race and race-order tables are current as of the track-aware choices; the
sections after them were measured along the way and are labelled where an older engine matters.

## How racers are scored

Points per race = gold × P(1st) + silver × P(2nd) + bronze chips. Gold and silver are 3/2, 4/3,
4/3 and 5/4 for races 1 to 4, and races alternate Mild Mile and Wild Wilds. A fair share is
(gold + silver) / players.

Reproduce with `node scripts/sim.ts --n 100000 --race k` (5 players, seed 1). The tables below are from
2026-11-03.

## Points per race

Race 1, Mild Mile (3/2; a fair share is 1.00):

| racer | points | 1st | 2nd | bronze |
| --- | --- | --- | --- | --- |
| Lovable Loser | 3.03 | 3.7% | 8.7% | 2.74 |
| Sisyphus | 2.91 | 0.3% | 1.2% | 2.88 |
| Scoocher | 2.36 | 64.4% | 21.3% | 0 |
| Romantic | 2.05 | 54.1% | 21.3% | 0 |
| Suckerfish | 1.63 | 30.6% | 35.7% | 0 |
| Egg | 1.59 | 25.8% | 20.8% | 0.40 |
| Dicemonger | 1.50 | 33.1% | 25.0% | 0 |
| … | | | | |
| Alchemist | 0.65 | 9.8% | 17.8% | 0 |
| Blimp | 0.53 | 9.5% | 12.4% | 0 |
| Centaur | 0.51 | 7.9% | 13.5% | 0 |
| Huge Baby | 0.46 | 7.1% | 12.2% | 0 |
| Twin | 0.29 | 3.7% | 8.8% | 0 |

Race 2, Wild Wilds (4/3; a fair share is 1.40):

| racer | points | 1st | 2nd | bronze |
| --- | --- | --- | --- | --- |
| Scoocher | 7.23 | 48.4% | 21.9% | 4.64 |
| Lovable Loser | 3.70 | 4.8% | 9.8% | 3.21 |
| Suckerfish | 3.70 | 30.5% | 34.2% | 1.45 |
| Sisyphus | 3.69 | 0.5% | 2.0% | 3.61 |
| Dicemonger | 3.38 | 24.4% | 21.3% | 1.76 |
| Copycat | 3.17 | 32.6% | 23.5% | 1.16 |
| … | | | | |
| Coach | 1.34 | 11.8% | 17.8% | 0.34 |
| Alchemist | 1.33 | 9.8% | 16.1% | 0.46 |
| Centaur | 1.31 | 8.1% | 13.8% | 0.57 |
| Blimp | 1.18 | 12.4% | 14.2% | 0.26 |
| Twin | 1.06 | 4.8% | 10.2% | 0.56 |

Twin is last only because a standalone race gives it no earlier winners to copy; with them, it's
the second-best racer in race 4 (see "Racers that pick racers"). Mastermind and Egg improved once
they chose by the built-in ratings.

## Player count

`node scripts/players.ts` (100,000 races at each count). Points per race as a multiple of a fair share,
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

## Matchups

`node scripts/matchups.ts` (a million races of 5 per track) compares each racer's points when another
racer is in the race with when it isn't. Largest effects, in race-1 or race-2 points:

| racer | with | Mild Mile | Wild Wilds |
| --- | --- | --- | --- |
| Suckerfish | Scoocher | | +6.14 (2.87 → 9.01) |
| Scoocher | Suckerfish | | +5.04 (6.59 → 11.63) |
| Copycat | Scoocher | +0.53 | +5.01 (2.29 → 7.31) |
| Scoocher | Gunk | +0.57 | +3.65 |
| Copycat | Flip Flop | +0.77 (1.20 → 1.97) | |
| Heckler | Gunk, Banana, Baba Yaga | +0.61 to +0.76 | |
| Lovable Loser | Gunk, Hypnotist | +0.63 to +0.76 | |
| Huge Baby | M.O.U.T.H. | +0.71 (0.41 → 1.12) | |
| Lovable Loser | Sisyphus | −1.50 (3.31 → 1.81) | −1.29 |
| Scoocher | M.O.U.T.H. | −0.58 | −2.75 (7.47 → 4.72) |
| Dicemonger | Scoocher | −0.80 (1.67 → 0.87) | |
| Legs, Heckler, Skipper | Dicemonger | −0.66 to −0.71 | |

**Scoocher feeds on other powers, so anything that adds them helps it.** Gunk's -1 every turn,
Copycat, Romantic, Hypnotist and Party Animal all add triggers. Racers whose powers rarely go off
(Twin without a winner to copy, Mastermind, Alchemist, Rocket Scientist, Third Wheel) cost it
over a point a race on the Wild Wilds by taking a seat a busier racer would have had.

**M.O.U.T.H. is the counter to Scoocher.** Scoocher creeps forward one space at a time and keeps
stopping next to other racers, which is exactly what M.O.U.T.H. eats. M.O.U.T.H. also counters
Romantic and Party Animal, which pull racers into pairs.

**Lovable Loser and Sisyphus can't share a race.** Sisyphus keeps warping back to Start, so
Lovable Loser is rarely alone in last; they also draw on the same bronze chips.

**Heckler likes anything that stalls racers.** Trips (Banana, Baba Yaga) and Gunk's -1 make more
racers end a turn within one space of where they started, which is Heckler's trigger.

**Dicemonger shares its rerolls with everyone.** Each reroll also moves Scoocher, and it helps
racers like Legs and Skipper less than it helps their opponents.

**Huge Baby is safe from M.O.U.T.H.** Nothing can stop on Huge Baby's space, so M.O.U.T.H. can't
eat it, while it eats the racers around it.

## Race order and the draft

`node scripts/lineup.ts` takes each racer's points in each of the four races (100,000 races of 5 each),
then values a team as its best assignment of four racers to four races. A racer's draft value is
the average value of random teams it's on, against the average team (8.96 points a game). Twin
copies earlier winners drawn from the earlier races, and the pickers choose by these ratings,
which `lineup.ts --write` saves to `ratings.json` for the engine to play by.

| racer | race 1 (Mild 3/2) | race 2 (Wild 4/3) | race 3 (Mild 4/3) | race 4 (Wild 5/4) | usually played in | draft value |
| --- | --- | --- | --- | --- | --- | --- |
| Scoocher | 2.36 | 7.50 | 3.24 | 8.25 | 4 | +4.69 |
| Twin | 0.29 | 2.82 | 2.13 | 4.67 | 4 (always) | +1.40 |
| Suckerfish | 1.63 | 3.82 | 2.26 | 4.61 | 4 | +1.35 |
| Lovable Loser | 3.03 | 3.73 | 3.15 | 3.91 | 1 | +1.27 |
| Sisyphus | 2.91 | 3.71 | 2.96 | 3.72 | 1 | +1.17 |
| Romantic | 2.04 | 2.88 | 2.74 | 3.51 | 3 | +0.75 |
| Copycat | 1.47 | 3.26 | 2.08 | 3.89 | 4 | +0.74 |
| Dicemonger | 1.51 | 3.35 | 2.02 | 3.77 | 2 | +0.73 |
| Egg | 1.59 | 3.22 | 2.10 | 3.87 | 4 | +0.71 |
| Flip Flop | 1.42 | 2.92 | 1.92 | 3.46 | 4 | +0.36 |
| Heckler | 1.43 | 2.88 | 1.91 | 3.46 | 4 | +0.35 |
| … | | | | | | |
| Huge Baby | 0.46 | 1.46 | 0.61 | 1.71 | 2 | −0.96 |
| Blimp | 0.55 | 1.11 | 0.70 | 1.34 | 1 | −1.00 |
| Centaur | 0.51 | 1.26 | 0.67 | 1.48 | 1 | −1.02 |

**The Wild Wilds races are worth more than the Mild Mile races for everyone.** Stars add bronze,
and race 2 (4/3) on the Wild Wilds out-earns race 3 (4/3) on the Mild Mile at the same chip
values. Race 4 is the jackpot.

**Put Scoocher in race 4, and the bronze racers in race 1.** Lovable Loser's and Sisyphus's points
barely change from race to race, so they cost the least to spend on the cheapest race.

**Some racers prefer the Mild Mile.** Romantic, Legs, Hare, Lackey and Magician usually go to race
3: they're about as good on the Mild Mile as on the Wild Wilds, while others gain more from the
stars. Inchworm, Huge Baby, Hypnotist and Cheerleader go to race 2 for the opposite reason.

**In the draft, Scoocher is worth about 4.8 points a game over an average pick,** three and a
half times the next racer. After it come Suckerfish, Twin (saved for race 4), Lovable Loser and
Sisyphus.

## Optional powers

`node scripts/choices.ts` races each racer with an optional power in every race (100,000 races of 5) and
compares its current choice with alternatives. Points per race, race 1 / race 2:

| racer | current choice | alternatives |
| --- | --- | --- |
| Alchemist | always move 4 | never: 0.30 / 1.10, against 0.70 / 1.32 |
| Cheerleader | **was** only from last place: 0.76 / 1.81 | **always: 1.13 / 2.36**, never: 0.31 / 1.12 |
| Flip Flop | swap with the farthest racer 4+ ahead: 1.49 / 2.66 | 2+ ahead −0.30 / −0.16, 6+ ahead −0.04 / −0.04 |
| Genius | predict 6: 0.83 / 1.71 | every other number is worse; 1 is worst (−0.21 / −0.24) |
| Hypnotist | **was** opponents 4+ ahead: 0.94 / 2.30 | **anyone ahead: +0.07 / +0.20**, 7+ ahead −0.24 / −0.39 |
| Legs | always move 5 | never: 0.33 / 1.12, against 1.53 / 2.05 |
| Magician | reroll 1–4, then 1–3: 1.02 / 1.68 | 1–3 both times −0.03 / −0.08, 1–2 −0.21 / −0.19 |
| Rocket Scientist | double on 4+: 0.91 / 2.13 | 5+ +0.02 / −0.07, always −0.23 / −0.66 |
| Suckerfish | ride, except another player's Scoocher near the finish | always ride +0.02 / +0.02 |
| Third Wheel | farthest pair ahead: 0.81 / 1.74 | nearest pair ahead −0.01 / −0.02 |

Two defaults changed:
- **Cheerleader now always cheers.** The last-place racers get 2, but Cheerleader always gets its
  1. It's worth half a point a race.
- **Hypnotist now pulls back any opponent ahead,** except Copycat and Baba Yaga. Pulling a Copycat
  back makes it copy Hypnotist and pull straight back, forever. Pulling Baba Yaga onto your own
  space trips you, which stalled races when it repeated. New score: 1.01 / 2.44.

The rest were already the best of what was tried. Every racer's power is worth a lot over no
power at all: "never" costs 0.4 to 2.5 points a race.

The other tables in this file predate these two changes, which affect only Cheerleader and
Hypnotist themselves noticeably.

### By playing out each option

`node scripts/playouts.ts` decides each choice by replaying the turn up to it, forcing each option, and
playing the race out 20 times per option, then compares with the hand-written choice (4,000 races
of 5 per racer; differences under about 0.1 are noise):

| racer | race 1, Mild Mile | race 2, Wild Wilds |
| --- | --- | --- |
| Flip Flop | 1.40 → 1.89 (+0.49) | 2.52 → 4.18 (+1.66) |
| Legs | 1.45 → 1.43 | 1.95 → 2.64 (+0.69) |
| Suckerfish | 1.64 → 1.66 | 3.70 → 4.18 (+0.48) |
| Cheerleader | 1.07 → 1.06 | 2.31 → 2.71 (+0.40) |
| Rocket Scientist | 0.85 → 1.00 (+0.14) | 2.05 → 2.44 (+0.39) |
| Mastermind | 0.85 → 1.20 (+0.35) | 1.82 → 2.20 (+0.38) |
| Alchemist | 0.62 → 0.66 | 1.25 → 1.54 (+0.29) |
| Hypnotist | 0.98 → 0.92 | 2.42 → 2.56 (+0.14) |
| Genius, Duelist, Third Wheel | within ±0.1 | within ±0.1 |

**On the Mild Mile the hand-written choices are close to the best.** The exceptions are Flip Flop,
whose best swap depends on more than distance, and Mastermind, which does better predicting the
likely winner of this particular race than the best-rated racer.

**On the Wild Wilds they leave a lot behind, because they ignore the track.** Moving 5 or the roll,
4 or the roll, double or not, riding or not, swapping with whom: each lands on a different space,
and a star, a rock or an arrow there is worth more than a space or two of distance. Playouts see
that; the heuristics didn't.

**So the heuristics now score where each option lands** (`landing` in `racers.ts`: an arrow's move
counts, a star is worth 3 spaces, a rock costs a roll). Head to head in the same `choices.ts`
runs, race-2 points on the Wild Wilds, previous → now: Legs 1.95 → 2.54, Flip Flop 2.56 → 2.95,
Rocket Scientist 2.03 → 2.23, Alchemist 1.23 → 1.34, Cheerleader 2.30 → 2.41. The Mild Mile is
unchanged within ±0.03. Suckerfish was tried too and kept as it was: it scored 2.95 against 3.75
for always riding, because a ride the −4 arrow sends back still passes the star on 13 again.

Not covered: Magician's rerolls and the before-race picks (Egg, Twin), which happen outside a
turn's snapshot or outside `choose`.

## Racers that pick racers

`node scripts/twin.ts` reruns Twin, Egg, Mastermind and Copycat with a rating to choose by (each racer's
points in that race) and, for Twin, earlier winners to copy. The earlier winners are drawn from
earlier races' chances of 1st, leaving out this race's lineup. Points per race, 100,000 races of
5:

| racer | race 1 | race 2 | race 3 | race 4 |
| --- | --- | --- | --- | --- |
| Twin | 0.31 → 0.29 | 1.10 → 2.79 | 0.45 → 2.11 | 1.26 → 4.57 |
| Egg | 1.17 → 1.68 | 2.29 → 3.15 | 1.58 → 2.11 | 2.70 → 3.66 |
| Mastermind | 0.38 → 0.90 | 1.25 → 1.86 | 0.55 → 1.30 | 1.45 → 2.33 |
| Copycat | 1.29 → 1.35 | 2.85 → 3.12 | 1.81 → 1.90 | 3.33 → 3.76 |

**Twin is a late-race racer, and in race 4 it's the second best of all,** behind only Scoocher.
With three earlier winners to choose from, it can usually copy a strong one, often Scoocher,
which wins half the races it's in. In race 1 it has nothing to copy. In the draft it's worth far
more than `lineup.ts` shows, since that table has Twin with nothing to copy.

**Egg and Mastermind gain about half a point to a point a race from choosing well.** Egg moves
into the top 10 in every race. Mastermind does better predicting the strongest racer in the
lineup than predicting itself, though it stays below average.

**Copycat barely changes:** it only picks when the lead is tied.

The rest of the order hardly moves (rank correlation 0.81–0.97 against the unrated tables). Most
of the movement is these four racers changing places with their neighbors.

## Whole games

`node scripts/games.ts` plays 100,000 games of 5 where everyone drafts the highest-rated racer left and
plays each team in its best race order (`ratings.json`).

| first-round pick | score | wins |
| --- | --- | --- |
| 1 | 11.30 | 28.5% |
| 2 | 11.61 | 30.6% |
| 3 | 9.42 | 16.3% |
| 4 | 8.40 | 12.9% |
| 5 | 7.77 | 11.7% |

**Draft order decides a lot.** Only 10 racers are flipped up per round, and the value is
concentrated in a few of them (Scoocher above all), so the first picks take most of it. The 2nd
pick does best of all: the second snake draft starts with the player to the left of the first
pick, so it picks first in that round, while the first pick goes second. Between them they win
59% of games, against 40% for an even share. That's from an even roll-off, so it's the game's
biggest swing that isn't on the track.

**Team value predicts the winner, loosely.** The team with the best estimated value wins 42.3% of
games, against 20% for an even share, and the estimate correlates 0.47 with the final score.
Estimates run low (9.00 against 9.70 actual), probably because they come from races against
random opponents rather than drafted, stronger ones.

## The two-racer variants

`node scripts/games.ts --double --players 2` (or 3) plays the variants: everyone drafts 8 racers and races
two at a time. 100,000 games each, with standard 3-player games for comparison:

| game | 1st pick wins | 2nd pick | 3rd pick | best estimated team wins |
| --- | --- | --- | --- | --- |
| 2 players, two racers each | 50.5% | 49.5% | | 56.8% |
| 3 players, two racers each | 42.5% | 29.4% | 28.2% | 58.0% |
| 3 players, standard | 34.9% | 34.3% | 30.8% | 36.9% |
| 5 players, standard | 28.5% | 30.6% | 16.3% (then 12.9%, 11.7%) | 42.3% |

**The 2-player variant's draft is fair.** Its ABBAABBA rows, with the second draft reversed,
cancel the first pick's edge.

**The 3-player variant's draft isn't.** It runs four snake drafts of 6, rotating who starts, so
the first player starts two of the four and wins 42.5% of games against 33.3% for an even share.
A table could fix it by giving the last pick of the first draft the first pick of the fourth.

**Standard drafts are fair at 3 players but not at 5,** where only the first two players ever
start a round.

**Team quality matters more with two racers each.** The best estimated team wins 57–58% of the
time in the variants, against 37% in standard 3-player games, where one racer per race leaves
more to luck.

## Drafting strategy

`node scripts/draft.ts` gives one randomly seated player a different drafting strategy against
opponents who take the highest-rated racer left (100,000 games of 5 each):

| my draft | wins | score |
| --- | --- | --- |
| highest rating, as opponents do | 20.1% | 9.71 |
| most added to my best race order | 20.1% | 9.72 |
| my gain plus the most it would add to an opponent (denial) | 19.9% | 9.71 |

**Nothing beats taking the highest-rated racer.** The value is concentrated in a few racers, so the
racer that adds most to your team, the one that adds most to an opponent's, and the highest-rated
one are nearly always the same pick. Where you sit in the draft matters far more than how you
draft.

## Choosing racers during the game

`node scripts/endgame.ts` lets one randomly seated player choose its racer before each race differently
from the opponents, who play their best race order (100,000 games of 5 each):

| my choices | wins | score | my M.O.U.T.H. met their Scoocher | wins in those games |
| --- | --- | --- | --- | --- |
| best race order, as opponents do | 19.9% | 9.69 | 0.9% of games | 15.0% |
| by score: with two left, save the safe one when ahead, the likely winner when behind | 19.3% | 9.45 | | |
| counter: draft M.O.U.T.H. once an opponent has Scoocher, and race it in Scoocher's race | 19.3% | 9.22 | 5.5% of games | 9.7% |

**Just play your best race order.** Switching by score gives up a quarter of a point a game, and
the racers' spreads are too alike for the safety or the long shot to make it back.

**Countering Scoocher doesn't pay for the counterer.** When your M.O.U.T.H. meets their Scoocher
you win only 9.7% of the time. Slowing or eating Scoocher helps the other three opponents as much
as you, while it costs you a better draft pick and M.O.U.T.H.'s own best race.

## Spread of points

`node scripts/spread.ts` (race 4 by default, 100,000 races of 5). An average hides how a racer gets there.
Race 4 on the Wild Wilds (5/4), selected:

| racer | mean | sd | 0 points | at least gold |
| --- | --- | --- | --- | --- |
| Scoocher | 7.92 | 4.57 | 1% | 83% |
| Suckerfish | 4.21 | 3.45 | 17% | 50% |
| Lovable Loser | 3.96 | 2.77 | 11% | 42% |
| Dicemonger | 3.97 | 2.44 | 5% | 48% |
| Heckler | 3.73 | 2.31 | 19% | 55% |
| Sisyphus | 3.69 | 1.56 | 2% | 25% |
| Romantic | 3.57 | 2.33 | 21% | 53% |
| Copycat | 3.33 | 3.20 | 26% | 40% |
| Mastermind | 1.50 | 2.40 | 47% | 10% |

**Protecting a lead in race 4:** pick a racer that rarely scores nothing. Sisyphus (2%),
Dicemonger (5%) and Lovable Loser (11%) are nearly sure of a few points, and Sisyphus is the
steadiest of all (sd 1.56).

**Catching up in race 4:** pick a racer that often wins. Heckler (55%), Romantic (53%) and
Suckerfish (50%) take gold about half the time, against Sisyphus's 25%. Scoocher is both the
safest and the likeliest to win, so it's the best racer whichever position you're in.

## Seat order

`node scripts/seats.ts` (200,000 races at each count). Points by seat, seat 1 going first:

| players | seat 1 | seat 2 | seat 3 | seat 4 | seat 5 | seat 6 | seat 1 − average |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3 | 2.00 | 1.86 | 1.74 | | | | +0.13 |
| 4 | 1.57 | 1.47 | 1.36 | 1.31 | | | +0.15 |
| 5 | 1.29 | 1.21 | 1.14 | 1.09 | 1.06 | | +0.13 |
| 6 | 1.09 | 1.03 | 0.99 | 0.96 | 0.93 | 0.90 | +0.10 |

That's race 1 on the Mild Mile; the Wild Wilds is about the same (+0.08 to +0.13).

**Going first is worth about 0.1–0.15 points a race,** roughly 10% above an average seat, and
each later seat is worth a little less. With 5 players, seat 1 earns 22% more than seat 5. The
rule that the farthest-behind racer's player starts the next race is worth that much to them: a
small catch-up, far smaller than a strong racer is worth.

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

**Some racers look weak in the other tables because of the simulation, not the card.** Twin has
no earlier winners to copy in a standalone race, and Egg, Mastermind and Copycat pick at random
without a rating. "Racers that pick racers" above measures them properly.

## Against real play and another simulator

What players report on BoardGameGeek agrees with the model on the main points:

- **Scoocher is the strongest racer, more so at bigger tables.** In
  ["Is Scoocher OP?"](https://boardgamegeek.com/thread/3635824), players describe it running away
  with races and "worse with higher player counts", but beatable with Hypnotist or Flip Flop
  around. One player names Mastermind, Centaur and Third Wheel as "really quite bad" and Scoocher,
  Gunk and Suckerfish as "game-warpingly good."
- **The Wild Wilds star farm happens at real tables.** In the same thread, a Scoocher stuck
  around the −4 arrow kept scooching onto the star and "amassed a whopping 14 points."
- **The spread is deliberate.** Richard Garfield, in that thread: "the intent was to keep a pretty
  big spread in power … Balanced for boredom, not power."

An independent simulator, [MagSim](https://github.com/pschonev/magsim) by Philipp Schoneville
([thread](https://boardgamegeek.com/thread/3673716)), reaches the same ranking: Scoocher far
ahead, then Romantic, Lovable Loser and Sisyphus; Heckler, Flip Flop and Legs strong; Blimp,
Banana and Alchemist weak; and Twin the best of the racers that copy, since it copies a strong
earlier winner. Its author also found a Scoocher–Copycat loop on the Mild Mile that wins on the
first turn, which MagSim leaves out of its data. MagSim has its own rules readings, so the two
agreeing is evidence the ranking doesn't hinge on ours.

**Per racer, the two simulators agree closely.** MagSim publishes its dataset
(`docs/results/*.parquet`, about 8,000 5-player races per track). Comparing each racer's chance of
1st at 5 players with ours (200,000 races per track):

| | rank correlation | within 3 points | biggest differences |
| --- | --- | --- | --- |
| Mild Mile | 0.85 | 30 of 36 racers | Twin −36.9, Copycat +13.3, Flip Flop −7.0, Suckerfish +6.8 |
| Wild Wilds | 0.87 | 29 of 36 racers | Twin −27.1, Copycat +12.7, Legs −5.3, Suckerfish +5.0 |

Scoocher matches almost exactly (64.8% against 64.0% on the Mild Mile). With about 1,100 races
per racer in MagSim's data, differences of 3 points are within its noise. The large ones have
explanations:
- **Twin:** MagSim always gives it three earlier winners to copy; a standalone race here gives it
  none (see "Racers that pick racers").
- **Copycat:** MagSim's data has no Mild Mile races with both Copycat and Scoocher (about 130
  expected) and only 68 on the Wild Wilds, because it drops the Scoocher–Copycat first-turn loop.
  Copycat does very well alongside Scoocher, so leaving those races out lowers its numbers.
- **Suckerfish and Flip Flop:** each follows a different choice heuristic in the two simulators.

Not done: comparing with logged real games.

## What's still unsettled, and how much it matters

`node scripts/sensitivity.ts` reruns races 1 and 2 with each open reading flipped. None matters beyond its
own racer:

| reading | race 1 | race 2 |
| --- | --- | --- |
| main moves pushed below 0 go backwards (Hague yes, Garfield no) | under 0.1 for everyone | under 0.1 for everyone |
| triggers queue and resolve even if the board changed (Garfield's own play) | Romantic +0.10 (of 2.03) | Romantic +0.11 (of 2.92) |

Queuing lets a Romantic move even after the pair it saw has broken up. The engine keeps checking
each trigger as it resolves.

Two more were settled rather than left open:
- Duelist duels everyone on the Start before the first turn, worth about 0.15 points a race to it.
- Blimp's second corner is space 15, where the track turns the second time. Counting Start's
  rounded end as the first corner would make it 12 and cost Blimp about 0.2 points a race.

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
