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
| Lovable Loser | 3.03 | 3.6% | 8.0% | 2.76 |
| Sisyphus | 2.92 | 0.3% | 1.2% | 2.89 |
| Scoocher | 2.37 | 65.3% | 20.7% | 0 |
| Romantic | 2.03 | 53.5% | 21.2% | 0 |
| Egg | 1.65 | 25.5% | 20.8% | 0.47 |
| Suckerfish | 1.61 | 30.3% | 34.8% | 0 |
| Dicemonger | 1.47 | 32.5% | 24.5% | 0 |
| … | | | | |
| Banana | 0.66 | 10.8% | 17.0% | 0 |
| Alchemist | 0.61 | 9.5% | 16.3% | 0 |
| Blimp | 0.51 | 9.2% | 11.6% | 0 |
| Centaur | 0.48 | 7.7% | 12.7% | 0 |
| Huge Baby | 0.44 | 6.8% | 12.0% | 0 |

Race 2, Wild Wilds (4/3; a fair share is 1.40):

| racer | points | 1st | 2nd | bronze |
| --- | --- | --- | --- | --- |
| Scoocher | 7.66 | 48.4% | 21.8% | 5.07 |
| Dicemonger | 4.02 | 28.7% | 20.4% | 2.26 |
| Suckerfish | 3.96 | 30.6% | 33.7% | 1.72 |
| Flip Flop | 3.75 | 34.6% | 24.0% | 1.65 |
| Sisyphus | 3.73 | 0.5% | 1.8% | 3.66 |
| Lovable Loser | 3.71 | 4.5% | 8.9% | 3.27 |
| … | | | | |
| Banana | 1.46 | 9.1% | 14.8% | 0.65 |
| Alchemist | 1.41 | 8.8% | 14.9% | 0.61 |
| Centaur | 1.32 | 7.7% | 13.0% | 0.63 |
| Coach | 1.28 | 10.8% | 16.2% | 0.36 |
| Blimp | 1.11 | 11.0% | 12.8% | 0.29 |

**Dicemonger is second on the Wild Wilds.** Every racer may reroll its main move once with
Dicemonger in the race, and Dicemonger moves 1 each time another does. Racers now reroll whenever
the roll would land somewhere worse than an average roll, not just on a 1 to 3. On the Wild Wilds,
with stars, arrows and rocks, that's far more often, and each reroll carries Dicemonger a space
closer to the stars.

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
| Lovable Loser | 3.29 | 3.17 | 3.03 | 2.83 | 2.83 | 2.73 | 2.65 | 2.57 |
| Sisyphus | 1.66 | 2.28 | 2.92 | 3.59 | 1.57 | 2.11 | 2.67 | 3.24 |
| Scoocher | 1.24 | 1.76 | 2.37 | 2.97 | 1.93 | 3.31 | 5.47 | 8.45 |
| Romantic | 1.14 | 1.55 | 2.03 | 2.50 | 1.26 | 1.63 | 2.08 | 2.55 |
| Flip Flop | 1.25 | 1.35 | 1.41 | 1.46 | 1.83 | 2.29 | 2.68 | 3.06 |
| Legs | 1.46 | 1.53 | 1.42 | 1.22 | 1.58 | 1.77 | 1.80 | 1.78 |
| Stickler | 1.21 | 1.15 | 1.02 | 0.85 | 1.42 | 1.48 | 1.47 | 1.44 |
| Cheerleader | 1.26 | 1.23 | 1.08 | 0.88 | 1.50 | 1.66 | 1.73 | 1.81 |
| Hypnotist | 1.22 | 1.14 | 0.95 | 0.75 | 1.59 | 1.72 | 1.71 | 1.63 |
| M.O.U.T.H. | 1.17 | 1.06 | 0.83 | 0.61 | 1.46 | 1.50 | 1.40 | 1.28 |
| Alchemist | 0.99 | 0.80 | 0.61 | 0.48 | 1.15 | 1.07 | 1.01 | 0.99 |
| Third Wheel | 0.69 | 0.68 | 0.74 | 0.79 | 0.97 | 1.06 | 1.22 | 1.38 |

