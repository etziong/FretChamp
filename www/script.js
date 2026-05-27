
const mainButtons = document.querySelectorAll('.main-btn');
const smallButtons = document.querySelectorAll('.small-btn');
const guitarImg = document.querySelector('.guitar-img');
const header = document.querySelector('header');
const buttonsSection = document.querySelector('.buttons-section');
const buttonsRow = document.querySelector('.buttons-row');
const notesDisplay = document.querySelector(".noteD");
const feedbackEl = document.querySelector('.feedback');
const homeBtn = document.querySelector('.home-btn');
const nextBtn = document.querySelector('.next-btn');

const svgCells = {};
let targetKeys = new Set();

const fretBoundaries = [0, 72, 198, 378, 502, 597, 699, 807, 900, 1000, 1105, 1193, 1286, 1387];

// ── Pixel-exact string X positions per fret row (measured from greed.png) ──
const stringPositions = [
  [222, 274, 327, 386, 446, 502],  // btn1
  [220, 274, 327, 386, 447, 503],  // btn2
  [217, 272, 327, 386, 447, 505],  // btn3
  [215, 270, 326, 386, 448, 507],  // btn4
  [212, 259, 326, 386, 447, 496],  // btn5
  [212, 268, 326, 386, 448, 509],  // btn6
  [210, 267, 326, 386, 449, 510],  // btn7
  [196, 259, 324, 382, 437, 500],  // btn8
  [207, 266, 325, 386, 449, 513],  // btn9
  [205, 264, 325, 386, 450, 514],  // btn10
  [191, 260, 323, 385, 444, 508],  // btn11
  [202, 261, 324, 386, 451, 516],  // btn12
  [200, 260, 324, 386, 451, 517],  // btn13
];

// ── Per-cell fine-tuning: "btn{fret}-string-{string}": { dx, dy } ──
const cellOffsets = {
  "btn1-string-6":  { dx: 3,  dy: 21  }, "btn1-string-5":  { dx: 6,  dy: 21  },
  "btn1-string-4":  { dx: 6,  dy: 21  }, "btn1-string-3":  { dx: 3,  dy: 21  },
  "btn1-string-2":  { dx: 6,  dy: 21  }, "btn1-string-1":  { dx: 3,  dy: 21  },
  "btn2-string-6":  { dx: 5,  dy: 71  }, "btn2-string-5":  { dx: 3,  dy: 71  },
  "btn2-string-4":  { dx: 6,  dy: 71  }, "btn2-string-3":  { dx: 3,  dy: 71  },
  "btn2-string-2":  { dx: 3,  dy: 71  }, "btn2-string-1":  { dx: 3,  dy: 71  },
  "btn3-string-6":  { dx: 3,  dy: 105 }, "btn3-string-5":  { dx: 3,  dy: 105 },
  "btn3-string-4":  { dx: 3,  dy: 105 }, "btn3-string-3":  { dx: 3,  dy: 105 },
  "btn3-string-2":  { dx: 3,  dy: 105 }, "btn3-string-1":  { dx: 3,  dy: 105 },
  "btn4-string-6":  { dx: 5,  dy: 114 }, "btn4-string-5":  { dx: 6,  dy: 114 },
  "btn4-string-4":  { dx: 8,  dy: 114 }, "btn4-string-3":  { dx: 6,  dy: 114 },
  "btn4-string-2":  { dx: 3,  dy: 114 }, "btn4-string-1":  { dx: 3,  dy: 114 },
  "btn5-string-6":  { dx: 3,  dy: 157 }, "btn5-string-5":  { dx: 15, dy: 157 },
  "btn5-string-4":  { dx: 6,  dy: 157 }, "btn5-string-3":  { dx: 6,  dy: 157 },
  "btn5-string-2":  { dx: 9,  dy: 157 }, "btn5-string-1":  { dx: 18, dy: 157 },
  "btn6-string-6":  { dx: 3,  dy: 211 }, "btn6-string-5":  { dx: 3,  dy: 211 },
  "btn6-string-4":  { dx: 6,  dy: 211 }, "btn6-string-3":  { dx: 6,  dy: 211 },
  "btn6-string-2":  { dx: 6,  dy: 211 }, "btn6-string-1":  { dx: 6,  dy: 211 },
  "btn7-string-6":  { dx: 3,  dy: 254 }, "btn7-string-5":  { dx: 3,  dy: 254 },
  "btn7-string-4":  { dx: 3,  dy: 254 }, "btn7-string-3":  { dx: 3,  dy: 254 },
  "btn7-string-2":  { dx: 3,  dy: 254 }, "btn7-string-1":  { dx: 6,  dy: 254 },
  "btn8-string-6":  { dx: 15, dy: 300 }, "btn8-string-5":  { dx: 12, dy: 300 },
  "btn8-string-4":  { dx: 9,  dy: 300 }, "btn8-string-3":  { dx: 12, dy: 300 },
  "btn8-string-2":  { dx: 18, dy: 300 }, "btn8-string-1":  { dx: 18, dy: 300 },
  "btn9-string-6":  { dx: 3,  dy: 343 }, "btn9-string-5":  { dx: 3,  dy: 343 },
  "btn9-string-4":  { dx: 6,  dy: 343 }, "btn9-string-3":  { dx: 6,  dy: 343 },
  "btn9-string-2":  { dx: 6,  dy: 343 }, "btn9-string-1":  { dx: 6,  dy: 343 },
  "btn10-string-6": { dx: 6,  dy: 380 }, "btn10-string-5": { dx: 3,  dy: 380 },
  "btn10-string-4": { dx: 6,  dy: 380 }, "btn10-string-3": { dx: 6,  dy: 380 },
  "btn10-string-2": { dx: 6,  dy: 380 }, "btn10-string-1": { dx: 9,  dy: 380 },
  "btn11-string-6": { dx: 15, dy: 414 }, "btn11-string-5": { dx: 6,  dy: 414 },
  "btn11-string-4": { dx: 6,  dy: 414 }, "btn11-string-3": { dx: 9,  dy: 414 },
  "btn11-string-2": { dx: 12, dy: 414 }, "btn11-string-1": { dx: 15, dy: 414 },
  "btn12-string-6": { dx: 6,  dy: 458 }, "btn12-string-5": { dx: 3,  dy: 458 },
  "btn12-string-4": { dx: 6,  dy: 458 }, "btn12-string-3": { dx: 6,  dy: 458 },
  "btn12-string-2": { dx: 6,  dy: 458 }, "btn12-string-1": { dx: 9,  dy: 458 },
  "btn13-string-6": { dx: 6,  dy: 480 }, "btn13-string-5": { dx: 3,  dy: 480 },
  "btn13-string-4": { dx: 3,  dy: 480 }, "btn13-string-3": { dx: 6,  dy: 480 },
  "btn13-string-2": { dx: 6,  dy: 480 }, "btn13-string-1": { dx: 9,  dy: 480 },
};

// Merge saved calibration from localStorage (user's live adjustments override hardcoded values)
try {
  localStorage.removeItem('guitarCalibOffsets');
  localStorage.removeItem('guitarCalibOffsets_v2');
} catch(e) {}

// ── Set true to see all circles (for calibration), false for production ──
const SHOW_ALL_CIRCLES = false;

let selectedKey = null;
let bassMode = false;
const liveOffsets = {};
const baseCellPositions = {};

const bassOffsets = {
  "btn1-string-6": { dx: 15, dy: 0 },
  "btn1-string-5": { dx: 46, dy: 0 },
  "btn1-string-4": { dx: 81, dy: 0 },
  "btn1-string-3": { dx: 103, dy: 0 },
  "btn2-string-6": { dx: 20, dy: 60 },
  "btn2-string-5": { dx: 46, dy: 60 },
  "btn2-string-4": { dx: 81, dy: 60 },
  "btn2-string-3": { dx: 106, dy: 60 },
  "btn2-string-2": { dx: 0, dy: 60 },
  "btn2-string-1": { dx: 0, dy: 60 },
  "btn3-string-6": { dx: 17, dy: 100 },
  "btn3-string-5": { dx: 48, dy: 100 },
  "btn3-string-4": { dx: 84, dy: 100 },
  "btn3-string-3": { dx: 106, dy: 100 },
  "btn3-string-2": { dx: 0, dy: 100 },
  "btn3-string-1": { dx: 0, dy: 100 },
  "btn4-string-6": { dx: 16, dy: 118 },
  "btn4-string-5": { dx: 47, dy: 118 },
  "btn4-string-4": { dx: 85, dy: 118 },
  "btn4-string-3": { dx: 109, dy: 118 },
  "btn4-string-2": { dx: 0, dy: 118 },
  "btn4-string-1": { dx: 0, dy: 118 },
  "btn5-string-6": { dx: 16, dy: 160 },
  "btn5-string-5": { dx: 58, dy: 160 },
  "btn5-string-4": { dx: 85, dy: 160 },
  "btn5-string-3": { dx: 111, dy: 160 },
  "btn5-string-2": { dx: 0, dy: 160 },
  "btn5-string-1": { dx: 0, dy: 160 },
  "btn6-string-6": { dx: 16, dy: 217 },
  "btn6-string-5": { dx: 49, dy: 217 },
  "btn6-string-4": { dx: 85, dy: 217 },
  "btn6-string-3": { dx: 111, dy: 217 },
  "btn6-string-2": { dx: 0, dy: 217 },
  "btn6-string-1": { dx: 0, dy: 217 },
  "btn7-string-6": { dx: 18, dy: 260 },
  "btn7-string-5": { dx: 50, dy: 260 },
  "btn7-string-4": { dx: 88, dy: 260 },
  "btn7-string-3": { dx: 114, dy: 260 },
  "btn7-string-2": { dx: 0, dy: 260 },
  "btn7-string-1": { dx: 0, dy: 260 },
  "btn8-string-6": { dx: 35, dy: 302 },
  "btn8-string-5": { dx: 58, dy: 302 },
  "btn8-string-4": { dx: 93, dy: 302 },
  "btn8-string-3": { dx: 123, dy: 302 },
  "btn8-string-2": { dx: 0, dy: 302 },
  "btn8-string-1": { dx: 0, dy: 302 },
  "btn9-string-6": { dx: 21, dy: 346 },
  "btn9-string-5": { dx: 51, dy: 346 },
  "btn9-string-4": { dx: 92, dy: 346 },
  "btn9-string-3": { dx: 120, dy: 346 },
  "btn9-string-2": { dx: 0, dy: 346 },
  "btn9-string-1": { dx: 0, dy: 346 },
  "btn10-string-6": { dx: 20, dy: 377 },
  "btn10-string-5": { dx: 53, dy: 377 },
  "btn10-string-4": { dx: 92, dy: 377 },
  "btn10-string-3": { dx: 123, dy: 377 },
  "btn10-string-2": { dx: 0, dy: 377 },
  "btn10-string-1": { dx: 0, dy: 377 },
  "btn11-string-6": { dx: 34, dy: 417 },
  "btn11-string-5": { dx: 57, dy: 417 },
  "btn11-string-4": { dx: 94, dy: 417 },
  "btn11-string-3": { dx: 126, dy: 417 },
  "btn11-string-2": { dx: 0, dy: 417 },
  "btn11-string-1": { dx: 0, dy: 417 },
  "btn12-string-6": { dx: 23, dy: 460 },
  "btn12-string-5": { dx: 56, dy: 460 },
  "btn12-string-4": { dx: 96, dy: 460 },
  "btn12-string-3": { dx: 126, dy: 460 },
  "btn12-string-2": { dx: 0, dy: 460 },
  "btn12-string-1": { dx: 0, dy: 460 },
  "btn13-string-6": { dx: 22, dy: 485 },
  "btn13-string-5": { dx: 54, dy: 485 },
  "btn13-string-4": { dx: 96, dy: 485 },
  "btn13-string-3": { dx: 124, dy: 485 },
  "btn13-string-2": { dx: 0, dy: 485 },
  "btn13-string-1": { dx: 0, dy: 485 },
};

