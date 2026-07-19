
const mainButtons = document.querySelectorAll('.main-btn');
const smallButtons = document.querySelectorAll('.small-btn');
const guitarImg = document.querySelector('.guitar-img');
const header = document.querySelector('header');
const buttonsSection = document.querySelector('.buttons-section');
const buttonsRow = document.querySelector('.buttons-row');
const notesDisplay = document.querySelector(".noteD");
const noteDisplayToggleBtn = document.querySelector('.note-display-toggle');
const feedbackEl = document.querySelector('.feedback');
const homeBtn = document.querySelector('.home-btn');
const nextBtn = document.querySelector('.next-btn');

const timerWrapper = document.getElementById('timer-wrapper');
const timerStatusEl = document.getElementById('timer-status');
const timerSecondsEl = document.getElementById('timer-seconds');
let timerOn = false;
let timerSeconds = 0;
let timerCarryover = 0;
let timerIntervalId = null;
let timerRoundTotal = 0;
let timerRoundCount = 0;

function formatTimerSeconds(total) {
  if (total < 60) return total + 's';
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, '0');
  return m + 'm' + s + 's';
}

function resetRoundTimer() {
  if (timerOn && (timerSeconds > 0 || timerCarryover > 0)) {
    timerRoundTotal += timerCarryover + timerSeconds;
    timerRoundCount++;
  }
  timerSeconds = 0;
  timerCarryover = 0;
  if (timerOn && timerSecondsEl) timerSecondsEl.textContent = formatTimerSeconds(timerSeconds);
}

if (timerWrapper) {
  timerWrapper.addEventListener('click', () => {
    timerOn = !timerOn;
    timerWrapper.classList.toggle('timer-active', timerOn);
    if (timerOn) {
      timerSeconds = 0;
      timerCarryover = 0;
      timerSecondsEl.textContent = formatTimerSeconds(timerSeconds);
      timerStatusEl.textContent = 'Off';
      timerIntervalId = setInterval(() => {
        timerSeconds++;
        if (timerSeconds >= 600) { timerCarryover += 600; timerSeconds = 0; }
        timerSecondsEl.textContent = formatTimerSeconds(timerSeconds);
      }, 1000);
    } else {
      clearInterval(timerIntervalId);
      timerIntervalId = null;
      timerStatusEl.textContent = 'On';
    }
  });
}

// ── Listen (microphone note/chord detection) ────────────────────────────────
const listenWrapper = document.getElementById('listen-wrapper');
const listenStatusEl = document.getElementById('listen-status');
let listenOn = false;
let listenStream = null;
let listenAnalyser = null;
let listenChordAnalyser = null;
let listenRafId = null;
let pitchMatchStreak = 0;
let lastPitchMatchKey = null;
let chordMatchStreak = 0;
let noteIsActive = false;
let listenCooldownUntil = 0;
let releaseStreak = 0;
const PITCH_MATCH_FRAMES_NEEDED = 3;
const PITCH_MATCH_CENTS = 50;
const CHORD_MATCH_FRAMES_NEEDED = 4;
const CHORD_MATCH_THRESHOLD = 0.85;
const ONSET_RMS_THRESHOLD = 0.02;
const ONSET_RELEASE_THRESHOLD = 0.012;
const ONSET_COOLDOWN_MS = 400;
const RELEASE_FRAMES_NEEDED = 5;

// Big note-name circles shown on a successful Listen match, replacing the scattered
// small-dot flash across real fret positions (which for a chord spans several
// inversions at once and reads as noise) with a single readable stacked list.
let listenBigCircles = [];
// Shared root/3rd/5th/7th degree palette, also used by applyDegreeToKey() for the
// normal tap-mode fretboard circles.
const CHORD_DEGREE_COLORS = ['rgb(134,26,26)', 'rgb(184,68,12)', 'rgb(224,123,0)', 'rgb(216,190,0)'];

function listenBigCircleYPositions(n) {
  const top = 300, bottom = 1200;
  if (n <= 1) return [(top + bottom) / 2];
  const step = (bottom - top) / (n - 1);
  return Array.from({ length: n }, (_, i) => top + i * step);
}

function showListenBigCircles(notes, colors) {
  const ys = listenBigCircleYPositions(notes.length);
  listenBigCircles.forEach((bc, i) => {
    if (i < notes.length) {
      bc.circle.setAttribute('cy', ys[i]);
      bc.circle.setAttribute('fill', colors[i]);
      bc.circle.setAttribute('opacity', '1');
      bc.text.setAttribute('y', ys[i]);
      bc.text.textContent = notes[i];
      bc.text.setAttribute('opacity', '1');
    } else {
      bc.circle.setAttribute('opacity', '0');
      bc.text.setAttribute('opacity', '0');
    }
  });
}

function hideListenBigCircles() {
  listenBigCircles.forEach(bc => {
    bc.circle.setAttribute('opacity', '0');
    bc.text.setAttribute('opacity', '0');
  });
}

function centsOff(freqA, freqB) {
  return 1200 * Math.log2(freqA / freqB);
}

function computeRMS(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

const LISTEN_NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
function noteNameFromFreq(freq) {
  const noteNum = 12 * Math.log2(freq / 440) + 69;
  const rounded = Math.round(noteNum);
  const cents = (noteNum - rounded) * 100;
  const pitchClass = ((rounded % 12) + 12) % 12;
  return { name: LISTEN_NOTE_NAMES[pitchClass], cents };
}

function completeSingleNoteViaListen() {
  showListenBigCircles([note], ['darkorange']);
  targetKeys.clear();
  showWellDone();
  playBigSuccess();
  nextRoundTimeout = setTimeout(nextRound, 2200);
}

// Classic autocorrelation pitch detector (time-domain buffer -> frequency in Hz, or -1 if no clear pitch)
function autoCorrelate(buf, sampleRate) {
  const SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  let r1 = 0, r2 = SIZE - 1;
  const threshold = 0.2;
  for (let i = 0; i < SIZE / 2; i++) { if (Math.abs(buf[i]) < threshold) { r1 = i; break; } }
  for (let i = 1; i < SIZE / 2; i++) { if (Math.abs(buf[SIZE - i]) < threshold) { r2 = SIZE - i; break; } }
  const trimmed = buf.slice(r1, r2);
  const newSize = trimmed.length;
  if (newSize < 2) return -1;

  const c = new Array(newSize).fill(0);
  for (let i = 0; i < newSize; i++) {
    for (let j = 0; j < newSize - i; j++) c[i] += trimmed[j] * trimmed[j + i];
  }

  let d = 0;
  while (d < newSize - 1 && c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < newSize; i++) {
    if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  }
  let T0 = maxpos;
  if (T0 <= 0 || T0 >= newSize - 1) return -1;

  const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);

  return T0 > 0 ? sampleRate / T0 : -1;
}

// Frequency-domain chroma vector (12 pitch classes), normalized to unit length
function computeChroma(analyser, sampleRate) {
  const freqData = new Float32Array(analyser.frequencyBinCount);
  analyser.getFloatFrequencyData(freqData);
  const chroma = new Array(12).fill(0);
  const nyquist = sampleRate / 2;
  const binHz = nyquist / freqData.length;
  for (let i = 1; i < freqData.length; i++) {
    const db = freqData[i];
    if (db < -70) continue;
    const freq = i * binHz;
    if (freq < 70 || freq > 1200) continue;
    const amplitude = Math.pow(10, db / 20);
    const noteNum = 12 * Math.log2(freq / 440) + 69;
    const pitchClass = ((Math.round(noteNum) % 12) + 12) % 12;
    chroma[pitchClass] += amplitude;
  }
  const mag = Math.sqrt(chroma.reduce((s, v) => s + v * v, 0)) || 1;
  return chroma.map(v => v / mag);
}

function chordChromaSimilarity(liveChroma, pitchClassSet) {
  const target = new Array(12).fill(0);
  pitchClassSet.forEach(pc => { target[pc] = 1; });
  const mag = Math.sqrt(target.reduce((s, v) => s + v * v, 0)) || 1;
  let dot = 0;
  for (let i = 0; i < 12; i++) dot += liveChroma[i] * (target[i] / mag);
  return dot;
}

function completeChordViaListen() {
  // targetKeys is cleared exactly once per round, by whichever completion path (this
  // one, or a tap-mode completion in handleFretClick) gets there first. Without this
  // guard, a chord held ringing would re-trigger this every ~4 frames until nextRound()
  // finally swaps chordNotes, and a simultaneous tap completion could double-fire it.
  if (targetKeys.size === 0) return;
  showListenBigCircles(chordNotes, CHORD_DEGREE_COLORS);
  targetKeys.clear();
  foundChordNotes = new Set(chordNotes);
  score++;
  scoreNumberEl.textContent = score;
  showWellDone();
  playChordTogether(chordNotes);
  setTimeout(playBigSuccess, 1300);
  nextRoundTimeout = setTimeout(nextRound, 2200);
}

function processListenFrame() {
  if (!listenOn) return;
  if (gameMode === 'chord') {
    const chroma = computeChroma(listenChordAnalyser, audioCtx.sampleRate);
    const targetPitchClasses = new Set(chordNotes.map(n => chromaticIdx[normalize(n)]));
    const sim = chordChromaSimilarity(chroma, targetPitchClasses);
    if (sim >= CHORD_MATCH_THRESHOLD) {
      chordMatchStreak++;
      if (chordMatchStreak >= CHORD_MATCH_FRAMES_NEEDED) {
        chordMatchStreak = 0;
        completeChordViaListen();
      }
    } else {
      chordMatchStreak = 0;
    }
  } else if (gameMode === 'single') {
    // Audio alone can never tell WHICH physical position produced a note (only which
    // note), so "find all positions" doesn't map to Listen input. Instead: any correct
    // pluck of the target note, in any octave, completes the round outright.
    const timeData = new Float32Array(listenAnalyser.fftSize);
    listenAnalyser.getFloatTimeDomainData(timeData);
    const rms = computeRMS(timeData);

    if (noteIsActive) {
      if (rms < ONSET_RELEASE_THRESHOLD) releaseStreak++;
      else releaseStreak = 0;
      if (releaseStreak >= RELEASE_FRAMES_NEEDED && performance.now() >= listenCooldownUntil) {
        noteIsActive = false;
        releaseStreak = 0;
      }
    } else if (rms >= ONSET_RMS_THRESHOLD) {
      const freq = autoCorrelate(timeData, audioCtx.sampleRate);
      if (freq > 0) {
        const detected = noteNameFromFreq(freq);
        if (Math.abs(detected.cents) <= PITCH_MATCH_CENTS) {
          if (detected.name === lastPitchMatchKey) pitchMatchStreak++;
          else { lastPitchMatchKey = detected.name; pitchMatchStreak = 1; }
          if (pitchMatchStreak >= PITCH_MATCH_FRAMES_NEEDED) {
            pitchMatchStreak = 0;
            lastPitchMatchKey = null;
            noteIsActive = true;
            listenCooldownUntil = performance.now() + ONSET_COOLDOWN_MS;
            if (detected.name === normalize(note)) {
              completeSingleNoteViaListen();
            } else {
              feedbackEl.textContent = 'Try again';
              feedbackEl.className = 'feedback incorrect';
              setTimeout(() => { if (feedbackEl.textContent === 'Try again') feedbackEl.className = 'feedback'; }, 1500);
            }
          }
        } else {
          pitchMatchStreak = 0;
          lastPitchMatchKey = null;
        }
      } else {
        pitchMatchStreak = 0;
        lastPitchMatchKey = null;
      }
    }
  } else {
    let remainingKeys;
    if (gameMode === 'freeplay') {
      remainingKeys = scaleGameActive ? [...scaleGameNotes].filter(k => !scaleGameFound.has(k)) : [];
    } else {
      remainingKeys = [...targetKeys];
    }
    if (remainingKeys.length > 0) {
      const timeData = new Float32Array(listenAnalyser.fftSize);
      listenAnalyser.getFloatTimeDomainData(timeData);
      const rms = computeRMS(timeData);

      if (noteIsActive) {
        // A note is already ringing — require several consecutive quiet frames (not
        // just one) AND the cooldown to elapse before treating it as released, so a
        // brief dip anywhere in a still-ringing note's envelope (tremolo, sympathetic
        // resonance) can't look like the note ending and a new one starting.
        if (rms < ONSET_RELEASE_THRESHOLD) releaseStreak++;
        else releaseStreak = 0;
        if (releaseStreak >= RELEASE_FRAMES_NEEDED && performance.now() >= listenCooldownUntil) {
          noteIsActive = false;
          releaseStreak = 0;
        }
      } else if (rms >= ONSET_RMS_THRESHOLD) {
        const freq = autoCorrelate(timeData, audioCtx.sampleRate);
        let bestKey = null, bestCents = Infinity;
        if (freq > 0) {
          remainingKeys.forEach(key => {
            const stringNum = parseInt(key.match(/string-(\d+)/)[1]);
            if (lockedStrings.has(stringNum)) return;
            const keyFreq = freqFromKey(key);
            const cents = Math.abs(centsOff(freq, keyFreq));
            if (cents < bestCents) { bestCents = cents; bestKey = key; }
          });
        }
        const matchToken = (bestKey && bestCents <= PITCH_MATCH_CENTS) ? bestKey : (freq > 0 ? 'wrong' : null);
        if (matchToken) {
          if (matchToken === lastPitchMatchKey) pitchMatchStreak++;
          else { lastPitchMatchKey = matchToken; pitchMatchStreak = 1; }
          if (pitchMatchStreak >= PITCH_MATCH_FRAMES_NEEDED) {
            pitchMatchStreak = 0;
            lastPitchMatchKey = null;
            noteIsActive = true;
            listenCooldownUntil = performance.now() + ONSET_COOLDOWN_MS;
            if (matchToken === 'wrong') {
              feedbackEl.textContent = 'Try again';
              feedbackEl.className = 'feedback incorrect';
              setTimeout(() => { if (feedbackEl.textContent === 'Try again') feedbackEl.className = 'feedback'; }, 1500);
            } else {
              handleFretClick({ currentTarget: { dataset: { key: bestKey } } });
            }
          }
        } else {
          pitchMatchStreak = 0;
          lastPitchMatchKey = null;
        }
      }
    }
  }
  listenRafId = requestAnimationFrame(processListenFrame);
}

let listenStarting = false;

async function startListening() {
  // listenOn only becomes true after getUserMedia resolves below, so without this guard
  // a second click on the Listen button while the first request is still pending would
  // re-enter this function and create a second, orphaned analyser/rAF chain.
  if (listenStarting) return;
  listenStarting = true;
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('getUserMedia not available (navigator.mediaDevices missing)');
    }
    listenStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    const source = audioCtx.createMediaStreamSource(listenStream);
    listenAnalyser = audioCtx.createAnalyser();
    listenAnalyser.fftSize = 2048;
    source.connect(listenAnalyser);
    // Separate, much higher-resolution analyser just for chord chroma detection:
    // at 2048 the FFT bin width (~21Hz) is wider than the gap between adjacent low
    // guitar notes (~5Hz around E2/F2), smearing energy across the wrong pitch
    // classes. Kept as a second node so the monophonic autocorrelation (which reads
    // a time-domain buffer sized off fftSize too) doesn't get a much bigger, slower
    // buffer it doesn't need.
    listenChordAnalyser = audioCtx.createAnalyser();
    listenChordAnalyser.fftSize = 16384;
    source.connect(listenChordAnalyser);
    listenOn = true;
    pitchMatchStreak = 0;
    lastPitchMatchKey = null;
    chordMatchStreak = 0;
    noteIsActive = false;
    listenCooldownUntil = 0;
    releaseStreak = 0;
    listenWrapper.classList.remove('listen-error');
    listenWrapper.classList.add('listen-active');
    listenStatusEl.textContent = 'Off';
    listenStarting = false;
    processListenFrame();
  } catch (err) {
    console.error('Listen failed to start:', err);
    if (listenStream) { listenStream.getTracks().forEach(t => t.stop()); listenStream = null; }
    listenOn = false;
    listenStarting = false;
    listenWrapper.classList.remove('listen-active');
    listenWrapper.classList.add('listen-error');
    listenStatusEl.textContent = 'On';
    alert('Listen error: ' + (err.name || 'Error') + ': ' + (err.message || err));
  }
}

function stopListening() {
  listenOn = false;
  if (listenRafId) cancelAnimationFrame(listenRafId);
  listenRafId = null;
  if (listenStream) listenStream.getTracks().forEach(t => t.stop());
  listenStream = null;
  listenAnalyser = null;
  listenChordAnalyser = null;
  hideListenBigCircles();
  if (listenWrapper) listenWrapper.classList.remove('listen-active');
  if (listenStatusEl) listenStatusEl.textContent = 'On';
}

if (listenWrapper) {
  listenWrapper.addEventListener('click', () => {
    if (listenOn) stopListening();
    else startListening();
  });
}

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
  "btn1-string-6": { dx: 18, dy: 0 },
  "btn1-string-5": { dx: 49, dy: 0 },
  "btn1-string-4": { dx: 84, dy: 0 },
  "btn1-string-3": { dx: 103, dy: 0 },
  "btn1-string-2": { dx: 47, dy: 0 },
  "btn1-string-1": { dx: -2, dy: 0 },
  "btn2-string-6": { dx: 20, dy: 72 },
  "btn2-string-5": { dx: 46, dy: 72 },
  "btn2-string-4": { dx: 84, dy: 72 },
  "btn2-string-3": { dx: 106, dy: 72 },
  "btn2-string-2": { dx: 46, dy: 72 },
  "btn2-string-1": { dx: -12, dy: 72 },
  "btn3-string-6": { dx: 17, dy: 103 },
  "btn3-string-5": { dx: 48, dy: 103 },
  "btn3-string-4": { dx: 84, dy: 103 },
  "btn3-string-3": { dx: 106, dy: 103 },
  "btn3-string-2": { dx: 46, dy: 103 },
  "btn3-string-1": { dx: -5, dy: 103 },
  "btn4-string-6": { dx: 16, dy: 118 },
  "btn4-string-5": { dx: 53, dy: 118 },
  "btn4-string-4": { dx: 85, dy: 118 },
  "btn4-string-3": { dx: 109, dy: 118 },
  "btn4-string-2": { dx: 51, dy: 118 },
  "btn4-string-1": { dx: -10, dy: 118 },
  "btn5-string-6": { dx: 22, dy: 160 },
  "btn5-string-5": { dx: 64, dy: 160 },
  "btn5-string-4": { dx: 85, dy: 160 },
  "btn5-string-3": { dx: 111, dy: 160 },
  "btn5-string-2": { dx: 49, dy: 160 },
  "btn5-string-1": { dx: 1, dy: 160 },
  "btn6-string-6": { dx: 19, dy: 217 },
  "btn6-string-5": { dx: 52, dy: 217 },
  "btn6-string-4": { dx: 88, dy: 217 },
  "btn6-string-3": { dx: 111, dy: 217 },
  "btn6-string-2": { dx: 51, dy: 217 },
  "btn6-string-1": { dx: -9, dy: 217 },
  "btn7-string-6": { dx: 21, dy: 260 },
  "btn7-string-5": { dx: 53, dy: 260 },
  "btn7-string-4": { dx: 88, dy: 260 },
  "btn7-string-3": { dx: 114, dy: 260 },
  "btn7-string-2": { dx: 50, dy: 260 },
  "btn7-string-1": { dx: -10, dy: 260 },
  "btn8-string-6": { dx: 35, dy: 302 },
  "btn8-string-5": { dx: 61, dy: 302 },
  "btn8-string-4": { dx: 90, dy: 302 },
  "btn8-string-3": { dx: 123, dy: 302 },
  "btn8-string-2": { dx: 68, dy: 302 },
  "btn8-string-1": { dx: 6, dy: 302 },
  "btn9-string-6": { dx: 21, dy: 346 },
  "btn9-string-5": { dx: 54, dy: 346 },
  "btn9-string-4": { dx: 89, dy: 346 },
  "btn9-string-3": { dx: 120, dy: 346 },
  "btn9-string-2": { dx: 59, dy: 346 },
  "btn9-string-1": { dx: -4, dy: 346 },
  "btn10-string-6": { dx: 23, dy: 386 },
  "btn10-string-5": { dx: 56, dy: 386 },
  "btn10-string-4": { dx: 92, dy: 386 },
  "btn10-string-3": { dx: 123, dy: 386 },
  "btn10-string-2": { dx: 61, dy: 386 },
  "btn10-string-1": { dx: -5, dy: 386 },
  "btn11-string-6": { dx: 34, dy: 423 },
  "btn11-string-5": { dx: 60, dy: 423 },
  "btn11-string-4": { dx: 94, dy: 423 },
  "btn11-string-3": { dx: 126, dy: 423 },
  "btn11-string-2": { dx: 64, dy: 423 },
  "btn11-string-1": { dx: 1, dy: 423 },
  "btn12-string-6": { dx: 23, dy: 460 },
  "btn12-string-5": { dx: 59, dy: 460 },
  "btn12-string-4": { dx: 93, dy: 460 },
  "btn12-string-3": { dx: 126, dy: 460 },
  "btn12-string-2": { dx: 60, dy: 460 },
  "btn12-string-1": { dx: -4, dy: 460 },
  "btn13-string-6": { dx: 22, dy: 485 },
  "btn13-string-5": { dx: 60, dy: 485 },
  "btn13-string-4": { dx: 90, dy: 485 },
  "btn13-string-3": { dx: 124, dy: 485 },
  "btn13-string-2": { dx: 63, dy: 485 },
  "btn13-string-1": { dx: -5, dy: 485 },
};