![Points per race by racer and player count](charts/players.svg)

**Scoocher's dominance is a big-table effect.** At 3 players it earns 1.24 fair shares on the
Mild Mile, behind Lovable Loser, Sisyphus, Legs, Egg and Flip Flop. Each extra racer is another
power going off every turn, so by 6 players it's 3 fair shares on the Mild Mile and over 8 on the
Wild Wilds. Romantic, Suckerfish, Dicemonger, Copycat and Heckler also feed on traffic and climb with
the count.

**Bronze racers look better at big tables partly by arithmetic.** Sisyphus's 4 chips are worth
the same at any count while a fair share of gold and silver shrinks, so its multiple doubles from
3 to 6 players. Lovable Loser slips slightly instead: being alone in last gets harder in a crowd.

**Some racers want small tables.** Alchemist, Banana, M.O.U.T.H., Hypnotist, Coach, Magician,
Gunk and Stickler all lose ground as the count rises on the Mild Mile; Alchemist halves (0.99 to
0.48).

**At 3 players the field flattens.** Most racers sit between 0.8 and 1.3 fair shares. Only Lovable
Loser stands out, and Third Wheel, Huge Baby and Blimp trail.

## Matchups

`node scripts/matchups.ts` compares each racer's points when another racer is in the race with
when it isn't, from the million 5-player races per track. Each pair meets in about 16,000 races,
so differences under about 0.05 (Mild Mile) or 0.1 (Wild Wilds) are noise. Selected effects, in
race-1 or race-2 points:

| racer | with | Mild Mile | Wild Wilds |
| --- | --- | --- | --- |
| Suckerfish | Scoocher | +0.05 | +6.66 (3.21 → 9.87) |
| Scoocher | Suckerfish | +0.08 | +5.37 (7.05 → 12.41) |
| Copycat | Scoocher | +0.54 | +5.23 (2.77 → 8.00) |
| Scoocher | Gunk | +0.54 | +3.47 |
| Baba Yaga | Hypnotist | +1.13 (0.66 → 1.79) | +1.66 |
| Copycat | Hypnotist | +0.98 (1.24 → 2.22) | +1.32 |
| Heckler | Gunk | +0.77 | +0.75 |
| Huge Baby | M.O.U.T.H. | +0.72 (0.36 → 1.08) | +0.97 |
| Lovable Loser | Gunk | +0.76 | +0.75 |
| Copycat | Flip Flop | −0.30 (1.38 → 1.08) | +0.47 |
| Lovable Loser | Sisyphus | −1.41 (3.19 → 1.79) | −1.26 |
| Scoocher | M.O.U.T.H. | −0.58 | −2.99 (7.99 → 5.00) |
| Dicemonger | Scoocher | −0.84 (1.56 → 0.72) | −1.11 |
| Legs | Dicemonger | −0.67 | −0.59 |

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

**Flip Flop now takes Copycat's lead.** It used to skip Copycat, which then copied Flip Flop
and swapped with the leader, worth +0.66 a race to it on both tracks. Now Flip Flop swaps with a
Copycat ahead too, and Copycat loses 0.30 with it on the Mild Mile and gains only 0.47 on the Wild
Wilds.

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
value of random teams it's on, against the average team (9.30 points a game). `lineup.ts --write`
saves these to `ratings.json` for the engine to play by.