function initSvgGrid() {
  const svg = document.getElementById('fret-svg');
  const NS = 'http://www.w3.org/2000/svg';
  const rippleLayer = document.createElementNS(NS, 'g');
  rippleLayer.id = 'ripple-layer';
  svg.appendChild(rippleLayer);
  for (let fi = 0; fi < 13; fi++) {
    const y0 = fretBoundaries[fi], y1 = fretBoundaries[fi + 1], yCtr = (y0 + y1) / 2;
    for (let si = 0; si < 6; si++) {
      const strNum = 6 - si;
      const off = cellOffsets[`btn${fi + 1}-string-${strNum}`] || { dx: 0, dy: 0 };
      const xCtr = stringPositions[fi][si] + off.dx;
      const yCtr2 = yCtr + off.dy;
      const xStep = si < 5
        ? stringPositions[fi][si + 1] - stringPositions[fi][si]
        : stringPositions[fi][si] - stringPositions[fi][si - 1];
      baseCellPositions[`btn${fi + 1}-string-${strNum}`] = { xBase: stringPositions[fi][si], yCtrBase: yCtr, xStep, rectH: y1 - y0 };
      const key = `btn${fi + 1}-string-${strNum}`;

      const rectH = y1 - y0;
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', xCtr - xStep / 2);
      rect.setAttribute('y', yCtr2 - rectH / 2);
      rect.setAttribute('width', xStep);
      rect.setAttribute('height', rectH);
      rect.setAttribute('fill', 'transparent');
      rect.style.webkitTapHighlightColor = 'transparent';
      if (SHOW_ALL_CIRCLES) { rect.setAttribute('pointer-events', 'none'); }
      else { rect.style.cursor = 'pointer'; }
      rect.dataset.key = key;

      const circle = document.createElementNS(NS, 'circle');
      circle.setAttribute('cx', xCtr); circle.setAttribute('cy', yCtr2);
      circle.setAttribute('r', '30'); circle.setAttribute('fill', SHOW_ALL_CIRCLES ? 'red' : 'darkorange');
      circle.setAttribute('opacity', SHOW_ALL_CIRCLES ? '0.45' : '0');
      if (SHOW_ALL_CIRCLES) {
        circle.setAttribute('stroke', 'white');
        circle.setAttribute('stroke-width', '2');
        circle.setAttribute('pointer-events', 'all');
        circle.style.cursor = 'pointer';
        circle.addEventListener('click', () => selectCell(key));
      } else {
        circle.setAttribute('pointer-events', 'none');
      }

      const text = document.createElementNS(NS, 'text');
      text.setAttribute('x', xCtr); text.setAttribute('y', yCtr2 + 6);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', 'white'); text.setAttribute('font-weight', 'bold');
      text.setAttribute('pointer-events', 'none');
      if (SHOW_ALL_CIRCLES) {
        text.setAttribute('font-size', '18');
        text.setAttribute('opacity', '1');
        text.textContent = String(fi + 1);
      } else {
        text.setAttribute('font-size', '28');
        text.setAttribute('opacity', '0');
        text.textContent = 'X';
      }

      // scale highlight circles
      const scaleNoteCircle = document.createElementNS(NS, 'circle');
      scaleNoteCircle.setAttribute('cx', xCtr); scaleNoteCircle.setAttribute('cy', yCtr2);
      scaleNoteCircle.setAttribute('r', '30'); scaleNoteCircle.setAttribute('fill', 'rgb(130,40,210)');
      scaleNoteCircle.setAttribute('opacity', '0'); scaleNoteCircle.setAttribute('pointer-events', 'none');

      const rootHlCircle = document.createElementNS(NS, 'circle');
      rootHlCircle.setAttribute('cx', xCtr); rootHlCircle.setAttribute('cy', yCtr2);
      rootHlCircle.setAttribute('r', '30'); rootHlCircle.setAttribute('fill', 'rgb(210,40,40)');
      rootHlCircle.setAttribute('opacity', '0'); rootHlCircle.setAttribute('pointer-events', 'none');

      const bluesHlCircle = document.createElementNS(NS, 'circle');
      bluesHlCircle.setAttribute('cx', xCtr); bluesHlCircle.setAttribute('cy', yCtr2);
      bluesHlCircle.setAttribute('r', '30'); bluesHlCircle.setAttribute('fill', 'rgb(15,45,140)');
      bluesHlCircle.setAttribute('opacity', '0'); bluesHlCircle.setAttribute('pointer-events', 'none');

      const rootHlText = document.createElementNS(NS, 'text');
      rootHlText.setAttribute('x', xCtr); rootHlText.setAttribute('y', yCtr2 + 13);
      rootHlText.setAttribute('text-anchor', 'middle'); rootHlText.setAttribute('fill', 'white');
      rootHlText.setAttribute('font-size', '32'); rootHlText.setAttribute('font-weight', 'bold');
      rootHlText.setAttribute('font-family', 'system-ui, sans-serif');
      rootHlText.setAttribute('pointer-events', 'none'); rootHlText.setAttribute('opacity', '0');
      rootHlText.textContent = 'R';

      const bluesHlText = document.createElementNS(NS, 'text');
      bluesHlText.setAttribute('x', xCtr); bluesHlText.setAttribute('y', yCtr2 + 12);
      bluesHlText.setAttribute('text-anchor', 'middle'); bluesHlText.setAttribute('fill', 'white');
      bluesHlText.setAttribute('font-size', '32'); bluesHlText.setAttribute('font-weight', 'bold');
      bluesHlText.setAttribute('font-family', 'system-ui, sans-serif');
      bluesHlText.setAttribute('pointer-events', 'none'); bluesHlText.setAttribute('opacity', '0');
      bluesHlText.textContent = 'B';

      svg.appendChild(scaleNoteCircle); svg.appendChild(rootHlCircle); svg.appendChild(bluesHlCircle);
      svg.appendChild(rootHlText); svg.appendChild(bluesHlText);
      svg.appendChild(rect); svg.appendChild(circle); svg.appendChild(text);
      svgCells[key] = { rect, circle, text, scaleNoteCircle, rootHlCircle, bluesHlCircle, rootHlText, bluesHlText };
      rect.addEventListener('click', handleFretClick);
    }
  }
}

function showWellDone() {
  feedbackEl.textContent = 'WELL DONE!!!';
  feedbackEl.className = 'feedback correct';
  feedbackEl.style.transition = '';
  feedbackEl.style.opacity = '';
  setTimeout(() => {
    if (feedbackEl.textContent === 'WELL DONE!!!') {
      feedbackEl.style.transition = 'opacity 0.4s ease';
      feedbackEl.style.opacity = '0';
      setTimeout(() => {
        if (feedbackEl.textContent === 'WELL DONE!!!') {
          feedbackEl.className = 'feedback';
          feedbackEl.style.transition = '';
          feedbackEl.style.opacity = '';
          feedbackEl.textContent = '';
        }
      }, 400);
    }
  }, 1500);
}

function showTapRipple(key) {
  const cell = svgCells[key];
  if (!cell) return;
  const NS = 'http://www.w3.org/2000/svg';
  const ripple = document.createElementNS(NS, 'circle');
  ripple.setAttribute('cx', cell.circle.getAttribute('cx'));
  ripple.setAttribute('cy', cell.circle.getAttribute('cy'));
  ripple.setAttribute('r', '30');
  ripple.setAttribute('fill', 'rgba(100,180,255,0.25)');
  ripple.setAttribute('pointer-events', 'none');
  document.getElementById('ripple-layer').appendChild(ripple);
  setTimeout(() => ripple.remove(), 300);
}

