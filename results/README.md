---
pretty_name: Magical Athlete simulations
license: mit
tags:
  - board-games
  - simulation
  - monte-carlo
size_categories:
  - 10M<n<100M
configs:
  - config_name: races-mild-5p
    data_files: races-mild-5p.parquet
    default: true
  - config_name: races-wild-5p
    data_files: races-wild-5p.parquet
  - config_name: races-mild-3p
    data_files: races-mild-3p.parquet
  - config_name: races-mild-4p
    data_files: races-mild-4p.parquet
  - config_name: races-mild-6p
    data_files: races-mild-6p.parquet
  - config_name: races-wild-3p
    data_files: races-wild-3p.parquet
  - config_name: races-wild-4p
    data_files: races-wild-4p.parquet
  - config_name: races-wild-6p
    data_files: races-wild-6p.parquet
  - config_name: games
    data_files: games-*.parquet
  - config_name: draft
    data_files: draft-5p.parquet
  - config_name: endgame
    data_files: endgame-5p.parquet
  - config_name: choices
    data_files: choices-*.parquet
  - config_name: playouts
    data_files: playouts.parquet
  - config_name: twin
    data_files: twin.parquet
  - config_name: twin-rated
    data_files: twin-rated.parquet
  - config_name: lineup-twin
    data_files: lineup-twin.parquet
  - config_name: lineup-draft
    data_files: lineup-draft.parquet
  - config_name: sensitivity
    data_files: sensitivity-*.parquet
---

# Magical Athlete simulations

Raw output of a Monte Carlo simulator of the board game Magical Athlete (CMYK), following the
August 2026 rulebook and official rulings: https://github.com/visnup/magical-athlete. Its README
is the write-up these files back, and `make` there regenerates them.

Every file is one row per racer per race, or per player per game. Nothing is averaged.

The simulator, its analysis and this card were written with Claude Opus 5.5 at medium effort,
working in Claude Code throughout.

## Scoring a race

A game is four races: 1 and 3 on the Mild Mile, 2 and 4 on the Wild Wilds. Gold and silver chips
are worth 3/2, 4/3, 4/3 and 5/4 in races 1 to 4, so a row's points in race k are
`gold * GOLD[k] + silver * SILVER[k] + bronze`. The race files hold races on one track; score them
as race 1 or 3 (Mild Mile) or 2 or 4 (Wild Wilds). For example, with DuckDB:

```sql
select racer, avg(gold * 3 + silver * 2 + bronze) points
from 'hf://datasets/visnup/magical-athlete/races-mild-5p.parquet'
group by racer order by points desc;
```

## Race rows

`races-<track>-<players>p` is a million races of a random lineup of 3 to 6 of the 36 racers, with
no earlier winners for Twin and random picks for Egg, Twin, Mastermind and Copycat. Seat 0 goes
first. Columns:

| column | meaning |
| --- | --- |
| race | race number within the file |
| seat | turn order, 0 first |
| racer | the racer |
| gold, silver | 1 if it took that chip; a Mastermind that predicted itself can take both |
| bronze | bronze chip points gained (or lost) in the race |
| pos | final space, counting the Start as 0 |
| trips | times it was tripped |
| uses | times its power was used |
| eliminated | 1 if it was eliminated from the race |
| turns | turns it took |
| stalled | 1 if the race hit the 1,000-turn limit without two finishers |

The other files with these columns each race one racer under test, or a rule variant:

- `choices-<racer>`: the racer under test in every race, with `game_race` (1 or 2) and `choice`,
  its optional power's decision rule (`current` is the simulator's default).
- `playouts`: the same, with `playouts` 0 for the hand-written choice or the number of playouts
  per option when it chose by playing each option out.
- `twin`: Twin, Egg, Mastermind or Copycat in every race of `game_race` 1 to 4, picking by
  ratings and, for Twin, with earlier winners to copy. `twin-rated`: whole races set up that way.
- `lineup-twin`: Twin in every race with earlier winners, used for its race-order ratings.
- `sensitivity-<rule>-<track>`: 5-player races with an unsettled rule read the other way
  (`backwards`: main moves pushed below 0 go backwards; `queue`: triggers queue and resolve even
  after the board changed).

## Game rows

`games-<players>p[-double]`, `draft-5p` and `endgame-5p` are whole games, a row per player:

| column | meaning |
| --- | --- |
| game | game number |
| player | seat, 0 first |
| pick | first-round draft position, 1 first |
| team | its racers in the order raced, joined by `\|` |
| estimate | the team's value by the simulator's ratings (`games` only) |
| score | total points |
| won | 1, or a share of 1 when tied for the top score |
| strategy, me, met | `draft` and `endgame`: the test player's strategy, 1 on its row, and 1 if its M.O.U.T.H. raced an opponent's Scoocher |

`lineup-draft` is computed, not simulated: each racer's points by race, its draft value (points a
game over an average pick), and how often its best team plays it in each race.