| racer | race 1 (Mild 3/2) | race 2 (Wild 4/3) | race 3 (Mild 4/3) | race 4 (Wild 5/4) | usually played in | draft value |
| --- | --- | --- | --- | --- | --- | --- |
| Scoocher | 2.37 | 7.66 | 3.23 | 8.36 | 4 | +4.67 |
| Twin | 0.28 | 2.96 | 2.10 | 4.86 | 4 (always) | +1.46 |
| Lovable Loser | 3.03 | 3.71 | 3.15 | 3.85 | 1 | +1.25 |
| Suckerfish | 1.61 | 3.96 | 2.26 | 4.60 | 4 | +1.24 |
| Dicemonger | 1.47 | 4.02 | 2.04 | 4.51 | 2 | +1.23 |
| Sisyphus | 2.92 | 3.73 | 2.94 | 3.76 | 1 | +1.14 |
| Flip Flop | 1.41 | 3.75 | 1.96 | 4.34 | 4 | +1.00 |
| Romantic | 2.03 | 2.91 | 2.78 | 3.57 | 3 | +0.72 |
| Copycat | 1.35 | 3.37 | 1.88 | 3.88 | 4 | +0.64 |
| Egg | 1.65 | 3.29 | 2.11 | 3.74 | 2 | +0.55 |
| Heckler | 1.40 | 2.89 | 1.94 | 3.54 | 4 | +0.29 |
| … | | | | | | |
| Huge Baby | 0.44 | 1.56 | 0.63 | 1.80 | 2 | −0.98 |
| Blimp | 0.51 | 1.11 | 0.72 | 1.35 | 1 | −1.05 |
| Centaur | 0.48 | 1.32 | 0.69 | 1.53 | 1 | −1.07 |

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
next racer. After it come Twin (saved for race 4), Lovable Loser, Suckerfish, Dicemonger and
Sisyphus, all within a quarter point of each other.

## Optional powers

`node scripts/choices.ts` races each racer with an optional power in every race (100,000 races of
5) and compares its current choice with alternatives. Points per race, race 1 / race 2:

| racer | current choice | alternatives |
| --- | --- | --- |
| Alchemist | by where each option lands, a star worth 15 spaces: 0.63 / 1.45 | always move 4 (previous) +0.00 / −0.20, never 0.28 / 1.08 |
| Cheerleader | by where each option lands, two moves from last place, never for an opponent's M.O.U.T.H.: 1.10 / 2.50 | for M.O.U.T.H. too (previous) −0.01 / −0.03, not for M.O.U.T.H. only when it would eat +0.01 / −0.00, one move of 3 −0.01 / −0.09, always cheer −0.01 / −0.22, never 0.29 / 1.13 |
| Flip Flop | by where each swap lands, a star worth 15 spaces, Copycat included: 1.43 / 3.79 | never with a Copycat (previous) −0.01 / −0.09; a star worth 3 +0.00 / −0.81, 6 +0.00 / −0.54, 30 +0.00 / −0.02; farthest 4+ ahead −0.02 / −1.20, never 0.29 / 1.08 |
| Genius | predict 1 when leading, else 6: 0.82 / 1.71 | always 6 (previous) −0.03 / −0.03, 1 when in the top two −0.01 / −0.01; always 1 is worst (−0.27 / −0.28) |
| Hypnotist | any opponent ahead but Copycat and Baba Yaga: 0.97 / 2.44 | also Baba Yaga −0.02 / +0.04, 7+ ahead −0.32 / −0.56, never 0.28 / 1.06 |
| Legs | by where each option lands: 1.44 / 2.58 | a star worth 15 spaces +0.00 / −0.10, always move 5 (previous) −0.01 / −0.65, never 0.31 / 1.14 |
| Magician | reroll when the roll lands worse than an average roll, a star worth 15 spaces: 0.98 / 2.19 | 1–4 then 1–3 (previous) −0.04 / −0.62, a star worth 3 +0.00 / −0.04, 1–3 both times −0.08 / −0.68, 1–2 −0.25 / −0.79 |
| Mastermind | the likeliest winner on this track: 1.06 / 2.16 | the best-rated racer (previous) −0.22 / −0.27 |
| Rocket Scientist | by where each option lands, but not to within 6 of the finish without crossing: 1.00 / 2.34 | even just short of the finish (previous) −0.12 / −0.06, within 3 −0.04 / −0.01, within 9 −0.02 / −0.12, 4+ −0.14 / −0.29, always −0.36 / −0.98 |
| Suckerfish | ride, except another player's Scoocher near the finish: 1.61 / 3.85 | always ride +0.02 / −0.00, never 0.31 / 1.15 |
| Third Wheel | farthest pair ahead: 0.75 / 1.74 | nearest pair ahead −0.01 / −0.01, never 0.29 / 1.11 |