function handleFretClick(e) {
  if (!document.body.classList.contains('greed-mode')) return;
  const key = e.currentTarget.dataset.key;
  const stringNum = parseInt(key.match(/string-(\d+)/)[1]);
  if (bassMode && stringNum <= 2) return;
  if (lockedStrings.has(stringNum)) return;
  showTapRipple(key);
  playNote(bassMode ? freqFromKey(key) / 2 : freqFromKey(key));
  if (gameMode === 'freeplay') return;
  const btnNote = normalize(neckNotes[key]);
  const isCorrect = gameMode === 'chord'
    ? chordNotes.map(normalize).includes(btnNote)
    : btnNote === normalize(note);
  if (isCorrect) {
    if (!targetKeys.has(key)) return;
    targetKeys.delete(key);
    svgCells[key].circle.setAttribute('opacity', '1');
    if (gameMode === 'chord') {
      const noteName = chordNotes.find(n => normalize(n) === normalize(neckNotes[key]));
      if (noteName && !foundChordNotes.has(noteName)) {
        foundChordNotes.add(noteName);
        instracEl.textContent = 'Find: ' + [...foundChordNotes].join(' ');
      }
      if (foundChordNotes.size === chordNotes.length) {
        score++;
        scoreNumberEl.textContent = score;
        showWellDone();
        playChordTogether(chordNotes);
        setTimeout(playBigSuccess, 1300);
        nextRoundTimeout = setTimeout(nextRound, 2200);
        return;
      }
    }
    if (targetKeys.size === 0 && gameMode !== 'chord') {
      showWellDone();
      playBigSuccess();
      nextRoundTimeout = setTimeout(nextRound, 2200);
    } else if (gameMode !== 'chord') {
      score++;
      scoreNumberEl.textContent = score;
      playSuccess();
      feedbackEl.textContent = 'Good job!';
      feedbackEl.className = 'feedback correct';
      setTimeout(() => {
        if (feedbackEl.textContent === 'Good job!') feedbackEl.className = 'feedback';
      }, 3000);
    }
  } else {
    feedbackEl.textContent = 'Try again';
    feedbackEl.className = 'feedback incorrect';
    setTimeout(() => {
      if (feedbackEl.textContent === 'Try again') {
        feedbackEl.style.transition = 'opacity 0.4s ease';
        feedbackEl.style.opacity = '0';
        setTimeout(() => {
          if (feedbackEl.textContent === 'Try again') {
            feedbackEl.className = 'feedback';
            feedbackEl.style.transition = '';
            feedbackEl.style.opacity = '';
          }
        }, 400);
      }
    }, 1500);
  }
}

homeBtn.addEventListener('click', () => {
  document.body.classList.remove('greed-mode', 'four-chord-mode', 'free-play-mode', 'scales-mode', 'slash-chord-mode');
  scaleSelector.classList.remove('has-open');
  document.querySelectorAll('.scale-group').forEach(g => g.classList.remove('open'));
  clearScaleHighlights();
  score = 0;
  scoreNumberEl.textContent = 0;
});

document.getElementById('bass-btn').addEventListener('click', () => {
  bassMode = !bassMode;
  document.body.classList.toggle('bass-mode', bassMode);
  document.getElementById('bass-btn').classList.toggle('active', bassMode);
  document.getElementById('bass-btn-img').src = bassMode ? 'guitarHead.png' : 'bassHead.png';
  document.getElementById('mode-label').textContent = bassMode ? 'Bass Mode' : 'Guitar Mode';
  if (bassMode) {
    applyOffsets(bassOffsets);
    Object.entries(svgCells).forEach(([key, cell]) => {
      const strNum = parseInt(key.match(/string-(\d+)/)[1]);
      if (strNum <= 2) {
        cell.circle.setAttribute('opacity', '0');
        cell.rect.setAttribute('pointer-events', 'none');
      }
    });
  } else {
    applyOffsets(cellOffsets);
    Object.entries(svgCells).forEach(([key, cell]) => {
      const strNum = parseInt(key.match(/string-(\d+)/)[1]);
      if (strNum <= 2) {
        cell.circle.setAttribute('opacity', '0');
        cell.rect.setAttribute('pointer-events', 'all');
      }
    });
  }
});

nextBtn.addEventListener('click', () => {
  nextRound();
});

const extBtn = document.querySelector('.ext-btn');
extBtn.addEventListener('click', () => {
  extBtn.classList.toggle('active');
  if (extBtn.classList.contains('active')) {
    extBtn.textContent = 'Tensions';
    headLineEl.innerHTML = 'EXTENDED<br>CHORDS';
  } else {
    extBtn.textContent = 'Add tensions';
    headLineEl.innerHTML = chordMode === 'sevenths' ? 'FOUR NOTED<br>CHORDS' : 'TREE NOTES<br>CHORDS';
    no5thNote.style.display = 'none';
  }
});
const headLineEl = document.querySelector('.headLine');
const rootDisplayEl = document.querySelector('.rootDisplay');
const no5thNote = document.querySelector('.no5th-note');
const noteNameDisplay = document.querySelector('.noteNameDisplay');
const scoreNumberEl = document.querySelector('.score-number');
const instracEl = document.querySelector('.Instrac');
const muteBtn = document.querySelector('.mute-btn');
let score = 0;
let isMuted = false;
const lockedStrings = new Set();

muteBtn.addEventListener('click', () => {
  isMuted = !isMuted;
  if (isMuted) {
    audioCtx.suspend();
    muteBtn.classList.add('muted');
  } else {
    audioCtx.resume();
    muteBtn.classList.remove('muted');
  }
});
const audioCtx = new AudioContext();

function playSuccess() {
  const ctx = audioCtx;
  [523.25, 659.25, 783.99].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + i * 0.12);
    osc.stop(ctx.currentTime + i * 0.12 + 0.2);
  });
}

function playChordTogether(notes) {
  notes.forEach(name => {
    const freq = noteFrequencies[normalize(name)];
    if (!freq) return;
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq * 2;
    filter.Q.value = 1.5;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.2);
  });
}

function playBigSuccess() {
  const ctx = audioCtx;
  const melody = [
    { freq: 392.00, t: 0.0,  dur: 0.15 },
    { freq: 523.25, t: 0.15, dur: 0.15 },
    { freq: 659.25, t: 0.3,  dur: 0.15 },
    { freq: 783.99, t: 0.45, dur: 0.15 },
    { freq: 880.00, t: 0.6,  dur: 0.15 },
    { freq: 1046.5, t: 0.75, dur: 0.5  },
  ];
  const chord = [523.25, 659.25, 783.99, 1046.5];

  melody.forEach(({ freq, t, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.35, ctx.currentTime + t);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + t);
    osc.stop(ctx.currentTime + t + dur);
  });

  chord.forEach(freq => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.2, ctx.currentTime + 1.3);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + 1.3);
    osc.stop(ctx.currentTime + 2.2);
  });

}


mainButtons.forEach((btn, index) => {
  btn.addEventListener('click', () => {
    document.body.classList.add('greed-mode');
    document.body.classList.remove('slash-chord-mode', 'scales-mode', 'free-play-mode', 'four-chord-mode');
    feedbackEl.className = 'feedback';
    feedbackEl.textContent = '';
    no5thNote.style.display = 'none';
    if (index === 1) {
      gameMode = 'chord';
      chordMode = 'triads';
      startChordRound();
    } else if (index === 2) {
      gameMode = 'chord';
      chordMode = 'sevenths';
      document.body.classList.add('four-chord-mode');
      startFourChordRound();
    } else if (index === 3) {
      gameMode = 'freeplay';
      document.body.classList.add('free-play-mode', 'scales-mode');
      lockedStrings.clear();
      document.querySelectorAll('.str-btn').forEach(b => b.classList.remove('locked'));
      headLineEl.textContent = 'SCALES';
      instracEl.innerHTML = 'Choose scale<br>to practice';
      notesDisplay.innerHTML = '';
      targetKeys.clear();
      Object.values(svgCells).forEach(cell => {
        cell.circle.setAttribute('opacity', '0');
        cell.text.setAttribute('opacity', '0');
      });
    } else if (index === 4) {
      gameMode = 'chord';
      chordMode = 'slash';
      document.body.classList.add('slash-chord-mode');
      startSlashChordRound();
    } else {
      gameMode = 'single';
      headLineEl.innerHTML = 'SINGLE NOTES';
      instracEl.innerHTML = 'Find (all)<br>Displayed notes';
      note = randomNote();
      notesDisplay.innerHTML = formatNoteName(note);
      highlightNotes(note);
    }
  });
});


document.querySelectorAll('.str-btn').forEach(strBtn => {
  strBtn.addEventListener('click', () => {
    const stringNum = parseInt(strBtn.dataset.string);
    if (lockedStrings.has(stringNum)) {
      lockedStrings.delete(stringNum);
      strBtn.classList.remove('locked');
    } else {
      lockedStrings.add(stringNum);
      strBtn.classList.add('locked');
    }
    if (gameMode === 'chord') {
      highlightChordNotes(chordNotes);
    } else {
      highlightNotes(note);
    }

  });
});

const scaleSelector = document.querySelector('.scale-selector');
const scaleBackBtn = document.querySelector('.scale-back-btn');

scaleBackBtn.addEventListener('click', () => {
  document.querySelectorAll('.scale-group').forEach(g => g.classList.remove('open'));
  scaleSelector.classList.remove('has-open');
});

document.querySelectorAll('.scale-category-btn').forEach(catBtn => {
  catBtn.addEventListener('click', () => {
    const group = catBtn.closest('.scale-group');
    const isOpen = group.classList.contains('open');
    document.querySelectorAll('.scale-group').forEach(g => g.classList.remove('open'));
    if (!isOpen) {
      group.classList.add('open');
      scaleSelector.classList.add('has-open');
    } else {
      scaleSelector.classList.remove('has-open');
    }
  });
});

document.querySelector('.scale-selector').addEventListener('click', e => {
  const btn = e.target.closest('.scale-btn');
  if (!btn || btn.disabled) return;
  document.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyScaleHighlights(btn.dataset.scale);
});