function initSvgGrid() {
  const svg = document.getElementById('fret-svg');
  const NS = 'http://www.w3.org/2000/svg';
  const barreLineEl = document.createElementNS(NS, 'line');
  barreLineEl.setAttribute('id', 'barre-peek-line');
  barreLineEl.setAttribute('stroke', 'rgb(180,180,180)');
  barreLineEl.setAttribute('stroke-width', '18');
  barreLineEl.setAttribute('stroke-linecap', 'round');
  barreLineEl.setAttribute('opacity', '0');
  barreLineEl.setAttribute('pointer-events', 'none');
  svg.appendChild(barreLineEl);
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
      scaleNoteCircle.setAttribute('r', '30'); scaleNoteCircle.setAttribute('fill', 'rgb(230,126,34)');
      scaleNoteCircle.setAttribute('opacity', '0'); scaleNoteCircle.setAttribute('pointer-events', 'none');

      const rootHlCircle = document.createElementNS(NS, 'circle');
      rootHlCircle.setAttribute('cx', xCtr); rootHlCircle.setAttribute('cy', yCtr2);
      rootHlCircle.setAttribute('r', '30'); rootHlCircle.setAttribute('fill', 'rgb(139,0,0)');
      rootHlCircle.setAttribute('opacity', '0'); rootHlCircle.setAttribute('pointer-events', 'none');

      const bluesHlCircle = document.createElementNS(NS, 'circle');
      bluesHlCircle.setAttribute('cx', xCtr); bluesHlCircle.setAttribute('cy', yCtr2);
      bluesHlCircle.setAttribute('r', '30'); bluesHlCircle.setAttribute('fill', 'rgb(15,45,140)');
      bluesHlCircle.setAttribute('opacity', '0'); bluesHlCircle.setAttribute('pointer-events', 'none');

      const extraHlCircle = document.createElementNS(NS, 'circle');
      extraHlCircle.setAttribute('cx', xCtr); extraHlCircle.setAttribute('cy', yCtr2);
      extraHlCircle.setAttribute('r', '30'); extraHlCircle.setAttribute('fill', 'rgb(216,190,0)');
      extraHlCircle.setAttribute('opacity', '0'); extraHlCircle.setAttribute('pointer-events', 'none');

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

      const extraHlText = document.createElementNS(NS, 'text');
      extraHlText.setAttribute('x', xCtr); extraHlText.setAttribute('y', yCtr2 + 12);
      extraHlText.setAttribute('text-anchor', 'middle'); extraHlText.setAttribute('fill', 'white');
      extraHlText.setAttribute('font-size', '32'); extraHlText.setAttribute('font-weight', 'bold');
      extraHlText.setAttribute('font-family', 'system-ui, sans-serif');
      extraHlText.setAttribute('pointer-events', 'none'); extraHlText.setAttribute('opacity', '0');
      extraHlText.textContent = 'B';

      svg.appendChild(scaleNoteCircle); svg.appendChild(rootHlCircle); svg.appendChild(bluesHlCircle); svg.appendChild(extraHlCircle);
      svg.appendChild(rootHlText); svg.appendChild(bluesHlText); svg.appendChild(extraHlText);
      svg.appendChild(rect); svg.appendChild(circle); svg.appendChild(text);
      svgCells[key] = { rect, circle, text, scaleNoteCircle, rootHlCircle, bluesHlCircle, extraHlCircle, rootHlText, bluesHlText, extraHlText };
      rect.addEventListener('click', handleFretClick);
      rect.addEventListener('pointerdown', () => {
        if (!document.body.classList.contains('scales-mode')) return;
        const cell = svgCells[key];
        const dotMap = [
          { el: cell.scaleNoteCircle, orig: 'rgb(230,126,34)' },
          { el: cell.rootHlCircle,    orig: 'rgb(139,0,0)' },
          { el: cell.bluesHlCircle,   orig: 'rgb(15,45,140)' },
          { el: cell.extraHlCircle,   orig: 'rgb(216,190,0)' }
        ];
        for (const { el } of dotMap) {
          if (el.getAttribute('opacity') === '1') {
            el.setAttribute('fill', 'darkorange');
            el._origFill = dotMap.find(d => d.el === el).orig;
          }
        }
      });
      const restoreScaleDot = () => {
        if (!document.body.classList.contains('scales-mode')) return;
        const cell = svgCells[key];
        const dotMap = [
          { el: cell.scaleNoteCircle, orig: 'rgb(230,126,34)' },
          { el: cell.rootHlCircle,    orig: 'rgb(139,0,0)' },
          { el: cell.bluesHlCircle,   orig: 'rgb(15,45,140)' },
          { el: cell.extraHlCircle,   orig: 'rgb(216,190,0)' }
        ];
        setTimeout(() => {
          for (const { el, orig } of dotMap) {
            if (el.getAttribute('opacity') === '1') el.setAttribute('fill', orig);
          }
        }, 300);
      };
      rect.addEventListener('pointerup', restoreScaleDot);
      rect.addEventListener('pointercancel', restoreScaleDot);
    }
  }

  const bigCircleCx = 380.5;
  for (let i = 0; i < CHORD_DEGREE_COLORS.length; i++) {
    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('cx', bigCircleCx);
    circle.setAttribute('r', '65');
    circle.setAttribute('opacity', '0');
    circle.setAttribute('pointer-events', 'none');
    const text = document.createElementNS(NS, 'text');
    text.setAttribute('x', bigCircleCx);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('fill', 'white');
    text.setAttribute('font-size', '44');
    text.setAttribute('font-weight', 'bold');
    text.setAttribute('font-family', 'system-ui, sans-serif');
    text.setAttribute('direction', 'ltr');
    text.setAttribute('unicode-bidi', 'bidi-override');
    text.setAttribute('opacity', '0');
    text.setAttribute('pointer-events', 'none');
    svg.appendChild(circle);
    svg.appendChild(text);
    listenBigCircles.push({ circle, text });
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
  ripple.setAttribute('fill', 'rgba(100,180,255,0.75)');
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
  if (gameMode === 'basicchord' && !bothCatGroupsSelected()) { flashBasicChordHint(); return; }
  showTapRipple(key);
  playNote(freqFromKey(key));
  if (gameMode === 'freeplaying') return;
  if (gameMode === 'freeplay') {
    if (scaleGameActive && scaleGameNotes.size > 0) {
      if (scaleGameNotes.has(key) && !scaleGameFound.has(key)) {
        scaleGameFound.add(key);
        const activeSvgScale = document.querySelector('.scale-btn.active');
        const scaleName = activeSvgScale ? activeSvgScale.dataset.scale : null;
        const d = scaleName ? scaleData[scaleName] : null;
        showScaleNoteFound(key, d);
        playSuccess();
        feedbackEl.textContent = 'Good job!';
        feedbackEl.className = 'feedback correct';
        score++;
        scoreNumberEl.textContent = score;
        setTimeout(() => { if (feedbackEl.textContent === 'Good job!') feedbackEl.className = 'feedback'; }, 1500);
        if (scaleGameFound.size === scaleGameNotes.size) {
          scaleGameActive = false;
          showWellDone();
          setTimeout(playBigSuccess, 300);
          instracEl.innerHTML = 'Tap Try Again<br>or choose<br>another scale';
        }
      } else if (!scaleGameNotes.has(key)) {
        feedbackEl.textContent = 'Try again';
        feedbackEl.className = 'feedback incorrect';
        setTimeout(() => { if (feedbackEl.textContent === 'Try again') feedbackEl.className = 'feedback'; }, 1500);
      }
    }
    return;
  }
  if (gameMode === 'basicchord') {
    if (document.body.classList.contains('basic-study-phase')) return;
    if (targetKeys.has(key)) {
      targetKeys.delete(key);
      applyDegreeToKey(key);
      const found = basicStudyKeys.length - targetKeys.size;
      instracEl.textContent = `Find: ${found} / ${basicStudyKeys.length}`;
      if (targetKeys.size === 0) {
        score++;
        scoreNumberEl.textContent = score;
        showWellDone();
        playChordTogether(basicStudyKeys.map(k => neckNotes[k]).filter(Boolean));
        setTimeout(playBigSuccess, 1300);
        basicChordContinueBtn.classList.add('show');
      } else {
        playSuccess();
      }
    } else {
      feedbackEl.textContent = 'Try again';
      feedbackEl.className = 'feedback incorrect';
      setTimeout(() => {
        if (feedbackEl.textContent === 'Try again') feedbackEl.className = 'feedback';
      }, 1500);
    }
    return;
  }
  const btnNote = normalize(neckNotes[key]);
  const isCorrect = gameMode === 'chord'
    ? chordNotes.map(normalize).includes(btnNote)
    : btnNote === normalize(note);
  if (isCorrect) {
    if (!targetKeys.has(key)) return;
    targetKeys.delete(key);
    if (!applyDegreeToKey(key)) {
      svgCells[key].circle.setAttribute('fill', 'darkorange');
      svgCells[key].circle.setAttribute('opacity', '1');
    }
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

const HIGH_SCORE_MODES = {
  single: 'Single Note',
  triads: 'Triads',
  fourInverts: '7th Inversions',
  slash: 'Slash Chords',
  sevenths: '7th Chords',
  freeplay: 'Scales',
  basicchord: 'Beginners Trainer'
};

function getCurrentModeKey() {
  if (gameMode === 'chord') return chordMode;
  return gameMode;
}

function showScoreToast(scored, isNewRecord, avgSeconds) {
  const existing = document.getElementById('score-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'score-toast';
  toast.dir = 'ltr';
  toast.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:white;padding:16px 28px;border-radius:14px;font-family:system-ui,sans-serif;text-align:center;z-index:2000;box-shadow:0 4px 24px rgba(0,0,0,0.6);opacity:1;transition:opacity 0.4s;white-space:nowrap;';
  const avgLine = avgSeconds != null ? `<div style="font-size:14px;color:rgba(255,255,255,0.7);margin-top:6px;">Avg time per round: ${formatTimerSeconds(avgSeconds)}</div>` : '';
  toast.innerHTML = `<div style="font-size:20px;font-weight:bold;margin-bottom:${isNewRecord ? 6 : 0}px;">You scored ${scored} points!</div>${isNewRecord ? '<div style="font-size:14px;color:#ffd700;letter-spacing:1px;">NEW HIGH SCORE!</div>' : ''}${avgLine}`;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 5000);
}

homeBtn.addEventListener('click', () => {
  if (document.body.classList.contains('school-lesson-active')) {
    exitSchoolLesson();
    return;
  }
  if (listenOn) stopListening();
  const modeKey = getCurrentModeKey();
  if (score > 0 && HIGH_SCORE_MODES[modeKey]) {
    const storageKey = `hs_${modeKey}`;
    const prev = parseInt(localStorage.getItem(storageKey) || '0');
    const isNew = score > prev;
    if (isNew) localStorage.setItem(storageKey, score);
    const avgSeconds = timerRoundCount > 0 ? Math.round(timerRoundTotal / timerRoundCount) : null;
    showScoreToast(score, isNew, avgSeconds);
  }
  document.body.classList.remove('greed-mode', 'four-chord-mode', 'free-play-mode', 'scales-mode', 'slash-chord-mode', 'basic-chord-mode', 'basic-study-phase', 'three-chord-mode', 'four-inverts-mode', 'free-playing-mode', 'single-note-mode', 'school-mode', 'school-lesson-active');
  instracEl.classList.remove('instrac-blink');
  document.querySelectorAll('.basic-chord-cat-btn').forEach(b => b.classList.remove('active'));
  basicChordContinueBtn.classList.remove('show');
  scaleSelector.classList.remove('has-open');
  document.querySelectorAll('.scale-group').forEach(g => g.classList.remove('open'));
  clearScaleHighlights();
  score = 0;
  timerRoundTotal = 0;
  timerRoundCount = 0;
  timerSeconds = 0;
  timerCarryover = 0;
  scoreNumberEl.textContent = 0;
});

document.getElementById('bass-btn').addEventListener('click', () => {
  bassMode = !bassMode;
  document.body.classList.toggle('bass-mode', bassMode);
  document.getElementById('bass-btn').classList.toggle('active', bassMode);
  document.getElementById('bass-btn-img').src = bassMode ? 'guitarHead.png' : 'bassHead.png';
  document.getElementById('mode-label').textContent = bassMode ? 'Bass Mode Trainer' : 'Guitar Mode Trainer';
  document.getElementById('bass-btn-label').textContent = bassMode ? 'Go Guitar' : 'Go Bass';
  const inSetMode = document.body.classList.contains('three-chord-mode') || document.body.classList.contains('four-inverts-mode');
  if (inSetMode) {
    lockedStrings.clear();
    document.querySelectorAll('.str-btn').forEach(b => b.classList.remove('locked'));
    document.querySelectorAll('.three-chord-set-btn, .four-inverts-set-btn').forEach(b => b.classList.remove('active'));
  }
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
  if (gameMode === 'single') {
    // Switching bass/guitar changes which clef and which frets are reachable —
    // re-pick a valid octave tier and redraw so the round stays winnable.
    randomizeStaffOctaveChoice(note);
    renderSingleNoteDisplay(note);
    highlightNotes(note);
  }
});

nextBtn.addEventListener('click', () => {
  nextRound();
});

const headLineEl = document.querySelector('.headLine');
const rootDisplayEl = document.querySelector('.rootDisplay');
const no5thNote = document.querySelector('.no5th-note');
const noteNameDisplay = document.querySelector('.noteNameDisplay');
const scoreNumberEl = document.querySelector('.score-number');
const instracEl = document.querySelector('.Instrac');
const muteBtn = document.querySelector('.mute-btn');
const peekBtn = document.querySelector('.peek-btn');
const peekLabel = document.querySelector('.peek-label');
const peekWrapper = document.querySelector('.peek-wrapper');

function getPeekKeys() {
  return Array.from(targetKeys);
}

function applyDegreeToKey(key) {
  if (!svgCells[key] || !chordNotes || !chordNotes.length) return false;
  const isTension = gameMode === 'chord' && document.body.classList.contains('four-chord-mode');
  const isSlash   = gameMode === 'chord' && document.body.classList.contains('slash-chord-mode');
  const isDegree  = (gameMode === 'chord' && (
    document.body.classList.contains('three-chord-mode') ||
    document.body.classList.contains('four-inverts-mode') ||
    isTension
  )) || gameMode === 'basicchord' || isSlash;
  if (!isDegree) return false;

  const degreeColors = CHORD_DEGREE_COLORS;
  const n = normalize(neckNotes[key]);
  const rootSemitone = chromaticIdx[normalize(chordNotes[0])] ?? 0;
  const semitones = (chromaticIdx[n] - rootSemitone + 12) % 12;
  let fill, label;

  if (isSlash) {
    const idx = chordNotes.findIndex(cn => normalize(cn) === n);
    if (idx === -1) { svgCells[key].circle.setAttribute('opacity', '0'); return true; }
    const bassNote = currentChordName.includes('/') ? normalize(currentChordName.slice(currentChordName.indexOf('/') + 1)) : null;
    const strNum = parseInt(key.match(/string-(\d+)/)[1]);
    if (n === bassNote) {
      if (strNum !== 5 && strNum !== 6) { svgCells[key].circle.setAttribute('opacity', '0'); return true; }
      fill = 'rgb(30,80,180)'; label = 'B';
    } else {
      const di = chordNotes.length === 4 ? idx - 1 : idx;
      fill = degreeColors[di] || 'darkorange';
      label = intervalToDegreeLabel(semitones);
    }
  } else {
    const idx = chordNotes.findIndex(cn => normalize(cn) === n);
    if (idx === -1) { svgCells[key].circle.setAttribute('opacity', '0'); return true; }
    if (isTension && idx === 3) {
      fill = 'rgb(120,40,180)'; label = getTensionLabel(currentChordName);
    } else {
      fill = degreeColors[idx] || 'darkorange';
      label = intervalToDegreeLabel(semitones);
    }
  }

  const fontSize = label.length >= 3 ? '22' : label.length === 2 ? '28' : '36';
  svgCells[key].circle.setAttribute('fill', fill);
  svgCells[key].circle.setAttribute('opacity', '1');
  svgCells[key].text.textContent = label;
  svgCells[key].text.setAttribute('font-size', fontSize);
  svgCells[key].text.setAttribute('font-family', 'Arial, sans-serif');
  svgCells[key].text.setAttribute('y', svgCells[key].circle.getAttribute('cy'));
  svgCells[key].text.setAttribute('dominant-baseline', 'central');
  svgCells[key].text.setAttribute('opacity', '1');
  return true;
}

function showPeek() {
  const keys = getPeekKeys();
  keys.forEach(key => {
    if (!svgCells[key]) return;
    if (!applyDegreeToKey(key)) {
      svgCells[key].circle.setAttribute('fill', 'darkorange');
      svgCells[key].circle.setAttribute('opacity', '1');
    }
  });
  showBarrePeekLine();
}

function showBarrePeekLine() {
  const lineEl = document.getElementById('barre-peek-line');
  if (!lineEl || gameMode !== 'basicchord' || targetKeys.size === 0) return;
  const minFret = Math.min(...Array.from(targetKeys).map(k => parseInt(k.match(/btn(\d+)/)[1])));
  const barreKeys = Array.from(targetKeys).filter(k => parseInt(k.match(/btn(\d+)/)[1]) === minFret);
  if (barreKeys.length < 2) return;
  const xs = barreKeys.map(k => parseFloat(svgCells[k].circle.getAttribute('cx')));
  const y = parseFloat(svgCells[barreKeys[0]].circle.getAttribute('cy'));
  lineEl.setAttribute('x1', String(Math.min(...xs)));
  lineEl.setAttribute('y1', String(y));
  lineEl.setAttribute('x2', String(Math.max(...xs)));
  lineEl.setAttribute('y2', String(y));
  lineEl.setAttribute('opacity', '1');
}

function hidePeek() {
  const keys = getPeekKeys();
  keys.forEach(key => {
    if (svgCells[key]) {
      svgCells[key].circle.setAttribute('opacity', '0');
      svgCells[key].circle.setAttribute('fill', 'darkorange');
      svgCells[key].text.setAttribute('opacity', '0');
      svgCells[key].text.setAttribute('font-size', '28');
      svgCells[key].text.setAttribute('font-family', '');
      svgCells[key].text.setAttribute('y', String(parseFloat(svgCells[key].circle.getAttribute('cy')) + 6));
      svgCells[key].text.setAttribute('dominant-baseline', 'auto');
      svgCells[key].text.textContent = 'X';
    }
  });
  const barreEl = document.getElementById('barre-peek-line');
  if (barreEl) barreEl.setAttribute('opacity', '0');
}

let schoolNotesShown = false;

function updatePeekLabel() {
  if (!peekLabel) return;
  if (document.body.classList.contains('school-lesson-active')) {
    peekLabel.innerHTML = `<img src="eya.png" class="peek-icon" alt="show" /><br>${schoolNotesShown ? 'Hide' : 'Show'}<br>Notes`;
    if (peekWrapper) peekWrapper.classList.toggle('notes-shown', schoolNotesShown);
    return;
  }
  const word = (gameMode === 'single' || gameMode === 'freeplay' || gameMode === 'basicchord') ? 'Notes' : 'Chords';
  peekLabel.innerHTML = `<img src="eya.png" class="peek-icon" alt="show" /><br>Show<br>${word}`;
  if (peekWrapper) peekWrapper.classList.remove('notes-shown');
}

const scoreLabelSmEl = document.querySelector('.score-label-sm');

// Repurposes the existing Score line's two spans in place (rather than replacing
// them) -- scoreNumberEl is cached once at load, so overwriting its parent's
// innerHTML would detach it and silently break every future score update.
function setSchoolClassLabel() {
  if (scoreLabelSmEl) { scoreLabelSmEl.textContent = 'Class'; scoreLabelSmEl.style.opacity = '1'; }
  if (scoreNumberEl) scoreNumberEl.textContent = activeClassNumber;
}

function restoreScoreLabel() {
  if (scoreLabelSmEl) { scoreLabelSmEl.textContent = 'Score'; scoreLabelSmEl.style.opacity = ''; }
  if (scoreNumberEl) scoreNumberEl.textContent = score;
}

// Re-applies the School lesson's headline and (if the user toggled it on) the
// permanent notes display to whatever new round just started -- covers every
// path a round can restart from: Next button, Listen completion, tap completion.
function refreshSchoolLessonUI() {
  if (!document.body.classList.contains('school-lesson-active')) return;
  headLineEl.textContent = LESSON_TITLES[activeClassNumber] || ('Lesson ' + activeClassNumber);
  setSchoolClassLabel();
  if (schoolNotesShown) { if (targetKeys.size > 0) showPeek(); } else { hidePeek(); }
}

let instracFlashTimeout = null;
let hintFlashTimeout = null;
const basicChordHintEl = document.querySelector('.basic-chord-hint');
const basicChordContinueBtn = document.querySelector('.basic-chord-continue-btn');

basicChordContinueBtn.addEventListener('click', () => {
  basicChordContinueBtn.classList.remove('show');
  playContinueClick();
  startBasicChordRound();
  refreshSchoolLessonUI();
});


function flashBasicChordHint() {
  if (!basicChordHintEl) return;
  basicChordHintEl.style.color = 'darkorange';
  clearTimeout(hintFlashTimeout);
  hintFlashTimeout = setTimeout(() => { basicChordHintEl.style.color = ''; }, 3000);
}

function bothCatGroupsSelected() {
  const g1 = document.querySelector('.basic-chord-cat-btn[data-cat="open"].active, .basic-chord-cat-btn[data-cat="barre"].active');
  if (!g1) return false;
  if (g1.dataset.cat === 'open') return true;
  const g2 = document.querySelector('.basic-chord-cat-btn[data-cat="root6"].active, .basic-chord-cat-btn[data-cat="root5"].active');
  return !!(g2);
}

peekBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();

  if (document.body.classList.contains('school-lesson-active')) {
    schoolNotesShown = !schoolNotesShown;
    if (schoolNotesShown) { if (targetKeys.size > 0) showPeek(); } else { hidePeek(); }
    updatePeekLabel();
    return;
  }

  if (gameMode === 'freeplay' && scaleGameActive) {
    const activeBtn = document.querySelector('.scale-btn.active');
    if (!activeBtn) return;
    const d = scaleData[activeBtn.dataset.scale];
    if (!d) return;
    const skipKey = k => bassMode && parseInt(k.match(/string-(\d+)/)[1]) <= 2;
    (d.notes||[]).forEach(k => { if (svgCells[k] && !skipKey(k) && !scaleGameFound.has(k)) svgCells[k].scaleNoteCircle.setAttribute('opacity','1'); });
    (d.roots||[]).forEach(k => { if (svgCells[k] && !skipKey(k) && !scaleGameFound.has(k)) { svgCells[k].rootHlCircle.setAttribute('opacity','1'); svgCells[k].rootHlText.setAttribute('opacity','1'); } });
    (d.blues||[]).forEach(k => { if (svgCells[k] && !skipKey(k) && !scaleGameFound.has(k)) { svgCells[k].bluesHlCircle.setAttribute('opacity','1'); svgCells[k].bluesHlText.setAttribute('opacity','1'); } });
    (d.extra||[]).forEach(k => { if (svgCells[k] && !skipKey(k) && !scaleGameFound.has(k)) { svgCells[k].extraHlCircle.setAttribute('opacity','1'); svgCells[k].extraHlText.setAttribute('opacity','1'); } });
    return;
  }

  if (gameMode === 'basicchord') {
    const g1 = document.querySelector('.basic-chord-cat-btn[data-cat="open"].active, .basic-chord-cat-btn[data-cat="barre"].active');
    if (!bothCatGroupsSelected()) { flashBasicChordHint(); return; }
    if (!g1 || targetKeys.size === 0) {
      instracEl.style.color = 'darkorange';
      clearTimeout(instracFlashTimeout);
      instracFlashTimeout = setTimeout(() => { instracEl.style.color = ''; }, 3000);
      return;
    }
  }
  if (targetKeys.size === 0) return;
  showPeek();
});