![Each alternative's points against the current choice](charts/choices.svg)

Every current choice is the best of what was tried, within noise (±0.01 standard error), except
Suckerfish's, which gives up a few hundredths on purpose (see "Findings"), and Hypnotist's, where
also pulling back Baba Yaga is +0.04 on the Wild Wilds but −0.02 on the Mild Mile.

**Genius predicts 6 to swing, and 1 to protect a lead.** Every prediction is right 1 time in 6,
so the guess doesn't change how far Genius goes on average, only which roll comes with the extra
turn. A right 6 makes the best roll better, which a trailing racer needs to reach the medals. A
right 1 makes the worst roll harmless, which is worth more to the leader. Guessing 1 from 2nd
place doesn't help.

**A star is worth about 15 spaces, not 3.** It's a sure point, while a few spaces only matter if
they change who finishes 1st or 2nd. Flip Flop now swaps onto a star even if it's behind, and
Magician and Alchemist land on stars when they can. Legs is the exception: valuing stars that
highly costs it 0.10, since it often gives up moving 5 for them.

**Flip Flop should swap with a Copycat too.** A Copycat copies the leader's power, so after Flip
Flop takes its lead it swaps straight back, and the two can trade places every turn. That still
pays Flip Flop on balance: +0.12 on the Wild Wilds at 5 players and +0.10 at 3. The cost is races
where they're the last two left, which end with neither scoring (fiddly details 5: a loop where
no one can finish ends the race). With both in a race of 3, that's a quarter of races. Swapping only when it wouldn't put Flip Flop
in the lead gained just 0.02.

**Cheerleader shouldn't cheer for an opponent's M.O.U.T.H.** Moving it 2 can land it on a space
with one other racer, which it eats. Skipping it gains 0.03 on the Wild Wilds; skipping it only
when it would eat gained the same. Most of the rest of Cheerleader's gap behind playouts doesn't
survive a recheck, and what does is scattered.

**Mastermind should predict the likeliest winner, not the best racer.** Ratings are points per
race, so the best-rated racer is often Lovable Loser or Sisyphus, who almost never win.

**Rocket Scientist shouldn't double to just short of the finish.** Doubling to within 6 spaces of
the line without crossing it leaves it tripped there while the others get a turn to finish
first.

**Dicemonger's rerolls follow Magician's rule.** Any racer rerolling Dicemonger's offer when the
roll lands worse than an average roll, instead of on a 1 to 3, scored 0.25 more a race on the
Wild Wilds and 0.007 less on the Mild Mile (100,000 races each, ±0.006).

**Don't play defensively against Dicemonger.** Taking its reroll only when it gains a racer
several spaces, so Dicemonger moves less, costs that racer more than it costs Dicemonger
(`node scripts/dicemonger.ts`, 100,000 races of 5 on the Wild Wilds with Dicemonger and a test
racer):

| test racer rerolls | points | change |
| --- | --- | --- |
| by the default rule | 2.39 | |
| only when it gains 2+ spaces | 2.28 | −0.11 |
| only when it gains 4+ spaces | 2.11 | −0.29 |
| never | 1.98 | −0.41 |

Tried and rejected, besides the alternatives in the table: Suckerfish declining rides inside the
Wild Wilds' 12–16 loop (−0.84 to −0.98 on the Wild Wilds), Hypnotist also skipping Party Animal,
Suckerfish and Flip Flop (−0.03 / −0.15), Cheerleader not cheering when an opponent shares
last place (−0.20 / −0.25) or for an opponent's Baba Yaga too (+0.01 / −0.01).

Every racer's power is worth a lot over no power at all: "never" costs 0.4 to 2.7 points a race.

Unlike Flip Flop, Hypnotist still skips Copycat. Pulling a Copycat back makes it copy Hypnotist and pull straight back, forever, and pulling Baba
Yaga onto your own space trips you, which stalled races when it repeated; so Hypnotist skips both.

### By playing out each option

`node scripts/playouts.ts` decides each choice by replaying the turn up to it, forcing each option,
and playing the race out 20 times per option, then compares with the hand-written choice (4,000
races of 5 per racer; differences under about 0.1 are noise). A decision on the same board in the
same turn is reused, as long as the box still has bronze or still doesn't: Suckerfish riding Scoocher around the Wild Wilds' 12–16 cycle can decide
hundreds of times in one turn, and each playout replays every decision before it.

