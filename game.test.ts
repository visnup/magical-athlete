import assert from "node:assert/strict";
import { test } from "node:test";
import { mulberry32, NAMES, type Name, playGame, Race, type RaceOptions, shuffle } from "./game.ts";

function setup(names: Name[], pos: number[], dice: number[] = [], o: Partial<RaceOptions> = {}) {
  const race = new Race({ racers: names, dice, rng: mulberry32(1), ...o });
  race.racers.forEach((r, i) => (r.pos = pos[i]));
  return race;
}

test("rulebook example: Romantic passes Scoocher and Banana", () => {
  const race = setup(["Romantic", "Scoocher", "Banana"], [1, 3, 4], [5]);
  const [romantic, scoocher, banana] = race.racers;
  race.turn(romantic);
  assert.equal(romantic.tripped, true);
  assert.equal(romantic.pos, 8);
  assert.equal(scoocher.pos, 5);
  assert.equal(banana.pos, 4);
});

test("Scoocher and Huge Baby loop once", () => {
  const race = setup(["Alchemist", "Scoocher", "Huge Baby"], [0, 4, 5], [2]);
  const [alchemist, scoocher] = race.racers;
  race.turn(alchemist);
  assert.equal(alchemist.pos, 4);
  assert.equal(scoocher.pos, 4);
  assert.ok(race.loops > 0);
});

test("random races finish, except rare rules deadlocks", () => {
  const rng = mulberry32(42);
  const seen = new Set<Name>();
  let stalled = 0;
  for (let i = 0; i < 20000; i++) {
    const names = shuffle([...NAMES], rng).slice(0, 2 + (i % 5));
    names.forEach((n) => seen.add(n));
    const result = new Race({ racers: names, rng }).run();
    stalled += +result.stalled;
    assert.ok(result.finishers.length <= 2);
  }
  // e.g. four racers on the last space with Coach (+1) and Stickler (exact finishes only)
  assert.ok(stalled < 5, `${stalled} stalled`);
  assert.equal(seen.size, NAMES.length);
});

test("full games score four races", () => {
  const rng = mulberry32(7);
  for (let i = 0; i < 500; i++) {
    const game = playGame({ players: 3 + (i % 4), rng });
    assert.equal(game.races.length, 4);
    assert.ok(game.scores.every(Number.isFinite));
  }
});