peekBtn.addEventListener('pointerup', () => {
  if (document.body.classList.contains('school-lesson-active')) return;
  if (gameMode === 'freeplay' && scaleGameActive) {
    scaleGameNotes.forEach(k => {
      if (!scaleGameFound.has(k) && svgCells[k]) {
        svgCells[k].scaleNoteCircle.setAttribute('opacity','0');
        svgCells[k].rootHlCircle.setAttribute('opacity','0');
        svgCells[k].rootHlText.setAttribute('opacity','0');
        svgCells[k].bluesHlCircle.setAttribute('opacity','0');
        svgCells[k].bluesHlText.setAttribute('opacity','0');
        svgCells[k].extraHlCircle.setAttribute('opacity','0');
        svgCells[k].extraHlText.setAttribute('opacity','0');
      }
    });
    return;
  }
  hidePeek();
});
peekBtn.addEventListener('pointerleave', () => {
  if (document.body.classList.contains('school-lesson-active')) return;
  if (gameMode === 'freeplay' && scaleGameActive) {
    scaleGameNotes.forEach(k => {
      if (!scaleGameFound.has(k) && svgCells[k]) {
        svgCells[k].scaleNoteCircle.setAttribute('opacity','0');
        svgCells[k].rootHlCircle.setAttribute('opacity','0');
        svgCells[k].rootHlText.setAttribute('opacity','0');
        svgCells[k].bluesHlCircle.setAttribute('opacity','0');
        svgCells[k].bluesHlText.setAttribute('opacity','0');
        svgCells[k].extraHlCircle.setAttribute('opacity','0');
        svgCells[k].extraHlText.setAttribute('opacity','0');
      }
    });
    return;
  }
  hidePeek();
});

const bassModeInstructions = {
  'greed-mode':        '• A note name appears on screen.\nFind all its positions on the fretboard.\n\n• Use the string lock buttons to focus on specific strings if needed.\n\n• To display the note on a music staff (F clef for bass), tap the Notes button.\n\n• Tap the Timer button to time how long each round takes you.',
  'three-chord-mode':  '• Find the 3 notes of the displayed chord.\n• For deeper practice, try placing the root note on a different string each time.\n\n• Tap the Timer button to time how long each round takes you.',
  'four-inverts-mode': '• Find the chord tones shown on screen.\n• For deeper practice, try placing the root note on a different string each time.\n\n• Tap the Timer button to time how long each round takes you.',
};

const modeInstructions = {
  'three-chord-mode': '• Choose a string set, then find a triad inversion of the displayed chord.\n\n• For deeper practice, try placing the root on a different string each time.\n\n• Tap Show Notes if needed.\n\n• Use the "Free Grid" button to practice inversions and arpeggios freely across the entire fretboard.\n\n• For open string notes, tap the top of the grid.\n\n• Tap the Timer button to time how long each round takes you.',
  'four-inverts-mode':'• Choose a string set, then find a 7th chord inversion.\n\n• For deeper practice, try placing the root on a different string each time.\n\n• Tap Show Notes if needed.\n\n• Use the "Free Grid" button to practice inversions and arpeggios freely across the entire fretboard.\n\n• For open string notes, tap the top of the grid.\n\n• Tap the Timer button to time how long each round takes you.',
  'slash-chord-mode': '• Find the chord tones on the fretboard.\n\n• Place the note after the slash as the lowest bass note of the chord.\n\n• Tap Show Notes if needed.\n\n• For open string notes, tap the top of the grid.\n\n• Tap the Timer button to time how long each round takes you.',
  'four-chord-mode':  '• Find the chord tones.\n\n• Use the string lock buttons to practice on a specific string set if needed.\n\n• The 5th is optional.\n\n• Tap Show Notes if needed.\n\n• For open string notes, tap the top of the grid.\n\n• Tap the Timer button to time how long each round takes you.',
  'scales-mode':      '• Choose a scale — the notes will appear on the fretboard for a few seconds, then disappear.\n\n• Try to remember and find them.\n\n• If you\'re struggling, use the Show Notes button.\n\n• For convenience, the scale root is set on the note G.\n\n• Tap the Timer button to time how long each round takes you.',
  'basic-chord-mode': '• To practice Open Chords — tap "Open Chords".\n\n• To practice Barre Chords — tap "Barre Chords", then choose a root on string 5 or 6.\n\n• Find the chord tones on the fretboard.\n\n• Use Show Notes if you need a hint.\n\n• For open string notes, tap the top of the grid.\n\n• Tap the Timer button to time how long each round takes you.',
  'free-playing-mode':'• Tap any fret to hear the note.\n• Explore freely with no scoring or goals.\n• Try to play something nice :-)',
  'greed-mode':       '• A note name appears on screen.\nFind all its positions on the fretboard.\n\n• Use the string lock buttons to focus on specific strings if needed.\n\n• Tap the Show Notes button if needed.\n\n• To display the note on a music staff (G Clef), tap the Notes button.\n\n• Beginners: start by learning notes on strings 5 & 6 — these are where barre chord roots appear.\n\n• For open string notes, tap the top of the grid.\n\n• Tap the Timer button to time how long each round takes you.',
};

const LESSON_HOWTO = {
  1: '• Find notes on string 6.\n\n• Press Hide Notes if you want to practice without seeing the notes on the grid.\n\n• Use the Timer button to challenge yourself on time.\n\n• To practice without a guitar, turn off Listen.',
  2: '• Find notes on string 5.\n\n• Press Hide Notes if you want to practice without seeing the notes on the grid.\n\n• Use the Timer button to challenge yourself on time.\n\n• To practice without a guitar, turn off Listen.',
};

const SCHOOL_LIST_HOWTO = '• In this training, you can practice with your guitar.\n\n• Beginners: progress through the lessons in order and learn the fundamentals of playing guitar.\n\n• Follow the instructions in "How To" in each lesson.';

const instructionsWrapper = document.getElementById('instructions-wrapper');

const instructionsModal = document.getElementById('instructions-modal');
const instructionsModalText = document.getElementById('instructions-modal-text');
const instructionsModalClose = document.getElementById('instructions-modal-close');

instructionsWrapper.addEventListener('click', () => {
  const isBass = document.body.classList.contains('bass-mode');
  const isSchoolLesson = document.body.classList.contains('school-lesson-active');
  const isSchoolList = document.body.classList.contains('school-mode') && !isSchoolLesson;
  const currentMode = Object.keys(modeInstructions).find(m => document.body.classList.contains(m));
  const text = isSchoolLesson
    ? (LESSON_HOWTO[activeClassNumber] || '')
    : isSchoolList
      ? SCHOOL_LIST_HOWTO
      : isBass && bassModeInstructions[currentMode]
        ? bassModeInstructions[currentMode]
        : (currentMode ? modeInstructions[currentMode] : '');
  instructionsModalText.innerHTML = text.split('\n\n').map(part => `<p style="margin:0 0 8px;">${part.replace(/\n/g, '<br>')}</p>`).join('');
  instructionsModal.style.display = 'flex';
});

instructionsModalClose.addEventListener('click', () => {
  instructionsModal.style.display = 'none';
});

instructionsModal.addEventListener('click', (e) => {
  if (e.target === instructionsModal) instructionsModal.style.display = 'none';
});

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

function playContinueClick() {
  const ctx = audioCtx;
  [523.25, 659.25, 783.99].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.05 + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + i * 0.05);
    osc.stop(ctx.currentTime + i * 0.05 + 0.5);
  });
}


mainButtons.forEach((btn, index) => {
  btn.addEventListener('click', () => {
    document.body.classList.add('greed-mode');
    document.body.classList.remove('slash-chord-mode', 'scales-mode', 'free-play-mode', 'four-chord-mode', 'basic-chord-mode', 'basic-study-phase', 'three-chord-mode', 'four-inverts-mode', 'free-playing-mode', 'single-note-mode', 'school-mode', 'school-lesson-active');
    lockedStrings.clear();
    document.querySelectorAll('.str-btn').forEach(b => b.classList.remove('locked'));
    feedbackEl.className = 'feedback';
    feedbackEl.textContent = '';
    no5thNote.style.display = 'none';
    document.querySelectorAll('.basic-chord-cat-btn').forEach(b => b.classList.remove('active'));
    basicChordContinueBtn.classList.remove('show');
    if (index === 0) {
      const modal = document.getElementById('chord-list-modal');
      modal.classList.add('open');
      history.pushState({ guideOpen: true }, '');
      renderChordListSection('strings56');
      modal.querySelectorAll('.cl-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === 'strings56');
      });
      document.body.classList.remove('greed-mode');
      return;
    } else if (index === 2) {
      gameMode = 'chord';
      chordMode = 'triads';
      document.body.classList.add('three-chord-mode');
      updatePeekLabel();
      startChordRound();
    } else if (index === 3) {
      gameMode = 'chord';
      chordMode = 'fourInverts';
      updatePeekLabel();
      document.body.classList.add('four-inverts-mode');
      startFourInvertsRound();
    } else if (index === 4) {
      gameMode = 'chord';
      chordMode = 'slash';
      updatePeekLabel();
      document.body.classList.add('slash-chord-mode');
      startSlashChordRound();
    } else if (index === 5) {
      gameMode = 'chord';
      chordMode = 'sevenths';
      updatePeekLabel();
      document.body.classList.add('four-chord-mode');
      startFourChordRound();
    } else if (index === 6) {
      gameMode = 'freeplay';
      updatePeekLabel();
      document.body.classList.add('free-play-mode', 'scales-mode');
      lockedStrings.clear();
      document.querySelectorAll('.str-btn').forEach(b => b.classList.remove('locked'));
      headLineEl.textContent = 'SCALES';
      instracEl.innerHTML = 'Choose a scale<br>to practice';
      notesDisplay.innerHTML = '';
      targetKeys.clear();
      Object.values(svgCells).forEach(cell => {
        cell.circle.setAttribute('opacity', '0');
        cell.text.setAttribute('opacity', '0');
      });
    } else if (index === 7) {
      gameMode = 'school';
      document.body.classList.add('school-mode');
      headLineEl.textContent = 'SCHOOL';
      instracEl.innerHTML = 'Choose a lesson from the list<br><span style="color:darkorange">Use your guitar</span>';
      notesDisplay.innerHTML = '';
      targetKeys.clear();
      Object.values(svgCells).forEach(cell => {
        cell.circle.setAttribute('opacity', '0');
        cell.text.setAttribute('opacity', '0');
      });
      renderClassChecks();
    } else if (index === 8) {
      gameMode = 'freeplaying';
      document.body.classList.add('free-playing-mode');
      headLineEl.textContent = 'FREE PLAYING';
      instracEl.innerHTML = 'Play something<br>nice :-)';
      notesDisplay.innerHTML = '';
      targetKeys.clear();
      Object.values(svgCells).forEach(cell => {
        cell.circle.setAttribute('opacity', '0');
        cell.text.setAttribute('opacity', '0');
      });
    } else if (index === 9) {
      gameMode = 'basicchord';
      updatePeekLabel();
      basicChordCategory = null;
      lastBasicChordName = null;
      rootCatBtns.forEach(b => { b.style.display = ''; b.classList.remove('active'); });
      rootHintText.style.display = 'none';
      basicChordHintEl.style.display = 'none';
      document.body.classList.add('basic-chord-mode');
      headLineEl.innerHTML = 'BEGINNERS<br>TRAINER';
      instracEl.innerHTML = '<span style="color:darkorange">Choose open<br>or barre chords</span>';
      instracEl.classList.add('instrac-blink');
      notesDisplay.innerHTML = '';
      targetKeys.clear();
      Object.values(svgCells).forEach(cell => {
        cell.circle.setAttribute('opacity', '0');
        cell.text.setAttribute('opacity', '0');
      });
    } else {
      gameMode = 'single';
      document.body.classList.add('single-note-mode');
      updatePeekLabel();
      headLineEl.innerHTML = 'SINGLE NOTE';
      noteDisplayMode = 'letter';
      localStorage.setItem('noteDisplayMode', 'letter');
      updateNoteDisplayToggleButton();
      updateSingleNoteInstrac();
      note = randomNote();
      randomizeStaffOctaveChoice(note);
      renderSingleNoteDisplay(note);
      resetRoundTimer();
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


document.querySelectorAll('.scale-category-btn').forEach(catBtn => {
  catBtn.addEventListener('click', () => {
    const group = catBtn.closest('.scale-group');
    const isOpen = group.classList.contains('open');
    document.querySelectorAll('.scale-group').forEach(g => g.classList.remove('open'));
    if (!isOpen) { group.classList.add('open'); scaleSelector.classList.add('has-open'); }
    else { scaleSelector.classList.remove('has-open'); }
  });
});

const CLASS_DESCRIPTIONS = {
  1: 'Learn the notes on string 6\n-- you will use them to find the root notes of basic barre chords.',
  2: 'Learn the notes on string 5\n-- you will use them to find the root notes of basic barre chords.',
  3: 'Learn basic open chords.',
  4: 'Coming soon.', 5: 'Coming soon.',
  6: 'Coming soon.', 7: 'Coming soon.', 8: 'Coming soon.', 9: 'Coming soon.', 10: 'Coming soon.'
};

const LESSON_SUBTITLES = {
  1: '', 2: '',
  3: 'Learn open chords',
  4: '', 5: '', 6: '', 7: '', 8: '', 9: '', 10: ''
};

const LESSON_TITLES = {
  1: '6TH STRING',
  2: '5TH STRING',
  3: 'OPEN CHORDS',
};

function loadClassCompleted() {
  try {
    return new Set(JSON.parse(localStorage.getItem('classCompleted') || '[]'));
  } catch {
    return new Set();
  }
}

let classCompleted = loadClassCompleted();

function renderClassChecks() {
  document.querySelectorAll('.class-check').forEach(el => {
    el.classList.toggle('checked', classCompleted.has(el.dataset.classCheck));
  });
}

document.querySelectorAll('.class-check').forEach(el => {
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    const n = el.dataset.classCheck;
    if (classCompleted.has(n)) classCompleted.delete(n);
    else classCompleted.add(n);
    localStorage.setItem('classCompleted', JSON.stringify([...classCompleted]));
    renderClassChecks();
  });
});

const classModal = document.getElementById('class-modal');
const classModalTitle = document.getElementById('class-modal-title');
const classModalDesc = document.getElementById('class-modal-desc');

let activeClassNumber = null;

document.querySelectorAll('.class-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeClassNumber = btn.dataset.class;
    classModalTitle.textContent = 'Class ' + activeClassNumber;
    classModalDesc.textContent = CLASS_DESCRIPTIONS[activeClassNumber] || '';
    classModal.style.display = 'flex';
  });
});

document.getElementById('class-modal-exit').addEventListener('click', () => {
  classModal.style.display = 'none';
});

document.getElementById('class-modal-start').addEventListener('click', () => {
  classModal.style.display = 'none';
  document.body.classList.add('school-lesson-active');
  document.getElementById('home-label').textContent = 'Back';
  schoolNotesShown = true;
  updatePeekLabel();
  lockedStrings.clear();
  document.querySelectorAll('.str-btn').forEach(b => b.classList.remove('locked'));
  instracEl.innerHTML = LESSON_SUBTITLES[activeClassNumber] || '';
  if (activeClassNumber === '1' || activeClassNumber === '2') {
    const focusString = activeClassNumber === '1' ? 6 : 5;
    noteDisplayMode = 'letter';
    localStorage.setItem('noteDisplayMode', 'letter');
    updateNoteDisplayToggleButton();
    document.querySelectorAll('.str-btn').forEach(strBtn => {
      const stringNum = parseInt(strBtn.dataset.string);
      if (stringNum !== focusString) {
        lockedStrings.add(stringNum);
        strBtn.classList.add('locked');
      }
    });
    note = randomNote();
    renderSingleNoteDisplay(note);
    highlightNotes(note);
    instracEl.innerHTML = 'Play notes<br>on string ' + focusString;
  } else if (activeClassNumber === '3') {
    gameMode = 'basicchord';
    basicChordCategory = 'open';
    document.querySelectorAll('.basic-chord-cat-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.basic-chord-cat-btn[data-cat="open"]').classList.add('active');
    startBasicChordRound();
  }
  headLineEl.textContent = LESSON_TITLES[activeClassNumber] || ('Lesson ' + activeClassNumber);
  setSchoolClassLabel();
  if (!listenOn) startListening();
  if (targetKeys.size > 0) showPeek();
  // Lesson content beyond this not wired up yet -- filled in per-class once each lesson is designed.
});

function exitSchoolLesson() {
  if (listenOn) stopListening();
  gameMode = 'school';
  document.body.classList.remove('school-lesson-active');
  restoreScoreLabel();
  document.getElementById('home-label').textContent = 'Home';
  lockedStrings.clear();
  document.querySelectorAll('.str-btn').forEach(b => b.classList.remove('locked'));
  document.querySelectorAll('.basic-chord-cat-btn').forEach(b => b.classList.remove('active'));
  targetKeys.clear();
  Object.values(svgCells).forEach(cell => {
    cell.circle.setAttribute('opacity', '0');
    cell.text.textContent = 'X';
    cell.text.setAttribute('font-size', '28');
    cell.text.setAttribute('font-family', '');
    cell.text.setAttribute('y', String(parseFloat(cell.circle.getAttribute('cy')) + 6));
    cell.text.setAttribute('dominant-baseline', 'auto');
    cell.text.setAttribute('opacity', '0');
  });
  const barreEl = document.getElementById('barre-peek-line');
  if (barreEl) barreEl.setAttribute('opacity', '0');
  headLineEl.textContent = 'SCHOOL';
  instracEl.innerHTML = 'Choose a lesson from the list<br><span style="color:darkorange">Use your guitar</span>';
  notesDisplay.innerHTML = '';
  schoolNotesShown = false;
}

const group1Cats = ['open', 'barre'];
const group2Cats = ['root6', 'root5'];

const rootCatBtns = document.querySelectorAll('.basic-chord-cat-btn[data-cat="root6"], .basic-chord-cat-btn[data-cat="root5"]');
const rootHintText = document.getElementById('root-hint-text');

document.querySelectorAll('.basic-chord-cat-btn').forEach(catBtn => {
  catBtn.addEventListener('click', () => {
    const cat = catBtn.dataset.cat;
    const sameGroup = group1Cats.includes(cat) ? group1Cats : group2Cats;
    document.querySelectorAll('.basic-chord-cat-btn').forEach(b => {
      if (sameGroup.includes(b.dataset.cat)) b.classList.remove('active');
    });
    catBtn.classList.add('active');
    instracEl.classList.remove('instrac-blink');
    basicChordCategory = cat;
    if (cat === 'open') {
      rootCatBtns.forEach(b => { b.style.display = ''; b.classList.remove('active'); });
      rootHintText.style.display = 'none';
      basicChordHintEl.style.display = 'block';
      basicChordHintEl.innerHTML = 'Find chord tones<br>(tap eye icon<br>if needed)';
      basicChordHintEl.classList.remove('hint-blink-orange');
      void basicChordHintEl.offsetWidth;
      basicChordHintEl.classList.add('hint-blink-orange');
      clearTimeout(hintFlashTimeout);
      hintFlashTimeout = setTimeout(() => basicChordHintEl.classList.remove('hint-blink-orange'), 3000);
    } else if (cat === 'barre') {
      rootCatBtns.forEach(b => {
        b.style.display = 'block';
        b.classList.remove('root-blink');
        void b.offsetWidth;
        b.classList.add('root-blink');
        setTimeout(() => b.classList.remove('root-blink'), 4500);
      });
      rootHintText.style.display = 'block';
      instracEl.innerHTML = 'Choose a root<br>on string 5 or 6';
      basicChordHintEl.style.display = 'block';
      basicChordHintEl.innerHTML = 'Choose root<br>on string 5 or 6';
    } else if (cat === 'root6' || cat === 'root5') {
      basicChordHintEl.style.display = 'block';
      basicChordHintEl.innerHTML = 'Find chord tones<br>(tap eye icon<br>if needed)';
    }
    startBasicChordRound();
  });
});

document.querySelectorAll('.four-inverts-set-btn:not(.four-inverts-free-btn)').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.four-inverts-set-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const activeNums = btn.dataset.active.split(',').map(Number);
    lockedStrings.clear();
    for (let s = 1; s <= 6; s++) {
      if (!activeNums.includes(s)) lockedStrings.add(s);
    }
    document.querySelectorAll('.str-btn').forEach(b => {
      const s = parseInt(b.dataset.string);
      b.classList.toggle('locked', lockedStrings.has(s));
    });
    startFourInvertsRound();
  });
});

document.querySelector('.four-inverts-free-btn').addEventListener('click', () => {
  document.querySelectorAll('.four-inverts-set-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.four-inverts-free-btn').classList.add('active');
  lockedStrings.clear();
  document.querySelectorAll('.str-btn').forEach(b => b.classList.remove('locked'));
  startFourInvertsRound();
});

