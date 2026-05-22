
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
  "btn1-string-6":  { dx: -9, dy: 21  }, "btn1-string-5":  { dx: 6,  dy: 21  },
  "btn1-string-4":  { dx: 9,  dy: 21  }, "btn1-string-3":  { dx: 6,  dy: 21  },
  "btn1-string-2":  { dx: 6,  dy: 21  }, "btn1-string-1":  { dx: 3,  dy: 21  },
  "btn2-string-6":  { dx: -6, dy: 71  }, "btn2-string-5":  { dx: 6,  dy: 72  },
  "btn2-string-4":  { dx: 9,  dy: 71  }, "btn2-string-3":  { dx: 6,  dy: 71  },
  "btn2-string-2":  { dx: 3,  dy: 71  }, "btn2-string-1":  { dx: 3,  dy: 71  },
  "btn3-string-6":  { dx: -3, dy: 105 }, "btn3-string-5":  { dx: 6,  dy: 105 },
  "btn3-string-4":  { dx: 6,  dy: 102 }, "btn3-string-3":  { dx: 6,  dy: 105 },
  "btn3-string-2":  { dx: 3,  dy: 108 }, "btn3-string-1":  { dx: 3,  dy: 105 },
  "btn4-string-6":  { dx: 5,  dy: 114 }, "btn4-string-5":  { dx: 6,  dy: 114 },
  "btn4-string-4":  { dx: 8,  dy: 113 }, "btn4-string-3":  { dx: 6,  dy: 114 },
  "btn4-string-2":  { dx: 3,  dy: 114 }, "btn4-string-1":  { dx: 3,  dy: 114 },
  "btn5-string-6":  { dx: 3,  dy: 157 }, "btn5-string-5":  { dx: 15, dy: 157 },
  "btn5-string-4":  { dx: 6,  dy: 157 }, "btn5-string-3":  { dx: 6,  dy: 157 },
  "btn5-string-2":  { dx: 9,  dy: 157 }, "btn5-string-1":  { dx: 18, dy: 157 },
  "btn6-string-6":  { dx: -3, dy: 211 }, "btn6-string-5":  { dx: 6,  dy: 211 },
  "btn6-string-4":  { dx: 6,  dy: 211 }, "btn6-string-3":  { dx: 6,  dy: 211 },
  "btn6-string-2":  { dx: 6,  dy: 211 }, "btn6-string-1":  { dx: 6,  dy: 211 },
  "btn7-string-6":  { dx: 3,  dy: 254 }, "btn7-string-5":  { dx: 3,  dy: 254 },
  "btn7-string-4":  { dx: 6,  dy: 254 }, "btn7-string-3":  { dx: 6,  dy: 254 },
  "btn7-string-2":  { dx: 6,  dy: 251 }, "btn7-string-1":  { dx: 6,  dy: 251 },
  "btn8-string-6":  { dx: 15, dy: 300 }, "btn8-string-5":  { dx: 12, dy: 300 },
  "btn8-string-4":  { dx: 9,  dy: 300 }, "btn8-string-3":  { dx: 12, dy: 300 },
  "btn8-string-2":  { dx: 18, dy: 300 }, "btn8-string-1":  { dx: 18, dy: 300 },
  "btn9-string-6":  { dx: 3,  dy: 343 }, "btn9-string-5":  { dx: 3,  dy: 343 },
  "btn9-string-4":  { dx: 6,  dy: 343 }, "btn9-string-3":  { dx: 6,  dy: 343 },
  "btn9-string-2":  { dx: 6,  dy: 343 }, "btn9-string-1":  { dx: 6,  dy: 343 },
  "btn10-string-6": { dx: 6,  dy: 380 }, "btn10-string-5": { dx: 3,  dy: 380 },
  "btn10-string-4": { dx: 6,  dy: 380 }, "btn10-string-3": { dx: 6,  dy: 377 },
  "btn10-string-2": { dx: 6,  dy: 380 }, "btn10-string-1": { dx: 9,  dy: 383 },
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
  localStorage.removeItem('guitarCalibOffsets'); // clear old reversed-string data
  const saved = localStorage.getItem('guitarCalibOffsets_v2');
  if (saved) Object.assign(cellOffsets, JSON.parse(saved));
} catch(e) {}