| racer | race 1, Mild Mile | race 2, Wild Wilds |
| --- | --- | --- |
| Flip Flop | 1.41 → 1.93 (+0.53) | 3.74 → 4.24 (+0.50) |
| Cheerleader | 1.10 → 1.06 | 2.41 → 2.74 (+0.32) |
| Suckerfish | 1.61 → 1.66 | 3.87 → 4.13 (+0.26) |
| Legs | 1.43 → 1.45 | 2.55 → 2.72 (+0.17) |
| Mastermind | 1.04 → 1.17 (+0.13) | 2.21 → 2.26 |
| Hypnotist | 0.98 → 0.92 | 2.41 → 2.54 (+0.13) |
| Rocket Scientist | 1.00 → 1.01 | 2.33 → 2.45 (+0.12) |
| Duelist | 0.95 → 0.84 (−0.11) | 1.72 → 1.71 |
| Alchemist, Genius, Third Wheel | within ±0.1 | within ±0.1 |

![Hand-written choices against choices by playouts](charts/playouts.svg)

**On the Mild Mile the hand-written choices are close to the best.** The exceptions are Flip Flop,
whose best swap depends on more than distance, and Mastermind, which does better still predicting
from this particular race than from each racer's chance of winning in general.

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

**Then stars got their due.** Logging each decision against its playouts showed Flip Flop's
best swaps landing on stars, often backwards, and Rocket Scientist's worst doubles stopping just
short of the finish. The changes in "Optional powers" above cut the gaps on the Wild Wilds:
Flip Flop from +1.40 to +0.50, Mastermind from +0.38 to +0.05, Rocket Scientist from +0.26 to
+0.12.

**What's left of Flip Flop's gap has no pattern.** On the Mild Mile, only 0.07 of its 0.5 a race
survives a recheck with 10 times the playouts (`node scripts/decisions.ts --racer "Flip Flop"
--race 1`), so most of the gap is noise in picking the best of several estimates. On the Wild
Wilds 0.39 survives, spread over picking a different racer ahead, swapping backwards near the
star on 13 instead of rolling, and swapping with Copycat, the only part that became a rule.

Not covered: Magician's rerolls and the before-race picks (Egg, Twin), which happen outside a
turn's snapshot or outside `choose`.

## Racers that pick racers

