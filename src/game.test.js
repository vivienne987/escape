import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from './game.js';

function setup(run) {
  const originalNow = Date.now;
  let now = 100_000;
  Date.now = () => now;
  const events = [];
  const changes = [];
  const game = createGame({
    onChange: state => changes.push(structuredClone(state)),
    onEvent: event => events.push(event),
  });
  try { run({ game, events, changes, setTime: value => { now = value; } }); }
  finally { Date.now = originalNow; }
}

const observations = [
  ['triangle', 'green'], ['circle', 'purple'], ['star', 'blue'], ['square', 'yellow'],
];

function clues(game) {
  game.interact('paper3');
  game.interact('chair');
  observations.forEach(([shape, color], index) => game.submitObservation(index, shape, color));
}

function coins(game) {
  for (let i = 0; i < 5; i += 1) game.interact(`coin${i}`);
}

for (const order of [[1, 2], [2, 1]]) {
  test(`win with safe order ${order.join(' then ')}`, () => setup(({ game, events }) => {
    game.start();
    for (const safe of order) {
      if (safe === 1) {
        clues(game);
        game.interact('safe1');
        assert.equal(events.at(-1).kind, 'code');
        game.submitCode(order[0] === 1 ? ['green', 'purple', 'blue', 'yellow'] : ' GREEN, Purple, BLUE, yellow ');
      } else {
        coins(game);
        game.interact('safe2');
      }
      assert.equal(game.state.keys, order.indexOf(safe) + 1);
    }
    assert.equal(game.state.coins.size, 5);
    assert.equal(game.state.status, 'playing');
    game.interact('door');
    assert.equal(game.state.status, 'won');
    assert.equal(events.at(-1).kind, 'win');
    assert.match(events.at(-1).html, /did not guarantee freedom/);
  }));
}

test('initialization is quiet; ready actions are ignored', () => setup(({ game, events, changes }) => {
  assert.deepEqual(game.state, {
    status: 'ready', seconds: 900, coins: new Set(), keys: 0, paper: false,
    legend: false, portraits: new Set(), safe1: false, safe2: false, startedAt: null,
  });
  game.tick(9_000_000);
  game.interact('paper3');
  game.submitCode('green purple blue yellow');
  game.submitObservation(0, 'triangle', 'green');
  game.hint();
  assert.equal(events.length, 0);
  assert.equal(changes.length, 0);
}));

test('early safes, incomplete clues, and door cannot award keys or win', () => setup(({ game, events }) => {
  game.start();
  game.interact('safe1');
  assert.equal(events.at(-1).kind, 'info');
  game.submitCode('green purple blue yellow');
  game.interact('safe2');
  game.interact('door');
  game.interact('paper3');
  game.interact('chair');
  for (let i = 0; i < 3; i += 1) game.submitObservation(i, ...observations[i]);
  game.submitCode('green purple blue yellow');
  assert.equal(game.state.keys, 0);
  assert.equal(game.state.safe1, false);
  assert.equal(game.state.safe2, false);
  coins(game);
  game.interact('safe2');
  game.interact('door');
  assert.equal(game.state.status, 'playing');
}));

test('duplicates and invalid ids never add resources', () => setup(({ game }) => {
  game.start();
  for (let i = 0; i < 8; i += 1) {
    game.interact('coin0');
    game.interact('portrait0');
    game.submitObservation(0, 'triangle', 'green');
  }
  for (const id of ['coin5', 'coin00', 'portrait4', 'portrait01', 'unknown']) game.interact(id);
  assert.deepEqual(game.state.coins, new Set(['coin0']));
  assert.deepEqual(game.state.portraits, new Set([0]));
  clues(game);
  coins(game);
  for (let i = 0; i < 3; i += 1) {
    game.submitCode('green purple blue yellow');
    game.interact('safe1');
    game.interact('safe2');
  }
  assert.equal(game.state.keys, 2);
  assert.equal(game.state.coins.size, 5);
}));

test('wrong and malformed codes allow retry without losing', () => setup(({ game, events }) => {
  game.start();
  clues(game);
  for (const code of ['yellow blue purple green', '', null, ['green'], [1, 2, 3, 4]]) {
    game.submitCode(code);
    assert.equal(events.at(-1).kind, 'code');
    assert.equal(game.state.status, 'playing');
    assert.equal(game.state.keys, 0);
  }
  game.submitCode('green purple blue yellow');
  assert.equal(game.state.safe1, true);
}));

