# Magical Athlete

A simulator of the board game [Magical Athlete](https://www.cmyk.games/products/magical-athlete),
and what it says so far. Every number is from the
model, which follows the August 2026 printing of the rulebook and the official rulings in
`racers.ts`, and plays optional powers with simple greedy choices. It agrees with an independent
simulator and with what players report (see "Against real play"), but hasn't been checked against
logged real games.

The simulator and this analysis were written with Claude Opus 5.5 at medium effort, working in
Claude Code throughout.

The raw data behind every table and chart is on Hugging Face as Parquet, a row per racer per race
or per player per game: [visnup/magical-athlete](https://huggingface.co/datasets/visnup/magical-athlete).
`make` regenerates it into `results/` and redraws `charts/`. The tables below are from 2026-11-03.

## How racers are scored

Points per race = gold × P(1st) + silver × P(2nd) + bronze chips. Gold and silver are 3/2, 4/3,
4/3 and 5/4 for races 1 to 4, and races alternate Mild Mile and Wild Wilds. A fair share is
(gold + silver) / players.

Most tables come from one shared dataset: a million races of a random lineup at each track and
player count from 3 to 6 (`node scripts/races.ts`). Races 1 and 3 share the Mild Mile and 2 and 4
the Wild Wilds, and differ only in chip values, so each race is read from the same races.

## Points per race

`node scripts/points.ts --race k` (a million races of 5).

Race 1, Mild Mile (3/2; a fair share is 1.00):

| racer | points | 1st | 2nd | bronze |
| --- | --- | --- | --- | --- |
| Lovable Loser | 3.08 | 3.7% | 8.6% | 2.79 |
| Sisyphus | 2.91 | 0.3% | 1.3% | 2.88 |
| Scoocher | 2.38 | 65.6% | 20.6% | 0 |
| Romantic | 2.03 | 53.5% | 21.1% | 0 |
| Suckerfish | 1.62 | 30.1% | 35.6% | 0 |
| Egg | 1.56 | 25.0% | 19.4% | 0.42 |
| Copycat | 1.49 | 30.2% | 28.2% | 0.02 |
| … | | | | |
| Banana | 0.66 | 10.6% | 17.2% | 0 |
| Alchemist | 0.62 | 9.7% | 16.7% | 0 |
| Blimp | 0.52 | 9.3% | 12.0% | 0 |
| Centaur | 0.49 | 7.7% | 13.1% | 0 |
| Huge Baby | 0.45 | 6.8% | 12.3% | 0 |

Race 2, Wild Wilds (4/3; a fair share is 1.40):

| racer | points | 1st | 2nd | bronze |
| --- | --- | --- | --- | --- |
| Scoocher | 7.52 | 48.1% | 21.9% | 4.94 |
| Suckerfish | 3.85 | 30.1% | 34.0% | 1.63 |
| Lovable Loser | 3.75 | 4.5% | 9.5% | 3.29 |
| Sisyphus | 3.69 | 0.5% | 1.8% | 3.62 |
| Twin | 3.46 | 30.8% | 22.8% | 1.54 |
| Dicemonger | 3.33 | 23.5% | 21.1% | 1.76 |
| … | | | | |
| Banana | 1.40 | 9.0% | 15.0% | 0.59 |
| Alchemist | 1.30 | 9.2% | 15.4% | 0.46 |
| Coach | 1.28 | 11.1% | 16.7% | 0.34 |
| Centaur | 1.27 | 7.5% | 13.4% | 0.57 |
| Blimp | 1.13 | 11.6% | 13.7% | 0.25 |

The chance of each score in a race of 6, strongest racers first, with each racer's likeliest score
labeled:

![Chance of each score in a race of 6, by racer and track](charts/points.svg)

And their chances of 1st and 2nd:

![Chances of 1st and 2nd, by racer and track](charts/places.svg)

Twin's numbers here average over both races on each track: 0 or 2 earlier winners to copy on the
Mild Mile, 1 or 3 on the Wild Wilds. "Racers that pick racers" takes each race on its own, where
Twin goes from nothing in race 1 to second best in race 4.

## Player count

`node scripts/players.ts`. Points per race as a multiple of a fair share, so counts compare
directly; selected racers:

| racer | Mild 3p | 4p | 5p | 6p | Wild 3p | 4p | 5p | 6p |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Lovable Loser | 3.33 | 3.20 | 3.08 | 2.88 | 2.87 | 2.76 | 2.68 | 2.59 |
| Sisyphus | 1.66 | 2.27 | 2.91 | 3.58 | 1.56 | 2.08 | 2.64 | 3.20 |
| Scoocher | 1.25 | 1.77 | 2.38 | 2.97 | 1.92 | 3.27 | 5.37 | 8.30 |
| Romantic | 1.15 | 1.55 | 2.03 | 2.48 | 1.25 | 1.60 | 2.05 | 2.52 |
| Legs | 1.46 | 1.53 | 1.41 | 1.22 | 1.58 | 1.75 | 1.77 | 1.73 |
| Stickler | 1.22 | 1.18 | 1.04 | 0.88 | 1.42 | 1.48 | 1.46 | 1.41 |
| Cheerleader | 1.23 | 1.21 | 1.07 | 0.91 | 1.44 | 1.60 | 1.67 | 1.76 |
| Hypnotist | 1.23 | 1.15 | 0.96 | 0.76 | 1.58 | 1.71 | 1.65 | 1.57 |
| M.O.U.T.H. | 1.20 | 1.10 | 0.89 | 0.66 | 1.46 | 1.50 | 1.40 | 1.27 |
| Alchemist | 1.00 | 0.81 | 0.62 | 0.49 | 1.11 | 1.01 | 0.93 | 0.89 |
| Third Wheel | 0.70 | 0.69 | 0.75 | 0.81 | 0.96 | 1.04 | 1.17 | 1.32 |

![Points per race by racer and player count](charts/players.svg)

**Scoocher's dominance is a big-table effect.** At 3 players it earns 1.25 fair shares on the
Mild Mile, behind Lovable Loser, Sisyphus, Legs, Egg and Flip Flop. Each extra racer is another
power going off every turn, so by 6 players it's 3 fair shares on the Mild Mile and over 8 on the
Wild Wilds. Romantic, Suckerfish, Dicemonger, Copycat and Heckler also feed on traffic and climb with
the count.

**Bronze racers look better at big tables partly by arithmetic.** Sisyphus's 4 chips are worth
the same at any count while a fair share of gold and silver shrinks, so its multiple doubles from
3 to 6 players. Lovable Loser slips slightly instead: being alone in last gets harder in a crowd.

**Some racers want small tables.** Alchemist, Banana, M.O.U.T.H., Hypnotist, Coach, Magician,
Gunk and Stickler all lose ground as the count rises on the Mild Mile; Alchemist halves (1.00 to
0.49).

**At 3 players the field flattens.** Most racers sit between 0.8 and 1.3 fair shares. Only Lovable
Loser stands out, and Third Wheel, Huge Baby and Blimp trail.

## Matchups

`node scripts/matchups.ts` compares each racer's points when another racer is in the race with
when it isn't, from the million 5-player races per track. Each pair meets in about 16,000 races,
so differences under about 0.05 (Mild Mile) or 0.1 (Wild Wilds) are noise. Selected effects, in
race-1 or race-2 points:

| racer | with | Mild Mile | Wild Wilds |
| --- | --- | --- | --- |
| Suckerfish | Scoocher | +0.03 | +6.57 (3.11 → 9.68) |
| Scoocher | Suckerfish | +0.09 | +5.25 (6.93 → 12.18) |
| Copycat | Scoocher | +0.47 | +5.17 (2.70 → 7.87) |
| Scoocher | Gunk | +0.53 | +3.41 |
| Baba Yaga | Hypnotist | +1.09 (0.67 → 1.76) | +1.65 |
| Copycat | Hypnotist | +0.98 (1.38 → 2.36) | +1.11 |
| Heckler | Gunk | +0.76 | +0.74 |
| Huge Baby | M.O.U.T.H. | +0.75 (0.37 → 1.11) | +1.00 |
| Lovable Loser | Gunk | +0.77 | +0.83 |
| Copycat | Flip Flop | +0.66 | +0.59 |
| Lovable Loser | Sisyphus | −1.42 (3.24 → 1.82) | −1.25 |
| Scoocher | M.O.U.T.H. | −0.57 | −2.98 (7.86 → 4.88) |
| Dicemonger | Scoocher | −0.83 (1.58 → 0.75) | −0.95 |
| Legs | Dicemonger | −0.64 | −0.81 |

Every pair, as the row racer's points minus the column racer's when both are in a race of 6:

![Matchups on the Mild Mile](charts/matchups-race1.svg)

![Matchups on the Wild Wilds](charts/matchups-race2.svg)

**Scoocher feeds on other powers, so anything that adds them helps it.** Gunk's −1 every turn,
Copycat, Romantic, Hypnotist and Party Animal all add triggers. Racers whose powers rarely go off
(Twin without a winner to copy, Third Wheel, Rocket Scientist, Alchemist, Mastermind) cost it over
a point a race on the Wild Wilds by taking a seat a busier racer would have had.

**M.O.U.T.H. is the counter to Scoocher.** Scoocher creeps forward one space at a time and keeps
stopping next to other racers, which is exactly what M.O.U.T.H. eats. M.O.U.T.H. also counters
Hypnotist and Party Animal, which pull racers onto shared spaces.

**Hypnotist's two exceptions win the most from it.** Hypnotist pulls back any opponent ahead
except Copycat and Baba Yaga (the model's choice, to avoid loops), so those two gain a point or
more when it's in the race: everyone else gets pulled back, they don't. Fits the data, not traced
through individual races.

**Lovable Loser and Sisyphus can't share a race.** Sisyphus keeps warping back to Start, so
Lovable Loser is rarely alone in last; they also draw on the same bronze chips.

**Heckler likes anything that stalls racers.** Trips (Banana, Baba Yaga) and Gunk's −1 make more
racers end a turn within one space of where they started, which is Heckler's trigger.

**Dicemonger shares its rerolls with everyone.** Each reroll also moves Scoocher, and it helps
racers like Legs and Skipper less than it helps their opponents.

**Huge Baby is safe from M.O.U.T.H.** Nothing can stop on Huge Baby's space, so M.O.U.T.H. can't
eat it, while it eats the racers around it.

## Race order and the draft

`node scripts/lineup.ts` takes each racer's points in each of the four races from the dataset,
except Twin's, which is raced again with earlier winners drawn from the earlier races. It values a
team as its best assignment of four racers to four races. A racer's draft value is the average
value of random teams it's on, against the average team (8.95 points a game). `lineup.ts --write`
saves these to `ratings.json` for the engine to play by.

| racer | race 1 (Mild 3/2) | race 2 (Wild 4/3) | race 3 (Mild 4/3) | race 4 (Wild 5/4) | usually played in | draft value |
| --- | --- | --- | --- | --- | --- | --- |
| Scoocher | 2.38 | 7.52 | 3.24 | 8.22 | 4 | +4.68 |
| Twin | 0.29 | 2.86 | 2.15 | 4.71 | 4 (always) | +1.46 |
| Lovable Loser | 3.08 | 3.75 | 3.20 | 3.89 | 1 | +1.33 |
| Suckerfish | 1.62 | 3.85 | 2.27 | 4.49 | 4 | +1.27 |
| Sisyphus | 2.91 | 3.69 | 2.93 | 3.71 | 1 | +1.19 |
| Romantic | 2.03 | 2.87 | 2.77 | 3.53 | 3 | +0.75 |
| Copycat | 1.49 | 3.29 | 2.08 | 3.85 | 4 | +0.73 |
| Dicemonger | 1.48 | 3.33 | 2.06 | 3.78 | 2 | +0.72 |
| Egg | 1.56 | 3.12 | 2.00 | 3.55 | 2 | +0.50 |
| Flip Flop | 1.40 | 2.91 | 1.95 | 3.50 | 4 | +0.38 |
| Heckler | 1.40 | 2.85 | 1.93 | 3.51 | 4 | +0.38 |
| … | | | | | | |
| Huge Baby | 0.45 | 1.49 | 0.64 | 1.73 | 2 | −0.93 |
| Blimp | 0.52 | 1.13 | 0.73 | 1.38 | 1 | −1.00 |
| Centaur | 0.49 | 1.27 | 0.70 | 1.47 | 1 | −1.01 |

![Draft value by racer](charts/draft-value.svg)

**The Wild Wilds races are worth more than the Mild Mile races for everyone.** Stars add bronze,
and race 2 (4/3) on the Wild Wilds out-earns race 3 (4/3) on the Mild Mile at the same chip
values. Race 4 is the jackpot.

**Put Scoocher in race 4, and the bronze racers in race 1.** Lovable Loser's and Sisyphus's points
barely change from race to race, so they cost the least to spend on the cheapest race.

**Some racers prefer the Mild Mile.** Romantic, Skipper, Lackey, Hare and Magician usually go to
race 3: they're about as good on the Mild Mile as on the Wild Wilds, while others gain more from
the stars. Inchworm, Huge Baby, Dicemonger, Egg and M.O.U.T.H. go to race 2 for the opposite
reason.

**In the draft, Scoocher is worth about 4.7 points a game over an average pick,** three times the
next racer. After it come Twin (saved for race 4), Lovable Loser, Suckerfish and Sisyphus.

## Optional powers

`node scripts/choices.ts` races each racer with an optional power in every race (100,000 races of
5) and compares its current choice with alternatives. Points per race, race 1 / race 2:

| racer | current choice | alternatives |
| --- | --- | --- |
| Alchemist | by where each option lands: 0.64 / 1.34 | always move 4 (previous) +0.00 / −0.11, never 0.28 / 1.05 |
| Cheerleader | by where each option lands: 1.09 / 2.41 | always cheer +0.00 / −0.10, never 0.30 / 1.08 |
| Flip Flop | by where each swap lands: 1.43 / 2.95 | farthest 4+ ahead (previous) −0.01 / −0.41, 2+ ahead −0.31 / −0.57, 6+ ahead −0.03 / −0.43, never 0.30 / 1.04 |
| Genius | predict 6: 0.79 / 1.62 | every other number is worse or tied; 1 is worst (−0.23 / −0.25) |
| Hypnotist | any opponent ahead but Copycat and Baba Yaga: 0.99 / 2.39 | also Baba Yaga −0.02 / +0.02, 7+ ahead −0.32 / −0.55, never 0.28 / 1.01 |
| Legs | by where each option lands: 1.45 / 2.55 | always move 5 (previous) −0.02 / −0.61, never 0.31 / 1.08 |
| Magician | reroll 1–4, then 1–3: 0.95 / 1.57 | 1–3 both times −0.03 / −0.07, 1–2 −0.20 / −0.18, 1–5 then 1–3 −0.09 / −0.08 |
| Rocket Scientist | by where each option lands: 0.90 / 2.24 | 4+ (previous) −0.02 / −0.19, 5+ +0.00 / −0.26, always −0.24 / −0.84 |
| Suckerfish | ride, except another player's Scoocher near the finish: 1.61 / 3.71 | always ride +0.02 / +0.03, never 0.31 / 1.10 |
| Third Wheel | farthest pair ahead: 0.76 / 1.67 | nearest pair ahead −0.01 / −0.01, never 0.29 / 1.05 |

![Each alternative's points against the current choice](charts/choices.svg)

Every current choice is the best of what was tried, within noise (±0.01 standard error), except
Suckerfish's, which gives up a few hundredths on purpose (see "Findings"). Every
racer's power is worth a lot over no power at all: "never" costs 0.4 to 2.6 points a race.

Pulling a Copycat back makes it copy Hypnotist and pull straight back, forever, and pulling Baba
Yaga onto your own space trips you, which stalled races when it repeated; so Hypnotist skips both.

### By playing out each option

`node scripts/playouts.ts` decides each choice by replaying the turn up to it, forcing each option,
and playing the race out 20 times per option, then compares with the hand-written choice (4,000
races of 5 per racer; differences under about 0.1 are noise). A decision on the same board in the
same turn is reused, as long as the box still has bronze or still doesn't: Suckerfish riding Scoocher around the Wild Wilds' 12–16 cycle can decide
hundreds of times in one turn, and each playout replays every decision before it.

| racer | race 1, Mild Mile | race 2, Wild Wilds |
| --- | --- | --- |
| Flip Flop | 1.44 → 1.90 (+0.45) | 2.89 → 4.28 (+1.38) |
| Mastermind | 0.85 → 1.15 (+0.31) | 1.78 → 2.20 (+0.42) |
| Rocket Scientist | 0.87 → 0.97 (+0.10) | 2.19 → 2.49 (+0.30) |
| Cheerleader | 1.07 → 1.03 | 2.39 → 2.68 (+0.29) |
| Suckerfish | 1.61 → 1.68 | 3.70 → 3.99 (+0.29) |
| Alchemist | 0.65 → 0.66 | 1.32 → 1.45 (+0.13) |
| Hypnotist | 0.98 → 0.93 | 2.35 → 2.48 (+0.13) |
| Duelist | 0.98 → 0.83 (−0.15) | 1.67 → 1.67 |
| Legs, Genius, Third Wheel | within ±0.1 | within ±0.1 |

![Hand-written choices against choices by playouts](charts/playouts.svg)

**On the Mild Mile the hand-written choices are close to the best.** The exceptions are Flip Flop,
whose best swap depends on more than distance, and Mastermind, which does better predicting the
likely winner of this particular race than the best-rated racer.

**On the Wild Wilds the track matters most.** Moving 5 or the roll, 4 or the roll, double or not,
riding or not, swapping with whom: each lands on a different space, and a star, a rock or an
arrow there is worth more than a space or two of distance. The first heuristics ignored the
track, and playouts beat them by up to 1.7 points a race.

**So the heuristics now score where each option lands** (`landing` in `racers.ts`: an arrow's move
counts, a star is worth 3 spaces, a rock costs a roll). Against the previous choices in the same
`choices.ts` runs, race-2 points on the Wild Wilds: Legs 1.95 → 2.54, Flip Flop 2.54 → 2.95,
Rocket Scientist 2.03 → 2.24, Alchemist 1.23 → 1.35, Cheerleader 2.31 → 2.40. The Mild Mile is
unchanged within ±0.02. That closed the gap for Legs; Flip Flop, Mastermind, Rocket Scientist,
Cheerleader and Suckerfish still leave a quarter point or more behind. Suckerfish was tried too and
kept as it was: it scored 2.95 against 3.75 for always riding, because a ride the −4 arrow sends
back still passes the star on 13 again.

Not covered: Magician's rerolls and the before-race picks (Egg, Twin), which happen outside a
turn's snapshot or outside `choose`.

## Racers that pick racers

`node scripts/twin.ts` reruns Twin, Egg, Mastermind and Copycat with a rating to choose by (each
racer's points in that race) and, for Twin, earlier winners to copy. The earlier winners are drawn
from earlier races' chances of 1st, leaving out this race's lineup. Points per race, 100,000 races
of 5, against the dataset, where they pick by the built-in ratings (`ratings.json`) and Twin's
earlier winners are averaged over both races on the track:

| racer | race 1 | race 2 | race 3 | race 4 |
| --- | --- | --- | --- | --- |
| Twin | 0.93 → 0.28 | 3.46 → 2.86 | 1.28 → 2.13 | 3.99 → 4.73 |
| Egg | 1.56 → 1.68 | 3.12 → 3.25 | 2.00 → 2.13 | 3.55 → 3.86 |
| Mastermind | 0.87 → 0.88 | 1.85 → 1.82 | 1.28 → 1.28 | 2.27 → 2.28 |
| Copycat | 1.49 → 1.49 | 3.29 → 3.25 | 2.08 → 2.10 | 3.85 → 3.94 |

![Racers that pick racers, with ratings and earlier winners](charts/twin.svg)

**Twin is a late-race racer, and in race 4 it's the second best of all,** behind only Scoocher.
With three earlier winners to choose from, it can usually copy a strong one, often Scoocher,
which wins half the races it's in. In race 1 it has nothing to copy.

**Rating each race separately adds little over the built-in ratings:** 0.0 to 0.3 points for Egg,
Mastermind and Copycat. Against random picks, choosing by any rating was worth half a point to a
point a race to Egg and Mastermind.

The rest of the order hardly moves (rank correlation 0.96–1.00); what moves is mostly Twin.

## Whole games

`node scripts/games.ts` plays 100,000 games of 5 where everyone drafts the highest-rated racer left
and plays each team in its best race order (`ratings.json`).

| first-round pick | score | wins |
| --- | --- | --- |
| 1 | 10.93 | 28.7% |
| 2 | 11.15 | 30.2% |
| 3 | 9.27 | 16.1% |
| 4 | 8.38 | 13.1% |
| 5 | 7.77 | 12.0% |

**Draft order decides a lot.** Only 10 racers are flipped up per round, and the value is
concentrated in a few of them (Scoocher above all), so the first picks take most of it. The 2nd
pick does best of all: the second snake draft starts with the player to the left of the first
pick, so it picks first in that round, while the first pick goes second. Between them they win
59% of games, against 40% for an even share. That's from an even roll-off, so it's the game's
biggest swing that isn't on the track.

**Team value predicts the winner, loosely.** The team with the best estimated value wins 43.6% of
games, against 20% for an even share, and the estimate correlates 0.47 with the final score.
Estimates run low (9.02 against 9.50 actual), probably because they come from races against
random opponents rather than drafted, stronger ones.

## The two-racer variants

`node scripts/games.ts --double --players 2` (or 3) plays the variants: everyone drafts 8 racers
and races two at a time. 100,000 games each, with standard games for comparison:

| game | 1st pick wins | 2nd pick | 3rd pick | best estimated team wins |
| --- | --- | --- | --- | --- |
| 2 players, two racers each | 50.8% | 49.2% | | 57.2% |
| 3 players, two racers each | 41.4% | 30.1% | 28.5% | 59.0% |
| 3 players, standard | 34.9% | 33.8% | 31.3% | 36.5% |
| 5 players, standard | 28.7% | 30.2% | 16.1% (then 13.1%, 12.0%) | 43.6% |

![Chance of winning by draft position](charts/games.svg)

**The 2-player variant's draft is fair.** Its ABBAABBA rows, with the second draft reversed,
cancel the first pick's edge.

**The 3-player variant's draft isn't.** It runs four snake drafts of 6, rotating who starts, so
the first player starts two of the four and wins 41.4% of games against 33.3% for an even share.
A table could fix it by giving the last pick of the first draft the first pick of the fourth.

**Standard drafts are fair at 3 players but not at 5,** where only the first two players ever
start a round.

**Team quality matters more with two racers each.** The best estimated team wins 57–59% of the
time in the variants, against 37% in standard 3-player games, where one racer per race leaves
more to luck.

## Drafting strategy

`node scripts/draft.ts` gives one randomly seated player a different drafting strategy against
opponents who take the highest-rated racer left (100,000 games of 5 each):

| my draft | wins | score |
| --- | --- | --- |
| highest rating, as opponents do | 20.0% | 9.50 |
| most added to my best race order | 20.5% | 9.57 |
| my gain plus the most it would add to an opponent (denial) | 20.3% | 9.54 |

**Drafting smarter barely pays.** Both alternatives beat the highest rating by 0.04 to 0.07 points
a game and 0.3 to 0.5 points of win rate. That's about the size of the noise over 100,000 games,
and invisible at a table. The value is concentrated in a few racers, so the racer
that adds most to your team, the one that adds most to an opponent's, and the highest-rated one
are nearly always the same pick. Where you sit in the draft matters far more than how you draft.

## Choosing racers during the game

`node scripts/endgame.ts` lets one randomly seated player choose its racer before each race
differently from the opponents, who play their best race order (100,000 games of 5 each):

| my choices | wins | score | my M.O.U.T.H. met their Scoocher | wins in those games |
| --- | --- | --- | --- | --- |
| best race order, as opponents do | 20.0% | 9.49 | 0.6% of games | 14.3% |
| by score: with two left, save the safe one when ahead, the likely winner when behind | 19.7% | 9.39 | | |
| counter: draft M.O.U.T.H. once an opponent has Scoocher, and race it in Scoocher's race | 19.4% | 9.28 | 4.5% of games | 9.6% |

![Strategies' chances of winning](charts/strategies.svg)

**Just play your best race order.** Switching by score gives up a tenth of a point a game, and
the racers' spreads are too alike for the safety or the long shot to make it back.

**Countering Scoocher doesn't pay for the counterer.** When your M.O.U.T.H. meets their Scoocher
you win only 9.6% of the time. Slowing or eating Scoocher helps the other three opponents as much
as you, while it costs you a better draft pick and M.O.U.T.H.'s own best race.

## Spread of points

`node scripts/spread.ts` (race 4 by default, from the dataset). An average hides how a racer gets
there. Race 4 on the Wild Wilds (5/4), selected:

| racer | mean | sd | 0 points | at least gold |
| --- | --- | --- | --- | --- |
| Scoocher | 8.22 | 4.87 | 1% | 84% |
| Suckerfish | 4.49 | 3.87 | 16% | 52% |
| Lovable Loser | 3.89 | 2.76 | 11% | 40% |
| Copycat | 3.85 | 3.42 | 21% | 48% |
| Dicemonger | 3.78 | 2.44 | 5% | 44% |
| Sisyphus | 3.71 | 1.53 | 2% | 24% |
| Romantic | 3.53 | 2.35 | 22% | 52% |
| Heckler | 3.51 | 2.38 | 23% | 51% |
| Mastermind | 2.27 | 2.16 | 33% | 20% |

![Chance of scoring nothing against chance of at least gold in race 4](charts/spread.svg)

**Protecting a lead in race 4:** pick a racer that rarely scores nothing. Sisyphus (2%),
Dicemonger (5%) and Lovable Loser (11%) are nearly sure of a few points, and Sisyphus is the
steadiest of all (sd 1.53).

**Catching up in race 4:** pick a racer that often wins. Suckerfish (52%), Romantic (52%) and
Heckler (51%) take gold about half the time, against Sisyphus's 24%. Scoocher is both the
safest and the likeliest to win, so it's the best racer whichever position you're in.

## Seat order

`node scripts/seats.ts` (from the dataset). Points by seat, seat 1 going first:

| players | seat 1 | seat 2 | seat 3 | seat 4 | seat 5 | seat 6 | seat 1 − average |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3 | 2.00 | 1.87 | 1.75 | | | | +0.12 |
| 4 | 1.57 | 1.47 | 1.38 | 1.32 | | | +0.13 |
| 5 | 1.28 | 1.22 | 1.16 | 1.11 | 1.08 | | +0.11 |
| 6 | 1.08 | 1.04 | 1.00 | 0.96 | 0.93 | 0.92 | +0.09 |

That's race 1 on the Mild Mile; the Wild Wilds is a little flatter (+0.07 to +0.11).

![Points by seat](charts/seats.svg)

**Going first is worth about 0.1 points a race,** roughly 10% above an average seat, and each
later seat is worth a little less. With 5 players, seat 1 earns 19% more than seat 5. The rule
that the farthest-behind racer's player starts the next race is worth that much to them: a small
catch-up, far smaller than a strong racer is worth.

## Findings

**Winning isn't the measure; points are.** Lovable Loser and Sisyphus almost never place but top
race 1, because each collects about 2.8 bronze chips a race whatever happens. Placing pays less
in race 1 than later, so they're worth the most early. Racers that win often are worth more in
later races.

**Scoocher wins most races.** It wins 66% of 5-player Mild Mile races. It moves 1 after every
other racer's power, including passive ones every turn, which Richard Garfield's rule of thumb
supports: anything that changes the board versus a racer with no power is a power happening.
That's about 18 extra spaces a race. This is the first thing to check against real play.

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
space at a time circles 12–16 and crosses the star on 13 each lap. Scoocher averages 4.94 bronze
a race there. With Suckerfish too, the pair farmed about 21 a race until bronze was capped at the
43 points of chips in the box. The cap is shared across the whole game, so in full games the pair
also starves everyone else's stars.

**The Duelist should always duel.** It wins 58% of duels, ties included, and every alternative
scored lower (race-1 points over 200,000 races, an earlier engine): always 0.99, declining against
racers a loss would carry across the line 0.88, also declining late in the race 0.76, never 0.32.

**Twin depends on which race it's in more than any other racer.** It's useless in race 1, with
nothing to copy, and second best in race 4. The standalone tables average it over the races on
each track; "Racers that pick racers" above takes each race on its own.

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
1st at 5 players with ours (200,000 races per track, an earlier engine):

| | rank correlation | within 3 points | biggest differences |
| --- | --- | --- | --- |
| Mild Mile | 0.85 | 30 of 36 racers | Twin −36.9, Copycat +13.3, Flip Flop −7.0, Suckerfish +6.8 |
| Wild Wilds | 0.87 | 29 of 36 racers | Twin −27.1, Copycat +12.7, Legs −5.3, Suckerfish +5.0 |

Scoocher matches almost exactly (64.8% against 64.0% on the Mild Mile). With about 1,100 races
per racer in MagSim's data, differences of 3 points are within its noise. The large ones have
explanations:
- **Twin:** MagSim always gives it three earlier winners to copy; the engine compared here gave it
  none (see "Racers that pick racers").
- **Copycat:** MagSim's data has no Mild Mile races with both Copycat and Scoocher (about 130
  expected) and only 68 on the Wild Wilds, because it drops the Scoocher–Copycat first-turn loop.
  Copycat does very well alongside Scoocher, so leaving those races out lowers its numbers.
- **Suckerfish and Flip Flop:** each follows a different choice heuristic in the two simulators.

Not done: comparing with logged real games.

## What's still unsettled, and how much it matters

`node scripts/sensitivity.ts` reruns races 1 and 2 (100,000 races of 5 each) with each open
reading flipped. None matters beyond its own racer:

| reading | race 1 | race 2 |
| --- | --- | --- |
| main moves pushed below 0 go backwards (Hague yes, Garfield no) | under 0.1 for everyone | under 0.1 for everyone |
| triggers queue and resolve even if the board changed (Garfield's own play) | Romantic +0.11 (of 2.03) | Scoocher +0.12 (of 7.52) |

![Change in each racer's points with each reading flipped](charts/sensitivity.svg)

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

`TODO.md` has what's left: logging real games and comparing them with the model.
