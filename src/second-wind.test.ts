import assert from "node:assert/strict";
import { test } from "node:test";
import { mulberry32, type Name, Race, type RaceOptions, SECOND_WIND } from "./game.ts";

function setup(names: Name[], pos: number[], dice: number[] = [], o: Partial<RaceOptions> = {}) {
  const race = new Race({ racers: names, dice, rng: mulberry32(1), ...o });
  race.racers.forEach((r, i) => (r.pos = pos[i]));
  return race;
}

const positions = (race: Race) => race.racers.map((r) => r.pos);

const cards: Record<(typeof SECOND_WIND)[number], () => void> = {
  "Bite Mark"() {
    // When I roll a 1 or 2 for my main move, I transform into a W.E.R.E.M.O.U.T.H. who eliminates
    // any racers I pass.
    const race = setup(["Bite Mark", "Legs", "Coach"], [0, 1, 5], [2, 6]);
    race.turn(race.racers[0]);
    assert.notEqual(race.racers[1].eliminated, null);
    race.turn(race.racers[0]);
    assert.notEqual(race.racers[2].eliminated, null);
  },
  "Blunderdog"() {
    // When I'm in last place, triple my main move roll. When I'm not, I move backwards.
    let race = setup(["Blunderdog", "Legs"], [0, 5], [2]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 6);
    race = setup(["Blunderdog", "Legs"], [10, 5], [2]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 8);
  },
  "Cheatah"() {
    // I secretly set my die to any number. If the player to my right guesses it, I don't move.
    let race = setup(["Cheatah", "Legs"], [0, 10], [], { policy: { choose: { Cheatah: () => 6 } } });
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 6);
    race = setup(["Cheatah", "Legs"], [0, 10], [], { policy: { choose: { Cheatah: () => 0 } } });
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 0);
  },
  "Critic"() {
    // I can make racers ahead of me reroll their main move once per turn.
    const race = setup(["Banana", "Critic"], [5, 0], [6, 1]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 6);
  },
  "Diva"() {
    // In last place at the start of my turn, I swap with the lead racer. Otherwise, with the last.
    let race = setup(["Diva", "Banana", "Legs"], [0, 3, 10], [1]);
    race.turn(race.racers[0]);
    assert.deepEqual(positions(race), [11, 3, 0]);
    race = setup(["Diva", "Banana", "Legs"], [5, 3, 10], [1]);
    race.turn(race.racers[0]);
    assert.deepEqual(positions(race), [4, 5, 10]);
  },
  "Doppelgängster"() {
    // The racer who finishes 1st is eliminated instead. I get their power.
    const race = setup(["Banana", "Doppelgängster", "Legs"], [28, 0, 0], [3]);
    race.turn(race.racers[0]);
    assert.notEqual(race.racers[0].eliminated, null);
    assert.equal(race.finishers.length, 0);
    assert.deepEqual(race.racers[1].copied, ["Banana"]);
  },
  "Gloth"() {
    // I get -1 to my main move. When the race ends, I get 3 points if I'm not past the second
    // corner.
    let race = setup(["Gloth", "Banana"], [0, 10], [3]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 2);
    race = setup(["Gloth", "Banana", "Legs"], [0, 29, 29], [1]);
    race.race(race.racers[1]);
    assert.equal(race.racers[0].bronze, 3);
  },
  "Hog Knight"() {
    // I start on a hog that gives +2 to its rider's main move. When a racer stops on the hog's
    // space, they take it.
    const race = setup(["Banana", "Hog Knight"], [0, 5], [5, 1]);
    race.beforeRace();
    race.turn(race.racers[0]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 8);
  },
  "Hopfrog"() {
    // When I end my turn 1 space behind a racer, I take an extra turn.
    const race = setup(["Hopfrog", "Banana"], [0, 4], [3]);
    race.turn(race.racers[0]);
    assert.deepEqual(race.queue, [race.racers[0]]);
  },
  "Hotel"() {
    // When a racer stops on my space, they pay me 1 point. If they can't, they trip.
    let race = setup(["Banana", "Hotel"], [0, 3], [3], { bank: [5, 0] });
    race.turn(race.racers[0]);
    assert.deepEqual(race.racers.map((r) => r.bronze), [-1, 1]);
    race = setup(["Banana", "Hotel"], [0, 3], [3]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].tripped, true);
  },
  "Icarus"() {
    // I get +3 to my main move. If I roll a 6 for my main move, I'm eliminated.
    let race = setup(["Icarus", "Banana"], [0, 10], [2]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 5);
    race = setup(["Icarus", "Banana", "Legs"], [0, 10, 10], [6]);
    race.turn(race.racers[0]);
    assert.notEqual(race.racers[0].eliminated, null);
  },
  "Kingtripper"() {
    // At the start of my turn, I can trip the lead racer.
    const race = setup(["Kingtripper", "Banana"], [0, 10], [1]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[1].tripped, true);
  },
  "Kraken"() {
    // Once per race, at the start of my turn, I can warp all other racers to my space and trip them.
    const race = setup(["Kraken", "Banana", "Legs"], [0, 10, 3], [2]);
    race.turn(race.racers[0]);
    assert.deepEqual(positions(race), [2, 0, 0]);
    assert.equal(race.racers[1].tripped && race.racers[2].tripped, true);
  },
  "Le Saboteur"() {
    // When other racers roll a 3 for their main move, they move backwards instead.
    const race = setup(["Banana", "Le Saboteur"], [10, 0], [3]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 7);
  },
  "Magical Athlete"() {
    // 1: I move 7. … 4: I move 4 and take an extra turn. 5: The lead racer moves backwards 5.
    // 6: I move 6 and trip any racers I pass.
    let race = setup(["Magical Athlete", "Banana"], [0, 10], [1]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 7);
    race = setup(["Magical Athlete", "Banana"], [0, 10], [4]);
    race.turn(race.racers[0]);
    assert.deepEqual(race.queue, [race.racers[0]]);
    race = setup(["Magical Athlete", "Banana"], [0, 10], [5]);
    race.turn(race.racers[0]);
    assert.deepEqual(positions(race), [0, 5]);
    race = setup(["Magical Athlete", "Legs"], [0, 2], [6]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[1].tripped, true);
  },
  "Mole"() {
    // If there aren't any racers within 1 space of me, I can skip rolling and move 6 instead.
    let race = setup(["Mole", "Banana"], [0, 10]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 6);
    race = setup(["Mole", "Banana"], [0, 1], [2]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 2);
  },
  "Mr. Dice Guy"() {
    // I roll all six dice for my main move and pick any number that was rolled more than once.
    let race = setup(["Mr. Dice Guy", "Banana"], [0, 20], [1, 1, 4, 4, 6, 2]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 4);
    race = setup(["Mr. Dice Guy", "Banana"], [0, 20], [1, 2, 3, 4, 5, 6]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 0);
  },
  "Mush"() {
    // When I roll a 1 or 2 for my main move, I draw a racer card and get its power.
    const race = setup(["Mush", "Banana"], [0, 20], [1], { deck: ["Legs"] });
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 1);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 6);
  },
  "Nemesis"() {
    // When other racers roll for their main move, I can roll too. If I roll the same, I move that.
    const race = setup(["Banana", "Nemesis"], [0, 0], [4, 4]);
    race.turn(race.racers[0]);
    assert.deepEqual(positions(race), [4, 4]);
  },
  "Nepo Baby"() {
    // I start the race on the first corner of the track.
    const race = setup(["Nepo Baby", "Banana"], [0, 0]);
    race.beforeRace();
    assert.equal(race.racers[0].pos, 12);
  },
  "Null"() {
    // Racers ahead of me get -1 to their main move and have no powers.
    const race = setup(["Banana", "Null", "Legs"], [5, 0, 5], [3, 2]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 7);
    race.turn(race.racers[2]);
    assert.equal(race.racers[2].pos, 6);
  },
  "Overtaker"() {
    // I get +1 to my main move for each racer ahead of me.
    const race = setup(["Overtaker", "Banana", "Legs"], [0, 5, 5], [1]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 3);
  },
  "Party Pooper"() {
    // All sixes must be rerolled. When they are, I move 1.
    const race = setup(["Banana", "Party Pooper"], [0, 0], [6, 2]);
    race.turn(race.racers[0]);
    assert.deepEqual(positions(race), [2, 1]);
  },
  "Penguin"() {
    // Whenever a racer passes me, I trip. While I'm tripped, double my roll for my main move.
    const race = setup(["Legs", "Penguin"], [0, 2], [3]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[1].tripped, true);
    race.turn(race.racers[1]);
    assert.equal(race.racers[1].pos, 8);
    assert.equal(race.racers[1].tripped, false);
  },
  "Re-Runner"() {
    // After my first race, I race as an extra racer for my player in all remaining races.
    const race = setup(["Re-Runner", "Banana"], [0, 20], [3]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 3);
  },
  "Show-Off"() {
    // After I roll, I can keep rolling and adding each amount. If I roll the same or lower, I
    // don't move.
    let race = setup(["Show-Off", "Banana"], [0, 20], [2, 4]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 6);
    race = setup(["Show-Off", "Banana"], [0, 20], [3, 2]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 0);
  },
  "Soulmate"() {
    // Before my race, I pick any opposing racer. When I start my turn within 5 spaces of them, I
    // warp to their space.
    const race = setup(["Soulmate", "Banana"], [0, 4], [1]);
    race.beforeRace();
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 5);
  },
  "Speed Demon"() {
    // I get +1 to my main move for each point my player has. I am eliminated if I'm 4+ spaces in
    // the lead at the start of my turn.
    let race = setup(["Speed Demon", "Banana"], [0, 20], [1], { bank: [3, 0] });
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 4);
    race = setup(["Speed Demon", "Banana", "Legs"], [10, 5, 5]);
    race.turn(race.racers[0]);
    assert.notEqual(race.racers[0].eliminated, null);
  },
  "Spoilsport"() {
    // If all other racers are 5+ spaces ahead of me at the start of my turn, the race is cancelled
    // and I get 3 points.
    const race = setup(["Spoilsport", "Banana", "Legs"], [0, 5, 6]);
    const result = race.race(race.racers[0]);
    assert.deepEqual(result.finishers, []);
    assert.equal(race.racers[0].bronze, 3);
  },
  "Stepdad"() {
    // The racer to my left gets +2 to their main move. If they finish 1st, I get 3 points.
    let race = setup(["Stepdad", "Banana"], [0, 0], [3]);
    race.turn(race.racers[1]);
    assert.equal(race.racers[1].pos, 5);
    race = setup(["Stepdad", "Banana", "Legs"], [0, 28, 0], [1]);
    race.race(race.racers[1]);
    assert.equal(race.racers[0].bronze, 3);
  },
  "Streaker"() {
    // When I pass any racers, I get 1 point.
    const race = setup(["Streaker", "Coach", "Legs"], [0, 1, 2], [3]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].bronze, 1);
  },
  "Stunner"() {
    // Other racers within 1 space of me roll a 1 for all rolls.
    const race = setup(["Banana", "Stunner"], [0, 1], [6]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 1);
  },
  "Switcharoo"() {
    // When I end my turn within 1 space of another racer, I can swap who controls which racer.
    const race = setup(["Switcharoo", "Banana"], [0, 4], [3]);
    race.turn(race.racers[0]);
    assert.deepEqual(race.racers.map((r) => r.player), [1, 0]);
  },
  "Tail"() {
    // At the start of my turn, I can warp to the space behind the next racer ahead of me.
    const race = setup(["Tail", "Banana"], [0, 8], [2]);
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 9);
  },
  "The Hose"() {
    // At the end of my turn, roll a die and trip every racer within that many spaces ahead of me.
    const race = setup(["The Hose", "Coach", "Legs"], [0, 5, 20], [1, 6]);
    race.turn(race.racers[0]);
    assert.deepEqual(race.racers.map((r) => r.tripped), [false, true, false]);
  },
  "Understudy"() {
    // Before my race, I copy an opposing racer's power.
    const race = setup(["Understudy", "Legs"], [0, 10]);
    race.beforeRace();
    race.turn(race.racers[0]);
    assert.equal(race.racers[0].pos, 5);
  },
};

for (const name of SECOND_WIND) test(name, cards[name]);
