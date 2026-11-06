import assert from "node:assert/strict";
import { test } from "node:test";
import { type Name, NAMES, WILD_WILDS } from "./game.ts";
import { setup } from "./setup.ts";

const cards: Record<Name, () => void> = {
  "Alchemist"() {
    // When I roll a 1 or 2 for my main move, I can move 4 instead.
    const race = setup(["Alchemist", "Banana"], [0, 10], [2]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 4);
  },
  "Baba Yaga"() {
    // Trip any racer that stops on my space, or when I stop on theirs.
    let race = setup(["Banana", "Baba Yaga"], [0, 3], [3]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].tripped, true);
    race = setup(["Baba Yaga", "Banana"], [0, 3], [3]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[1].tripped, true);
  },
  "Banana"() {
    // I trip any racer that passes me.
    const race = setup(["Alchemist", "Banana"], [0, 2], [5]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].tripped, true);
  },
  "Blimp"() {
    // When I start my turn before the second corner of the track, I get +3 to my main move.
    // On or after that corner, I get -1.
    let race = setup(["Blimp", "Banana"], [0, 20], [2]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 5);
    race = setup(["Blimp", "Banana"], [15, 20], [2]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 16);
  },
  "Centaur"() {
    // When I pass a racer, they move -2. Not farther back than the Start space.
    const race = setup(["Centaur", "Legs"], [0, 1], [5]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 5);
    assert.equal(race.racers[1].pos, 0);
  },
  "Cheerleader"() {
    // Before my main move, I can make the racer(s) in last place move 2. If I do, I move 1.
    const race = setup(["Cheerleader", "Legs", "Banana"], [0, 0, 5], [1]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 4);
    assert.equal(race.racers[1].pos, 2);
  },
  "Coach"() {
    // Everyone on my space gets +1 to their main move, including me.
    const race = setup(["Coach", "Legs"], [0, 0], [1]);
    race.turn(race.racers[1]);
    assert.equal(race.racers[1].pos, 6);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 2);
  },
  "Copycat"() {
    // I have the power of the racer currently in the lead.
    const race = setup(["Copycat", "Legs"], [0, 10]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 5);
  },
  "Dicemonger"() {
    // Anyone can reroll their main move once per turn. When another racer does it, I move 1.
    const race = setup(["Banana", "Dicemonger"], [0, 0], [1, 4]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 4);
    assert.equal(race.racers[1].pos, 1);
  },
  "Duelist"() {
    // Whenever a racer shares my space, I can shout DUEL! We roll our dice and whoever rolls
    // highest moves 2. I win ties.
    let race = setup(["Legs", "Duelist"], [0, 5], [3, 3], { policy: { choose: { Duelist: () => true } } });
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 5);
    assert.equal(race.racers[1].pos, 7);
    // I just need to be sharing a space to immediately declare a duel.
    race = setup(["Legs", "Duelist"], [0, 0], [2, 5], { policy: { choose: { Duelist: () => true } } });
    race.beforeRace();
    assert.deepEqual(race.racers.map((r) => r.pos), [2, 0]);
  },
  "Egg"() {
    // Before my race, draw 3 new racers from the deck and pick one. I have its powers.
    const race = setup(["Egg", "Banana"], [0, 10], [], { deck: ["Legs"] });
    race.beforeRace();
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 5);
  },
  "Flip Flop"() {
    // I can skip rolling for my main move and swap spaces with another racer instead.
    let race = setup(["Flip Flop", "Banana"], [0, 10]);
    race.turn(race.racers[0]);
    assert.deepEqual(race.racers.map((r) => r.pos), [10, 0]);
    // Richard Garfield: swapping with a racer on my own star doesn't score it.
    race = setup(["Flip Flop", "Banana"], [13, 13], [], { track: WILD_WILDS, policy: { choose: { "Flip Flop": (r) => r.racers[1] } } });
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].bronze, 0);
  },
  "Genius"() {
    // I can predict what number I'll roll for my main move. If I'm right, I take an extra turn.
    let race = setup(["Genius", "Banana"], [0, 20], [6]);
    race.turn(race.racers[0]);
    assert.equal(race.queue[0], race.racers[0]);
    // If I'm racing against Skipper and I predict a 1, Skipper steals the next turn.
    race = setup(["Genius", "Skipper"], [0, 20], [1], { policy: { choose: { Genius: () => 1 } } });
    race.turn(race.racers[0]);
    assert.deepEqual(race.queue, [race.racers[1]]);
    // Alex Hague: Scoocher works with wrong predictions.
    race = setup(["Genius", "Scoocher"], [0, 20], [3]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[1].pos, 21);
  },
  "Gunk"() {
    // Other racers get -1 to their main move.
    const race = setup(["Banana", "Gunk"], [0, 10], [4]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 3);
  },
  "Hare"() {
    // I get +2 to my main move. When I start my turn alone in the lead, I skip my main move.
    let race = setup(["Hare", "Banana"], [0, 10], [1]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 3);
    race = setup(["Hare", "Banana"], [15, 10]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 15);
  },
  "Heckler"() {
    // When a racer ends their turn within 1 space of where they started, I move 2. Including
    // racers recovering from tripping.
    let race = setup(["Banana", "Heckler"], [0, 10], [1]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[1].pos, 12);
    race = setup(["Banana", "Heckler"], [0, 10]);
    race.racers[0].tripped = true;
    race.turn(race.racers[0]);
    assert.equal(race.racers[1].pos, 12);
  },
  "Huge Baby"() {
    // No one can ever be on my space, besides the Start. Whenever that would happen, put the
    // racer on the space behind me instead.
    let race = setup(["Legs", "Huge Baby"], [0, 5]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 4);
    // If I stop on Banana's space and move them back, it counts as passing them and I trip.
    race = setup(["Huge Baby", "Banana"], [0, 3], [3]);
    race.turn(race.racers[0]);
    assert.deepEqual(race.racers.map((r) => r.pos), [3, 2]);
    assert.equal(race.racers[0].tripped, true);
  },
  "Hypnotist"() {
    // At the start of my turn, I can warp a racer to my space.
    let race = setup(["Hypnotist", "Banana"], [0, 10], [1]);
    race.turn(race.racers[0]);
    assert.deepEqual(race.racers.map((r) => r.pos), [1, 0]);
    // Under Baba Yaga: the Hypnotist can cast their spell on me, but they still trip, and skip
    // this turn's main move (Alex Hague, BGG 2025-09-16).
    race = setup(["Hypnotist", "Baba Yaga", "Banana"], [0, 10, 20], [6], {
      policy: { choose: { Hypnotist: (r) => r.racers[1] } },
    });
    race.turn(race.racers[0]);
    assert.deepEqual(race.racers.map((r) => r.pos), [0, 0, 20]);
    assert.equal(race.racers[0].tripped, false);
    assert.deepEqual(race.dice, [6]);
  },
  "Inchworm"() {
    // When another racer rolls a 1 for their main move, they skip that move and I move 1.
    const race = setup(["Banana", "Inchworm"], [0, 0], [1]);
    race.turn(race.racers[0]);
    assert.deepEqual(race.racers.map((r) => r.pos), [0, 1]);
  },
  "Lackey"() {
    // When another racer rolls a 6 for their main move, I move 2 before they move.
    const race = setup(["Banana", "Lackey"], [0, 0], [6]);
    race.turn(race.racers[0]);
    assert.deepEqual(race.racers.map((r) => r.pos), [6, 2]);
  },
  "Leaptoad"() {
    // While moving, I skip spaces with other racers on them.
    const race = setup(["Leaptoad", "Banana", "Gunk"], [0, 1, 2], [3]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 4);
    assert.equal(race.racers[0].tripped, true);
  },
  "Legs"() {
    // I can skip rolling for my main move and move 5 instead.
    const race = setup(["Legs", "Banana"], [0, 10]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 5);
  },
  "Lovable Loser"() {
    // At the start of my turn, I get 1 point chip if I'm alone in last place. Even tripped.
    const race = setup(["Lovable Loser", "Banana"], [0, 5], [1]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].bronze, 1);
    race.racers[0].tripped = true;
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].bronze, 2);
  },
  "Magician"() {
    // I can reroll my main move up to two times. I must use whatever my last roll is.
    const race = setup(["Magician", "Banana"], [0, 20], [1, 2, 6]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 6);
  },
  "Mastermind"() {
    // At the start of my first turn, I predict which racer will win the race. If I'm right, the
    // race ends immediately and I finish 2nd.
    const race = setup(["Mastermind", "Legs", "Banana"], [0, 27, 0], [1], {
      policy: { choose: { Mastermind: () => "Legs" } },
    });
    assert.deepEqual(race.run().finishers, [1, 0]);
  },
  "M.O.U.T.H."() {
    // When I stop on a space with exactly one other racer, they're eliminated from the race.
    const race = setup(["M.O.U.T.H.", "Banana"], [0, 3], [3]);
    race.turn(race.racers[0]);
    assert.notEqual(race.racers[1].eliminated, null);
  },
  "Party Animal"() {
    // At the start of my turn, all racers move 1 space towards me. Each other racer on my space
    // gives me +1 to my main move.
    let race = setup(["Party Animal", "Legs", "Banana"], [5, 4, 10], [1]);
    race.turn(race.racers[0]);
    assert.deepEqual(race.racers.map((r) => r.pos), [7, 5, 9]);
    // They move at the same time, so M.O.U.T.H. doesn't arrive alone with me and eat me.
    race = setup(["Party Animal", "M.O.U.T.H.", "Legs"], [5, 4, 6], [1]);
    race.turn(race.racers[0]);
    assert.ok(race.racers.every((r) => r.eliminated === null));
  },
  "Rocket Scientist"() {
    // When I roll for my main move, I can move double that number. If I do, I trip after moving.
    const race = setup(["Rocket Scientist", "Banana"], [0, 20], [4]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 8);
    assert.equal(race.racers[0].tripped, true);
  },
  "Romantic"() {
    // When anyone stops on a space with exactly one other racer, I move 2.
    let race = setup(["Legs", "Romantic", "Banana"], [0, 0, 5]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[1].pos, 2);
    // If two racers move together simultaneously, like with the Party Animal or Suckerfish, my
    // power doesn't trigger.
    race = setup(["Legs", "Suckerfish", "Romantic"], [0, 0, 10]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[1].pos, 5);
    assert.equal(race.racers[2].pos, 10);
  },
  "Scoocher"() {
    // When another racer's power happens, I move 1.
    const race = setup(["Alchemist", "Scoocher"], [0, 10], [1]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[1].pos, 11);
  },
  "Sisyphus"() {
    // Before my race, I take 4 point chips. When I roll a 6 for my main move, instead of moving,
    // I warp to the Start and lose 1 point chip.
    const race = setup(["Sisyphus", "Banana"], [10, 20], [6]);
    race.beforeRace();
    assert.equal(race.racers[0].bronze, 4);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 0);
    assert.equal(race.racers[0].bronze, 3);
  },
  "Skipper"() {
    // When anyone rolls a 1 for their main move, I go next in turn order.
    const race = setup(["Banana", "Legs", "Skipper"], [0, 0, 0], [1]);
    race.turn(race.racers[0]);
    assert.equal(race.queue[0], race.racers[2]);
  },
  "Stickler"() {
    // Other racers can only cross the finish line by moving the exact amount they need. If they
    // overshoot, they don't move.
    const race = setup(["Banana", "Stickler", "Legs"], [27, 0, 0], [5, 3]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 27);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].place, 1);
  },
  "Suckerfish"() {
    // When a racer on my space moves, I can move to their new space.
    let race = setup(["Legs", "Suckerfish"], [0, 0]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[1].pos, 5);
    // Within a roll of the finish, I don't ride Scoocher home behind it.
    race = setup(["Alchemist", "Scoocher", "Suckerfish"], [0, 26, 26], [1]);
    race.turn(race.racers[0]);
    assert.deepEqual(race.racers.map((r) => r.pos), [4, 27, 26]);
  },
  "Third Wheel"() {
    // Before my main move, I can warp to any space with exactly 2 racers on it.
    const race = setup(["Third Wheel", "Legs", "Banana"], [0, 8, 8], [1]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 9);
    assert.equal(race.racers[0].tripped, false);
  },
  "Twin"() {
    // Before my race, I can pick a racer who won a previous race and race with their powers.
    const race = setup(["Twin", "Banana"], [0, 10], [], { winners: ["Legs"] });
    race.beforeRace();
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 5);
  },
};

for (const name of NAMES) test(name, cards[name]);