// ── Set true to see all circles (for calibration), false for production ──
const SHOW_ALL_CIRCLES = false;

let selectedKey = null;
const liveOffsets = {};

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
      bluesHlText.setAttribute('x', xCtr); bluesHlText.setAttribute('y', yCtr2 + 13);
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
  const key = e.currentTarget.dataset.key;
  const stringNum = parseInt(key.match(/string-(\d+)/)[1]);
  if (lockedStrings.has(stringNum)) return;
  showTapRipple(key);
  playNote(freqFromKey(key));
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
  document.body.classList.remove('greed-mode', 'free-play-mode', 'scales-mode');
  clearScaleHighlights();
  score = 0;
  scoreNumberEl.textContent = 0;
});

nextBtn.addEventListener('click', () => {
  nextRound();
});

const extBtn = document.querySelector('.ext-btn');
extBtn.addEventListener('click', () => {
  extBtn.classList.toggle('active');
  extBtn.textContent = extBtn.classList.contains('active') ? 'Tensions' : 'Add tensions';
});
const headLineEl = document.querySelector('.headLine');
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
    feedbackEl.className = 'feedback';
    feedbackEl.textContent = '';
    if (index === 1) {
      gameMode = 'chord';
      chordMode = 'triads';
      document.body.classList.remove('four-chord-mode', 'free-play-mode');
      startChordRound();
    } else if (index === 2) {
      gameMode = 'chord';
      chordMode = 'sevenths';
      document.body.classList.add('four-chord-mode');
      document.body.classList.remove('free-play-mode');
      startFourChordRound();
    } else if (index === 3) {
      gameMode = 'freeplay';
      document.body.classList.remove('four-chord-mode');
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
    } else {
      gameMode = 'single';
      document.body.classList.remove('four-chord-mode', 'free-play-mode');
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

document.querySelectorAll('.scale-category-btn').forEach(catBtn => {
  catBtn.addEventListener('click', () => {
    const group = catBtn.closest('.scale-group');
    const isOpen = group.classList.contains('open');
    document.querySelectorAll('.scale-group').forEach(g => g.classList.remove('open'));
    if (!isOpen) group.classList.add('open');
  });
});

document.querySelector('.scale-selector').addEventListener('click', e => {
  const btn = e.target.closest('.scale-btn');
  if (!btn || btn.disabled) return;
  document.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyScaleHighlights(btn.dataset.scale);
});


const scaleData = {"Ionian":{"notes":["btn4-string-5","btn6-string-6","btn6-string-5","btn8-string-6","btn8-string-5","btn5-string-4","btn5-string-3","btn6-string-3","btn8-string-4","btn8-string-3","btn6-string-2","btn6-string-1","btn8-string-2","btn8-string-1","btn9-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Dorian":{"notes":["btn6-string-6","btn7-string-6","btn4-string-5","btn6-string-5","btn8-string-5","btn4-string-4","btn8-string-4","btn4-string-3","btn6-string-3","btn8-string-3","btn6-string-2","btn7-string-2","btn6-string-1","btn7-string-1","btn9-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Phrygian":{"notes":["btn5-string-6","btn7-string-6","btn4-string-5","btn7-string-5","btn4-string-4","btn6-string-4","btn7-string-4","btn4-string-3","btn6-string-3","btn8-string-3","btn5-string-2","btn5-string-1","btn7-string-2","btn7-string-1","btn9-string-1"],"roots":["btn4-string-6","btn6-string-5","btn9-string-2"],"blues":[]},"Lydian":{"notes":["btn6-string-6","btn8-string-6","btn5-string-5","btn8-string-5","btn5-string-4","btn8-string-4","btn5-string-3","btn7-string-3","btn8-string-3","btn6-string-2","btn8-string-2","btn6-string-1","btn8-string-1","btn10-string-1","btn6-string-5"],"roots":["btn4-string-6","btn9-string-2","btn6-string-4"],"blues":[]},"Mixolydian":{"notes":["btn4-string-5","btn4-string-4","btn6-string-6","btn6-string-5","btn8-string-6","btn8-string-5","btn8-string-4","btn5-string-3","btn6-string-3","btn8-string-3","btn6-string-2","btn6-string-1","btn9-string-1","btn7-string-2","btn8-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Aeolian":{"notes":["btn6-string-6","btn7-string-6","btn4-string-5","btn6-string-5","btn7-string-5","btn4-string-4","btn4-string-3","btn6-string-3","btn8-string-4","btn8-string-3","btn5-string-2","btn7-string-2","btn6-string-1","btn7-string-1","btn9-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Locrian":{"notes":["btn5-string-6","btn7-string-6","btn4-string-5","btn5-string-5","btn7-string-5","btn4-string-4","btn7-string-4","btn4-string-3","btn6-string-3","btn7-string-3","btn5-string-2","btn5-string-1","btn7-string-2","btn7-string-1","btn9-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Minor Blues 1":{"notes":["btn7-string-6","btn4-string-5","btn4-string-4","btn4-string-3","btn4-string-2","btn6-string-5","btn6-string-3","btn7-string-2","btn7-string-1"],"roots":["btn4-string-6","btn6-string-4","btn4-string-1"],"blues":["btn5-string-5","btn7-string-3"]},"Minor Blues 2":{"notes":["btn6-string-6","btn3-string-5","btn6-string-5","btn3-string-4","btn3-string-3","btn5-string-3","btn4-string-2","btn6-string-2","btn6-string-1"],"roots":["btn4-string-6","btn6-string-4","btn4-string-1"],"blues":["btn7-string-6","btn7-string-1","btn4-string-3"]},"Minor Blues 3":{"notes":["btn6-string-6","btn4-string-5","btn6-string-5","btn4-string-4","btn3-string-3","btn6-string-3","btn4-string-2","btn7-string-2","btn6-string-1"],"roots":["btn4-string-6","btn4-string-1","btn6-string-4"],"blues":["btn7-string-5","btn5-string-1"]},"Minor Blues 4":{"notes":["btn7-string-6","btn4-string-5","btn7-string-5","btn4-string-4","btn4-string-3","btn6-string-3","btn5-string-2","btn7-string-2","btn7-string-1"],"roots":["btn4-string-6","btn6-string-4","btn4-string-1"],"blues":["btn5-string-4","btn8-string-2"]},"Minor Blues 5":{"notes":["btn6-string-6","btn4-string-5","btn6-string-5","btn3-string-4","btn3-string-3","btn6-string-3","btn4-string-2","btn6-string-2","btn6-string-1"],"roots":["btn4-string-6","btn6-string-4","btn4-string-1"],"blues":["btn7-string-5","btn5-string-2"]},"Diminished":{"notes":["btn6-string-6","btn7-string-6","btn4-string-5","btn5-string-5","btn7-string-5","btn3-string-4","btn5-string-4","btn3-string-3","btn4-string-3","btn6-string-3","btn3-string-2","btn5-string-2","btn6-string-2","btn3-string-1","btn6-string-1"],"roots":["btn4-string-6","btn6-string-4","btn4-string-1"],"blues":[]},"Dim b9":{"notes":["btn5-string-6","btn7-string-6","btn8-string-6","btn5-string-5","btn6-string-5","btn8-string-5","btn4-string-4","btn7-string-4","btn4-string-3","btn5-string-3","btn7-string-3","btn4-string-2","btn6-string-2","btn7-string-2","btn5-string-1","btn7-string-1"],"roots":["btn4-string-6","btn6-string-4","btn4-string-1"],"blues":[]},"Whole Tone":{"notes":["btn6-string-6","btn8-string-6","btn5-string-5","btn7-string-5","btn5-string-2","btn7-string-2","btn6-string-1","btn8-string-1","btn4-string-4","btn8-string-4","btn5-string-3","btn7-string-3"],"roots":["btn4-string-6","btn6-string-4","btn4-string-1"],"blues":[]},"Melodic Minor":{"notes":["btn6-string-6","btn7-string-6","btn4-string-5","btn6-string-5","btn8-string-5","btn8-string-4","btn5-string-4","btn4-string-3","btn6-string-3","btn8-string-3","btn5-string-2","btn7-string-2","btn5-string-1","btn6-string-1","btn8-string-1"],"roots":["btn4-string-6","btn6-string-4","btn8-string-2"],"blues":[]},"Dorian ♭2":{"notes":["btn5-string-6","btn7-string-6","btn4-string-5","btn6-string-5","btn8-string-5","btn4-string-4","btn7-string-4","btn4-string-3","btn6-string-3","btn8-string-3","btn6-string-2","btn7-string-2","btn5-string-1","btn7-string-1","btn9-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Lydian Aug":{"notes":["btn6-string-6","btn8-string-6","btn5-string-5","btn8-string-4","btn5-string-3","btn7-string-3","btn6-string-2","btn6-string-1","btn8-string-1","btn10-string-1","btn8-string-5","btn5-string-4","btn8-string-2","btn7-string-5","btn9-string-3"],"roots":["btn4-string-6","btn9-string-2","btn6-string-4"],"blues":[]},"Lydian Dom":{"notes":["btn6-string-6","btn8-string-6","btn5-string-5","btn8-string-5","btn4-string-4","btn6-string-4","btn8-string-4","btn5-string-3","btn7-string-3","btn8-string-3","btn6-string-2","btn7-string-2","btn6-string-1","btn8-string-1","btn10-string-1"],"roots":["btn4-string-6","btn6-string-5","btn9-string-2"],"blues":[]},"Altered Scale":{"notes":["btn5-string-6","btn7-string-6","btn3-string-5","btn5-string-5","btn7-string-5","btn4-string-4","btn7-string-4","btn4-string-3","btn5-string-3","btn7-string-3","btn5-string-2","btn7-string-2","btn5-string-1","btn6-string-1","btn8-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Locrian ♮2":{"notes":["btn7-string-6","btn6-string-6","btn4-string-5","btn5-string-5","btn7-string-5","btn4-string-4","btn8-string-4","btn4-string-3","btn6-string-3","btn7-string-3","btn5-string-2","btn7-string-2","btn6-string-1","btn7-string-1","btn9-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Mixolydian ♭6":{"notes":["btn4-string-5","btn6-string-6","btn8-string-6","btn7-string-5","btn4-string-4","btn8-string-4","btn5-string-3","btn6-string-3","btn8-string-3","btn5-string-2","btn7-string-2","btn6-string-1","btn8-string-1","btn9-string-1","btn5-string-5"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Aeolian ♯7":{"notes":["btn6-string-6","btn7-string-6","btn4-string-5","btn6-string-5","btn7-string-5","btn8-string-4","btn4-string-3","btn6-string-3","btn8-string-3","btn5-string-2","btn6-string-1","btn7-string-1","btn9-string-1","btn5-string-4","btn8-string-2"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Locrian ♮6":{"notes":["btn5-string-6","btn7-string-6","btn4-string-5","btn5-string-5","btn4-string-4","btn7-string-4","btn4-string-3","btn6-string-3","btn7-string-3","btn5-string-2","btn5-string-1","btn7-string-1","btn9-string-1","btn8-string-5","btn8-string-2"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Dorian ♯4":{"notes":["btn6-string-6","btn7-string-6","btn6-string-5","btn8-string-5","btn4-string-4","btn4-string-3","btn6-string-2","btn6-string-1","btn7-string-2","btn8-string-4","btn5-string-5","btn7-string-3","btn10-string-1","btn8-string-3","btn7-string-1"],"roots":["btn4-string-6","btn9-string-2","btn6-string-4"],"blues":[]},"Phrygian ♮3":{"notes":["btn5-string-6","btn4-string-5","btn7-string-5","btn4-string-4","btn7-string-4","btn6-string-5","btn6-string-3","btn8-string-3","btn5-string-2","btn5-string-1","btn7-string-2","btn9-string-1","btn8-string-6","btn5-string-3","btn8-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]}};

function applyScaleHighlights(scaleName) {
  clearScaleHighlights();
  const d = scaleData[scaleName];
  if (!d) return;
  (d.notes || []).forEach(k => { if (svgCells[k]) svgCells[k].scaleNoteCircle.setAttribute('opacity','1'); });
  (d.roots || []).forEach(k => {
    if (svgCells[k]) {
      svgCells[k].rootHlCircle.setAttribute('opacity','1');
      svgCells[k].rootHlText.setAttribute('opacity','1');
    }
  });
  (d.blues || []).forEach(k => {
    if (svgCells[k]) {
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

  "Cmaj9":["C","E","G","B","D"],  "Dmaj9":["D","F#","A","C#","E"], "Emaj9":["E","G#","B","D#","F#"],
  "Fmaj9":["F","A","C","E","G"],  "Gmaj9":["G","B","D","F#","A"],  "Amaj9":["A","C#","E","G#","B"], "Bmaj9":["B","D#","F#","A#","C#"],

  "Cm6":["C","Eb","G","A"],  "Dm6":["D","F","A","B"],   "Em6":["E","G","B","C#"],
  "Fm6":["F","Ab","C","D"],  "Gm6":["G","Bb","D","E"],  "Am6":["A","C","E","F#"],  "Bm6":["B","D","F#","G#"],

  "C6":["C","E","G","A"],  "D6":["D","F#","A","B"],   "E6":["E","G#","B","C#"],
  "F6":["F","A","C","D"],  "G6":["G","B","D","E"],    "A6":["A","C#","E","F#"],  "B6":["B","D#","F#","G#"],

  "C7b9":["C","E","G","Ab"], "D7b9":["D","F#","A","Bb"], "E7b9":["E","G#","B","C"],
  "F7b9":["F","A","C","Gb"], "G7b9":["G","B","D","Ab"],  "A7b9":["A","C#","E","F"], "B7b9":["B","D#","F#","G"],

  "C7#9":["C","E","G","A#"], "D7#9":["D","F#","A","C"],  "E7#9":["E","G#","B","D"],
  "F7#9":["F","A","C","Eb"], "G7#9":["G","B","D","F"],   "A7#9":["A","C#","E","G"], "B7#9":["B","D#","F#","A"],

  "C#11":["C","E","G","F#"], "D#11":["D","F#","A","G#"], "E#11":["E","G#","B","A#"],
  "F#11":["F","A","C","B"],  "G#11":["G","B","D","C#"],  "A#11":["A","C#","E","D#"], "B#11":["B","D#","F#","F"],

  "Cdim7":["C","Eb","Gb","A"],  "Ddim7":["D","F","Ab","B"],   "Edim7":["E","G","Bb","C#"],
  "Fdim7":["F","Ab","B","D"],   "Gdim7":["G","Bb","Db","E"],  "Adim7":["A","C","Eb","F#"], "Bdim7":["B","D","F","Ab"],

  "Caug7":["C","E","G#","Bb"],  "Daug7":["D","F#","A#","C"],  "Eaug7":["E","G#","C","D"],
  "Faug7":["F","A","C#","Eb"], "Gaug7":["G","B","D#","F"],   "Aaug7":["A","C#","F","G"],  "Baug7":["B","D#","G","A"],

  "C7b5":["C","E","Gb","B"],  "D7b5":["D","F#","Ab","C#"], "E7b5":["E","G#","Bb","D#"],
  "F7b5":["F","A","B","E"],   "G7b5":["G","B","Db","F#"],  "A7b5":["A","C#","Eb","G#"], "B7b5":["B","D#","F","A#"],
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
  } while (excludedNotes.includes(n));
  return n;
}

let note = randomNote();
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

function startFourChordRound() {
  let chordName;
  if (extBtn.classList.contains('active')) {
    const keys = Object.keys(tensionChords);
    chordName = keys[Math.floor(Math.random() * keys.length)];
    chordNotes = tensionChords[chordName];
  } else {
    const weightedChords = [
      ...Object.keys(dominant7), ...Object.keys(dominant7),
      ...Object.keys(minor7),    ...Object.keys(minor7),
      ...Object.keys(major7),    ...Object.keys(major7),
      ...Object.keys(halfDim7),
    ];
    chordName = weightedChords[Math.floor(Math.random() * weightedChords.length)];
    chordNotes = allSeventhChords[chordName];
  }
  foundChordNotes = new Set();
  headLineEl.innerHTML = 'FOUR NOTED<br>CHORDS';
  notesDisplay.innerHTML = formatNoteName(chordName);
  instracEl.textContent = `Find 4 notes`;
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
  const chordName = weightedChords[Math.floor(Math.random() * weightedChords.length)];
  chordNotes = allTriads[chordName];
  foundChordNotes = new Set();
  headLineEl.innerHTML = 'TREE NOTES<br>CHORDS';
  notesDisplay.innerHTML = formatNoteName(chordName);
  instracEl.textContent = 'Find 3 notes';
  highlightChordNotes(chordNotes);
}

initSvgGrid();
if (!SHOW_ALL_CIRCLES) highlightNotes(note);

function selectCell(key) {
  if (selectedKey && svgCells[selectedKey]) {
    svgCells[selectedKey].circle.setAttribute('fill', 'red');
    svgCells[selectedKey].circle.setAttribute('opacity', '0.45');
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

  // Auto-save combined offsets to localStorage
  try {
    const combined = { ...cellOffsets };
    for (const k in liveOffsets) {
      const base = cellOffsets[k] || { dx: 0, dy: 0 };
      combined[k] = { dx: base.dx + liveOffsets[k].dx, dy: base.dy + liveOffsets[k].dy };
    }
    localStorage.setItem('guitarCalibOffsets_v2', JSON.stringify(combined));
  } catch(e) {}
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
  try {
    const combined = { ...cellOffsets };
    for (const k in liveOffsets) {
      const base = cellOffsets[k] || { dx: 0, dy: 0 };
      combined[k] = { dx: base.dx + liveOffsets[k].dx, dy: base.dy + liveOffsets[k].dy };
    }
    localStorage.setItem('guitarCalibOffsets_v2', JSON.stringify(combined));
  } catch(e) {}
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
  try {
    const combined = { ...cellOffsets };
    for (const k in liveOffsets) {
      const base = cellOffsets[k] || { dx: 0, dy: 0 };
      combined[k] = { dx: base.dx + liveOffsets[k].dx, dy: base.dy + liveOffsets[k].dy };
    }
    localStorage.setItem('guitarCalibOffsets_v2', JSON.stringify(combined));
  } catch(e) {}
}

function copyOffsets() {
  const entries = Object.entries(liveOffsets).filter(([, v]) => v.dx !== 0 || v.dy !== 0);
  if (!entries.length) { alert('No offsets yet'); return; }
  const lines = entries.map(([k, v]) => `  "${k}": { dx: ${v.dx}, dy: ${v.dy} },`).join('\n');
  const code = `const cellOffsets = {\n${lines}\n};`;
  navigator.clipboard.writeText(code).then(() => {
    const lbl = document.getElementById('calib-label');
    const prev = lbl.textContent;
    lbl.textContent = '✓ Copied!';
    setTimeout(() => { lbl.textContent = prev; }, 2000);
  }).catch(() => { alert(code); });
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
  bar.append(row1, row2);
  document.body.appendChild(bar);
}

function nextRound() {
  clearTimeout(nextRoundTimeout);
  noteNameDisplay.classList.remove('well-done');
  feedbackEl.className = 'feedback';
  feedbackEl.textContent = '';
  if (gameMode === 'chord') {
    if (chordMode === 'sevenths') startFourChordRound();
    else startChordRound();
  } else {
    headLineEl.textContent = 'SINGLE NOTES';
    instracEl.innerHTML = 'Find (all)<br>Displayed notes';
    note = randomNote();
    notesDisplay.innerHTML = formatNoteName(note);
    highlightNotes(note);
  }
}