test('timer starts once and follows the wall clock without drift', () => setup(({ game, setTime }) => {
  game.start();
  assert.equal(game.state.startedAt, 100_000);
  setTime(100_999);
  game.tick();
  assert.equal(game.state.seconds, 900);
  setTime(101_001);
  game.tick();
  assert.equal(game.state.seconds, 899);
  game.start();
  assert.equal(game.state.startedAt, 100_000);
  setTime(550_500);
  game.tick();
  assert.equal(game.state.seconds, 450);
  game.tick();
  assert.equal(game.state.seconds, 450);
  game.tick(999_999);
  assert.equal(game.state.seconds, 1);
  game.tick(1_000_000);
  assert.equal(game.state.seconds, 0);
  assert.equal(game.state.status, 'lost');
}));

test('expired deadline prevents actions even before the next timer tick', () => setup(({ game, setTime, events }) => {
  game.start();
  setTime(1_000_001);
  game.interact('coin0');
  assert.equal(game.state.status, 'lost');
  assert.equal(game.state.coins.size, 0);
  assert.equal(events.at(-1).kind, 'loss');
  assert.match(events.at(-1).html, /fictional.*captured/);
  assert.match(events.at(-1).html, /sale into slavery/);
}));

for (const terminal of ['won', 'lost']) {
  test(`${terminal} state and callbacks freeze`, () => setup(({ game, events, changes }) => {
    game.start();
    if (terminal === 'won') {
      clues(game);
      coins(game);
      game.submitCode('green purple blue yellow');
      game.interact('safe2');
      game.interact('door');
    } else game.tick(1_000_000);
    const snapshot = structuredClone(game.state);
    const eventCount = events.length;
    const changeCount = changes.length;
    game.start();
    game.tick(5_000_000);
    game.interact('paper3');
    game.interact('door');
    game.submitCode('green purple blue yellow');
    game.submitObservation(0, 'triangle', 'green');
    game.hint();
    assert.deepEqual(game.state, snapshot);
    assert.equal(events.length, eventCount);
    assert.equal(changes.length, changeCount);
  }));
}

test('hints progress without giving the combination before all clues', () => setup(({ game, events }) => {
  game.start();
  for (const [action, expected] of [[null, /desk/], ['paper3', /chair/], ['chair', /folded cloth/]]) {
    if (action) game.interact(action);
    game.hint();
    assert.match(events.at(-1).html, expected);
    assert.doesNotMatch(events.at(-1).html, /GREEN, PURPLE, BLUE, YELLOW/);
  }
  clues(game);
  game.hint();
  assert.match(events.at(-1).html, /GREEN, PURPLE, BLUE, YELLOW/);
  game.submitCode('green purple blue yellow');
  game.hint();
  assert.match(events.at(-1).html, /remaining coins/);
  coins(game);
  game.hint();
  assert.match(events.at(-1).html, /Safe Two/);
  game.interact('safe2');
  game.hint();
  assert.match(events.at(-1).html, /Open the door/);
}));

test('reset restores all fields, notifies once, and permits a fresh deadline', () => setup(({ game, changes, events, setTime }) => {
  const state = game.state;
  game.start();
  clues(game);
  coins(game);
  game.submitCode('green purple blue yellow');
  game.interact('safe2');
  game.interact('door');
  const changeCount = changes.length;
  const eventCount = events.length;
  game.reset();
  assert.equal(game.state, state);
  assert.deepEqual(game.state, createGame().state);
  assert.equal(changes.length, changeCount + 1);
  assert.equal(events.length, eventCount);
  setTime(2_000_000);
  game.start();
  assert.equal(game.state.startedAt, 2_000_000);
  game.tick(2_001_000);
  assert.equal(game.state.seconds, 899);
}));

test('portrait interactions show indexed, neutral observations without collecting clues', () => setup(({ game, events }) => {
  game.start();
  for (const [index, numeral] of ['I', 'II', 'III', 'IV'].entries()) {
    game.interact(`portrait${index}`);
    const event = events.at(-1);
    assert.equal(event.title, `Painting ${numeral}`);
    assert.equal(event.kind, 'portrait');
    assert.equal(event.portraitIndex, index);
    assert.doesNotMatch(event.html, /triangle|circle|star|square|green|purple|blue|yellow|△|○|☆|□/i);
  }
  assert.equal(game.state.portraits.size, 0);
  game.submitObservation(0, ...observations[0]);
  assert.equal(events.at(-1).kind, 'info');
  assert.match(events.at(-1).html, /journal.*△.*triangle.*GREEN/);
  game.interact('portrait0');
  assert.equal(events.at(-1).kind, 'portrait');
  assert.equal(events.at(-1).portraitIndex, 0);
  assert.match(events.at(-1).html, /recorded/);
}));