const scaleData = {"Arp Major 3n":{"notes":["btn8-string-6","btn6-string-5","btn10-string-4","btn8-string-3","btn11-string-1","btn8-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Arp Major 4n":{"notes":["btn3-string-6","btn8-string-6","btn6-string-5","btn10-string-4","btn8-string-3","btn8-string-2","btn5-string-4","btn8-string-1","btn11-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Arp Minor 3n":{"notes":["btn7-string-6","btn6-string-5","btn9-string-4","btn8-string-3","btn5-string-1","btn9-string-1"],"roots":["btn4-string-6","btn6-string-4","btn7-string-2"],"blues":[]},"Arp Minor 4n":{"notes":["btn2-string-6","btn7-string-6","btn6-string-5","btn4-string-4","btn9-string-4","btn8-string-3","btn7-string-2","btn7-string-1","btn11-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"AO Major":{"notes":["btn6-string-6","btn8-string-6","btn4-string-5","btn6-string-5","btn8-string-5","btn5-string-4","btn8-string-4","btn10-string-4","btn6-string-3","btn8-string-3","btn10-string-3","btn11-string-2","btn13-string-2","btn8-string-2","btn9-string-1","btn11-string-1","btn13-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"AO Minor":{"notes":["btn6-string-6","btn7-string-6","btn4-string-5","btn6-string-5","btn7-string-5","btn4-string-4","btn8-string-4","btn9-string-4","btn6-string-3","btn8-string-3","btn9-string-3","btn7-string-2","btn11-string-2","btn12-string-2","btn9-string-1","btn11-string-1","btn12-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"AO Major Blues":{"notes":["btn6-string-6","btn3-string-5","btn6-string-5","btn3-string-4","btn8-string-4","btn5-string-3","btn8-string-3","btn6-string-2","btn11-string-2","btn8-string-1","btn11-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":["btn7-string-6","btn9-string-4","btn12-string-2"]},"AO Minor Blues":{"notes":["btn7-string-6","btn4-string-5","btn6-string-5","btn4-string-4","btn9-string-4","btn6-string-3","btn8-string-3","btn7-string-2","btn12-string-2","btn9-string-1","btn11-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":["btn5-string-5","btn7-string-3","btn10-string-1"]},"Ionian":{"notes":["btn4-string-5","btn6-string-6","btn6-string-5","btn8-string-6","btn8-string-5","btn5-string-4","btn5-string-3","btn6-string-3","btn8-string-4","btn8-string-3","btn6-string-2","btn6-string-1","btn8-string-2","btn8-string-1","btn9-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Dorian":{"notes":["btn6-string-6","btn7-string-6","btn4-string-5","btn6-string-5","btn8-string-5","btn4-string-4","btn8-string-4","btn4-string-3","btn6-string-3","btn8-string-3","btn6-string-2","btn7-string-2","btn6-string-1","btn7-string-1","btn9-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Phrygian":{"notes":["btn5-string-6","btn7-string-6","btn4-string-5","btn7-string-5","btn4-string-4","btn6-string-4","btn7-string-4","btn4-string-3","btn6-string-3","btn8-string-3","btn5-string-2","btn5-string-1","btn7-string-2","btn7-string-1","btn9-string-1"],"roots":["btn4-string-6","btn6-string-5","btn9-string-2"],"blues":[]},"Lydian":{"notes":["btn6-string-6","btn8-string-6","btn5-string-5","btn8-string-5","btn5-string-4","btn8-string-4","btn5-string-3","btn7-string-3","btn8-string-3","btn6-string-2","btn8-string-2","btn6-string-1","btn8-string-1","btn10-string-1","btn6-string-5"],"roots":["btn4-string-6","btn9-string-2","btn6-string-4"],"blues":[]},"Mixolydian":{"notes":["btn4-string-5","btn4-string-4","btn6-string-6","btn6-string-5","btn8-string-6","btn8-string-5","btn8-string-4","btn5-string-3","btn6-string-3","btn8-string-3","btn6-string-2","btn6-string-1","btn9-string-1","btn7-string-2","btn8-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Aeolian":{"notes":["btn6-string-6","btn7-string-6","btn4-string-5","btn6-string-5","btn7-string-5","btn4-string-4","btn4-string-3","btn6-string-3","btn8-string-4","btn8-string-3","btn5-string-2","btn7-string-2","btn6-string-1","btn7-string-1","btn9-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Locrian":{"notes":["btn5-string-6","btn7-string-6","btn4-string-5","btn5-string-5","btn7-string-5","btn4-string-4","btn7-string-4","btn4-string-3","btn6-string-3","btn7-string-3","btn5-string-2","btn5-string-1","btn7-string-2","btn7-string-1","btn9-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Minor Blues 1":{"notes":["btn7-string-6","btn4-string-5","btn4-string-4","btn4-string-3","btn4-string-2","btn6-string-5","btn6-string-3","btn7-string-2","btn7-string-1"],"roots":["btn4-string-6","btn6-string-4","btn4-string-1"],"blues":["btn5-string-5","btn7-string-3"]},"Minor Blues 2":{"notes":["btn6-string-6","btn3-string-5","btn6-string-5","btn3-string-4","btn3-string-3","btn5-string-3","btn4-string-2","btn6-string-2","btn6-string-1"],"roots":["btn4-string-6","btn6-string-4","btn4-string-1"],"blues":["btn7-string-6","btn7-string-1","btn4-string-3"]},"Minor Blues 3":{"notes":["btn6-string-6","btn4-string-5","btn6-string-5","btn4-string-4","btn3-string-3","btn6-string-3","btn4-string-2","btn7-string-2","btn6-string-1"],"roots":["btn4-string-6","btn4-string-1","btn6-string-4"],"blues":["btn7-string-5","btn5-string-1"]},"Minor Blues 4":{"notes":["btn7-string-6","btn4-string-5","btn7-string-5","btn4-string-4","btn4-string-3","btn6-string-3","btn5-string-2","btn7-string-2","btn7-string-1"],"roots":["btn4-string-6","btn6-string-4","btn4-string-1"],"blues":["btn5-string-4","btn8-string-2"]},"Minor Blues 5":{"notes":["btn6-string-6","btn4-string-5","btn6-string-5","btn3-string-4","btn3-string-3","btn6-string-3","btn4-string-2","btn6-string-2","btn6-string-1"],"roots":["btn4-string-6","btn6-string-4","btn4-string-1"],"blues":["btn7-string-5","btn5-string-2"]},"Diminished":{"notes":["btn6-string-6","btn7-string-6","btn4-string-5","btn5-string-5","btn7-string-5","btn3-string-4","btn5-string-4","btn3-string-3","btn4-string-3","btn6-string-3","btn3-string-2","btn5-string-2","btn6-string-2","btn3-string-1","btn6-string-1"],"roots":["btn4-string-6","btn6-string-4","btn4-string-1"],"blues":[]},"Dim b9":{"notes":["btn5-string-6","btn7-string-6","btn8-string-6","btn5-string-5","btn6-string-5","btn8-string-5","btn4-string-4","btn7-string-4","btn4-string-3","btn5-string-3","btn7-string-3","btn4-string-2","btn6-string-2","btn7-string-2","btn5-string-1","btn7-string-1"],"roots":["btn4-string-6","btn6-string-4","btn4-string-1"],"blues":[]},"Whole Tone":{"notes":["btn6-string-6","btn8-string-6","btn5-string-5","btn7-string-5","btn5-string-2","btn7-string-2","btn6-string-1","btn8-string-1","btn4-string-4","btn8-string-4","btn5-string-3","btn7-string-3"],"roots":["btn4-string-6","btn6-string-4","btn4-string-1"],"blues":[]},"Melodic Minor":{"notes":["btn6-string-6","btn7-string-6","btn4-string-5","btn6-string-5","btn8-string-5","btn8-string-4","btn5-string-4","btn4-string-3","btn6-string-3","btn8-string-3","btn5-string-2","btn7-string-2","btn5-string-1","btn6-string-1","btn8-string-1"],"roots":["btn4-string-6","btn6-string-4","btn8-string-2"],"blues":[]},"Dorian ♭2":{"notes":["btn5-string-6","btn7-string-6","btn4-string-5","btn6-string-5","btn8-string-5","btn4-string-4","btn7-string-4","btn4-string-3","btn6-string-3","btn8-string-3","btn6-string-2","btn7-string-2","btn5-string-1","btn7-string-1","btn9-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Lydian Aug":{"notes":["btn6-string-6","btn8-string-6","btn5-string-5","btn8-string-4","btn5-string-3","btn7-string-3","btn6-string-2","btn6-string-1","btn8-string-1","btn10-string-1","btn8-string-5","btn5-string-4","btn8-string-2","btn7-string-5","btn9-string-3"],"roots":["btn4-string-6","btn9-string-2","btn6-string-4"],"blues":[]},"Lydian Dom":{"notes":["btn6-string-6","btn8-string-6","btn5-string-5","btn8-string-5","btn4-string-4","btn6-string-4","btn8-string-4","btn5-string-3","btn7-string-3","btn8-string-3","btn6-string-2","btn7-string-2","btn6-string-1","btn8-string-1","btn10-string-1"],"roots":["btn4-string-6","btn6-string-5","btn9-string-2"],"blues":[]},"Altered Scale":{"notes":["btn5-string-6","btn7-string-6","btn3-string-5","btn5-string-5","btn7-string-5","btn4-string-4","btn7-string-4","btn4-string-3","btn5-string-3","btn7-string-3","btn5-string-2","btn7-string-2","btn5-string-1","btn6-string-1","btn8-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Locrian ♮2":{"notes":["btn7-string-6","btn6-string-6","btn4-string-5","btn5-string-5","btn7-string-5","btn4-string-4","btn8-string-4","btn4-string-3","btn6-string-3","btn7-string-3","btn5-string-2","btn7-string-2","btn6-string-1","btn7-string-1","btn9-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Mixolydian ♭6":{"notes":["btn4-string-5","btn6-string-6","btn8-string-6","btn7-string-5","btn4-string-4","btn8-string-4","btn5-string-3","btn6-string-3","btn8-string-3","btn5-string-2","btn7-string-2","btn6-string-1","btn8-string-1","btn9-string-1","btn5-string-5"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Aeolian ♯7":{"notes":["btn6-string-6","btn7-string-6","btn4-string-5","btn6-string-5","btn7-string-5","btn8-string-4","btn4-string-3","btn6-string-3","btn8-string-3","btn5-string-2","btn6-string-1","btn7-string-1","btn9-string-1","btn5-string-4","btn8-string-2"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Locrian ♮6":{"notes":["btn5-string-6","btn7-string-6","btn4-string-5","btn5-string-5","btn4-string-4","btn7-string-4","btn4-string-3","btn6-string-3","btn7-string-3","btn5-string-2","btn5-string-1","btn7-string-1","btn9-string-1","btn8-string-5","btn8-string-2"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Dorian ♯4":{"notes":["btn6-string-6","btn7-string-6","btn6-string-5","btn8-string-5","btn4-string-4","btn4-string-3","btn6-string-2","btn6-string-1","btn7-string-2","btn8-string-4","btn5-string-5","btn7-string-3","btn10-string-1","btn8-string-3","btn7-string-1"],"roots":["btn4-string-6","btn9-string-2","btn6-string-4"],"blues":[]},"Phrygian ♮3":{"notes":["btn5-string-6","btn4-string-5","btn7-string-5","btn4-string-4","btn7-string-4","btn6-string-5","btn6-string-3","btn8-string-3","btn5-string-2","btn5-string-1","btn7-string-2","btn9-string-1","btn8-string-6","btn5-string-3","btn8-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]}};

function repositionCell(key, dx, dy) {
  const base = baseCellPositions[key];
  if (!base) return;
  const { xBase, yCtrBase, xStep, rectH } = base;
  const xCtr = xBase + dx;
  const yCtr2 = yCtrBase + dy;
  const cell = svgCells[key];
  if (!cell) return;
  cell.circle.setAttribute('cx', xCtr);
  cell.circle.setAttribute('cy', yCtr2);
  cell.rect.setAttribute('x', xCtr - xStep / 2);
  cell.rect.setAttribute('y', yCtr2 - rectH / 2);
  cell.text.setAttribute('x', xCtr);
  cell.text.setAttribute('y', yCtr2 + 6);
  [cell.scaleNoteCircle, cell.rootHlCircle, cell.bluesHlCircle].forEach(el => {
    if (el) { el.setAttribute('cx', xCtr); el.setAttribute('cy', yCtr2); }
  });
  [cell.rootHlText, cell.bluesHlText].forEach(el => {
    if (el) { el.setAttribute('x', xCtr); el.setAttribute('y', yCtr2 + 13); }
  });
}

function applyOffsets(offsets) {
  for (let fi = 0; fi < 13; fi++) {
    for (let si = 0; si < 6; si++) {
      const strNum = 6 - si;
      const key = `btn${fi + 1}-string-${strNum}`;
      const off = offsets[key] || { dx: 0, dy: 0 };
      repositionCell(key, off.dx, off.dy);
    }
  }
}

function applyScaleHighlights(scaleName) {
  clearScaleHighlights();
  const d = scaleData[scaleName];
  if (!d) return;
  const skipKey = k => bassMode && parseInt(k.match(/string-(\d+)/)[1]) <= 2;
  (d.notes || []).forEach(k => { if (svgCells[k] && !skipKey(k)) svgCells[k].scaleNoteCircle.setAttribute('opacity','1'); });
  (d.roots || []).forEach(k => {
    if (svgCells[k] && !skipKey(k)) {
      svgCells[k].rootHlCircle.setAttribute('opacity','1');
      svgCells[k].rootHlText.setAttribute('opacity','1');
    }
  });
  (d.blues || []).forEach(k => {
    if (svgCells[k] && !skipKey(k)) {
      svgCells[k].bluesHlCircle.setAttribute('opacity','1');
      svgCells[k].bluesHlText.setAttribute('opacity','1');
    }
  });
}

function clearScaleHighlights() {
  Object.values(svgCells).forEach(({ scaleNoteCircle, rootHlCircle, bluesHlCircle, rootHlText, bluesHlText }) => {
    if (scaleNoteCircle) scaleNoteCircle.setAttribute('opacity','0');
    if (rootHlCircle)    rootHlCircle.setAttribute('opacity','0');
    if (bluesHlCircle)   bluesHlCircle.setAttribute('opacity','0');
    if (rootHlText)      rootHlText.setAttribute('opacity','0');
    if (bluesHlText)     bluesHlText.setAttribute('opacity','0');
  });
}

const neckNotes = {
  "btn1-string-1":"E",  "btn1-string-2":"B",  "btn1-string-3":"G",  "btn1-string-4":"D",  "btn1-string-5":"A",  "btn1-string-6":"E",
  "btn2-string-1":"F",  "btn2-string-2":"C",  "btn2-string-3":"G#", "btn2-string-4":"D#", "btn2-string-5":"A#", "btn2-string-6":"F",
  "btn3-string-1":"F#", "btn3-string-2":"C#", "btn3-string-3":"A",  "btn3-string-4":"E",  "btn3-string-5":"B",  "btn3-string-6":"F#",
  "btn4-string-1":"G",  "btn4-string-2":"D",  "btn4-string-3":"A#", "btn4-string-4":"F",  "btn4-string-5":"C",  "btn4-string-6":"G",
  "btn5-string-1":"G#", "btn5-string-2":"D#", "btn5-string-3":"B",  "btn5-string-4":"F#", "btn5-string-5":"C#", "btn5-string-6":"G#",
  "btn6-string-1":"A",  "btn6-string-2":"E",  "btn6-string-3":"C",  "btn6-string-4":"G",  "btn6-string-5":"D",  "btn6-string-6":"A",
  "btn7-string-1":"A#", "btn7-string-2":"F",  "btn7-string-3":"C#", "btn7-string-4":"G#", "btn7-string-5":"D#", "btn7-string-6":"A#",
  "btn8-string-1":"B",  "btn8-string-2":"F#", "btn8-string-3":"D",  "btn8-string-4":"A",  "btn8-string-5":"E",  "btn8-string-6":"B",
  "btn9-string-1":"C",  "btn9-string-2":"G",  "btn9-string-3":"D#", "btn9-string-4":"A#", "btn9-string-5":"F",  "btn9-string-6":"C",
  "btn10-string-1":"C#","btn10-string-2":"G#","btn10-string-3":"E", "btn10-string-4":"B", "btn10-string-5":"F#","btn10-string-6":"C#",
  "btn11-string-1":"D", "btn11-string-2":"A", "btn11-string-3":"F", "btn11-string-4":"C", "btn11-string-5":"G", "btn11-string-6":"D",
  "btn12-string-1":"D#","btn12-string-2":"A#","btn12-string-3":"F#","btn12-string-4":"C#","btn12-string-5":"G#","btn12-string-6":"D#",
  "btn13-string-1":"E", "btn13-string-2":"B", "btn13-string-3":"G",  "btn13-string-4":"D",  "btn13-string-5":"A",  "btn13-string-6":"E",
}

const enharmonic = { "Ab":"G#", "Bb":"A#", "Cb":"B", "Db":"C#", "Eb":"D#", "Fb":"E", "Gb":"F#", "B#":"C", "E#":"F" };
const normalize = n => enharmonic[n] || n;

const noteFrequencies = {
  "E":329.63, "F":349.23, "F#":369.99, "G":392.00,
  "G#":415.30, "A":440.00, "A#":466.16, "B":493.88,
  "C":261.63, "C#":277.18, "D":293.66, "D#":311.13
};

const openStrings = { 1:329.63, 2:246.94, 3:196.00, 4:146.83, 5:110.00, 6:82.41 };

function formatNoteName(name) {
  if (name.includes('/')) {
    const slashIdx = name.indexOf('/');
    const chord = name.slice(0, slashIdx);
    const bass = name.slice(slashIdx + 1);
    const chordMatch = chord.match(/^([A-G])(.*)$/);
    const chordFormatted = chordMatch && chordMatch[2]
      ? `${chordMatch[1]}<span class="note-suffix">${chordMatch[2]}</span>`
      : (chordMatch ? chordMatch[1] : chord);
    const bassMatch = bass.match(/^([A-G])(.*)$/);
    const bassFormatted = bassMatch && bassMatch[2]
      ? `<span class="slash-bass">${bassMatch[1]}</span><span class="note-suffix">${bassMatch[2]}</span>`
      : `<span class="slash-bass">${bass}</span>`;
    return `${chordFormatted}<span class="slash-sep">/</span>${bassFormatted}`;
  }
  const match = name.match(/^([A-G])(.+)$/);
  if (!match) return name;
  return `${match[1]}<span class="note-suffix">${match[2]}</span>`;
}

function freqFromKey(key) {
  const fret = parseInt(key.match(/btn(\d+)/)[1]) - 1;
  const string = parseInt(key.match(/string-(\d+)/)[1]);
  return openStrings[string] * Math.pow(2, fret / 12);
}

function playNote(freq) {
  if (!freq) return;
  const ctx = audioCtx;

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = freq;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq * 2;
  filter.Q.value = 1.5;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.8, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 1.5);
}

const majorTriads = {
  "C":["C","E","G"], "D":["D","F#","A"], "E":["E","G#","B"],
  "F":["F","A","C"], "G":["G","B","D"],  "A":["A","C#","E"], "B":["B","D#","F#"]
};

const minorTriads = {
  "Am":["A","C","E"], "Bm":["B","D","F#"], "Cm":["C","D#","G"],
  "Dm":["D","F","A"], "Em":["E","G","B"],  "Fm":["F","G#","C"], "Gm":["G","A#","D"]
};

const diminishedTriads = {
  "Cdim":["C","Eb","Gb"], "Ddim":["D","F","Ab"],  "Edim":["E","G","Bb"],
  "Fdim":["F","Ab","Cb"], "Gdim":["G","Bb","Db"], "Adim":["A","C","Eb"], "Bdim":["B","D","F"]
};

const augmentedTriads = {
  "Caug":["C","E","G#"],
  "Daug":["D","F#","A#"],
  "Eaug":["E","G#","C"],
  "Faug":["F","A","C#"],
  "Gaug":["G","B","D#"],
  "Aaug":["A","C#","F"],
  "Baug":["B","D#","G"]
};

const sus2Chords = {
  "Csus2":["C","D","G"],  "Dsus2":["D","E","A"],   "Esus2":["E","F#","B"],
  "Fsus2":["F","G","C"],  "Gsus2":["G","A","D"],   "Asus2":["A","B","E"],  "Bsus2":["B","C#","F#"]
};

const sus4Chords = {
  "Csus4":["C","F","G"],  "Dsus4":["D","G","A"],   "Esus4":["E","A","B"],
  "Fsus4":["F","Bb","C"], "Gsus4":["G","C","D"],   "Asus4":["A","D","E"],  "Bsus4":["B","E","F#"]
};

const allTriads = { ...majorTriads, ...minorTriads, ...diminishedTriads, ...augmentedTriads, ...sus2Chords, ...sus4Chords };

const dominant7 = {
  "C7":["C","E","G","Bb"], "D7":["D","F#","A","C"], "E7":["E","G#","B","D"],
  "F7":["F","A","C","Eb"], "G7":["G","B","D","F"],  "A7":["A","C#","E","G"], "B7":["B","D#","F#","A"]
};

const minor7 = {
  "Cm7":["C","Eb","G","Bb"], "Dm7":["D","F","A","C"],  "Em7":["E","G","B","D"],
  "Fm7":["F","Ab","C","Eb"], "Gm7":["G","Bb","D","F"],  "Am7":["A","C","E","G"], "Bm7":["B","D","F#","A"]
};

const major7 = {
  "Cmaj7":["C","E","G","B"],   "Dmaj7":["D","F#","A","C#"], "Emaj7":["E","G#","B","D#"],
  "Fmaj7":["F","A","C","E"],   "Gmaj7":["G","B","D","F#"],  "Amaj7":["A","C#","E","G#"], "Bmaj7":["B","D#","F#","A#"]
};

const halfDim7 = {
  "Cm7b5":["C","Eb","Gb","Bb"], "Dm7b5":["D","F","Ab","C"],  "Em7b5":["E","G","Bb","D"],
  "Fm7b5":["F","Ab","Cb","Eb"], "Gm7b5":["G","Bb","Db","F"],  "Am7b5":["A","C","Eb","G"], "Bm7b5":["B","D","F","A"]
};

const allSeventhChords = { ...dominant7, ...minor7, ...major7, ...halfDim7 };

const tensionChords = {
  "CminM7":["C","Eb","G","B"],    "DminM7":["D","F","A","C#"],   "EminM7":["E","G","B","D#"],
  "FminM7":["F","Ab","C","E"],    "GminM7":["G","Bb","D","F#"],  "AminM7":["A","C","E","G#"],  "BminM7":["B","D","F#","A#"],

  "Cmaj9":["C","E","B","D"],  "Dmaj9":["D","F#","C#","E"], "Emaj9":["E","G#","D#","F#"],
  "Fmaj9":["F","A","E","G"],  "Gmaj9":["G","B","F#","A"],  "Amaj9":["A","C#","G#","B"], "Bmaj9":["B","D#","A#","C#"],

  "Cm6":["C","Eb","G","A"],  "Dm6":["D","F","A","B"],   "Em6":["E","G","B","C#"],
  "Fm6":["F","Ab","C","D"],  "Gm6":["G","Bb","D","E"],  "Am6":["A","C","E","F#"],  "Bm6":["B","D","F#","G#"],

  "C6":["C","E","G","A"],  "D6":["D","F#","A","B"],   "E6":["E","G#","B","C#"],
  "F6":["F","A","C","D"],  "G6":["G","B","D","E"],    "A6":["A","C#","E","F#"],  "B6":["B","D#","F#","G#"],

  "C7b9":["C","E","Bb","Db"], "D7b9":["D","F#","C","Eb"], "E7b9":["E","G#","D","F"],
  "F7b9":["F","A","Eb","Gb"], "G7b9":["G","B","F","Ab"],  "A7b9":["A","C#","G","Bb"], "B7b9":["B","D#","A","C"],

  "C7#9":["C","E","Bb","D#"], "D7#9":["D","F#","C","F"],  "E7#9":["E","G#","D","G"],
  "F7#9":["F","A","Eb","G#"], "G7#9":["G","B","F","A#"],  "A7#9":["A","C#","G","C"], "B7#9":["B","D#","A","D"],

  "C#11":["C","E","Bb","F#"], "D#11":["D","F#","C","G#"], "E#11":["E","G#","D","A#"],
  "F#11":["F","A","Eb","B"],  "G#11":["G","B","F","C#"],  "A#11":["A","C#","G","D#"], "B#11":["B","D#","A","F"],

  "Cdim7":["C","Eb","Gb","A"],  "Ddim7":["D","F","Ab","B"],   "Edim7":["E","G","Bb","C#"],
  "Fdim7":["F","Ab","B","D"],   "Gdim7":["G","Bb","Db","E"],  "Adim7":["A","C","Eb","F#"], "Bdim7":["B","D","F","Ab"],

  "Caug7":["C","E","G#","Bb"],  "Daug7":["D","F#","A#","C"],  "Eaug7":["E","G#","C","D"],
  "Faug7":["F","A","C#","Eb"], "Gaug7":["G","B","D#","F"],   "Aaug7":["A","C#","F","G"],  "Baug7":["B","D#","G","A"],

  "C13":["C","E","Bb","A"], "D13":["D","F#","C","B"], "E13":["E","G#","D","C#"],
  "F13":["F","A","Eb","D"], "G13":["G","B","F","E"],  "A13":["A","C#","G","F#"], "B13":["B","D#","A","G#"],

  "Cb13":["C","E","Bb","Ab"], "Db13":["D","F#","C","Bb"], "Eb13":["E","G#","D","C"],
  "Fb13":["F","A","Eb","Db"], "Gb13":["G","B","F","Eb"],  "Ab13":["A","C#","G","F"], "Bb13":["B","D#","A","G"],

  "Cm9":["C","Eb","Bb","D"], "Dm9":["D","F","C","E"], "Em9":["E","G","D","F#"],
  "Fm9":["F","Ab","Eb","G"], "Gm9":["G","Bb","F","A"], "Am9":["A","C","G","B"], "Bm9":["B","D","A","C#"],

  "C11":["C","E","Bb","F"], "D11":["D","F#","C","G"], "E11":["E","G#","D","A"],
  "F11":["F","A","Eb","Bb"], "G11":["G","B","F","C"], "A11":["A","C#","G","D"], "B11":["B","D#","A","E"],

  "C7sus4":["C","F","G","Bb"], "D7sus4":["D","G","A","C"], "E7sus4":["E","A","B","D"],
  "F7sus4":["F","Bb","C","Eb"], "G7sus4":["G","C","D","F"], "A7sus4":["A","D","E","G"], "B7sus4":["B","E","F#","A"],

  "C7sus2":["C","D","G","Bb"], "D7sus2":["D","E","A","C"], "E7sus2":["E","F#","B","D"],
  "F7sus2":["F","G","C","Eb"], "G7sus2":["G","A","D","F"], "A7sus2":["A","B","E","G"], "B7sus2":["B","C#","F#","A"],

  "C7b5":["C","E","Gb","Bb"],  "D7b5":["D","F#","Ab","C"], "E7b5":["E","G#","Bb","D"],
  "F7b5":["F","A","B","Eb"],   "G7b5":["G","B","Db","F"],  "A7b5":["A","C#","Eb","G"], "B7b5":["B","D#","F","A"],
};

const slashChords = {
  // UST bVII/I (Bb/C type)
  "Bb/C":["C","Bb","D","F"],  "C/D":["D","C","E","G"],   "D/E":["E","D","F#","A"],
  "Eb/F":["F","Eb","G","Bb"], "F/G":["G","F","A","C"],   "G/A":["A","G","B","D"],  "A/B":["B","A","C#","E"],

  // UST II/I (D/C type)
  "D/C":["C","D","F#","A"],   "E/D":["D","E","G#","B"],  "F#/E":["E","F#","A#","C#"],
  "G/F":["F","G","B","D"],    "A/G":["G","A","C#","E"],  "B/A":["A","B","D#","F#"], "C#/B":["B","C#","F","G#"],

  // UST bII/I (Db/C type)
  "Db/C":["C","Db","F","Ab"], "Eb/D":["D","Eb","G","Bb"], "F/E":["E","F","A","C"],
  "Gb/F":["F","Gb","Bb","Db"],"Ab/G":["G","Ab","C","Eb"], "Bb/A":["A","Bb","D","F"], "C/B":["B","C","E","G"],

  // UST III/I (E/C type)
  "E/C":["C","E","G#","B"],   "F#/D":["D","F#","A#","C#"], "G#/E":["E","G#","C","D#"],
  "A/F":["F","A","C#","E"],   "B/G":["G","B","D#","F#"],  "C#/A":["A","C#","F","G#"], "D#/B":["B","D#","G","A#"],

  // Major 1st inversion (C/E type)
  "C/E":["C","E","G"],   "D/F#":["D","F#","A"],  "E/G#":["E","G#","B"],
  "F/A":["F","A","C"],   "G/B":["G","B","D"],    "A/C#":["A","C#","E"],  "B/D#":["B","D#","F#"],

  // Major 2nd inversion (C/G type)
  "C/G":["C","E","G"],   "D/A":["D","F#","A"],   "E/B":["E","G#","B"],
  "F/C":["F","A","C"],   "G/D":["G","B","D"],    "A/E":["A","C#","E"],   "B/F#":["B","D#","F#"],

  // Minor 1st inversion (Cm/Eb type)
  "Cm/Eb":["C","Eb","G"], "Dm/F":["D","F","A"],  "Em/G":["E","G","B"],
  "Fm/Ab":["F","Ab","C"], "Gm/Bb":["G","Bb","D"],"Am/C":["A","C","E"],   "Bm/D":["B","D","F#"],

  // Minor 2nd inversion (Cm/G type)
  "Cm/G":["C","Eb","G"],  "Dm/A":["D","F","A"],  "Em/B":["E","G","B"],
  "Fm/C":["F","Ab","C"],  "Gm/D":["G","Bb","D"], "Am/E":["A","C","E"],   "Bm/F#":["B","D","F#"],

  // Hybrid: minor triad over M2-below bass (Am/G type)
  "Cm/Bb":["Bb","C","Eb","G"], "Dm/C":["C","D","F","A"],  "Em/D":["D","E","G","B"],
  "Fm/Eb":["Eb","F","Ab","C"], "Gm/F":["F","G","Bb","D"], "Am/G":["G","A","C","E"],  "Bm/A":["A","B","D","F#"],

  // Hybrid: major triad over m3-below bass (G/E type)
  "C/A":["A","C","E","G"],    "D/B":["B","D","F#","A"],  "E/C#":["C#","E","G#","B"],
  "F/D":["D","F","A","C"],    "G/E":["E","G","B","D"],   "A/F#":["F#","A","C#","E"], "B/G#":["G#","B","D#","F#"],
};

let gameMode = 'single';
let chordMode = 'triads';
let chordNotes = [];

const notesArr = ["A","B","C","D","E","F","G"]
const diesBemol = ["#","b","","","","",""]
const excludedNotes = ["Cb"];

function randomNote() {
  let n;
  do {
    n = notesArr[Math.floor(Math.random() * notesArr.length)]
      + diesBemol[Math.floor(Math.random() * diesBemol.length)];
  } while (excludedNotes.includes(n) || n === note);
  return n;
}

let note = null;
note = randomNote();
notesDisplay.innerHTML = formatNoteName(note);

function highlightNotes(note) {
  targetKeys.clear();
  Object.entries(svgCells).forEach(([key, cell]) => {
    const stringNum = parseInt(key.match(/string-(\d+)/)[1]);
    cell.circle.setAttribute('opacity', '0');
    if (lockedStrings.has(stringNum)) {
      cell.text.setAttribute('opacity', key.startsWith('btn1-') ? '1' : '0');
      return;
    }
    if (bassMode && stringNum <= 2) return;
    cell.text.setAttribute('opacity', '0');
    if (neckNotes[key] === normalize(note)) {
      targetKeys.add(key);
    }
  });
}

function highlightChordNotes(notes) {
  const normalizedNotes = notes.map(normalize);
  targetKeys.clear();
  Object.entries(svgCells).forEach(([key, cell]) => {
    const stringNum = parseInt(key.match(/string-(\d+)/)[1]);
    cell.circle.setAttribute('opacity', '0');
    if (lockedStrings.has(stringNum)) {
      cell.text.setAttribute('opacity', key.startsWith('btn1-') ? '1' : '0');
      return;
    }
    cell.text.setAttribute('opacity', '0');
    if (normalizedNotes.includes(normalize(neckNotes[key]))) {
      targetKeys.add(key);
    }
  });
}

let foundChordNotes = new Set();
let nextRoundTimeout = null;
let lastChordName = null;
let lastSlashChordName = null;

function startFourChordRound() {
  let chordName;
  if (extBtn.classList.contains('active')) {
    const keys = Object.keys(tensionChords);
    do { chordName = keys[Math.floor(Math.random() * keys.length)]; } while (chordName === lastChordName && keys.length > 1);
    chordNotes = tensionChords[chordName];
  } else {
    const weightedChords = [
      ...Object.keys(dominant7), ...Object.keys(dominant7),
      ...Object.keys(minor7),    ...Object.keys(minor7),
      ...Object.keys(major7),    ...Object.keys(major7),
      ...Object.keys(halfDim7),
    ];
    do { chordName = weightedChords[Math.floor(Math.random() * weightedChords.length)]; } while (chordName === lastChordName && weightedChords.length > 1);
    chordNotes = allSeventhChords[chordName];
  }
  lastChordName = chordName;
  foundChordNotes = new Set();
  headLineEl.innerHTML = 'FOUR NOTED<br>CHORDS';
  notesDisplay.innerHTML = formatNoteName(chordName);
  instracEl.textContent = `Find chord tones`;
  const no5thSuffixes = ['7b9','7#9','#11','11','maj9','13','b13','m9'];
  const isNo5th = extBtn.classList.contains('active') && no5thSuffixes.some(s => chordName.endsWith(s));
  no5thNote.style.display = isNo5th ? 'block' : 'none';
  highlightChordNotes(chordNotes);
}

function startSlashChordRound() {
  const keys = Object.keys(slashChords);
  let chordName;
  do { chordName = keys[Math.floor(Math.random() * keys.length)]; } while (chordName === lastSlashChordName && keys.length > 1);
  lastSlashChordName = chordName;
  chordNotes = slashChords[chordName];
  foundChordNotes = new Set();
  headLineEl.innerHTML = 'SLASH<br>CHORDS';
  notesDisplay.innerHTML = formatNoteName(chordName);
  instracEl.textContent = 'Find chord tones';
  no5thNote.style.display = 'none';
  highlightChordNotes(chordNotes);
}

function startChordRound() {
  const weightedChords = [
    ...Object.keys(majorTriads),
    ...Object.keys(majorTriads),
    ...Object.keys(majorTriads),
    ...Object.keys(majorTriads),
    ...Object.keys(majorTriads),
    ...Object.keys(minorTriads),
    ...Object.keys(minorTriads),
    ...Object.keys(minorTriads),
    ...Object.keys(minorTriads),
    ...Object.keys(minorTriads),
    ...Object.keys(diminishedTriads),
    ...Object.keys(augmentedTriads),
    ...Object.keys(sus2Chords),
    ...Object.keys(sus4Chords),
  ];
  let chordName;
  do { chordName = weightedChords[Math.floor(Math.random() * weightedChords.length)]; } while (chordName === lastChordName && weightedChords.length > 1);
  lastChordName = chordName;
  chordNotes = allTriads[chordName];
  foundChordNotes = new Set();
  headLineEl.innerHTML = 'TREE NOTES<br>CHORDS';
  notesDisplay.innerHTML = formatNoteName(chordName);
  instracEl.textContent = 'Find 3 notes';
  highlightChordNotes(chordNotes);
}

initSvgGrid();
if (!SHOW_ALL_CIRCLES) highlightNotes(note);

let scaleMarkMode = 'position';
const scaleMarks = { notes: new Set(), roots: new Set(), blues: new Set() };

function calibCircleColor(key) {
  if (scaleMarks.roots.has(key)) return { fill: 'rgb(210,40,40)', opacity: '1' };
  if (scaleMarks.blues.has(key)) return { fill: 'rgb(0,120,255)', opacity: '1' };
  if (scaleMarks.notes.has(key)) return { fill: 'rgb(130,40,210)', opacity: '1' };
  return { fill: 'red', opacity: '0.45' };
}

function selectCell(key) {
  if (scaleMarkMode === 'note') {
    const cell = svgCells[key];
    if (scaleMarks.notes.has(key)) {
      scaleMarks.notes.delete(key);
      const s = calibCircleColor(key);
      cell.circle.setAttribute('fill', s.fill);
      cell.circle.setAttribute('opacity', s.opacity);
    } else {
      scaleMarks.roots.delete(key);
      scaleMarks.blues.delete(key);
      scaleMarks.notes.add(key);
      cell.circle.setAttribute('fill', 'rgb(130,40,210)');
      cell.circle.setAttribute('opacity', '1');
    }
    return;
  }
  if (scaleMarkMode === 'root') {
    const cell = svgCells[key];
    if (scaleMarks.roots.has(key)) {
      scaleMarks.roots.delete(key);
      const s = calibCircleColor(key);
      cell.circle.setAttribute('fill', s.fill);
      cell.circle.setAttribute('opacity', s.opacity);
    } else {
      scaleMarks.notes.delete(key);
      scaleMarks.blues.delete(key);
      scaleMarks.roots.add(key);
      cell.circle.setAttribute('fill', 'rgb(210,40,40)');
      cell.circle.setAttribute('opacity', '1');
    }
    return;
  }
  if (scaleMarkMode === 'blues') {
    const cell = svgCells[key];
    if (scaleMarks.blues.has(key)) {
      scaleMarks.blues.delete(key);
      const s = calibCircleColor(key);
      cell.circle.setAttribute('fill', s.fill);
      cell.circle.setAttribute('opacity', s.opacity);
    } else {
      scaleMarks.notes.delete(key);
      scaleMarks.roots.delete(key);
      scaleMarks.blues.add(key);
      cell.circle.setAttribute('fill', 'rgb(0,120,255)');
      cell.circle.setAttribute('opacity', '1');
    }
    return;
  }
  // position mode
  if (selectedKey && svgCells[selectedKey]) {
    const s = calibCircleColor(selectedKey);
    svgCells[selectedKey].circle.setAttribute('fill', s.fill);
    svgCells[selectedKey].circle.setAttribute('opacity', s.opacity);
  }
  selectedKey = (selectedKey === key) ? null : key;
  if (selectedKey) {
    svgCells[selectedKey].circle.setAttribute('fill', 'red');
    svgCells[selectedKey].circle.setAttribute('opacity', '1');
  }
  const lbl = document.getElementById('calib-label');
  if (lbl) lbl.textContent = selectedKey
    ? selectedKey.replace('btn', 'f').replace('-string-', '-s') + ' (0,0)'
    : 'tap circle';
}

function copyScaleData() {
  const notes = [...scaleMarks.notes].map(k => `"${k}"`).join(',');
  const roots = [...scaleMarks.roots].map(k => `"${k}"`).join(',');
  const blues = [...scaleMarks.blues].map(k => `"${k}"`).join(',');
  const code = `{"notes":[${notes}],"roots":[${roots}],"blues":[${blues}]}`;
  navigator.clipboard.writeText(code).then(() => {}).catch(() => {});
  prompt('Scale data:', code);
}

function nudgeSelected(ddx, ddy) {
  if (!selectedKey) return;
  if (!liveOffsets[selectedKey]) liveOffsets[selectedKey] = { dx: 0, dy: 0 };
  liveOffsets[selectedKey].dx += ddx;
  liveOffsets[selectedKey].dy += ddy;
  const { rect, circle, text } = svgCells[selectedKey];
  circle.setAttribute('cx', parseFloat(circle.getAttribute('cx')) + ddx);
  circle.setAttribute('cy', parseFloat(circle.getAttribute('cy')) + ddy);
  text.setAttribute('x',   parseFloat(text.getAttribute('x'))   + ddx);
  text.setAttribute('y',   parseFloat(text.getAttribute('y'))   + ddy);
  rect.setAttribute('x',   parseFloat(rect.getAttribute('x'))   + ddx);
  const { dx, dy } = liveOffsets[selectedKey];
  const lbl = document.getElementById('calib-label');
  if (lbl) lbl.textContent = selectedKey.replace('btn','f').replace('-string-','-s') + ` (${dx},${dy})`;
}

function alignYSelected() {
  if (!selectedKey) return;
  const fretPart = selectedKey.match(/^btn\d+/)[0];
  const selectedCy = parseFloat(svgCells[selectedKey].circle.getAttribute('cy'));
  for (const key of Object.keys(svgCells)) {
    if (key === selectedKey || !key.startsWith(fretPart + '-')) continue;
    const { circle, rect, text } = svgCells[key];
    const ddy = selectedCy - parseFloat(circle.getAttribute('cy'));
    if (!liveOffsets[key]) liveOffsets[key] = { dx: 0, dy: 0 };
    liveOffsets[key].dy += ddy;
    circle.setAttribute('cy', selectedCy);
    text.setAttribute('y', parseFloat(text.getAttribute('y')) + ddy);
    rect.setAttribute('y', parseFloat(rect.getAttribute('y')) + ddy);
  }
}

function alignXSelected() {
  if (!selectedKey) return;
  const stringPart = selectedKey.match(/-string-\d+$/)[0];
  const selectedCx = parseFloat(svgCells[selectedKey].circle.getAttribute('cx'));
  for (const key of Object.keys(svgCells)) {
    if (key === selectedKey || !key.endsWith(stringPart)) continue;
    const { circle, rect, text } = svgCells[key];
    const ddx = selectedCx - parseFloat(circle.getAttribute('cx'));
    if (!liveOffsets[key]) liveOffsets[key] = { dx: 0, dy: 0 };
    liveOffsets[key].dx += ddx;
    circle.setAttribute('cx', selectedCx);
    text.setAttribute('x', parseFloat(text.getAttribute('x')) + ddx);
    rect.setAttribute('x', parseFloat(rect.getAttribute('x')) + ddx);
  }
}

function copyOffsets() {
  const lines = Object.entries(svgCells).map(([key, cell]) => {
    const base = baseCellPositions[key];
    if (!base) return null;
    const dx = Math.round(parseFloat(cell.circle.getAttribute('cx')) - base.xBase);
    const dy = Math.round(parseFloat(cell.circle.getAttribute('cy')) - base.yCtrBase);
    if (dx === 0 && dy === 0) return null;
    return `  "${key}": { dx: ${dx}, dy: ${dy} },`;
  }).filter(Boolean).join('\n');
  if (!lines) { alert('No offsets yet'); return; }
  const varName = bassMode ? 'bassOffsets' : 'cellOffsets';
  const code = `const ${varName} = {\n${lines}\n};`;
  navigator.clipboard.writeText(code).then(() => {
    const lbl = document.getElementById('calib-label');
    const prev = lbl.textContent;
    lbl.textContent = '✓ Copied!';
    setTimeout(() => { lbl.textContent = prev; }, 2000);
  }).catch(() => {});
  prompt('Copy offsets:', code);
}

if (SHOW_ALL_CIRCLES) {
  document.body.classList.add('greed-mode');

  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;top:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;z-index:9999;box-sizing:border-box;';

  const mkBtn = (label, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'font-size:20px;padding:8px 14px;background:#444;color:white;border:none;border-radius:8px;cursor:pointer;';
    b.addEventListener('click', fn);
    return b;
  };

  const lbl = document.createElement('span');
  lbl.id = 'calib-label';
  lbl.style.cssText = 'color:white;font-size:12px;min-width:80px;text-align:center;';
  lbl.textContent = 'tap circle';

  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copy';
  copyBtn.style.cssText = 'font-size:14px;padding:8px 12px;background:#1a6fdb;color:white;border:none;border-radius:8px;cursor:pointer;';
  copyBtn.addEventListener('click', copyOffsets);

  const modeBtns = {};
  const modeRow = document.createElement('div');
  modeRow.style.cssText = 'display:flex;align-items:center;gap:6px;';

  const mkModeBtn = (label, mode, color) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = `font-size:14px;padding:8px 12px;background:${color};color:white;border:2px solid transparent;border-radius:8px;cursor:pointer;`;
    b.addEventListener('click', () => {
      scaleMarkMode = mode;
      Object.entries(modeBtns).forEach(([m, btn]) => {
        btn.style.borderColor = m === mode ? 'white' : 'transparent';
      });
      if (lbl) lbl.textContent = mode === 'position' ? 'tap circle' : `mode: ${mode}`;
    });
    modeBtns[mode] = b;
    return b;
  };

  const posBtn = mkModeBtn('Pos', 'position', '#555');
  posBtn.style.borderColor = 'white';
  const noteBtn = mkModeBtn('Note', 'note', 'rgb(130,40,210)');
  const rootBtn = mkModeBtn('Root', 'root', 'rgb(180,30,30)');
  const bluesBtn = mkModeBtn('Blues', 'blues', 'rgb(0,90,200)');

  const copyScaleBtn = document.createElement('button');
  copyScaleBtn.textContent = 'Copy Scale';
  copyScaleBtn.style.cssText = 'font-size:14px;padding:8px 12px;background:#207050;color:white;border:none;border-radius:8px;cursor:pointer;';
  copyScaleBtn.addEventListener('click', copyScaleData);

  const clearScaleBtn = document.createElement('button');
  clearScaleBtn.textContent = 'Clear';
  clearScaleBtn.style.cssText = 'font-size:14px;padding:8px 12px;background:#883030;color:white;border:none;border-radius:8px;cursor:pointer;';
  clearScaleBtn.addEventListener('click', () => {
    [...scaleMarks.notes, ...scaleMarks.roots, ...scaleMarks.blues].forEach(key => {
      svgCells[key].circle.setAttribute('fill', 'red');
      svgCells[key].circle.setAttribute('opacity', '0.45');
    });
    scaleMarks.notes.clear();
    scaleMarks.roots.clear();
    scaleMarks.blues.clear();
  });

  modeRow.append(posBtn, noteBtn, rootBtn, bluesBtn, copyScaleBtn, clearScaleBtn);

  const row1 = document.createElement('div');
  row1.style.cssText = 'display:flex;align-items:center;gap:6px;';
  row1.append(
    mkBtn('←', () => nudgeSelected(-3, 0)),
    mkBtn('↑', () => nudgeSelected(0, -3)),
    lbl,
    mkBtn('↓', () => nudgeSelected(0, 3)),
    mkBtn('→', () => nudgeSelected(3, 0)),
    copyBtn
  );

  const alignXBtn = document.createElement('button');
  alignXBtn.textContent = 'Align X';
  alignXBtn.style.cssText = 'font-size:14px;padding:8px 12px;background:#c07000;color:white;border:none;border-radius:8px;cursor:pointer;';
  alignXBtn.addEventListener('click', alignXSelected);

  const alignYBtn = document.createElement('button');
  alignYBtn.textContent = 'Align Y';
  alignYBtn.style.cssText = 'font-size:14px;padding:8px 12px;background:#207050;color:white;border:none;border-radius:8px;cursor:pointer;';
  alignYBtn.addEventListener('click', alignYSelected);

  const row2 = document.createElement('div');
  row2.style.cssText = 'display:flex;align-items:center;gap:6px;';
  row2.append(
    mkBtn('⇐', () => nudgeSelected(-20, 0)),
    mkBtn('⇑', () => nudgeSelected(0, -20)),
    mkBtn('⇓', () => nudgeSelected(0, 20)),
    mkBtn('⇒', () => nudgeSelected(20, 0)),
    alignXBtn,
    alignYBtn
  );

  bar.style.flexDirection = 'column';
  bar.append(modeRow, row1, row2);
  document.body.appendChild(bar);
}

window.addEventListener('load', () => {
  if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
    window.Capacitor.Plugins.App.addListener('backButton', () => {
      if (document.body.classList.contains('greed-mode')) {
        homeBtn.click();
      } else {
        if (confirm('Leave the app?')) {
          window.Capacitor.Plugins.App.exitApp();
        }
      }
    });
  }
});

function nextRound() {
  clearTimeout(nextRoundTimeout);
  noteNameDisplay.classList.remove('well-done');
  feedbackEl.className = 'feedback';
  feedbackEl.textContent = '';
  if (gameMode === 'chord') {
    if (chordMode === 'sevenths') startFourChordRound();
    else if (chordMode === 'slash') startSlashChordRound();
    else startChordRound();
  } else {
    headLineEl.textContent = 'SINGLE NOTES';
    instracEl.innerHTML = 'Find (all)<br>Displayed notes';
    note = randomNote();
    notesDisplay.innerHTML = formatNoteName(note);
    highlightNotes(note);
  }
}

