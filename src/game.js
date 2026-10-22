import {deskPapers} from './documents.js';
const DURATION = 900;
const SYMBOLS = ['△', '○', '☆', '□'];
const SHAPES = ['triangle', 'circle', 'star', 'square'];
const COLORS = ['green', 'purple', 'blue', 'yellow'];
const PORTRAIT_TITLES = ['Painting I', 'Painting II', 'Painting III', 'Painting IV'];
const PORTRAIT_HINTS = [
  'Look closely at the folded cloth over the basket in the lower right.',
  'Look closely at the reader’s brooch at her neckline.',
  'Look closely at the ornament on the mill door at the right side of the landscape.',
  'Look closely at the sewn patch near the lower center of the quilt.',
];
const CONTEXT = '<p>Literacy, information, and resources are simplified metaphors in this game; they did not guarantee freedom for enslaved people.</p>';

function initialState() {
  return {
    status: 'ready', seconds: DURATION, coins: new Set(), keys: 0,
    paper: false, legend: false, portraits: new Set(), safe1: false,
    safe2: false, startedAt: null,
  };
}

export function createGame({ onChange = () => {}, onEvent = () => {} } = {}) {
  const state = initialState();

  function announce(title, html, kind = 'info', extra = {}) {
    onChange(state);
    onEvent({ ...extra, title, html: html + CONTEXT, kind });
  }

  function start() {
    if (state.status !== 'ready') return;
    state.status = 'playing';
    state.startedAt = Date.now();
    announce('The search begins', '<p>You have fifteen minutes to find two keys and open the door.</p>');
  }

  function reset() {
    Object.assign(state, initialState());
    onChange(state);
  }

  function tick(now = Date.now()) {
    if (state.status !== 'playing') return;
    const remaining = Math.max(0, Math.min(DURATION,
      Math.ceil((state.startedAt + DURATION * 1000 - now) / 1000)));
    if (remaining === state.seconds) return;
    state.seconds = remaining;
    if (remaining === 0) {
      state.status = 'lost';
      announce('Time has run out', '<p>In this fictional scenario, you have been captured and face the threat of sale into slavery. This represents a grave historical danger, not a measure of anyone’s courage or worth.</p>', 'loss');
    } else {
      onChange(state);
    }
  }

  function isPlaying() {
    tick();
    return state.status === 'playing';
  }

  function codePrompt(message = 'Use the marks on the paper and the colors you discovered.') {
    announce('Safe One: enter the code', `<p>${message}</p>`, 'code');
  }

  function interact(id) {
    if (!isPlaying()) return;
    if (/^portrait[0-3]$/.test(id)) {
      const index = Number(id.slice(-1));
      announce(PORTRAIT_TITLES[index], state.portraits.has(index)
        ? '<p>Your observation is recorded in the journal. You can examine the painting again.</p>'
        : '<p>Examine the painting closely, then record the shape and color you observe.</p>',
      'portrait', { portraitIndex: index });
    } else if (id === 'desk') {
      announce('The writing desk', '<p>Loose papers cover the worn wood. Pick up a sheet to examine it.</p>', 'desk');
    } else if (/^paper[0-6]$/.test(id)) {
      const index=Number(id.slice(-1));
      if(index===3)state.paper=true;
      announce(deskPapers[index].title, `<p>${deskPapers[index].description}</p>`, 'paper', {paperIndex:index});
    } else if (id === 'chair') {
      state.legend = true;
      announce('Legend under the chair', '<p>Words are not the only things you can read. Look for familiar shapes among painted scenes and objects. Note each detail’s color, and compare them with the marks on the papers.</p>');
    } else if (/^coin[0-4]$/.test(id)) {
      const collected = state.coins.has(id);
      state.coins.add(id);
      announce(collected ? 'Coin already collected' : 'Coin found', `<p>You have ${state.coins.size}/5 distinct coins.</p>`);
    } else if (id === 'safe1') {
      if (state.safe1) announce('Safe One is open', '<p>You already collected its key.</p>');
      else if (!hasClues()) announce('Safe One is locked', '<p>Find the useful sheet among the desk papers and the folded note under the chair, then examine all four paintings.</p>');
      else codePrompt();
    } else if (id === 'safe2') {
      if (state.safe2) announce('Safe Two is open', '<p>You already collected its key.</p>');
      else if (state.coins.size < 5) announce('Safe Two is locked', `<p>Find five distinct coins. You have ${state.coins.size}/5.</p>`);
      else {
        state.safe2 = true;
        state.keys += 1;
        announce('Safe Two opened', '<p>Your five coins unlock the safe. You collect one key and keep the coins.</p>');
      }
    } else if (id === 'door') {
      if (state.keys !== 2) announce('The door is locked', `<p>The door requires both keys. You have ${state.keys}/2.</p>`);
      else {
        state.status = 'won';
        announce('The door opens', '<p>You have escaped the room in this fictional story.</p>', 'win');
      }
    }
  }

  function hasClues() {
    return state.paper && state.legend && state.portraits.size === 4;
  }

  function submitObservation(index, shape, color) {
    if (!isPlaying()) return;
    if (!Number.isInteger(index) || index < 0 || index >= SHAPES.length) return;
    if (shape === SHAPES[index] && color === COLORS[index]) {
      state.portraits.add(index);
      announce(PORTRAIT_TITLES[index], `<p>Observation recorded in your journal: ${SYMBOLS[index]} (${shape}) = ${color.toUpperCase()}.</p>`);
    } else {
      announce(PORTRAIT_TITLES[index], '<p>That observation does not match the detail in the painting. Look closely and try again.</p>',
        'portrait', { portraitIndex: index });
    }
  }

  function submitCode(input) {
    if (!isPlaying()) return;
    if (state.safe1 || !hasClues()) {
      interact('safe1');
      return;
    }
    const code = typeof input === 'string' ? input.trim().split(/[\s,]+/) : input;
    if (Array.isArray(code) && code.length === 4 &&
        code.every((color, index) => typeof color === 'string' && color.trim().toLowerCase() === COLORS[index])) {
      state.safe1 = true;
      state.keys += 1;
      announce('Safe One opened', '<p>The code works. You collect one key.</p>');
    } else {
      codePrompt('That combination did not work. Recheck the symbols and their order, then try again.');
    }
  }

  function hint() {
    if (!isPlaying()) return;
    if (!state.safe1) {
      if (!state.paper) announce('Hint', '<p>Search the desk papers for a sheet with marks that seem out of place.</p>');
      else if (!state.legend) announce('Hint', '<p>Look under the chair for the symbol legend.</p>');
      else if (state.portraits.size < 4) {
        const index = SHAPES.findIndex((_, index) => !state.portraits.has(index));
        announce('Hint', `<p>${PORTRAIT_TITLES[index]}: ${PORTRAIT_HINTS[index]}</p>`);
      }
      else announce('Hint', '<p>The marks △ ○ ☆ □ correspond to GREEN, PURPLE, BLUE, YELLOW. Enter those colors in Safe One.</p>');
    } else if (!state.safe2) announce('Hint', state.coins.size < 5
      ? `<p>Search for the remaining coins. You have ${state.coins.size}/5 distinct coins.</p>`
      : '<p>Take your five coins to Safe Two to collect the other key.</p>');
    else announce('Hint', '<p>You have both keys. Open the door.</p>');
  }

  return { state, start, reset, tick, interact, submitObservation, submitCode, hint };
}
