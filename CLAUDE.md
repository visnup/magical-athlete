# magical-athlete

A simulator of the CMYK board game Magical Athlete, from the rulebook in `magical-athlete.pdf`
(https://bghub.org/r/magical-athlete.pdf, not committed). No dependencies; Node 24 runs the
TypeScript directly.

- `game.ts`: the engine. `Race` runs one race, `playGame` drafts and runs four.
- `sim.ts`: Monte Carlo. `node sim.ts --n 100000 --players 5` prints per-racer odds;
  `--mode game` runs whole games; `--csv` prints one row per racer per race (or per player per
  game) instead; `--log` prints every event.
- `node --test` runs `game.test.ts`, which includes the rulebook's Romantic/Scoocher/Banana
  example, and `racers.test.ts`, one test per card named for its text, plus the rulebook's notes.
- `TODO.md` is the plan: checking the model first, then the analysis.

## Not in the rulebook

- **Wild Wilds layout.** The rules describe arrows, rocks and stars but never show where they are,
  so every race defaults to the Mild Mile. Pass a `Track` in `schedule` once the layout is known.
- **Chip values.** Gold 3/4/4/5 and silver 2/3/3/4 by race, from the physical chips.
- **Mild Mile geometry.** Start is space 0, 29 is the last space, and 30 is across the finish.
  Blimp's second corner is space 15.

## Interpretations

- Simultaneous triggers resolve racetrack spaces first, then racers starting with the current
  player and going clockwise, each resolving fully (depth-first) before the next.
- Scoocher moves after every other racer's power, including passive ones every turn (Blimp, Hare,
  Coach, Gunk per -1, Party Animal) and each Leaptoad skip.
- An infinite loop is a power repeating with identical positions within its own chain of
  triggers. That's cut after one pass (`loops` counts them).
- A tripped racer skips "before my main move" powers too.
- Heckler counts its own turns.
- Hare doesn't skip when it's the only racer left, which would otherwise never end.
- Sisyphus follows its card: a 6 warps it to Start instead of moving. The rulebook's note under it,
  "I still get my main move after warping", is word for word Third Wheel's and contradicts the card.
- A Duelist duels everyone it shares the Start with before the first turn.
- Some races deadlock under the rules, like four racers on space 29 with Coach (+1) and Stickler
  (exact finishes only). They stop after 1,000 turns and count as `stalled`.
- Optional powers follow `defaultPolicy`, a greedy guess. Hypnotist and Flip Flop avoid targets
  that would ping-pong forever with a Copycat. Mastermind predicts itself unless `rating`
  says otherwise, and with no ratings, drafts, Egg and Twin picks are random.