test('wrong observations permit retry without revealing answers or unlocking the safe', () => setup(({ game, events }) => {
  game.start();
  game.interact('paper3');
  game.interact('chair');
  observations.forEach(([shape, color], index) => {
    game.submitObservation(index, observations[(index + 1) % 4][0], color);
    assert.equal(events.at(-1).kind, 'portrait');
    assert.equal(events.at(-1).portraitIndex, index);
    assert.match(events.at(-1).html, /try again/);
    assert.doesNotMatch(events.at(-1).html, /triangle|circle|star|square|green|purple|blue|yellow|△|○|☆|□/i);
    game.submitObservation(index, shape, observations[(index + 1) % 4][1]);
  });
  game.submitCode('green purple blue yellow');
  assert.equal(game.state.portraits.size, 0);
  assert.equal(game.state.safe1, false);
  assert.equal(game.state.keys, 0);
}));

test('invalid observation indices and values never record a clue', () => setup(({ game }) => {
  game.start();
  for (const index of [-1, 4, 0.5, '0', null, undefined, NaN, Infinity]) {
    game.submitObservation(index, 'triangle', 'green');
  }
  for (const value of [null, undefined, '', 0, {}, [], 'TRIANGLE', 'GREEN', ' triangle ', ' green ', 'hexagon', 'red']) {
    game.submitObservation(0, value, 'green');
    game.submitObservation(0, 'triangle', value);
  }
  assert.equal(game.state.portraits.size, 0);
}));

test('Safe One requires four distinct correct observations, paper, and legend', () => setup(({ game, events }) => {
  game.start();
  for (let i = 0; i < 4; i += 1) game.submitObservation(0, ...observations[0]);
  game.interact('paper3');
  game.interact('chair');
  game.submitCode('green purple blue yellow');
  assert.equal(game.state.portraits.size, 1);
  assert.equal(game.state.safe1, false);
  for (let i = 1; i < 4; i += 1) game.submitObservation(i, ...observations[i]);
  assert.deepEqual(game.state.portraits, new Set([0, 1, 2, 3]));
  game.interact('safe1');
  assert.equal(events.at(-1).kind, 'code');
  game.submitCode('green purple blue yellow');
  assert.equal(game.state.keys, 1);

  for (const missing of ['paper3', 'chair']) {
    game.reset();
    game.start();
    observations.forEach(([shape, color], index) => game.submitObservation(index, shape, color));
    game.interact(missing === 'paper3' ? 'chair' : 'paper3');
    game.submitCode('green purple blue yellow');
    assert.equal(game.state.safe1, false);
    assert.equal(game.state.keys, 0);
  }
}));

test('expired observations trigger the deadline and never record clues', () => setup(({ game, events, setTime }) => {
  game.start();
  setTime(1_000_000);
  game.submitObservation(0, 'triangle', 'green');
  assert.equal(game.state.status, 'lost');
  assert.equal(game.state.portraits.size, 0);
  assert.equal(events.at(-1).kind, 'loss');
}));

test('missing portrait hints identify details progressively without giving the mapping', () => setup(({ game, events }) => {
  game.start();
  game.interact('paper3');
  game.interact('chair');
  const locations = [/folded cloth.*basket.*lower right/, /brooch.*neckline/, /ornament.*mill door.*right/, /sewn patch.*quilt/];
  for (let index = 0; index < 4; index += 1) {
    game.interact(`portrait${index}`);
    game.hint();
    assert.equal(events.at(-1).kind, 'info');
    assert.match(events.at(-1).html, locations[index]);
    assert.doesNotMatch(events.at(-1).html, /triangle|circle|star|square|green|purple|blue|yellow|△|○|☆|□/i);
    game.submitObservation(index, ...observations[index]);
  }
  game.hint();
  assert.match(events.at(-1).html, /GREEN, PURPLE, BLUE, YELLOW/);
}));


test('desk search and decoy papers never award the useful clue', () => setup(({game,events}) => {
  game.start();
  game.interact('desk');
  assert.equal(events.at(-1).kind,'desk');
  assert.equal(game.state.paper,false);
  for(const id of ['paper0','paper1','paper2','paper4','paper5','paper6']){
    game.interact(id);
    assert.equal(events.at(-1).kind,'paper');
    assert.equal(game.state.paper,false);
    assert.doesNotMatch(events.at(-1).html,/left.to.right|read the pictures/i);
  }
  game.interact('paper3');
  assert.equal(game.state.paper,true);
  assert.equal(events.at(-1).paperIndex,3);
  assert.doesNotMatch(events.at(-1).html,/left.to.right|read the pictures/i);
}));
