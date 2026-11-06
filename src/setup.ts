import { mulberry32, type Name, Race, type RaceOptions } from "./game.ts";

/** A race for tests: `names` at `pos`, rolling `dice` first. */
export function setup(names: Name[], pos: number[], dice: number[] = [], o: Partial<RaceOptions> = {}) {
  const race = new Race({ racers: names, dice, rng: mulberry32(1), ...o });
  race.racers.forEach((r, i) => (r.pos = pos[i]));
  return race;
}