document.querySelectorAll('.three-chord-set-btn:not(.three-chord-free-btn)').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.three-chord-set-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const activeNums = btn.dataset.active.split(',').map(Number);
    lockedStrings.clear();
    for (let s = 1; s <= 6; s++) {
      if (!activeNums.includes(s)) lockedStrings.add(s);
    }
    document.querySelectorAll('.str-btn').forEach(b => {
      const s = parseInt(b.dataset.string);
      b.classList.toggle('locked', lockedStrings.has(s));
    });
    startChordRound();
  });
});

document.querySelector('.three-chord-free-btn').addEventListener('click', () => {
  document.querySelectorAll('.three-chord-set-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.three-chord-free-btn').classList.add('active');
  lockedStrings.clear();
  document.querySelectorAll('.str-btn').forEach(b => b.classList.remove('locked'));
  startChordRound();
});

document.querySelector('.scale-selector').addEventListener('click', e => {
  const btn = e.target.closest('.scale-btn');
  if (!btn || btn.disabled) return;
  document.querySelectorAll('.scale-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyScaleHighlights(btn.dataset.scale);
});


const scaleData = {"Arp Major 3n":{"notes":["btn8-string-6","btn6-string-5","btn10-string-4","btn8-string-3","btn11-string-1","btn8-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Arp Major 4n":{"notes":["btn3-string-6","btn8-string-6","btn6-string-5","btn10-string-4","btn8-string-3","btn8-string-2","btn5-string-4","btn8-string-1","btn11-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Arp Minor 3n":{"notes":["btn7-string-6","btn6-string-5","btn9-string-4","btn8-string-3","btn5-string-1","btn9-string-1"],"roots":["btn4-string-6","btn6-string-4","btn7-string-2"],"blues":[]},"Arp Minor 4n":{"notes":["btn2-string-6","btn7-string-6","btn6-string-5","btn4-string-4","btn9-string-4","btn8-string-3","btn7-string-2","btn7-string-1","btn11-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"AO Major":{"notes":["btn6-string-6","btn8-string-6","btn4-string-5","btn6-string-5","btn8-string-5","btn5-string-4","btn8-string-4","btn10-string-4","btn6-string-3","btn8-string-3","btn10-string-3","btn11-string-2","btn13-string-2","btn8-string-2","btn9-string-1","btn11-string-1","btn13-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"AO Minor":{"notes":["btn6-string-6","btn7-string-6","btn4-string-5","btn6-string-5","btn7-string-5","btn4-string-4","btn8-string-4","btn9-string-4","btn6-string-3","btn8-string-3","btn9-string-3","btn7-string-2","btn11-string-2","btn12-string-2","btn9-string-1","btn11-string-1","btn12-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"AO Major Blues":{"notes":["btn6-string-6","btn3-string-5","btn6-string-5","btn3-string-4","btn8-string-4","btn5-string-3","btn8-string-3","btn6-string-2","btn11-string-2","btn8-string-1","btn11-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":["btn7-string-6","btn9-string-4","btn12-string-2"]},"AO Minor Blues":{"notes":["btn7-string-6","btn4-string-5","btn6-string-5","btn4-string-4","btn9-string-4","btn6-string-3","btn8-string-3","btn7-string-2","btn12-string-2","btn9-string-1","btn11-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":["btn5-string-5","btn7-string-3","btn10-string-1"]},"Ionian":{"notes":["btn4-string-5","btn6-string-6","btn6-string-5","btn8-string-6","btn8-string-5","btn5-string-4","btn5-string-3","btn6-string-3","btn8-string-4","btn8-string-3","btn6-string-2","btn6-string-1","btn8-string-2","btn8-string-1","btn9-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Dorian":{"notes":["btn6-string-6","btn7-string-6","btn4-string-5","btn6-string-5","btn8-string-5","btn4-string-4","btn8-string-4","btn4-string-3","btn6-string-3","btn8-string-3","btn6-string-2","btn7-string-2","btn6-string-1","btn7-string-1","btn9-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Phrygian":{"notes":["btn5-string-6","btn7-string-6","btn4-string-5","btn7-string-5","btn4-string-4","btn6-string-4","btn7-string-4","btn4-string-3","btn6-string-3","btn8-string-3","btn5-string-2","btn5-string-1","btn7-string-2","btn7-string-1","btn9-string-1"],"roots":["btn4-string-6","btn6-string-5","btn9-string-2"],"blues":[]},"Lydian":{"notes":["btn6-string-6","btn8-string-6","btn5-string-5","btn8-string-5","btn5-string-4","btn8-string-4","btn5-string-3","btn7-string-3","btn8-string-3","btn6-string-2","btn8-string-2","btn6-string-1","btn8-string-1","btn10-string-1","btn6-string-5"],"roots":["btn4-string-6","btn9-string-2","btn6-string-4"],"blues":[]},"Mixolydian":{"notes":["btn4-string-5","btn4-string-4","btn6-string-6","btn6-string-5","btn8-string-6","btn8-string-5","btn8-string-4","btn5-string-3","btn6-string-3","btn8-string-3","btn6-string-2","btn6-string-1","btn9-string-1","btn7-string-2","btn8-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Aeolian":{"notes":["btn6-string-6","btn7-string-6","btn4-string-5","btn6-string-5","btn7-string-5","btn4-string-4","btn4-string-3","btn6-string-3","btn8-string-4","btn8-string-3","btn5-string-2","btn7-string-2","btn6-string-1","btn7-string-1","btn9-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Locrian":{"notes":["btn5-string-6","btn7-string-6","btn4-string-5","btn5-string-5","btn7-string-5","btn4-string-4","btn7-string-4","btn4-string-3","btn6-string-3","btn7-string-3","btn5-string-2","btn5-string-1","btn7-string-2","btn7-string-1","btn9-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Minor Blues 1":{"notes":["btn7-string-6","btn4-string-5","btn4-string-4","btn4-string-3","btn4-string-2","btn6-string-5","btn6-string-3","btn7-string-2","btn7-string-1"],"roots":["btn4-string-6","btn6-string-4","btn4-string-1"],"blues":["btn5-string-5","btn7-string-3"]},"Minor Blues 2":{"notes":["btn6-string-6","btn3-string-5","btn6-string-5","btn3-string-4","btn3-string-3","btn5-string-3","btn4-string-2","btn6-string-2","btn6-string-1"],"roots":["btn4-string-6","btn6-string-4","btn4-string-1"],"blues":["btn7-string-6","btn7-string-1","btn4-string-3"]},"Minor Blues 3":{"notes":["btn6-string-6","btn4-string-5","btn6-string-5","btn4-string-4","btn3-string-3","btn6-string-3","btn4-string-2","btn7-string-2","btn6-string-1"],"roots":["btn4-string-6","btn4-string-1","btn6-string-4"],"blues":["btn7-string-5","btn5-string-1"]},"Minor Blues 4":{"notes":["btn7-string-6","btn4-string-5","btn7-string-5","btn4-string-4","btn4-string-3","btn6-string-3","btn5-string-2","btn7-string-2","btn7-string-1"],"roots":["btn4-string-6","btn6-string-4","btn4-string-1"],"blues":["btn5-string-4","btn8-string-2"]},"Minor Blues 5":{"notes":["btn6-string-6","btn4-string-5","btn6-string-5","btn3-string-4","btn3-string-3","btn6-string-3","btn4-string-2","btn6-string-2","btn6-string-1"],"roots":["btn4-string-6","btn6-string-4","btn4-string-1"],"blues":["btn7-string-5","btn5-string-2"]},"Diminished":{"notes":["btn6-string-6","btn7-string-6","btn4-string-5","btn5-string-5","btn7-string-5","btn3-string-4","btn5-string-4","btn3-string-3","btn4-string-3","btn6-string-3","btn3-string-2","btn5-string-2","btn6-string-2","btn3-string-1","btn6-string-1"],"roots":["btn4-string-6","btn6-string-4","btn4-string-1"],"blues":[]},"Dim b9":{"notes":["btn5-string-6","btn7-string-6","btn8-string-6","btn5-string-5","btn6-string-5","btn8-string-5","btn4-string-4","btn7-string-4","btn4-string-3","btn5-string-3","btn7-string-3","btn4-string-2","btn6-string-2","btn7-string-2","btn5-string-1","btn7-string-1"],"roots":["btn4-string-6","btn6-string-4","btn4-string-1"],"blues":[]},"Whole Tone":{"notes":["btn6-string-6","btn8-string-6","btn5-string-5","btn7-string-5","btn5-string-2","btn7-string-2","btn6-string-1","btn8-string-1","btn4-string-4","btn8-string-4","btn5-string-3","btn7-string-3"],"roots":["btn4-string-6","btn6-string-4","btn4-string-1"],"blues":[]},"Melodic Minor":{"notes":["btn6-string-6","btn7-string-6","btn4-string-5","btn6-string-5","btn8-string-5","btn8-string-4","btn5-string-4","btn4-string-3","btn6-string-3","btn8-string-3","btn5-string-2","btn7-string-2","btn5-string-1","btn6-string-1","btn8-string-1"],"roots":["btn4-string-6","btn6-string-4","btn8-string-2"],"blues":[]},"Dorian ♭2":{"notes":["btn5-string-6","btn7-string-6","btn4-string-5","btn6-string-5","btn8-string-5","btn4-string-4","btn7-string-4","btn4-string-3","btn6-string-3","btn8-string-3","btn6-string-2","btn7-string-2","btn5-string-1","btn7-string-1","btn9-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Lydian Aug":{"notes":["btn6-string-6","btn8-string-6","btn5-string-5","btn8-string-4","btn5-string-3","btn7-string-3","btn6-string-2","btn6-string-1","btn8-string-1","btn10-string-1","btn8-string-5","btn5-string-4","btn8-string-2","btn7-string-5","btn9-string-3"],"roots":["btn4-string-6","btn9-string-2","btn6-string-4"],"blues":[]},"Lydian Dom":{"notes":["btn6-string-6","btn8-string-6","btn5-string-5","btn8-string-5","btn4-string-4","btn6-string-4","btn8-string-4","btn5-string-3","btn7-string-3","btn8-string-3","btn6-string-2","btn7-string-2","btn6-string-1","btn8-string-1","btn10-string-1"],"roots":["btn4-string-6","btn6-string-5","btn9-string-2"],"blues":[]},"Altered Scale":{"notes":["btn5-string-6","btn7-string-6","btn3-string-5","btn5-string-5","btn7-string-5","btn4-string-4","btn7-string-4","btn4-string-3","btn5-string-3","btn7-string-3","btn5-string-2","btn7-string-2","btn5-string-1","btn6-string-1","btn8-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Locrian ♮2":{"notes":["btn7-string-6","btn6-string-6","btn4-string-5","btn5-string-5","btn7-string-5","btn4-string-4","btn8-string-4","btn4-string-3","btn6-string-3","btn7-string-3","btn5-string-2","btn7-string-2","btn6-string-1","btn7-string-1","btn9-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Mixolydian ♭6":{"notes":["btn4-string-5","btn6-string-6","btn8-string-6","btn7-string-5","btn4-string-4","btn8-string-4","btn5-string-3","btn6-string-3","btn8-string-3","btn5-string-2","btn7-string-2","btn6-string-1","btn8-string-1","btn9-string-1","btn5-string-5"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Aeolian ♯7":{"notes":["btn6-string-6","btn7-string-6","btn4-string-5","btn6-string-5","btn7-string-5","btn8-string-4","btn4-string-3","btn6-string-3","btn8-string-3","btn5-string-2","btn6-string-1","btn7-string-1","btn9-string-1","btn5-string-4","btn8-string-2"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Locrian ♮6":{"notes":["btn5-string-6","btn7-string-6","btn4-string-5","btn5-string-5","btn4-string-4","btn7-string-4","btn4-string-3","btn6-string-3","btn7-string-3","btn5-string-2","btn5-string-1","btn7-string-1","btn9-string-1","btn8-string-5","btn8-string-2"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Dorian ♯4":{"notes":["btn6-string-6","btn7-string-6","btn6-string-5","btn8-string-5","btn4-string-4","btn4-string-3","btn6-string-2","btn6-string-1","btn7-string-2","btn8-string-4","btn5-string-5","btn7-string-3","btn10-string-1","btn8-string-3","btn7-string-1"],"roots":["btn4-string-6","btn9-string-2","btn6-string-4"],"blues":[]},"Phrygian ♮3":{"notes":["btn5-string-6","btn4-string-5","btn7-string-5","btn4-string-4","btn7-string-4","btn6-string-5","btn6-string-3","btn8-string-3","btn5-string-2","btn5-string-1","btn7-string-2","btn9-string-1","btn8-string-6","btn5-string-3","btn8-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Harmonic Minor":{"notes":["btn4-string-6","btn6-string-6","btn4-string-5","btn6-string-5","btn7-string-5","btn5-string-4","btn6-string-4","btn8-string-4","btn4-string-3","btn6-string-3","btn8-string-3","btn4-string-2","btn5-string-2","btn8-string-2","btn4-string-1","btn6-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[]},"Harmonic Minor Pos.5":{"notes":["btn11-string-6","btn12-string-6","btn11-string-5","btn13-string-5","btn14-string-5","btn11-string-4","btn13-string-4","btn12-string-3","btn13-string-3","btn11-string-2","btn12-string-2","btn11-string-1","btn12-string-1"],"roots":["btn11-string-5","btn13-string-3"],"blues":[]},"Major Bebop":{"notes":["btn6-string-6","btn8-string-6","btn4-string-5","btn6-string-5","btn8-string-5","btn5-string-4","btn8-string-4","btn5-string-3","btn6-string-3","btn8-string-3","btn6-string-2","btn6-string-1","btn9-string-1","btn8-string-2","btn8-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[],"extra":["btn7-string-5","btn5-string-2"]},"Dorian Bebop":{"notes":["btn6-string-6","btn7-string-6","btn4-string-5","btn6-string-5","btn8-string-5","btn4-string-4","btn8-string-4","btn4-string-3","btn6-string-3","btn8-string-3","btn6-string-2","btn6-string-1","btn7-string-1","btn9-string-1","btn7-string-2"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[],"extra":["btn8-string-6","btn5-string-3","btn8-string-1"]},"Mixolydian Bebop":{"notes":["btn6-string-6","btn8-string-6","btn4-string-5","btn6-string-5","btn8-string-5","btn4-string-4","btn8-string-4","btn5-string-3","btn6-string-3","btn8-string-3","btn6-string-2","btn7-string-2","btn6-string-1","btn8-string-1","btn9-string-1"],"roots":["btn4-string-6","btn6-string-4","btn9-string-2"],"blues":[],"extra":["btn5-string-4","btn8-string-2"]}};

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
  [cell.scaleNoteCircle, cell.rootHlCircle, cell.bluesHlCircle, cell.extraHlCircle].forEach(el => {
    if (el) { el.setAttribute('cx', xCtr); el.setAttribute('cy', yCtr2); }
  });
  [cell.rootHlText, cell.bluesHlText, cell.extraHlText].forEach(el => {
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
  resetRoundTimer();
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
  (d.extra || []).forEach(k => {
    if (svgCells[k] && !skipKey(k)) {
      svgCells[k].extraHlCircle.setAttribute('opacity','1');
      svgCells[k].extraHlText.setAttribute('opacity','1');
    }
  });
  startScaleGame(scaleName, d);
}

// ── Scale Game ────────────────────────────────────────────────────────────────
let scaleGameActive = false;
let scaleGameNotes = new Set();
let scaleGameFound = new Set();
let scaleGameTimeout = null;
let lastScaleName = null;
let lastScaleData = null;

document.getElementById('try-again-wrapper').addEventListener('click', () => {
  if (!lastScaleName || !lastScaleData) return;
  clearScaleHighlights();
  applyScaleHighlights(lastScaleName);
});

function startScaleGame(scaleName, d) {
  clearTimeout(scaleGameTimeout);
  scaleGameActive = false;
  lastScaleName = scaleName;
  lastScaleData = d;
  scaleGameFound = new Set();
  const skipKey = k => bassMode && parseInt(k.match(/string-(\d+)/)[1]) <= 2;
  const noteKeys  = new Set((d.notes||[]).filter(k => !skipKey(k)));
  const rootKeys  = new Set((d.roots||[]).filter(k => !skipKey(k)));
  const bluesKeys = new Set((d.blues||[]).filter(k => !skipKey(k)));
  const extraKeys = new Set((d.extra||[]).filter(k => !skipKey(k)));
  scaleGameNotes = new Set([...noteKeys, ...rootKeys, ...bluesKeys, ...extraKeys]);

  instracEl.innerHTML = '<span style="color:darkorange">Watch the scale<br>note positions!</span>';

  const setAllOp = op => {
    noteKeys.forEach(k  => { if (svgCells[k]) { svgCells[k].scaleNoteCircle.setAttribute('opacity', op); } });
    rootKeys.forEach(k  => { if (svgCells[k]) { svgCells[k].rootHlCircle.setAttribute('opacity', op); svgCells[k].rootHlText.setAttribute('opacity', op); } });
    bluesKeys.forEach(k => { if (svgCells[k]) { svgCells[k].bluesHlCircle.setAttribute('opacity', op); svgCells[k].bluesHlText.setAttribute('opacity', op); } });
    extraKeys.forEach(k => { if (svgCells[k]) { svgCells[k].extraHlCircle.setAttribute('opacity', op); svgCells[k].extraHlText.setAttribute('opacity', op); } });
  };

  // Phase 1: 4 blinks before display
  setAllOp('0');
  let pre = 0;
  const preBlink = setInterval(() => {
    setAllOp(pre % 2 === 0 ? '1' : '0');
    pre++;
    if (pre >= 8) {
      clearInterval(preBlink);
      setAllOp('1');
      // Phase 2: 3s stable display, then 6 blinks
      scaleGameTimeout = setTimeout(() => {
        clearScaleHighlights();
        scaleGameActive = true;
        instracEl.innerHTML = 'Find the scale<br>notes!';
      }, 3000);
    }
  }, 300);
}

function showScaleNoteFound(key, d) {
  if (!d) return;
  if ((d.roots||[]).includes(key)) {
    svgCells[key].rootHlCircle.setAttribute('opacity','1');
    svgCells[key].rootHlText.setAttribute('opacity','1');
  } else if ((d.blues||[]).includes(key)) {
    svgCells[key].bluesHlCircle.setAttribute('opacity','1');
    svgCells[key].bluesHlText.setAttribute('opacity','1');
  } else if ((d.extra||[]).includes(key)) {
    svgCells[key].extraHlCircle.setAttribute('opacity','1');
    svgCells[key].extraHlText.setAttribute('opacity','1');
  } else {
    svgCells[key].scaleNoteCircle.setAttribute('opacity','1');
  }
}

function clearScaleHighlights() {
  Object.values(svgCells).forEach(({ scaleNoteCircle, rootHlCircle, bluesHlCircle, extraHlCircle, rootHlText, bluesHlText, extraHlText }) => {
    if (scaleNoteCircle) scaleNoteCircle.setAttribute('opacity','0');
    if (rootHlCircle)    rootHlCircle.setAttribute('opacity','0');
    if (bluesHlCircle)   bluesHlCircle.setAttribute('opacity','0');
    if (extraHlCircle)   extraHlCircle.setAttribute('opacity','0');
    if (rootHlText)      rootHlText.setAttribute('opacity','0');
    if (bluesHlText)     bluesHlText.setAttribute('opacity','0');
    if (extraHlText)     extraHlText.setAttribute('opacity','0');
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

// ── Staff notation display (Single Note mode) ───────────────────────────────
const naturalIndex = { C:0, D:1, E:2, F:3, G:4, A:5, B:6 };
const openStringPitch = {
  1: { idx: 4, octave: 4 },  // E4
  2: { idx: 11, octave: 3 }, // B3
  3: { idx: 7, octave: 3 },  // G3
  4: { idx: 2, octave: 3 },  // D3
  5: { idx: 9, octave: 2 },  // A2
  6: { idx: 4, octave: 2 },  // E2
};

function neckKeyAbsPitch(key) {
  const m = key.match(/^btn(\d+)-string-(\d+)$/);
  if (!m) return null;
  const fret = parseInt(m[1], 10) - 1;
  const open = openStringPitch[parseInt(m[2], 10)];
  return open.octave * 12 + open.idx + fret;
}

function isKeyPlayable(key) {
  const stringNum = parseInt(key.match(/string-(\d+)/)[1], 10);
  return !(bassMode && stringNum <= 2);
}

function findAllAtLowestPitch(name) {
  const target = normalize(name);
  let minAbs = null;
  let keys = [];
  for (const key in neckNotes) {
    if (neckNotes[key] !== target || !isKeyPlayable(key)) continue;
    const abs = neckKeyAbsPitch(key);
    if (minAbs === null || abs < minAbs) {
      minAbs = abs;
      keys = [key];
    } else if (abs === minAbs) {
      keys.push(key);
    }
  }
  return { keys, abs: minAbs };
}

function findAllKeysAtPitch(name, abs) {
  const target = normalize(name);
  const keys = [];
  for (const key in neckNotes) {
    if (neckNotes[key] !== target || !isKeyPlayable(key)) continue;
    if (neckKeyAbsPitch(key) === abs) keys.push(key);
  }
  return keys;
}

function getDisplayOctave(name) {
  const { abs } = findAllAtLowestPitch(name);
  let realOctave = abs === null ? 4 : Math.floor(abs / 12);
  // B# and Cb are found on the neck via their normalized spelling (C / B), which
  // crosses the B/C octave seam — correct the octave back to the written letter's own.
  const base = name[0];
  const normalizedBase = normalize(name)[0];
  if (base === 'B' && normalizedBase === 'C') realOctave -= 1;
  else if (base === 'C' && normalizedBase === 'B') realOctave += 1;
  // Bass mode plays the fretboard pitch an octave lower (real sounding = neck octave - 1).
  // Both guitar (treble) and bass (bass clef) are written one octave above sounding pitch,
  // so the two shifts cancel out for bass: display octave = neck octave, unchanged.
  return bassMode ? realOctave : realOctave + 1;
}

const CLEF_REF = {
  treble: { letter: 'E', octave: 4 }, // bottom line
  bass:   { letter: 'G', octave: 2 }, // bottom line
};

function diatonicStep(base, octave, clef) {
  const ref = CLEF_REF[clef] || CLEF_REF.treble;
  return (octave * 7 + naturalIndex[base]) - (ref.octave * 7 + naturalIndex[ref.letter]);
}

function ledgerStepsFor(step) {
  const steps = [];
  if (step < 0) {
    const n = Math.floor(-step / 2);
    for (let i = 1; i <= n; i++) steps.push(-2 * i);
  } else if (step > 8) {
    const n = Math.floor((step - 8) / 2);
    for (let i = 1; i <= n; i++) steps.push(8 + 2 * i);
  }
  return steps;
}

let staffOctaveOffset = 0; // 0 = lowest, 1 = one octave up, 2 = two octaves up
function randomizeStaffOctaveChoice(name) {
  const { abs } = findAllAtLowestPitch(name);
  const validOffsets = [0];
  if (abs !== null) {
    for (let o = 1; o <= 2; o++) {
      if (findAllKeysAtPitch(name, abs + o * 12).length > 0) validOffsets.push(o);
    }
  }
  staffOctaveOffset = validOffsets[Math.floor(Math.random() * validOffsets.length)];
}

function getChosenOctave(name) {
  const baseOctave = getDisplayOctave(name);
  return baseOctave + staffOctaveOffset;
}

function renderStaffNote(name) {
  const m = name.match(/^([A-G])(.*)$/);
  const base = m ? m[1] : name;
  const accidental = m ? m[2] : '';
  const clef = bassMode ? 'bass' : 'treble';
  const octave = getChosenOctave(name);
  const step = diatonicStep(base, octave, clef);

  const width = 40;
  const lineGap = 8;
  const stepGap = lineGap / 2;
  // Bass clef only ever needs up to 3 ledger lines above and 1 below (offsets with no
  // reachable fret are excluded before a round starts); treble needs up to 3 above, 3 below.
  const staffTopY = 38;   // top staff line — same headroom covers both clefs' worst case
  const staffBottomY = staffTopY + lineGap * 4;  // bottom staff line
  const height = clef === 'bass' ? 90 : 106;
  const noteX = 22;
  const noteY = staffBottomY - step * stepGap;

  let svg = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="display:block;overflow:visible">`;
  for (let i = 0; i < 5; i++) {
    const y = staffTopY + i * lineGap;
    svg += `<line x1="1" y1="${y}" x2="${width - 1}" y2="${y}" stroke="darkorange" stroke-width="1"/>`;
  }

  ledgerStepsFor(step).forEach(s => {
    const y = staffBottomY - s * stepGap;
    svg += `<line x1="${noteX - 9}" y1="${y}" x2="${noteX + 9}" y2="${y}" stroke="darkorange" stroke-width="1"/>`;
  });

  if (accidental === '#') {
    svg += `<text x="0" y="${noteY + 6}" font-size="20" fill="darkorange">&#9839;</text>`;
  } else if (accidental === 'b') {
    svg += `<text x="1" y="${noteY + 6}" font-size="20" fill="darkorange">&#9837;</text>`;
  }

  svg += `<ellipse cx="${noteX}" cy="${noteY}" rx="6" ry="4.5" fill="darkorange" transform="rotate(-20 ${noteX} ${noteY})"/>`;

  const stemUp = step < 4;
  if (stemUp) {
    svg += `<line x1="${noteX + 5.5}" y1="${noteY}" x2="${noteX + 5.5}" y2="${noteY - 32}" stroke="darkorange" stroke-width="1.4"/>`;
  } else {
    svg += `<line x1="${noteX - 5.5}" y1="${noteY}" x2="${noteX - 5.5}" y2="${noteY + 32}" stroke="darkorange" stroke-width="1.4"/>`;
  }

  svg += `</svg>`;
  return svg;
}

let noteDisplayMode = localStorage.getItem('noteDisplayMode') === 'staff' ? 'staff' : 'letter';

function renderSingleNoteDisplay(n) {
  notesDisplay.classList.toggle('noteD--staff', noteDisplayMode === 'staff');
  notesDisplay.innerHTML = noteDisplayMode === 'staff' ? renderStaffNote(n) : formatNoteName(n);
}

function updateSingleNoteInstrac() {
  instracEl.innerHTML = noteDisplayMode === 'staff' ? 'Find all positions<br>of this note' : 'Find all<br>displayed notes';
}

const noteDisplayToggleLabel = document.querySelector('.note-display-toggle-label');

const NOTE_ICON_SVG = '<svg viewBox="0 0 16 20" width="16" height="20" style="display:block"><line x1="11" y1="2" x2="11" y2="15" stroke="white" stroke-width="1.6"/><ellipse cx="7.5" cy="15.5" rx="4.2" ry="3.2" fill="white" transform="rotate(-20 7.5 15.5)"/></svg>';

function updateNoteDisplayToggleButton() {
  if (!noteDisplayToggleBtn) return;
  const isStaff = noteDisplayMode === 'staff';
  if (isStaff) {
    noteDisplayToggleBtn.textContent = 'Aa';
    noteDisplayToggleBtn.style.fontSize = '14px';
  } else {
    noteDisplayToggleBtn.innerHTML = NOTE_ICON_SVG;
    noteDisplayToggleBtn.style.fontSize = '';
  }
  if (noteDisplayToggleLabel) noteDisplayToggleLabel.textContent = isStaff ? 'Letters' : 'Notes';
}
updateNoteDisplayToggleButton();

if (noteDisplayToggleBtn) {
  noteDisplayToggleBtn.addEventListener('click', () => {
    noteDisplayMode = noteDisplayMode === 'staff' ? 'letter' : 'staff';
    localStorage.setItem('noteDisplayMode', noteDisplayMode);
    renderSingleNoteDisplay(note);
    updateSingleNoteInstrac();
    updateNoteDisplayToggleButton();
    highlightNotes(note);
  });
}

const chromaticIdx = {'C':0,'C#':1,'D':2,'D#':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'A#':10,'B':11};
function intervalToDegreeLabel(semitones) {
  return ['1','b2','2','b3','3','4','b5','5','#5','6','b7','7'][((semitones % 12) + 12) % 12] || '';
}
function getTensionLabel(name) {
  if (/\(b13\)|b13/.test(name)) return 'b13';
  if (/\(#13\)|#13/.test(name)) return '#13';
  if (/13/.test(name)) return '13';
  if (/\(#11\)|#11/.test(name)) return '#11';
  if (/\(b11\)|b11/.test(name)) return 'b11';
  if (/11/.test(name)) return '11';
  if (/\(b9\)|b9/.test(name)) return 'b9';
  if (/\(#9\)|#9/.test(name)) return '#9';
  if (/9/.test(name)) return '9';
  if (/6/.test(name)) return '6';
  return 'b7';
}

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
  const freq = openStrings[string] * Math.pow(2, fret / 12);
  // Bass mode sounds an octave below the guitar-neck pitch (see playNote's caller and
  // getDisplayOctave's comment) -- apply that once here so every caller gets it for free.
  return bassMode ? freq / 2 : freq;
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

const augmented7 = {
  "Caug7":["C","E","G#","B"],  "Daug7":["D","F#","A#","C#"], "Eaug7":["E","G#","C","D#"],
  "Faug7":["F","A","C#","E"],  "Gaug7":["G","B","D#","F#"],  "Aaug7":["A","C#","F","G#"], "Baug7":["B","D#","G","A#"]
};

const allSeventhChords = { ...dominant7, ...minor7, ...major7, ...halfDim7, ...augmented7 };

const tensionChords = {
  "CminM7":["C","Eb","G","B"],    "DminM7":["D","F","A","C#"],   "EminM7":["E","G","B","D#"],
  "FminM7":["F","Ab","C","E"],    "GminM7":["G","Bb","D","F#"],  "AminM7":["A","C","E","G#"],  "BminM7":["B","D","F#","A#"],

  "Cmaj9":["C","E","B","D"],  "Dmaj9":["D","F#","C#","E"], "Emaj9":["E","G#","D#","F#"],
  "Fmaj9":["F","A","E","G"],  "Gmaj9":["G","B","F#","A"],  "Amaj9":["A","C#","G#","B"], "Bmaj9":["B","D#","A#","C#"],

  "Cm6":["C","Eb","G","A"],  "Dm6":["D","F","A","B"],   "Em6":["E","G","B","C#"],
  "Fm6":["F","Ab","C","D"],  "Gm6":["G","Bb","D","E"],  "Am6":["A","C","E","F#"],  "Bm6":["B","D","F#","G#"],

  "C6":["C","E","G","A"],  "D6":["D","F#","A","B"],   "E6":["E","G#","B","C#"],
  "F6":["F","A","C","D"],  "G6":["G","B","D","E"],    "A6":["A","C#","E","F#"],  "B6":["B","D#","F#","G#"],

  "C7(b9)":["C","E","Bb","Db"], "D7(b9)":["D","F#","C","Eb"], "E7(b9)":["E","G#","D","F"],
  "F7(b9)":["F","A","Eb","Gb"], "G7(b9)":["G","B","F","Ab"],  "A7(b9)":["A","C#","G","Bb"], "B7(b9)":["B","D#","A","C"],

  "C7(#9)":["C","E","Bb","D#"], "D7(#9)":["D","F#","C","F"],  "E7(#9)":["E","G#","D","G"],
  "F7(#9)":["F","A","Eb","G#"], "G7(#9)":["G","B","F","A#"],  "A7(#9)":["A","C#","G","C"], "B7(#9)":["B","D#","A","D"],

  "C(#11)":["C","E","Bb","F#"], "D(#11)":["D","F#","C","G#"], "E(#11)":["E","G#","D","A#"],
  "F(#11)":["F","A","Eb","B"],  "G(#11)":["G","B","F","C#"],  "A(#11)":["A","C#","G","D#"], "B(#11)":["B","D#","A","F"],

  "Cdim7":["C","Eb","Gb","A"],  "Ddim7":["D","F","Ab","B"],   "Edim7":["E","G","Bb","C#"],
  "Fdim7":["F","Ab","B","D"],   "Gdim7":["G","Bb","Db","E"],  "Adim7":["A","C","Eb","F#"], "Bdim7":["B","D","F","Ab"],

  "C7(#5)":["C","E","G#","Bb"],  "D7(#5)":["D","F#","A#","C"],  "E7(#5)":["E","G#","C","D"],
  "F7(#5)":["F","A","C#","Eb"], "G7(#5)":["G","B","D#","F"],   "A7(#5)":["A","C#","F","G"],  "B7(#5)":["B","D#","G","A"],

  "C13":["C","E","Bb","A"], "D13":["D","F#","C","B"], "E13":["E","G#","D","C#"],
  "F13":["F","A","Eb","D"], "G13":["G","B","F","E"],  "A13":["A","C#","G","F#"], "B13":["B","D#","A","G#"],

  "C(b13)":["C","E","Bb","Ab"], "D(b13)":["D","F#","C","Bb"], "E(b13)":["E","G#","D","C"],
  "F(b13)":["F","A","Eb","Db"], "G(b13)":["G","B","F","Eb"],  "A(b13)":["A","C#","G","F"], "B(b13)":["B","D#","A","G"],

  "Cm9":["C","Eb","Bb","D"], "Dm9":["D","F","C","E"], "Em9":["E","G","D","F#"],
  "Fm9":["F","Ab","Eb","G"], "Gm9":["G","Bb","F","A"], "Am9":["A","C","G","B"], "Bm9":["B","D","A","C#"],

  "C11":["C","E","Bb","F"], "D11":["D","F#","C","G"], "E11":["E","G#","D","A"],
  "F11":["F","A","Eb","Bb"], "G11":["G","B","F","C"], "A11":["A","C#","G","D"], "B11":["B","D#","A","E"],

  "Csus4":["C","F","G"], "Dsus4":["D","G","A"], "Esus4":["E","A","B"],
  "Fsus4":["F","Bb","C"], "Gsus4":["G","C","D"], "Asus4":["A","D","E"], "Bsus4":["B","E","F#"],

  "Csus2":["C","D","G"], "Dsus2":["D","E","A"], "Esus2":["E","F#","B"],
  "Fsus2":["F","G","C"], "Gsus2":["G","A","D"], "Asus2":["A","B","E"], "Bsus2":["B","C#","F#"],

  "C7(b5)":["C","E","Gb","Bb"],  "D7(b5)":["D","F#","Ab","C"], "E7(b5)":["E","G#","Bb","D"],
  "F7(b5)":["F","A","B","Eb"],   "G7(b5)":["G","B","Db","F"],  "A7(b5)":["A","C#","Eb","G"], "B7(b5)":["B","D#","F","A"],

  "C9":["C","E","Bb","D"],   "D9":["D","F#","C","E"],   "E9":["E","G#","D","F#"],
  "F9":["F","A","Eb","G"],   "G9":["G","B","F","A"],    "A9":["A","C#","G","B"],   "B9":["B","D#","A","C#"],

  "C9sus4":["C","F","Bb","D"],   "D9sus4":["D","G","C","E"],   "E9sus4":["E","A","D","F#"],
  "F9sus4":["F","Bb","Eb","G"],  "G9sus4":["G","C","F","A"],   "A9sus4":["A","D","G","B"],  "B9sus4":["B","E","A","C#"],
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

const basicOpenChords = [
  { name: 'A',   keys: ['btn1-string-5','btn3-string-4','btn3-string-3','btn3-string-2','btn1-string-1'] },
  { name: 'Am',  keys: ['btn1-string-5','btn3-string-4','btn3-string-3','btn2-string-2','btn1-string-1'] },
  { name: 'A7',  keys: ['btn1-string-5','btn3-string-4','btn1-string-3','btn3-string-2','btn1-string-1'] },
  { name: 'B',   keys: ['btn3-string-5','btn5-string-4','btn5-string-3','btn5-string-2','btn3-string-1'] },
  { name: 'Bm',  keys: ['btn3-string-5','btn5-string-4','btn5-string-3','btn4-string-2','btn3-string-1'] },
  { name: 'B7',  keys: ['btn3-string-5','btn2-string-4','btn3-string-3','btn1-string-2','btn3-string-1'] },
  { name: 'C',   keys: ['btn4-string-5','btn3-string-4','btn1-string-3','btn2-string-2','btn1-string-1'] },
  { name: 'D',   keys: ['btn1-string-4','btn3-string-3','btn4-string-2','btn3-string-1'] },
  { name: 'Dm',  keys: ['btn1-string-4','btn3-string-3','btn4-string-2','btn2-string-1'] },
  { name: 'D7',  keys: ['btn1-string-4','btn3-string-3','btn2-string-2','btn3-string-1'] },
  { name: 'E',   keys: ['btn1-string-6','btn3-string-5','btn3-string-4','btn2-string-3','btn1-string-2','btn1-string-1'] },
  { name: 'Em',  keys: ['btn1-string-6','btn3-string-5','btn3-string-4','btn1-string-3','btn1-string-2','btn1-string-1'] },
  { name: 'E7',  keys: ['btn1-string-6','btn3-string-5','btn1-string-4','btn2-string-3','btn1-string-2','btn1-string-1'] },
  { name: 'Em7', keys: ['btn1-string-6','btn3-string-5','btn1-string-4','btn1-string-3','btn1-string-2','btn1-string-1'] },
  { name: 'G',   keys: ['btn4-string-6','btn3-string-5','btn1-string-4','btn1-string-3','btn1-string-2','btn4-string-1'] },
  { name: 'G7',  keys: ['btn4-string-6','btn3-string-5','btn1-string-4','btn1-string-3','btn1-string-2','btn2-string-1'] },
];

const basicBarreChords = [
  // F  (E-shape, barre fret 1)
  { name: 'F',    keys: ['btn2-string-6','btn4-string-5','btn4-string-4','btn3-string-3','btn2-string-2','btn2-string-1'] },
  { name: 'Fm',   keys: ['btn2-string-6','btn4-string-5','btn4-string-4','btn2-string-3','btn2-string-2','btn2-string-1'] },
  { name: 'F7',   keys: ['btn2-string-6','btn4-string-5','btn2-string-4','btn3-string-3','btn2-string-2','btn2-string-1'] },
  { name: 'Fm7',  keys: ['btn2-string-6','btn4-string-5','btn2-string-4','btn2-string-3','btn2-string-2','btn2-string-1'] },
  { name: 'Fmaj7',keys: ['btn2-string-6','btn4-string-5','btn3-string-4','btn3-string-3','btn2-string-2','btn2-string-1'] },
  // G  (E-shape, barre fret 3)
  { name: 'G',    keys: ['btn4-string-6','btn6-string-5','btn6-string-4','btn5-string-3','btn4-string-2','btn4-string-1'] },
  { name: 'Gm',   keys: ['btn4-string-6','btn6-string-5','btn6-string-4','btn4-string-3','btn4-string-2','btn4-string-1'] },
  { name: 'G7',   keys: ['btn4-string-6','btn6-string-5','btn4-string-4','btn5-string-3','btn4-string-2','btn4-string-1'] },
  { name: 'Gm7',  keys: ['btn4-string-6','btn6-string-5','btn4-string-4','btn4-string-3','btn4-string-2','btn4-string-1'] },
  { name: 'Gmaj7',keys: ['btn4-string-6','btn6-string-5','btn5-string-4','btn5-string-3','btn4-string-2','btn4-string-1'] },
  // A  (E-shape, barre fret 5)
  { name: 'A',    keys: ['btn6-string-6','btn8-string-5','btn8-string-4','btn7-string-3','btn6-string-2','btn6-string-1'] },
  { name: 'Am',   keys: ['btn6-string-6','btn8-string-5','btn8-string-4','btn6-string-3','btn6-string-2','btn6-string-1'] },
  { name: 'A7',   keys: ['btn6-string-6','btn8-string-5','btn6-string-4','btn7-string-3','btn6-string-2','btn6-string-1'] },
  { name: 'Am7',  keys: ['btn6-string-6','btn8-string-5','btn6-string-4','btn6-string-3','btn6-string-2','btn6-string-1'] },
  { name: 'Amaj7',keys: ['btn6-string-6','btn8-string-5','btn7-string-4','btn7-string-3','btn6-string-2','btn6-string-1'] },
  // B  (E-shape, barre fret 7)
  { name: 'B',    keys: ['btn8-string-6','btn10-string-5','btn10-string-4','btn9-string-3','btn8-string-2','btn8-string-1'] },
  { name: 'Bm',   keys: ['btn8-string-6','btn10-string-5','btn10-string-4','btn8-string-3','btn8-string-2','btn8-string-1'] },
  { name: 'B7',   keys: ['btn8-string-6','btn10-string-5','btn8-string-4','btn9-string-3','btn8-string-2','btn8-string-1'] },
  { name: 'Bm7',  keys: ['btn8-string-6','btn10-string-5','btn8-string-4','btn8-string-3','btn8-string-2','btn8-string-1'] },
  { name: 'Bmaj7',keys: ['btn8-string-6','btn10-string-5','btn9-string-4','btn9-string-3','btn8-string-2','btn8-string-1'] },
  // C  (E-shape, barre fret 8)
  { name: 'C',    keys: ['btn9-string-6','btn11-string-5','btn11-string-4','btn10-string-3','btn9-string-2','btn9-string-1'] },
  { name: 'Cm',   keys: ['btn9-string-6','btn11-string-5','btn11-string-4','btn9-string-3','btn9-string-2','btn9-string-1'] },
  { name: 'C7',   keys: ['btn9-string-6','btn11-string-5','btn9-string-4','btn10-string-3','btn9-string-2','btn9-string-1'] },
  { name: 'Cm7',  keys: ['btn9-string-6','btn11-string-5','btn9-string-4','btn9-string-3','btn9-string-2','btn9-string-1'] },
  { name: 'Cmaj7',keys: ['btn9-string-6','btn11-string-5','btn10-string-4','btn10-string-3','btn9-string-2','btn9-string-1'] },
  // D  (E-shape, barre fret 10)
  { name: 'D',    keys: ['btn11-string-6','btn13-string-5','btn13-string-4','btn12-string-3','btn11-string-2','btn11-string-1'] },
  { name: 'Dm',   keys: ['btn11-string-6','btn13-string-5','btn13-string-4','btn11-string-3','btn11-string-2','btn11-string-1'] },
  { name: 'D7',   keys: ['btn11-string-6','btn13-string-5','btn11-string-4','btn12-string-3','btn11-string-2','btn11-string-1'] },
  { name: 'Dm7',  keys: ['btn11-string-6','btn13-string-5','btn11-string-4','btn11-string-3','btn11-string-2','btn11-string-1'] },
  { name: 'Dmaj7',keys: ['btn11-string-6','btn13-string-5','btn12-string-4','btn12-string-3','btn11-string-2','btn11-string-1'] },
  // E  (A-shape, barre fret 7, string 5)
  { name: 'E',    keys: ['btn8-string-5','btn10-string-4','btn10-string-3','btn10-string-2','btn8-string-1'] },
  { name: 'Em',   keys: ['btn8-string-5','btn10-string-4','btn10-string-3','btn9-string-2','btn8-string-1'] },
  { name: 'E7',   keys: ['btn8-string-5','btn10-string-4','btn8-string-3','btn10-string-2','btn8-string-1'] },
  { name: 'Em7',  keys: ['btn8-string-5','btn10-string-4','btn8-string-3','btn9-string-2','btn8-string-1'] },
  { name: 'Emaj7',keys: ['btn8-string-5','btn10-string-4','btn9-string-3','btn10-string-2','btn8-string-1'] },
];

const basicRoot6Chords = [
  // F (E-shape, fret 1)
  { name: 'F',    keys: ['btn2-string-6','btn4-string-5','btn4-string-4','btn3-string-3','btn2-string-2','btn2-string-1'] },
  { name: 'Fm',   keys: ['btn2-string-6','btn4-string-5','btn4-string-4','btn2-string-3','btn2-string-2','btn2-string-1'] },
  { name: 'F7',   keys: ['btn2-string-6','btn4-string-5','btn2-string-4','btn3-string-3','btn2-string-2','btn2-string-1'] },
  { name: 'Fm7',  keys: ['btn2-string-6','btn4-string-5','btn2-string-4','btn2-string-3','btn2-string-2','btn2-string-1'] },
  { name: 'Fmaj7',keys: ['btn2-string-6','btn4-string-5','btn3-string-4','btn3-string-3','btn2-string-2','btn2-string-1'] },
  // G (E-shape, fret 3)
  { name: 'G',    keys: ['btn4-string-6','btn6-string-5','btn6-string-4','btn5-string-3','btn4-string-2','btn4-string-1'] },
  { name: 'Gm',   keys: ['btn4-string-6','btn6-string-5','btn6-string-4','btn4-string-3','btn4-string-2','btn4-string-1'] },
  { name: 'G7',   keys: ['btn4-string-6','btn6-string-5','btn4-string-4','btn5-string-3','btn4-string-2','btn4-string-1'] },
  { name: 'Gm7',  keys: ['btn4-string-6','btn6-string-5','btn4-string-4','btn4-string-3','btn4-string-2','btn4-string-1'] },
  { name: 'Gmaj7',keys: ['btn4-string-6','btn6-string-5','btn5-string-4','btn5-string-3','btn4-string-2','btn4-string-1'] },
  // A (E-shape, fret 5)
  { name: 'A',    keys: ['btn6-string-6','btn8-string-5','btn8-string-4','btn7-string-3','btn6-string-2','btn6-string-1'] },
  { name: 'Am',   keys: ['btn6-string-6','btn8-string-5','btn8-string-4','btn6-string-3','btn6-string-2','btn6-string-1'] },
  { name: 'A7',   keys: ['btn6-string-6','btn8-string-5','btn6-string-4','btn7-string-3','btn6-string-2','btn6-string-1'] },
  { name: 'Am7',  keys: ['btn6-string-6','btn8-string-5','btn6-string-4','btn6-string-3','btn6-string-2','btn6-string-1'] },
  { name: 'Amaj7',keys: ['btn6-string-6','btn8-string-5','btn7-string-4','btn7-string-3','btn6-string-2','btn6-string-1'] },
  // B (E-shape, fret 7)
  { name: 'B',    keys: ['btn8-string-6','btn10-string-5','btn10-string-4','btn9-string-3','btn8-string-2','btn8-string-1'] },
  { name: 'Bm',   keys: ['btn8-string-6','btn10-string-5','btn10-string-4','btn8-string-3','btn8-string-2','btn8-string-1'] },
  { name: 'B7',   keys: ['btn8-string-6','btn10-string-5','btn8-string-4','btn9-string-3','btn8-string-2','btn8-string-1'] },
  { name: 'Bm7',  keys: ['btn8-string-6','btn10-string-5','btn8-string-4','btn8-string-3','btn8-string-2','btn8-string-1'] },
  { name: 'Bmaj7',keys: ['btn8-string-6','btn10-string-5','btn9-string-4','btn9-string-3','btn8-string-2','btn8-string-1'] },
  // C (E-shape, fret 8)
  { name: 'C',    keys: ['btn9-string-6','btn11-string-5','btn11-string-4','btn10-string-3','btn9-string-2','btn9-string-1'] },
  { name: 'Cm',   keys: ['btn9-string-6','btn11-string-5','btn11-string-4','btn9-string-3','btn9-string-2','btn9-string-1'] },
  { name: 'C7',   keys: ['btn9-string-6','btn11-string-5','btn9-string-4','btn10-string-3','btn9-string-2','btn9-string-1'] },
  { name: 'Cm7',  keys: ['btn9-string-6','btn11-string-5','btn9-string-4','btn9-string-3','btn9-string-2','btn9-string-1'] },
  { name: 'Cmaj7',keys: ['btn9-string-6','btn11-string-5','btn10-string-4','btn10-string-3','btn9-string-2','btn9-string-1'] },
  // D (E-shape, fret 10)
  { name: 'D',    keys: ['btn11-string-6','btn13-string-5','btn13-string-4','btn12-string-3','btn11-string-2','btn11-string-1'] },
  { name: 'Dm',   keys: ['btn11-string-6','btn13-string-5','btn13-string-4','btn11-string-3','btn11-string-2','btn11-string-1'] },
  { name: 'D7',   keys: ['btn11-string-6','btn13-string-5','btn11-string-4','btn12-string-3','btn11-string-2','btn11-string-1'] },
  { name: 'Dm7',  keys: ['btn11-string-6','btn13-string-5','btn11-string-4','btn11-string-3','btn11-string-2','btn11-string-1'] },
  { name: 'Dmaj7',keys: ['btn11-string-6','btn13-string-5','btn12-string-4','btn12-string-3','btn11-string-2','btn11-string-1'] },
];

const basicRoot5Chords = [
  // B (A-shape, fret 2)
  { name: 'B',    keys: ['btn3-string-5','btn5-string-4','btn5-string-3','btn5-string-2','btn3-string-1'] },
  { name: 'Bm',   keys: ['btn3-string-5','btn5-string-4','btn5-string-3','btn4-string-2','btn3-string-1'] },
  { name: 'B7',   keys: ['btn3-string-5','btn5-string-4','btn3-string-3','btn5-string-2','btn3-string-1'] },
  { name: 'Bm7',  keys: ['btn3-string-5','btn5-string-4','btn3-string-3','btn4-string-2','btn3-string-1'] },
  { name: 'Bmaj7',keys: ['btn3-string-5','btn5-string-4','btn4-string-3','btn5-string-2','btn3-string-1'] },
  // C (A-shape, fret 3)
  { name: 'C',    keys: ['btn4-string-5','btn6-string-4','btn6-string-3','btn6-string-2','btn4-string-1'] },
  { name: 'Cm',   keys: ['btn4-string-5','btn6-string-4','btn6-string-3','btn5-string-2','btn4-string-1'] },
  { name: 'C7',   keys: ['btn4-string-5','btn6-string-4','btn4-string-3','btn6-string-2','btn4-string-1'] },
  { name: 'Cm7',  keys: ['btn4-string-5','btn6-string-4','btn4-string-3','btn5-string-2','btn4-string-1'] },
  { name: 'Cmaj7',keys: ['btn4-string-5','btn6-string-4','btn5-string-3','btn6-string-2','btn4-string-1'] },
  // D (A-shape, fret 5)
  { name: 'D',    keys: ['btn6-string-5','btn8-string-4','btn8-string-3','btn8-string-2','btn6-string-1'] },
  { name: 'Dm',   keys: ['btn6-string-5','btn8-string-4','btn8-string-3','btn7-string-2','btn6-string-1'] },
  { name: 'D7',   keys: ['btn6-string-5','btn8-string-4','btn6-string-3','btn8-string-2','btn6-string-1'] },
  { name: 'Dm7',  keys: ['btn6-string-5','btn8-string-4','btn6-string-3','btn7-string-2','btn6-string-1'] },
  { name: 'Dmaj7',keys: ['btn6-string-5','btn8-string-4','btn7-string-3','btn8-string-2','btn6-string-1'] },
  // E (A-shape, fret 7)
  { name: 'E',    keys: ['btn8-string-5','btn10-string-4','btn10-string-3','btn10-string-2','btn8-string-1'] },
  { name: 'Em',   keys: ['btn8-string-5','btn10-string-4','btn10-string-3','btn9-string-2','btn8-string-1'] },
  { name: 'E7',   keys: ['btn8-string-5','btn10-string-4','btn8-string-3','btn10-string-2','btn8-string-1'] },
  { name: 'Em7',  keys: ['btn8-string-5','btn10-string-4','btn8-string-3','btn9-string-2','btn8-string-1'] },
  { name: 'Emaj7',keys: ['btn8-string-5','btn10-string-4','btn9-string-3','btn10-string-2','btn8-string-1'] },
  // F (A-shape, fret 8)
  { name: 'F',    keys: ['btn9-string-5','btn11-string-4','btn11-string-3','btn11-string-2','btn9-string-1'] },
  { name: 'Fm',   keys: ['btn9-string-5','btn11-string-4','btn11-string-3','btn10-string-2','btn9-string-1'] },
  { name: 'F7',   keys: ['btn9-string-5','btn11-string-4','btn9-string-3','btn11-string-2','btn9-string-1'] },
  { name: 'Fm7',  keys: ['btn9-string-5','btn11-string-4','btn9-string-3','btn10-string-2','btn9-string-1'] },
  { name: 'Fmaj7',keys: ['btn9-string-5','btn11-string-4','btn10-string-3','btn11-string-2','btn9-string-1'] },
  // G (A-shape, fret 10)
  { name: 'G',    keys: ['btn11-string-5','btn13-string-4','btn13-string-3','btn13-string-2','btn11-string-1'] },
  { name: 'Gm',   keys: ['btn11-string-5','btn13-string-4','btn13-string-3','btn12-string-2','btn11-string-1'] },
  { name: 'G7',   keys: ['btn11-string-5','btn13-string-4','btn11-string-3','btn13-string-2','btn11-string-1'] },
  { name: 'Gm7',  keys: ['btn11-string-5','btn13-string-4','btn11-string-3','btn12-string-2','btn11-string-1'] },
  { name: 'Gmaj7',keys: ['btn11-string-5','btn13-string-4','btn12-string-3','btn13-string-2','btn11-string-1'] },
];

let basicChordCategory = null;
let lastBasicChordName = null;
let basicStudyKeys = [];

function showBasicChordStudy(chord) {
  basicStudyKeys = chord.keys;
  notesDisplay.innerHTML = formatNoteName(chord.name);
  resetRoundTimer();
  headLineEl.innerHTML = 'BEGINNERS<br>TRAINER';
  foundChordNotes = new Set();
  Object.values(svgCells).forEach(cell => {
    cell.circle.setAttribute('opacity', '0');
    cell.text.setAttribute('opacity', '0');
  });
  startBasicChordPlay(chord);
}

function startBasicChordPlay(chord) {
  document.body.classList.remove('basic-study-phase');
  chord.keys.forEach(key => {
    if (svgCells[key]) svgCells[key].circle.setAttribute('opacity', '0');
  });
  targetKeys = new Set(chord.keys);
  chordNotes = allTriads[chord.name] || allSeventhChords[chord.name] || [];
  instracEl.innerHTML = `Find:<br>${chord.name}`;
}

function startBasicChordRound() {
  if (!basicChordCategory) return;
  basicChordContinueBtn.classList.remove('show');
  const pool = basicChordCategory === 'open' ? basicOpenChords :
               basicChordCategory === 'root6' ? basicRoot6Chords :
               basicChordCategory === 'root5' ? basicRoot5Chords :
               basicBarreChords;
  let chord;
  do { chord = pool[Math.floor(Math.random() * pool.length)]; } while (chord.name === lastBasicChordName && pool.length > 1);
  lastBasicChordName = chord.name;
  foundChordNotes = new Set();
  clearTimeout(nextRoundTimeout);
  noteNameDisplay.classList.remove('well-done');
  feedbackEl.className = 'feedback';
  feedbackEl.textContent = '';
  showBasicChordStudy(chord);
}

let gameMode = 'single';
let chordMode = 'triads';
let chordNotes = [];
let currentChordName = '';

const notesArr = ["A","B","C","D","E","F","G"]
const diesBemol = ["#","b","","","","",""]
const excludedNotes = ["Cb", "Fb", "E#"];

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
renderSingleNoteDisplay(note);

function highlightNotes(note) {
  targetKeys.clear();
  let staffOnlyKeys = null;
  if (noteDisplayMode === 'staff') {
    const { keys: lowKeys, abs } = findAllAtLowestPitch(note);
    const keys = (staffOctaveOffset > 0 && abs !== null)
      ? findAllKeysAtPitch(note, abs + staffOctaveOffset * 12)
      : lowKeys;
    staffOnlyKeys = new Set(keys);
  }
  Object.entries(svgCells).forEach(([key, cell]) => {
    const stringNum = parseInt(key.match(/string-(\d+)/)[1]);
    cell.circle.setAttribute('opacity', '0');
    if (lockedStrings.has(stringNum)) {
      // A cell's text element may still be showing a stale chord-degree label (e.g.
      // "1", "b3") left over from a previous chord round (Beginners/Lesson 2) --
      // reset it back to the plain "X" mark before revealing it here.
      cell.text.textContent = 'X';
      cell.text.setAttribute('font-size', '28');
      cell.text.setAttribute('font-family', '');
      cell.text.setAttribute('y', String(parseFloat(cell.circle.getAttribute('cy')) + 6));
      cell.text.setAttribute('dominant-baseline', 'auto');
      cell.text.setAttribute('opacity', key.startsWith('btn1-') ? '1' : '0');
      return;
    }
    if (bassMode && stringNum <= 2) return;
    cell.text.setAttribute('opacity', '0');
    if (staffOnlyKeys !== null) {
      if (staffOnlyKeys.has(key)) targetKeys.add(key);
    } else if (neckNotes[key] === normalize(note)) {
      targetKeys.add(key);
    }
  });
  if (gameMode === 'school') {
    // Lesson 1 only ever has 1-2 unlocked strings; when the target note matches the
    // open string's pitch, it also reappears at fret 12 (0+12) within the visible
    // grid -- keep just the open-string position so a beginner doesn't see the same
    // note flagged twice on one string.
    targetKeys.forEach(key => {
      if (key.startsWith('btn13-')) {
        const stringNum = key.match(/string-(\d+)/)[1];
        if (targetKeys.has(`btn1-string-${stringNum}`)) targetKeys.delete(key);
      }
    });
  }
}

function highlightChordNotes(notes) {
  const normalizedNotes = notes.map(normalize);
  targetKeys.clear();
  Object.entries(svgCells).forEach(([key, cell]) => {
    const stringNum = parseInt(key.match(/string-(\d+)/)[1]);
    cell.circle.setAttribute('opacity', '0');
    if (bassMode && stringNum <= 2) return;
    if (lockedStrings.has(stringNum)) {
      // A cell's text element may still be showing a stale chord-degree label (e.g.
      // "1", "b3") left over from a previous chord round (Beginners/Lesson 2) --
      // reset it back to the plain "X" mark before revealing it here.
      cell.text.textContent = 'X';
      cell.text.setAttribute('font-size', '28');
      cell.text.setAttribute('font-family', '');
      cell.text.setAttribute('y', String(parseFloat(cell.circle.getAttribute('cy')) + 6));
      cell.text.setAttribute('dominant-baseline', 'auto');
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
  const keys = Object.keys(tensionChords);
  let chordName;
  do { chordName = keys[Math.floor(Math.random() * keys.length)]; } while (chordName === lastChordName && keys.length > 1);
  lastChordName = chordName;
  currentChordName = chordName;
  chordNotes = tensionChords[chordName];
  foundChordNotes = new Set();
  headLineEl.innerHTML = 'TENSIONS';
  notesDisplay.innerHTML = formatNoteName(chordName);
  resetRoundTimer();
  instracEl.textContent = 'Find chord tones';
  const no5thSuffixes = ['7(b9)','7(#9)','(#11)','11','maj9','13','(b13)','m9','9'];
  no5thNote.style.display = no5thSuffixes.some(s => chordName.endsWith(s)) ? 'block' : 'none';
  highlightChordNotes(chordNotes);
}

function startFourInvertsRound() {
  // Half-diminished and augmented are each weighted down to 15% (9 of 60), the
  // other three qualities split the remaining 70% evenly (14 of 60 each, ~23.3%).
  const allChords = [
    ...Array(14).fill(0).flatMap(() => Object.keys(dominant7)),
    ...Array(14).fill(0).flatMap(() => Object.keys(minor7)),
    ...Array(14).fill(0).flatMap(() => Object.keys(major7)),
    ...Array(9).fill(0).flatMap(() => Object.keys(halfDim7)),
    ...Array(9).fill(0).flatMap(() => Object.keys(augmented7)),
  ];
  let chordName;
  do { chordName = allChords[Math.floor(Math.random() * allChords.length)]; } while (chordName === lastChordName && allChords.length > 1);
  lastChordName = chordName;
  chordNotes = allSeventhChords[chordName];
  foundChordNotes = new Set();
  headLineEl.innerHTML = '7TH CHORD';
  notesDisplay.innerHTML = formatNoteName(chordName);
  resetRoundTimer();
  instracEl.textContent = 'Find chord tones';
  no5thNote.style.display = 'none';
  highlightChordNotes(chordNotes);
}

function startSlashChordRound() {
  const keys = Object.keys(slashChords);
  let chordName;
  do { chordName = keys[Math.floor(Math.random() * keys.length)]; } while (chordName === lastSlashChordName && keys.length > 1);
  lastSlashChordName = chordName;
  currentChordName = chordName;
  chordNotes = slashChords[chordName];
  foundChordNotes = new Set();
  headLineEl.innerHTML = 'SLASH CHORDS';
  notesDisplay.innerHTML = formatNoteName(chordName);
  resetRoundTimer();
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
  ];
  let chordName;
  do { chordName = weightedChords[Math.floor(Math.random() * weightedChords.length)]; } while (chordName === lastChordName && weightedChords.length > 1);
  lastChordName = chordName;
  chordNotes = allTriads[chordName];
  foundChordNotes = new Set();
  headLineEl.innerHTML = 'TRIADS';
  notesDisplay.innerHTML = formatNoteName(chordName);
  resetRoundTimer();
  instracEl.innerHTML = 'Find 3<br>chord tones';
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
      const guideModal = document.getElementById('chord-list-modal');
      if (guideModal && guideModal.classList.contains('open')) {
        guideModal.classList.remove('open');
        homeBtn.click();
      } else if (document.body.classList.contains('school-lesson-active')) {
        exitSchoolLesson();
      } else if (document.body.classList.contains('greed-mode')) {
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
  hideListenBigCircles();
  noteNameDisplay.classList.remove('well-done');
  feedbackEl.className = 'feedback';
  feedbackEl.textContent = '';
  if (gameMode === 'basicchord') {
    startBasicChordRound();
  } else if (gameMode === 'chord') {
    if (chordMode === 'sevenths') startFourChordRound();
    else if (chordMode === 'fourInverts') startFourInvertsRound();
    else if (chordMode === 'slash') startSlashChordRound();
    else startChordRound();
  } else if (gameMode === 'school') {
    note = randomNote();
    renderSingleNoteDisplay(note);
    highlightNotes(note);
  } else {
    headLineEl.textContent = 'SINGLE NOTE';
    updateSingleNoteInstrac();
    note = randomNote();
    randomizeStaffOctaveChoice(note);
    renderSingleNoteDisplay(note);
    resetRoundTimer();
    highlightNotes(note);
  }
  refreshSchoolLessonUI();
}

// ── Chord List Reference ─────────────────────────────────────────────────────

function makeChordSVG(chord, rootString) {
  const W = 72, H = 96;
  const pL = 10, pR = 10, pT = 20, pB = 8;
  const gW = W - pL - pR, gH = H - pT - pB;
  const STRINGS = 6, FRETS = 5;
  const sx = i => pL + (i * gW / (STRINGS - 1));
  const fy = j => pT + (j * gH / FRETS);
  const slotY = (relFret) => pT + (relFret - 0.5) * gH / FRETS;
  const startFret = chord.fret || 1;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W); svg.setAttribute('height', H);

  const el = (tag, attrs) => {
    const e = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k,v]) => e.setAttribute(k, v));
    return e;
  };

  // Strings
  for (let i = 0; i < STRINGS; i++) {
    svg.appendChild(el('line', { x1:sx(i),y1:fy(0),x2:sx(i),y2:fy(FRETS), stroke:'rgba(255,255,255,0.5)', 'stroke-width':'1' }));
  }
  // Frets
  for (let j = 0; j <= FRETS; j++) {
    svg.appendChild(el('line', { x1:sx(0),y1:fy(j),x2:sx(STRINGS-1),y2:fy(j),
      stroke:'rgba(255,255,255,0.5)', 'stroke-width': j === 0 && startFret === 1 ? '4' : '1' }));
  }
  // Fret number
  if (startFret > 1) {
    const t = el('text', { x:sx(STRINGS-1)+3, y:fy(1)-2, fill:'rgba(255,255,255,0.6)', 'font-size':'7', 'font-family':'system-ui' });
    t.textContent = `${startFret}fr`;
    svg.appendChild(t);
  }

  // Barre
  if (chord.barre) {
    const { fret: bf, from: bs, to: be } = chord.barre;
    const relF = bf - startFret + 1;
    const x1 = sx(6 - be), x2 = sx(6 - bs);
    svg.appendChild(el('line', { x1, y1:slotY(relF), x2, y2:slotY(relF), stroke:'white', 'stroke-width':'9', 'stroke-linecap':'round' }));
    if (chord.root) {
      const [rs, rf] = chord.root;
      if (rf === bf && rs >= bs && rs <= be) {
        svg.appendChild(el('circle', { cx:sx(6-rs), cy:slotY(relF), r:'5.5', fill:'darkorange' }));
      }
    }
  }

  // Dots
  const barre = chord.barre;
  const barreFret = barre ? barre.fret : -1;
  // Find root dot: rootString param (jazz) or chord.root = [str, fret]
  const rootDot = rootString
    ? (chord.dots || []).find(([s]) => s === rootString)
    : chord.root;

  (chord.dots || []).forEach(([str, gFret]) => {
    const relF = gFret - startFret + 1;
    if (relF < 1 || relF > FRETS) return;
    const x = sx(6 - str), y = slotY(relF);
    const isRoot = rootDot && rootDot[0] === str && rootDot[1] === gFret;
    svg.appendChild(el('circle', { cx:x, cy:y, r:'5.5', fill: isRoot ? 'darkorange' : 'white' }));
  });

  // Muted / Open indicators above nut
  const muted = new Set(chord.muted || []);
  const dotted = new Set((chord.dots || []).map(d => d[0]));
  const barreCovered = new Set();
  if (barre) { for (let s = barre.from; s <= barre.to; s++) barreCovered.add(s); }

  for (let str = 1; str <= 6; str++) {
    const x = sx(6 - str);
    if (muted.has(str)) {
      const t = el('text', { x, y:pT-6, 'text-anchor':'middle', fill:'rgba(255,255,255,0.7)', 'font-size':'9', 'font-family':'system-ui' });
      t.textContent = '✕'; svg.appendChild(t);
    } else if (!dotted.has(str) && !barreCovered.has(str)) {
      const isOpenRoot = rootDot && rootDot[0] === str && rootDot[1] === 0;
      svg.appendChild(el('circle', { cx:x, cy:pT-8, r:'4',
        fill: isOpenRoot ? 'darkorange' : 'none',
        stroke: isOpenRoot ? 'darkorange' : 'rgba(255,255,255,0.7)',
        'stroke-width':'1.5' }));
    }
  }
  return svg;
}

function makeScaleSVG(scaleName) {
  const data = scaleData[scaleName];
  if (!data) return null;
  const parseBtn = id => { const m = id.match(/btn(\d+)-string-(\d+)/); return m ? {fret:+m[1],str:+m[2]} : null; };
  const allNotes = (data.notes||[]).map(parseBtn).filter(Boolean);
  const rootSet = new Set((data.roots||[]).map(parseBtn).filter(Boolean).map(n=>`${n.fret},${n.str}`));
  const frets = allNotes.map(n=>n.fret).filter(f=>f>0);
  if (!frets.length) return null;
  const minFret = Math.min(...frets);
  const W=72,H=96,pL=10,pR=10,pT=16,pB=8,STRINGS=6,FRETS=6;
  const gW=W-pL-pR, gH=H-pT-pB;
  const sx = i => pL + i*(gW/(STRINGS-1));
  const strX = str => sx(6-str);
  const fy = j => pT + j*(gH/FRETS);
  const slotY = fret => pT + (fret-minFret+0.5)*(gH/FRETS);
  const NS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(NS,'svg');
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  svg.setAttribute('width',W); svg.setAttribute('height',H);
  const el=(tag,attrs)=>{const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));return e;};
  for(let i=0;i<STRINGS;i++) svg.appendChild(el('line',{x1:sx(i),y1:fy(0),x2:sx(i),y2:fy(FRETS),stroke:'rgba(255,255,255,0.25)','stroke-width':'1'}));
  for(let j=0;j<=FRETS;j++) svg.appendChild(el('line',{x1:sx(0),y1:fy(j),x2:sx(STRINGS-1),y2:fy(j),stroke:j===0&&minFret===1?'rgba(255,255,255,0.6)':'rgba(255,255,255,0.2)','stroke-width':j===0&&minFret===1?'3':'1'}));
  if(minFret>1){const t=el('text',{x:sx(STRINGS-1)+3,y:fy(1)-1,fill:'rgba(255,255,255,0.5)','font-size':'7','font-family':'system-ui'});t.textContent=`${minFret}fr`;svg.appendChild(t);}
  allNotes.forEach(({fret,str})=>{
    if(fret-minFret<0||fret-minFret>=FRETS) return;
    const isRoot=rootSet.has(`${fret},${str}`);
    svg.appendChild(el('circle',{cx:strX(str),cy:slotY(fret),r:'4.5',fill:isRoot?'darkorange':'white'}));
  });
  return svg;
}

const chordListData = {
  open: [
    { section: 'E family' },
    { name:'E',     fret:1, dots:[[5,2],[4,2],[3,1]], muted:[],   root:[6,0] },
    { name:'Em',    fret:1, dots:[[5,2],[4,2]], muted:[],          root:[6,0] },
    { name:'E7',    fret:1, dots:[[5,2],[3,1]], muted:[],          root:[6,0] },
    { name:'Emaj7', fret:1, dots:[[5,2],[4,1],[3,1]], muted:[],   root:[6,0] },
    { section: 'A family' },
    { name:'A',     fret:1, dots:[[4,2],[3,2],[2,2]], muted:[6],  root:[5,0] },
    { name:'Am',    fret:1, dots:[[4,2],[3,2],[2,1]], muted:[6],  root:[5,0] },
    { name:'A7',    fret:1, dots:[[4,2],[2,2]], muted:[6],         root:[5,0] },
    { name:'Amaj7', fret:1, dots:[[4,2],[3,1],[2,2]], muted:[6],  root:[5,0] },
    { section: 'D family' },
    { name:'D',     fret:1, dots:[[3,2],[2,3],[1,2]], muted:[6,5],root:[4,0] },
    { name:'Dm',    fret:1, dots:[[3,2],[2,3],[1,1]], muted:[6,5],root:[4,0] },
    { name:'D7',    fret:1, dots:[[3,2],[2,1],[1,2]], muted:[6,5],root:[4,0] },
    { section: 'G & C' },
    { name:'G',     fret:1, dots:[[6,3],[5,2],[1,3]], muted:[],   root:[6,3] },
    { name:'G7',    fret:1, dots:[[6,3],[5,2],[1,1]], muted:[],   root:[6,3] },
    { name:'C',     fret:1, dots:[[5,3],[4,2],[2,1]], muted:[6],  root:[5,3] },
    { name:'Cmaj7', fret:1, dots:[[5,3],[4,2]], muted:[6],         root:[5,3] },
    { name:'B7',    fret:1, dots:[[5,2],[4,1],[3,2],[1,2]], muted:[6], root:[5,2] },
  ],
  barre: [
    { section: 'E-shape (root on 6th string)' },
    { name:'Major',  fret:1, barre:{fret:1,from:1,to:6}, dots:[[5,3],[4,3],[3,2]], muted:[],  root:[6,1] },
    { name:'Minor',  fret:1, barre:{fret:1,from:1,to:6}, dots:[[5,3],[4,3]], muted:[],         root:[6,1] },
    { name:'7',      fret:1, barre:{fret:1,from:1,to:6}, dots:[[5,3],[3,2]], muted:[],         root:[6,1] },
    { name:'m7',     fret:1, barre:{fret:1,from:1,to:6}, dots:[[5,3]], muted:[],               root:[6,1] },
    { name:'maj7',   fret:1, barre:{fret:1,from:1,to:6}, dots:[[5,3],[4,3],[3,2]], muted:[],  root:[6,1] },
    { section: 'A-shape (root on 5th string)' },
    { name:'Major',  fret:1, barre:{fret:1,from:1,to:5}, dots:[[4,3],[3,3],[2,3]], muted:[6], root:[5,1] },
    { name:'Minor',  fret:1, barre:{fret:1,from:1,to:5}, dots:[[4,3],[3,3]], muted:[6],        root:[5,1] },
    { name:'7',      fret:1, barre:{fret:1,from:1,to:5}, dots:[[4,3],[3,2]], muted:[6],        root:[5,1] },
    { name:'m7',     fret:1, barre:{fret:1,from:1,to:5}, dots:[[4,3]], muted:[6],              root:[5,1] },
    { name:'maj7',   fret:1, barre:{fret:1,from:1,to:5}, dots:[[4,3],[3,3],[2,2]], muted:[6], root:[5,1] },
  ],
  triads: [
    { section: 'Strings 1-2-3 (C major)' },
    { name:'Root pos', fret:5, dots:[[3,5],[2,5],[1,5]], muted:[6,5,4], barre:{fret:5,from:1,to:3}, root:[3,5] },
    { name:'1st inv',  fret:3, dots:[[3,4],[2,3],[1,3]], muted:[6,5,4], barre:{fret:3,from:1,to:2}, root:[2,3] },
    { name:'2nd inv',  fret:7, dots:[[3,7],[2,8],[1,8]], muted:[6,5,4], root:[1,8] },
    { section: 'Strings 2-3-4 (C major)' },
    { name:'Root pos', fret:5, dots:[[4,5],[3,5],[2,5]], muted:[6,5,1], barre:{fret:5,from:2,to:4}, root:[4,5] },
    { name:'1st inv',  fret:2, dots:[[4,3],[3,2],[2,3]], muted:[6,5,1], root:[3,2] },
    { name:'2nd inv',  fret:7, dots:[[4,7],[3,7],[2,8]], muted:[6,5,1], root:[2,8] },
    { section: 'Strings 3-4-5 (C major)' },
    { name:'Root pos', fret:2, dots:[[5,3],[4,2],[3,5]], muted:[6,2,1], root:[5,3] },
    { name:'1st inv',  fret:5, dots:[[5,7],[4,5],[3,5]], muted:[6,2,1], root:[4,5] },
    { name:'2nd inv',  fret:9, dots:[[5,10],[4,9],[3,9]], muted:[6,2,1], root:[3,9] },
    { section: 'Strings 4-5-6 (C major)' },
    { name:'Root pos', fret:3, dots:[[6,3],[5,3],[4,5]], muted:[3,2,1], root:[6,3] },
    { name:'1st inv',  fret:7, dots:[[6,8],[5,7],[4,7]], muted:[3,2,1], root:[5,7] },
    { name:'2nd inv',  fret:10,dots:[[6,10],[5,10],[4,10]], muted:[3,2,1], root:[4,10] },
  ],
  sevenths: [
    { section: 'Strings 1-2-3-4 (Cmaj7)' },
    { name:'Root',    fret:3, dots:[[4,3],[3,5],[2,5],[1,5]], muted:[6,5], root:[4,3] },
    { name:'1st inv', fret:4, dots:[[4,5],[3,4],[2,5],[1,5]], muted:[6,5], root:[3,4] },
    { name:'2nd inv', fret:7, dots:[[4,7],[3,7],[2,8],[1,7]], muted:[6,5], root:[2,8] },
    { name:'3rd inv', fret:8, dots:[[4,9],[3,8],[2,8],[1,8]], muted:[6,5], root:[1,8] },
    { section: 'Strings 2-3-4-5 (Cmaj7)' },
    { name:'Root',    fret:2, dots:[[5,3],[4,3],[3,5],[2,5]], muted:[6,1], root:[5,3] },
    { name:'1st inv', fret:4, dots:[[5,5],[4,5],[3,4],[2,5]], muted:[6,1], root:[4,5] },
    { name:'2nd inv', fret:7, dots:[[5,7],[4,7],[3,7],[2,8]], muted:[6,1], root:[3,7] },
    { name:'3rd inv', fret:9, dots:[[5,10],[4,9],[3,9],[2,9]], muted:[6,1], root:[2,9] },
  ],
  slash: [
    { section: 'Common slash chords' },
    { name:'G/B',  fret:1, dots:[[5,2],[1,3]], muted:[6],  root:[5,2] },
    { name:'C/E',  fret:1, dots:[[5,3],[4,2],[2,1]], muted:[], root:[6,0] },
    { name:'D/F#', fret:1, dots:[[6,2],[3,2],[2,3],[1,2]], muted:[5], root:[6,2] },
    { name:'Am/G', fret:1, dots:[[6,3],[4,2],[3,2],[2,1]], muted:[], root:[6,3] },
    { name:'F/A',  fret:1, barre:{fret:1,from:1,to:2}, dots:[[4,3],[3,2]], muted:[6], root:[5,0] },
    { name:'Em/B', fret:1, dots:[[5,2],[4,2]], muted:[], root:[5,2] },
  ],
  jazz: 'table',
};

// Jazz chord table data: [chordName, root6voicing, root5voicing, root4voicing]
// voicing = {fret, dots, muted} or null
const jazzTableData = [
  { section: 'MAJOR' },
  { name:'maj7',     r6:{fret:7,dots:[[6,8],[5,7],[4,9],[3,9]],muted:[2,1]}, r5:{fret:2,dots:[[5,3],[4,2],[3,4],[2,5]],muted:[6,1]}, r4:{fret:7,dots:[[4,10],[3,9],[2,8],[1,7]],muted:[6,5]} },
  { name:'maj6',     r6:{fret:7,dots:[[6,8],[5,7],[4,7],[3,9]],muted:[2,1]}, r5:{fret:2,dots:[[5,3],[4,2],[3,2],[2,5]],muted:[6,1]}, r4:{fret:8,dots:[[4,10],[3,9],[2,10],[1,8]],muted:[6,5]} },
  { name:'maj9',     r6:{fret:7,dots:[[6,8],[5,7],[4,9],[3,7]],muted:[2,1]}, r5:{fret:2,dots:[[5,3],[4,2],[3,4],[2,3]],muted:[6,1]}, r4:{fret:7,dots:[[4,10],[3,9],[2,7],[1,7]],muted:[6,5]} },
  { name:'maj7#11',  r6:{fret:7,dots:[[6,8],[5,7],[4,9],[3,11]],muted:[2,1]},r5:{fret:3,dots:[[5,3],[4,4],[3,4],[2,5]],muted:[6,1]}, r4:{fret:8,dots:[[4,10],[3,9],[2,10],[1,11]],muted:[6,5]} },
  { section: 'MINOR' },
  { name:'m7',       r6:{fret:6,dots:[[6,8],[5,6],[4,8],[3,8]],muted:[2,1]}, r5:{fret:1,dots:[[5,3],[4,1],[3,3],[2,1]],muted:[6,1]}, r4:{fret:7,dots:[[4,10],[3,8],[2,8],[1,8]],muted:[6,5]} },
  { name:'m6',       r6:{fret:6,dots:[[6,8],[5,6],[4,7],[3,8]],muted:[2,1]}, r5:{fret:1,dots:[[5,3],[4,1],[3,2],[2,4]],muted:[6,1]}, r4:{fret:8,dots:[[4,10],[3,8],[2,10],[1,8]],muted:[6,5]} },
  { name:'m9',       r6:{fret:6,dots:[[6,8],[5,6],[4,8],[3,7]],muted:[2,1]}, r5:{fret:1,dots:[[5,3],[4,1],[3,3],[2,3]],muted:[6,1]}, r4:{fret:7,dots:[[4,10],[3,8],[2,7],[1,8]],muted:[6,5]} },
  { name:'m(maj7)',  r6:{fret:6,dots:[[6,8],[5,6],[4,9],[3,8]],muted:[2,1]}, r5:{fret:1,dots:[[5,3],[4,1],[3,4],[2,1]],muted:[6,1]}, r4:{fret:7,dots:[[4,10],[3,8],[2,8],[1,7]],muted:[6,5]} },
  { section: 'DOMINANT' },
  { name:'7',        r6:{fret:7,dots:[[6,8],[5,7],[4,8],[3,9]],muted:[2,1]}, r5:{fret:1,dots:[[5,3],[4,2],[3,3],[2,1]],muted:[6,1]}, r4:{fret:7,dots:[[4,10],[3,9],[2,8],[1,8]],muted:[6,5]} },
  { name:'9',        r6:{fret:7,dots:[[6,8],[5,7],[4,8],[3,7]],muted:[2,1]}, r5:{fret:2,dots:[[5,3],[4,2],[3,3],[2,3]],muted:[6,1]}, r4:{fret:7,dots:[[4,10],[3,9],[2,8],[1,10]],muted:[6,5]} },
  { name:'7b9',      r6:{fret:6,dots:[[6,8],[5,7],[4,8],[3,6]],muted:[2,1]}, r5:{fret:2,dots:[[5,3],[4,2],[3,3],[2,2]],muted:[6,1]}, r4:{fret:7,dots:[[4,10],[3,9],[2,8],[1,9]],muted:[6,5]} },
  { name:'7#9',      r6:{fret:7,dots:[[6,8],[5,7],[4,8],[3,8]],muted:[2,1]}, r5:{fret:2,dots:[[5,3],[4,2],[3,3],[2,4]],muted:[6,1]}, r4:{fret:7,dots:[[4,10],[3,9],[2,8],[1,11]],muted:[6,5]} },
  { name:'7#11',     r6:{fret:7,dots:[[6,8],[5,7],[4,8],[3,11]],muted:[2,1]},r5:{fret:3,dots:[[5,3],[4,4],[3,3],[2,5]],muted:[6,1]}, r4:{fret:8,dots:[[4,10],[3,9],[2,12],[1,8]],muted:[6,5]} },
  { name:'13',       r6:{fret:8,dots:[[6,8],[4,8],[3,9],[2,10]],muted:[5,1]}, r5:{fret:2,dots:[[5,3],[4,2],[3,2],[1,5]],muted:[6,2]}, r4:{fret:7,dots:[[4,10],[3,9],[2,7],[1,5]],muted:[6,5]} },
  { name:'7b13',     r6:{fret:8,dots:[[6,8],[4,8],[3,9],[2,9]],muted:[5,1]},  r5:{fret:2,dots:[[5,3],[4,2],[3,3],[1,4]],muted:[6,2]}, r4:{fret:7,dots:[[4,10],[3,9],[2,8],[1,4]],muted:[6,5]} },
  { name:'7alt',     r6:{fret:7,dots:[[6,8],[5,7],[4,8],[3,8]],muted:[2,1]}, r5:{fret:2,dots:[[5,3],[4,2],[3,3],[2,4]],muted:[6,1]}, r4:{fret:7,dots:[[4,10],[3,9],[2,9],[1,11]],muted:[6,5]} },
  { section: 'SUSPENDED' },
  { name:'sus2',     r6:{fret:5,dots:[[6,8],[5,5],[4,5],[3,5]],muted:[2,1]}, r5:{fret:3,dots:[[5,3],[4,5],[3,5],[2,3]],muted:[6,1]}, r4:{fret:9,dots:[[4,10],[3,12],[2,10],[1,10]],muted:[6,5]} },
  { name:'sus4',     r6:{fret:5,dots:[[6,8],[5,8],[4,5],[3,5]],muted:[2,1]}, r5:{fret:3,dots:[[5,3],[4,3],[3,5],[2,6]],muted:[6,1]}, r4:{fret:8,dots:[[4,10],[3,10],[2,11],[1,8]],muted:[6,5]} },
  { name:'7sus4',    r6:{fret:5,dots:[[6,8],[5,8],[4,8],[3,5]],muted:[2,1]}, r5:{fret:1,dots:[[5,3],[4,3],[3,3],[2,1]],muted:[6,1]}, r4:{fret:8,dots:[[4,10],[3,10],[2,11],[1,10]],muted:[6,5]} },
  { section: 'SYMMETRIC' },
  { name:'dim7',     r6:{fret:6,dots:[[6,8],[5,6],[4,7],[3,8]],muted:[2,1]}, r5:{fret:1,dots:[[5,3],[4,1],[3,2],[2,4]],muted:[6,1]}, r4:{fret:7,dots:[[4,10],[3,8],[2,7],[1,9]],muted:[6,5]} },
  { name:'aug',      r6:{fret:6,dots:[[6,8],[5,7],[4,6],[3,9]],muted:[2,1]}, r5:{fret:1,dots:[[5,3],[4,2],[3,1],[2,5]],muted:[6,1]}, r4:{fret:7,dots:[[4,10],[3,9],[2,9],[1,8]],muted:[6,5]} },
  { name:'aug7',     r6:{fret:7,dots:[[6,8],[5,7],[4,8],[2,9]],muted:[3,1]}, r5:{fret:2,dots:[[5,3],[4,2],[3,3],[1,4]],muted:[6,2]}, r4:{fret:7,dots:[[4,10],[3,9],[2,9],[1,8]],muted:[6,5]} },
];

function renderStrings56(body) {
  const noteLabel = document.createElement('p');
  noteLabel.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.5);font-style:italic;font-family:system-ui;margin:0 0 10px 0;padding:0;text-align:left;';
  noteLabel.textContent = 'Natural notes only — no sharps or flats';
  body.appendChild(noteLabel);

  const NS = 'http://www.w3.org/2000/svg';
  const FRETS = 13;
  const W = 295, H = 708;
  const pL = 28, pR = 20, pT = 110, pB = 12;
  const gridH = H - pT - pB;
  const fretH = gridH / FRETS;
  const DOT_R = 12;

  // 6 strings: str6 (leftmost) to str1 (rightmost)
  const strCount = 6;
  const gridW = W - pL - pR;
  const strSpacing = gridW / (strCount - 1);
  const strX = s => pL + (6 - s) * strSpacing; // str6=leftmost, str1=rightmost

  const dotFrets = [3, 5, 7, 9, 12];
  const stringNotes = {
    6: ['E','F','','G','','A','','B','C','','D','','E'],
    5: ['A','','B','C','','D','','E','F','','G','','A'],
    4: ['D','','E','F','','G','','A','','B','C','','D'],
    3: ['G','','A','','B','C','','D','','E','F','','G'],
    2: ['B','C','','D','','E','F','','G','','A','','B'],
    1: ['E','F','','G','','A','','B','C','','D','','E'],
  };

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.style.display = 'block';

  const el = (tag, attrs, text) => {
    const e = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k,v]) => e.setAttribute(k, v));
    if (text !== undefined) e.textContent = text;
    return e;
  };

  const fretY = f => pT + f * fretH;
  const slotY = f => pT + (f - 0.5) * fretH; // center of fret slot

  // String labels
  const strLabels = {6:'Str 6',5:'Str 5',4:'Str 4',3:'Str 3',2:'Str 2',1:'Str 1'};
  const strTune   = {6:'E',5:'A',4:'D',3:'G',2:'B',1:'e'};
  [6,5,4,3,2,1].forEach(s => {
    const x = strX(s);
    const primary = s === 6 || s === 5;
    const labelFill = 'white';
    svg.appendChild(el('text', {x, y:52, 'text-anchor':'middle', fill:labelFill, 'font-size':'11', 'font-weight':'bold', 'font-family':'system-ui'}, strLabels[s]));
  });

  // Nut
  svg.appendChild(el('line', {x1:strX(6)-8, y1:pT, x2:strX(1)+8, y2:pT, stroke:'rgba(255,255,255,0.3)', 'stroke-width':'4'}));

  // Fret lines
  for (let f = 1; f <= FRETS; f++) {
    const y = fretY(f);
    svg.appendChild(el('line', {x1:strX(6)-8, y1:y, x2:strX(1)+8, y2:y, stroke:'rgba(255,255,255,0.15)', 'stroke-width':'1'}));
  }

  // String lines
  [6,5,4,3,2,1].forEach(s => {
    const x = strX(s);
    const w = s===6 ? '2.5' : s===5 ? '2' : s===4 ? '1.5' : s===3 ? '1.2' : '1';
    svg.appendChild(el('line', {x1:x, y1:pT, x2:x, y2:pT+FRETS*fretH, stroke:'rgba(255,255,255,0.2)', 'stroke-width':w}));
  });

  // Fret numbers
  for (let f = 1; f <= FRETS; f++) {
    svg.appendChild(el('text', {x:pL-5, y:slotY(f)+4, 'text-anchor':'end', fill:'rgba(255,255,255,0.4)', 'font-size':'10', 'font-family':'system-ui'}, String(f)));
  }

  // Position markers (between str3 and str4)
  const mX = (strX(3)+strX(4))/2;
  dotFrets.forEach(f => {
    const y = slotY(f);
    if (f===12) {
      svg.appendChild(el('circle', {cx:mX-6, cy:y, r:'4', fill:'rgba(255,255,255,0.2)'}));
      svg.appendChild(el('circle', {cx:mX+6, cy:y, r:'4', fill:'rgba(255,255,255,0.2)'}));
    } else {
      svg.appendChild(el('circle', {cx:mX, cy:y, r:'4', fill:'rgba(255,255,255,0.2)'}));
    }
  });

  // Note dots on all strings (5&6 white, 4&3&2&1 dimmed)
  [6,5,4,3,2,1].forEach(s => {
    const notes = stringNotes[s];
    const x = strX(s);
    const primary = s === 6 || s === 5;
    const stroke = 'rgba(255,255,255,0.35)';
    const textFill = 'white';
    notes.forEach((note, idx) => {
      if (!note) return;
      const f = idx;
      const y = f === 0 ? slotY(1) - fretH : slotY(f);
      svg.appendChild(el('circle', {cx:x, cy:y, r:DOT_R, fill:'#111', stroke, 'stroke-width':'2'}));
      svg.appendChild(el('text', {x, y:y+4, 'text-anchor':'middle', fill:textFill, 'font-size':'10', 'font-weight':'bold', 'font-family':'system-ui'}, note));
    });
  });

  body.appendChild(svg);
}

function renderScalesSection(body) {
  const list = ['Major Modes','Blues Shapes','Melodic M Modes','Harmonic Minor','Diminished','Whole Tone'];
  list.forEach(name => {
    const item = document.createElement('p');
    item.style.cssText = 'font-size:15px;color:white;font-family:system-ui;margin:0 0 10px 0;';
    item.textContent = name;
    body.appendChild(item);
  });
  const note = document.createElement('p');
  note.style.cssText = 'font-size:13px;color:darkorange;font-family:system-ui;margin:16px 0 0 0;font-weight:bold;';
  note.textContent = '* Scale shapes on the fretboard appear in the Scales tab of the app.';
  body.appendChild(note);
}

function renderInstructionsSection(body) {
  const s = (text, bold) => { const p = document.createElement('p'); p.style.cssText = `font-size:13px;color:${bold?'white':'rgba(255,255,255,0.6)'};font-family:system-ui;margin:${bold?'12px':'0'} 0 8px 0;line-height:1.6;text-wrap:balance;${bold?'font-weight:bold;':''}`; if (bold) p.textContent = text; else p.innerHTML = text; body.appendChild(p); };
  const isBass = document.body.classList.contains('bass-mode');

  { const box = document.createElement('div');
    box.style.cssText = 'background:rgba(255,255,255,0.07);border-radius:10px;padding:12px 14px;margin-bottom:16px;';
    const title = document.createElement('p');
    title.style.cssText = 'font-size:13px;font-weight:bold;color:white;font-family:system-ui;margin:0 0 8px 0;';
    title.textContent = '👉 How to use this app:';
    box.appendChild(title);
    const steps = isBass
      ? ['1. Single Note — learn note positions on the fretboard', '2. Triads — find 3-note chord inversions', '3. 7th Chord — expand to 4-note inversions', '4. Scales — practice scale shapes on the fretboard']
      : ['1. Single Note — learn note positions on the fretboard', '2. Triads — find 3-note chord inversions', '3. 7th Chord — expand to 4-note inversions', '4. Tensions — add advanced chord colors', '5. Scales — practice scale shapes on the fretboard', '6. Beginners — practice open & barre chord shapes'];
    steps.forEach(step => {
      const p = document.createElement('p');
      p.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.7);font-family:system-ui;margin:0 0 4px 0;line-height:1.5;';
      p.textContent = step;
      box.appendChild(p);
    });
    body.appendChild(box); }

  s('FretChamp helps you practice notes, chord tones, inversions, arpeggios and scales — improving your fretboard visualization and real-time navigation.<br>Ideal for practicing when away from your guitar.', false);
  { const p = document.createElement('p'); p.style.cssText = 'font-size:13px;color:darkorange;font-family:system-ui;margin:12px 0 8px 0;line-height:1.6;font-weight:bold;white-space:pre-line;'; p.textContent = 'Each page has a "How to" button,\ntap it to learn what to do.'; body.appendChild(p); }
  if (!isBass) {
    s('Please note: this app is not intended for teaching chord shapes — but it does include a Beginners section for open and barre chords.', false);
    { const p = document.createElement('p'); p.style.cssText = 'font-size:13px;color:white;font-family:system-ui;margin:0 0 8px 0;line-height:1.6;text-wrap:balance;'; p.textContent = 'To switch to Bass mode, tap the "Go Bass" button at the bottom-right of the screen.'; body.appendChild(p); }
  }
  s('This is a beta version — your feedback helps us improve! Use the Feedback button on the home page to share your thoughts.', false);
  s('Have fun and good luck!', true);
}

function renderChordListSection(tab) {
  const body = document.getElementById('cl-body');
  body.innerHTML = '';
  const subtitles = {
    strings56: 'Welcome :-)',
    open:      'Open chord shapes',
    barre:     'Barre chord shapes',
    triads:    'Inversions for 3-note chords',
    sevenths:  'Inversions for 4-note chords',
    slash:     'Chord with a specific bass note',
    scales:    'Scale list in the app',
    jazz:      'Common jazz chord shapes',
  };
  if (subtitles[tab]) {
    const h = document.createElement('p');
    h.className = 'cl-subtitle';
    h.textContent = subtitles[tab];
    body.appendChild(h);
  }
  if (tab === 'strings56') { renderInstructionsSection(body); return; }
  if (tab === 'scales') { renderScalesSection(body); return; }
  if (tab === 'jazz') { renderJazzTable(body); return; }
  if (false) { // placeholder
    const intro = document.createElement('p');
    intro.style.cssText = 'font-size:13px;color:rgba(255,255,255,0.6);font-family:system-ui;margin:0 0 16px 0;line-height:1.6;';
    intro.innerHTML = 'This app helps users practice notes, chord tones, and inversions (through string locking), while improving fretboard visualization, navigation, and control of the guitar grid. It is ideal for practicing when away from your guitar, such as while waiting in line, commuting, or traveling.<br>Suitable for both beginners and advanced players.<br><br>Please note: This app is not intended for teaching or memorizing chord shapes.';
    body.appendChild(intro);
    const sub = document.createElement('p');
    sub.style.cssText = 'font-size:13px;color:white;font-family:system-ui;margin:0 0 8px 0;font-weight:bold;';
    sub.textContent = '1. Single note greed';
    body.appendChild(sub);
    const line = document.createElement('p');
    line.style.cssText = 'font-size:13px;color:rgba(255,255,255,0.6);font-family:system-ui;margin:0 0 8px 0;line-height:1.6;';
    line.innerHTML = 'Know and practice the note positions on the guitar fretboard. Fretboard fluency will allow you to improvise solos and find chord shapes in real time.<br><br>Beginners: Start with strings 5 &amp; 6 — they hold the root notes for all basic chord shapes. Use the string lock to focus on those strings first.';
    body.appendChild(line);
    const sub2 = document.createElement('p');
    sub2.style.cssText = 'font-size:13px;color:white;font-family:system-ui;margin:12px 0 8px 0;font-weight:bold;';
    sub2.textContent = '2. Basic chord shapes';
    body.appendChild(sub2);
    const line2 = document.createElement('p');
    line2.style.cssText = 'font-size:13px;color:rgba(255,255,255,0.6);font-family:system-ui;margin:0 0 8px 0;line-height:1.6;';
    line2.textContent = 'Suitable for beginners — practice open chords and barre chords with the root on strings 5 & 6.';
    body.appendChild(line2);
    const sub3 = document.createElement('p');
    sub3.style.cssText = 'font-size:13px;color:white;font-family:system-ui;margin:12px 0 8px 0;font-weight:bold;';
    sub3.textContent = '3. Triads inverts';
    body.appendChild(sub3);
    const line3 = document.createElement('p');
    line3.style.cssText = 'font-size:13px;color:rgba(255,255,255,0.6);font-family:system-ui;margin:0 0 8px 0;line-height:1.6;';
    line3.textContent = 'Practice 3-note chord inversions across 4 string sets. Note that each string set contains 3 positions.';
    body.appendChild(line3);
    const sub4 = document.createElement('p');
    sub4.style.cssText = 'font-size:13px;color:white;font-family:system-ui;margin:12px 0 8px 0;font-weight:bold;';
    sub4.textContent = '4. Four-note chord inversions';
    body.appendChild(sub4);
    const line4 = document.createElement('p');
    line4.style.cssText = 'font-size:13px;color:rgba(255,255,255,0.6);font-family:system-ui;margin:0 0 8px 0;line-height:1.6;';
    line4.textContent = 'Practice 7th chord inversions across 3 string sets. Each set contains 4 inversions.';
    body.appendChild(line4);
    const sub5 = document.createElement('p');
    sub5.style.cssText = 'font-size:13px;color:white;font-family:system-ui;margin:12px 0 8px 0;font-weight:bold;';
    sub5.textContent = '5. Slash chords';
    body.appendChild(sub5);
    const line5 = document.createElement('p');
    line5.style.cssText = 'font-size:13px;color:rgba(255,255,255,0.6);font-family:system-ui;margin:0 0 8px 0;line-height:1.6;';
    line5.textContent = 'Practice slash chord shapes. The note after the slash is the bass note of the chord — place it on the bass string (5 or 6).';
    body.appendChild(line5);
    const sub6 = document.createElement('p');
    sub6.style.cssText = 'font-size:13px;color:white;font-family:system-ui;margin:12px 0 8px 0;font-weight:bold;';
    sub6.textContent = '6. Jazz / Advanced chords';
    body.appendChild(sub6);
    const line6 = document.createElement('p');
    line6.style.cssText = 'font-size:13px;color:rgba(255,255,255,0.6);font-family:system-ui;margin:0 0 8px 0;line-height:1.6;';
    line6.textContent = 'This is the core of the app. Practice 4-note chord shapes with tensions — you will be able to grab and play any chord in real time.';
    body.appendChild(line6);
    const sub7 = document.createElement('p');
    sub7.style.cssText = 'font-size:13px;color:white;font-family:system-ui;margin:12px 0 8px 0;font-weight:bold;';
    sub7.textContent = '7. Scales';
    body.appendChild(sub7);
    const line7 = document.createElement('p');
    line7.style.cssText = 'font-size:13px;color:rgba(255,255,255,0.6);font-family:system-ui;margin:0 0 8px 0;line-height:1.6;';
    line7.textContent = 'Practice all important scales.';
    body.appendChild(line7);
    return;
  }
  const items = chordListData[tab] || [];
  let grid = null;
  items.forEach(item => {
    if (item.section !== undefined) {
      const title = document.createElement('p');
      title.className = 'cl-section-title';
      title.textContent = item.section;
      body.appendChild(title);
      grid = document.createElement('div');
      grid.className = 'cl-chord-grid';
      body.appendChild(grid);
    } else if (grid) {
      const wrap = document.createElement('div');
      wrap.className = 'cl-chord-item';
      wrap.appendChild(makeChordSVG(item));
      const lbl = document.createElement('span');
      lbl.className = 'cl-chord-name';
      lbl.textContent = item.name;
      wrap.appendChild(lbl);
      grid.appendChild(wrap);
    }
  });
  if (tab === 'triads' || tab === 'sevenths') renderCustomSets(body, tab);
}

// ── Custom Chord Sets (editable, persisted in localStorage) ──────────────────

function getCustomSets() {
  try { return JSON.parse(localStorage.getItem('customChordSets') || '{}'); } catch { return {}; }
}
function saveCustomSets(data) {
  localStorage.setItem('customChordSets', JSON.stringify(data));
}
function emptyDiagram() {
  return { name: '', startFret: 1, heads: {}, dots: {} };
}
function emptySet(tab) {
  const count = tab === 'sevenths' ? 4 : 3;
  return { title: '', diagrams: Array.from({ length: count }, emptyDiagram) };
}

function makeEditableDiagramSVG(diag, onChange) {
  const W = 72, H = 96;
  const pL = 10, pR = 10, pT = 20, pB = 8;
  const gW = W - pL - pR, gH = H - pT - pB;
  const STRINGS = 6, FRETS = 5;
  const sx = i => pL + (i * gW / (STRINGS - 1));
  const fy = j => pT + (j * gH / FRETS);
  const slotY = r => pT + (r - 0.5) * gH / FRETS;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W); svg.setAttribute('height', H);

  const el = (tag, attrs) => {
    const e = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    return e;
  };

  function redraw() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const sf = diag.startFret || 1;

    for (let i = 0; i < STRINGS; i++)
      svg.appendChild(el('line', { x1:sx(i),y1:fy(0),x2:sx(i),y2:fy(FRETS), stroke:'rgba(255,255,255,0.5)', 'stroke-width':'1' }));
    for (let j = 0; j <= FRETS; j++)
      svg.appendChild(el('line', { x1:sx(0),y1:fy(j),x2:sx(STRINGS-1),y2:fy(j),
        stroke:'rgba(255,255,255,0.5)', 'stroke-width': j===0 && sf===1 ? '4' : '1' }));
    if (sf > 1) {
      const t = el('text', { x:sx(STRINGS-1)+3, y:fy(1)-2, fill:'rgba(255,255,255,0.6)', 'font-size':'7', 'font-family':'system-ui' });
      t.textContent = `${sf}fr`; svg.appendChild(t);
    }

    // Above-nut indicators
    for (let s = 1; s <= 6; s++) {
      const x = sx(6 - s), h = diag.heads[`s${s}`] || 'none';
      if (h === 'muted') {
        const t = el('text', { x, y:pT-6, 'text-anchor':'middle', fill:'rgba(255,255,255,0.8)', 'font-size':'9', 'font-family':'system-ui' });
        t.textContent = '✕'; svg.appendChild(t);
      } else if (h === 'open') {
        svg.appendChild(el('circle', { cx:x, cy:pT-8, r:'4', fill:'none', stroke:'rgba(255,255,255,0.7)', 'stroke-width':'1.5' }));
      }
    }

    // Dots
    for (let s = 1; s <= 6; s++) {
      for (let r = 1; r <= FRETS; r++) {
        const state = diag.dots[`s${s}r${r}`];
        if (state) svg.appendChild(el('circle', { cx:sx(6-s), cy:slotY(r), r:'5.5', fill: state==='root' ? 'darkorange' : 'white' }));
      }
    }

    // Clickable above-nut areas
    for (let s = 1; s <= 6; s++) {
      const r = el('rect', { x:sx(6-s)-7, y:2, width:14, height:pT-4, fill:'transparent', cursor:'pointer' });
      r.addEventListener('click', () => {
        const cur = diag.heads[`s${s}`] || 'none';
        const nxt = { none:'muted', muted:'open', open:'none' }[cur];
        if (nxt === 'none') delete diag.heads[`s${s}`]; else diag.heads[`s${s}`] = nxt;
        onChange(); redraw();
      });
      svg.appendChild(r);
    }

    // Clickable fret slots
    const slotH = gH / FRETS, slotW = gW / (STRINGS - 1);
    for (let s = 1; s <= 6; s++) {
      for (let rf = 1; rf <= FRETS; rf++) {
        const r = el('rect', { x:sx(6-s)-slotW/2, y:slotY(rf)-slotH/2, width:slotW, height:slotH, fill:'transparent', cursor:'pointer' });
        r.addEventListener('click', () => {
          const key = `s${s}r${rf}`;
          const cur = diag.dots[key] || 'none';
          if (cur === 'none') {
            diag.dots[key] = 'white';
          } else if (cur === 'white') {
            Object.keys(diag.dots).forEach(k => { if (diag.dots[k] === 'root') diag.dots[k] = 'white'; });
            diag.dots[key] = 'root';
          } else {
            delete diag.dots[key];
          }
          onChange(); redraw();
        });
        svg.appendChild(r);
      }
    }
  }
  redraw();
  return svg;
}

function renderCustomSets(body, tab) {
  const data = getCustomSets();
  const sets = (data[tab] || []);

  sets.forEach((set, setIdx) => {
    const titleRow = document.createElement('div');
    titleRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-top:18px;margin-bottom:4px;';

    const titleEl = document.createElement('span');
    titleEl.contentEditable = true;
    titleEl.className = 'cl-section-title';
    titleEl.style.cssText += 'outline:none;border-bottom:1px dashed rgba(255,255,255,0.3);min-width:80px;';
    titleEl.textContent = set.title || 'New String Set';
    titleEl.addEventListener('blur', () => { set.title = titleEl.textContent; saveCustomSets(data); });

    const delBtn = document.createElement('button');
    delBtn.textContent = '✕';
    delBtn.style.cssText = 'background:none;border:none;color:rgba(255,255,255,0.4);cursor:pointer;font-size:14px;padding:0 4px;';
    delBtn.addEventListener('click', () => {
      data[tab].splice(setIdx, 1); saveCustomSets(data); renderChordListSection(tab);
    });

    titleRow.appendChild(titleEl); titleRow.appendChild(delBtn);
    body.appendChild(titleRow);

    const grid = document.createElement('div');
    grid.className = 'cl-chord-grid';
    body.appendChild(grid);

    const onChange = () => saveCustomSets(data);

    set.diagrams.forEach(diag => {
      const wrap = document.createElement('div');
      wrap.className = 'cl-chord-item';

      // Fret selector
      const fretRow = document.createElement('div');
      fretRow.style.cssText = 'display:flex;align-items:center;gap:3px;justify-content:center;margin-bottom:2px;';
      const fretLbl = document.createElement('span');
      fretLbl.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.5);font-family:system-ui;min-width:28px;text-align:center;';
      fretLbl.textContent = `fr ${diag.startFret || 1}`;
      const mkBtn = (txt) => {
        const b = document.createElement('button');
        b.textContent = txt;
        b.style.cssText = 'background:none;border:1px solid rgba(255,255,255,0.3);color:white;cursor:pointer;padding:1px 5px;font-size:9px;border-radius:3px;line-height:1.4;';
        return b;
      };
      const up = mkBtn('+'), dn = mkBtn('−');
      up.addEventListener('click', () => { diag.startFret = Math.min(12, (diag.startFret||1)+1); fretLbl.textContent=`fr ${diag.startFret}`; onChange(); });
      dn.addEventListener('click', () => { diag.startFret = Math.max(1, (diag.startFret||1)-1); fretLbl.textContent=`fr ${diag.startFret}`; onChange(); });
      fretRow.append(dn, fretLbl, up);
      wrap.appendChild(fretRow);

      wrap.appendChild(makeEditableDiagramSVG(diag, onChange));

      const nameEl = document.createElement('div');
      nameEl.contentEditable = true;
      nameEl.className = 'cl-chord-name';
      nameEl.style.cssText += 'outline:none;border-bottom:1px dashed rgba(255,255,255,0.2);min-height:14px;';
      nameEl.textContent = diag.name || '';
      nameEl.addEventListener('blur', () => { diag.name = nameEl.textContent; onChange(); });
      wrap.appendChild(nameEl);

      grid.appendChild(wrap);
    });
  });

  // Add String Set button
  const addBtn = document.createElement('button');
  addBtn.textContent = '+ Add String Set';
  addBtn.style.cssText = 'margin-top:16px;background:rgba(255,255,255,0.08);color:white;border:1px solid rgba(255,255,255,0.25);border-radius:8px;padding:8px 16px;cursor:pointer;font-size:13px;font-family:system-ui;width:100%;';
  addBtn.addEventListener('click', () => {
    const d = getCustomSets();
    if (!d[tab]) d[tab] = [];
    d[tab].push(emptySet(tab));
    saveCustomSets(d);
    renderChordListSection(tab);
  });
  body.appendChild(addBtn);
}

function renderJazzTable(body) {
  const note = document.createElement('p');
  note.style.cssText = 'font-size:13px;color:white;margin-bottom:8px;margin-top:-8px;font-family:system-ui;';
  note.textContent = 'Root = C • 5th omitted where possible';
  body.appendChild(note);

  const table = document.createElement('table');
  table.className = 'cl-jazz-table';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Chord</th><th>Root<br>str 6</th><th>Root<br>str 5</th><th>Root<br>str 4</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');

  jazzTableData.forEach(row => {
    const tr = document.createElement('tr');
    if (row.section) {
      tr.className = 'cl-jazz-section';
      tr.innerHTML = `<td colspan="4">${row.section}</td>`;
    } else {
      const tdName = document.createElement('td');
      tdName.textContent = row.name;
      tr.appendChild(tdName);
      [[row.r6,6],[row.r5,5],[row.r4,4]].forEach(([v,rs]) => {
        const td = document.createElement('td');
        if (v) td.appendChild(makeChordSVG(v, rs));
        else { const ph = document.createElement('div'); ph.className='cl-empty-cell'; ph.textContent='—'; td.appendChild(ph); }
        tr.appendChild(td);
      });
    }
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  body.appendChild(table);
}

document.addEventListener('DOMContentLoaded', () => {
const clModal = document.getElementById('chord-list-modal');
const clBtn = document.getElementById('chord-list-btn');
const clClose = clModal.querySelector('.cl-close');

const closeGuide = () => {
  clModal.classList.remove('open');
  homeBtn.click();
};

clClose.addEventListener('click', closeGuide);

window.addEventListener('popstate', e => {
  if (clModal.classList.contains('open')) {
    clModal.classList.remove('open');
    homeBtn.click();
  }
});

clModal.querySelectorAll('.cl-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    clModal.querySelectorAll('.cl-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderChordListSection(tab.dataset.tab);
  });
});
}); // DOMContentLoaded