`node scripts/twin.ts` reruns Twin, Egg, Mastermind and Copycat with a rating to choose by (each
racer's points in that race) and, for Twin, earlier winners to copy. The earlier winners are drawn
from earlier races' chances of 1st, leaving out this race's lineup. Points per race, 100,000 races
of 5, against the dataset, where they pick by the built-in ratings (`ratings.json`: points on the
race's own track at its number of racers, or for Mastermind, chance of 1st on the track) and
Twin's earlier winners are averaged over both races on the track:

| racer | race 1 | race 2 | race 3 | race 4 |
| --- | --- | --- | --- | --- |
| Twin | 0.90 → 0.28 | 3.64 → 2.96 | 1.24 → 2.10 | 4.16 → 4.87 |
| Egg | 1.65 → 1.67 | 3.29 → 3.42 | 2.11 → 2.11 | 3.74 → 4.00 |
| Mastermind | 1.05 → 1.06 | 2.14 → 2.15 | 1.55 → 1.51 | 2.64 → 2.64 |
| Copycat | 1.35 → 1.34 | 3.37 → 3.30 | 1.88 → 1.89 | 3.88 → 3.92 |

![Racers that pick racers, with ratings and earlier winners](charts/twin.svg)

**Twin is a late-race racer, and in race 4 it's the second best of all,** behind only Scoocher.
With three earlier winners to choose from, it can usually copy a strong one, often Scoocher,
which wins half the races it's in. In race 1 it has nothing to copy.

**Rating each race separately adds little over the built-in ratings:** −0.07 to +0.25 points for
Egg, Mastermind and Copycat, most of it in race 4. Against random picks, choosing by any rating
was worth half a point to a point a race to Egg and Mastermind.

The rest of the order hardly moves (rank correlation 0.95–1.00); what moves is mostly Twin.

## Whole games

`node scripts/games.ts` plays 100,000 games of 5 where everyone drafts the highest-rated racer left
and plays each team in its best race order (`ratings.json`).

| first-round pick | score | wins |
| --- | --- | --- |
| 1 | 11.07 | 27.1% |
| 2 | 11.47 | 30.0% |
| 3 | 9.68 | 16.8% |
| 4 | 8.89 | 13.8% |
| 5 | 8.36 | 12.4% |

**Draft order decides a lot.** Only 10 racers are flipped up per round, and the value is
concentrated in a few of them (Scoocher above all), so the first picks take most of it. The 2nd
pick does best of all: the second snake draft starts with the player to the left of the first
pick, so it picks first in that round, while the first pick goes second. Between them they win
57% of games, against 40% for an even share. That's from an even roll-off, so it's the game's
biggest swing that isn't on the track.

**Team value predicts the winner, loosely.** The team with the best estimated value wins 42.4% of
games, against 20% for an even share, and the estimate correlates 0.45 with the final score.
Estimates run low (9.34 against 9.90 actual), probably because they come from races against
random opponents rather than drafted, stronger ones.

## The two-racer variants

`node scripts/games.ts --double --players 2` (or 3) plays the variants: everyone drafts 8 racers
and races two at a time. 100,000 games each, with standard games for comparison:

| game | 1st pick wins | 2nd pick | 3rd pick | best estimated team wins |
| --- | --- | --- | --- | --- |
| 2 players, two racers each | 50.5% | 49.5% | | 57.0% |
| 3 players, two racers each | 40.9% | 30.3% | 28.8% | 57.9% |
| 3 players, standard | 34.5% | 34.6% | 30.9% | 35.9% |
| 5 players, standard | 27.1% | 30.0% | 16.8% (then 13.8%, 12.4%) | 42.4% |

![Chance of winning by draft position](charts/games.svg)

**The 2-player variant's draft is fair.** Its ABBAABBA rows, with the second draft reversed,
cancel the first pick's edge.

**The 3-player variant's draft isn't.** It runs four snake drafts of 6, rotating who starts, so
the first player starts two of the four and wins 40.9% of games against 33.3% for an even share.
A table could fix it by giving the last pick of the first draft the first pick of the fourth.

**Standard drafts are fair at 3 players but not at 5,** where only the first two players ever
start a round.

**Team quality matters more with two racers each.** The best estimated team wins 57% of the
time in the variants, against 36% in standard 3-player games, where one racer per race leaves
more to luck.

## Drafting strategy

`node scripts/draft.ts` gives one randomly seated player a different drafting strategy against
opponents who take the highest-rated racer left (100,000 games of 5 each):

| my draft | wins | score |
| --- | --- | --- |
| highest rating, as opponents do | 20.2% | 9.93 |
| most added to my best race order | 19.8% | 9.91 |
| my gain plus the most it would add to an opponent (denial) | 19.8% | 9.90 |

**Drafting smarter doesn't pay.** Both alternatives score within 0.03 points a game of taking the
highest rating, and win 0.4 points less often. That's about the size of the noise over
100,000 games, and invisible at a table. The value is concentrated in a few racers, so the racer
that adds most to your team, the one that adds most to an opponent's, and the highest-rated one
are nearly always the same pick. Where you sit in the draft matters far more than how you draft.

## Choosing racers during the game

`node scripts/endgame.ts` lets one randomly seated player choose its racer before each race
differently from the opponents, who play their best race order (100,000 games of 5 each):

| my choices | wins | score | my M.O.U.T.H. met their Scoocher | wins in those games |
| --- | --- | --- | --- | --- |
| best race order, as opponents do | 19.9% | 9.89 | 0.6% of games | 14.8% |
| by score: with two left, save the safe one when ahead, the likely winner when behind | 19.7% | 9.83 | | |
| counter: draft M.O.U.T.H. once an opponent has Scoocher, and race it in Scoocher's race | 19.6% | 9.68 | 4.4% of games | 9.0% |

![Strategies' chances of winning](charts/strategies.svg)

**Just play your best race order.** Switching by score gives up 0.06 points a game, and
the racers' spreads are too alike for the safety or the long shot to make it back.

**Countering Scoocher doesn't pay for the counterer.** When your M.O.U.T.H. meets their Scoocher
you win only 9.0% of the time. Slowing or eating Scoocher helps the other three opponents as much
as you, while it costs you a better draft pick and M.O.U.T.H.'s own best race.

## Spread of points

`node scripts/spread.ts` (race 4 by default, from the dataset). An average hides how a racer gets
there. Race 4 on the Wild Wilds (5/4), selected:

| racer | mean | sd | 0 points | at least gold |
| --- | --- | --- | --- | --- |
| Scoocher | 8.36 | 4.93 | 1% | 85% |
| Suckerfish | 4.60 | 3.85 | 14% | 53% |
| Dicemonger | 4.51 | 2.44 | 2% | 53% |
| Flip Flop | 4.34 | 2.65 | 8% | 57% |
| Copycat | 3.88 | 3.49 | 20% | 45% |
| Lovable Loser | 3.85 | 2.75 | 12% | 39% |
| Sisyphus | 3.76 | 1.56 | 2% | 26% |
| Romantic | 3.57 | 2.35 | 20% | 52% |
| Heckler | 3.54 | 2.37 | 21% | 51% |
| Mastermind | 2.64 | 2.19 | 27% | 25% |

![Chance of scoring nothing against chance of at least gold in race 4](charts/spread.svg)

**Protecting a lead in race 4:** pick a racer that rarely scores nothing. Sisyphus (2%),
Dicemonger (2%) and Flip Flop (8%) are nearly sure of a few points, and Sisyphus is the steadiest
of all (sd 1.56).

**Catching up in race 4:** pick a racer that often wins. Flip Flop (57%), Suckerfish and
Dicemonger (53%) take gold more than half the time, against Sisyphus's 26%. Dicemonger and Flip
Flop are both safe and likely to win. Scoocher is both the
safest and the likeliest to win, so it's the best racer whichever position you're in.

## Seat order

`node scripts/seats.ts` (from the dataset). Points by seat, seat 1 going first:

| players | seat 1 | seat 2 | seat 3 | seat 4 | seat 5 | seat 6 | seat 1 − average |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3 | 2.00 | 1.88 | 1.75 | | | | +0.12 |
| 4 | 1.57 | 1.48 | 1.38 | 1.32 | | | +0.13 |
| 5 | 1.29 | 1.22 | 1.16 | 1.11 | 1.08 | | +0.12 |
| 6 | 1.08 | 1.04 | 0.99 | 0.96 | 0.94 | 0.92 | +0.09 |

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

**Scoocher wins most races.** It wins 65% of 5-player Mild Mile races. It moves 1 after every
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
space at a time circles 12–16 and crosses the star on 13 each lap. Scoocher averages 5.04 bronze
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
| triggers queue and resolve even if the board changed (Garfield's own play) | Romantic +0.11 (of 2.03) | Romantic +0.12 (of 2.91) |

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
- A Copycat ping-pongs forever with Hypnotist or Flip Flop if they keep targeting each other.
  Hypnotist avoids it. Flip Flop doesn't, since it pays: other racers usually finish while the
  two trade places, but when they're the last two left, it's a loop where no one can finish, which ends the race
  with no more points (fiddly details 5). The model ended those only at its 1,000-turn cap,
  letting the pair farm stars until then.
- Huge Baby on 12 traps a racer between 11's arrow (+1) and 16's (−4). The loop rule ends it
  after one pass.
- Flip Flop can swap with a racer on its own space, but neither scores the space again: a warp
  that doesn't change spaces triggers nothing (Garfield and Hague,
  [BGG](https://boardgamegeek.com/thread/3584489/article/46674967)). The model used to score the
  star again, which playouts found and farmed.

## Next

`TODO.md` has what's left: logging real games and comparing them with the model.
