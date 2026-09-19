/*
 * sfx.js - dependency-free Web Audio sound effects + chiptune music for Tetris.
 * Loaded via a plain <script src="sfx.js"></script> (no ES modules).
 * Exposes a single global: window.SFX
 *
 * Every public method is defensive: if the Web Audio API is missing, the
 * AudioContext failed to create, or init() hasn't run yet, calls are silent
 * no-ops and never throw.
 */
(function () {
  'use strict';

  var MUTE_KEY = 'pct.muted';
  var MASTER_VOLUME = 0.15;

  var ctx = null;          // lazily created AudioContext
  var masterGain = null;   // single gain node all sound routes through
  var noiseBuffer = null;  // cached white-noise buffer for percussive hits
  var musicTimer = null;   // setTimeout handle for the music scheduler
  var musicPlaying = false;

  // Read persisted mute preference (defaults to false / unmuted).
  var storedMuted = false;
  try {
    storedMuted = localStorage.getItem(MUTE_KEY) === 'true';
  } catch (e) { /* localStorage unavailable (privacy mode, etc.) - ignore */ }

  // ---- note frequency helper (equal temperament, A4 = 440Hz) -----------
  var NOTE_OFFSETS = {
    C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4,
    'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2
  };
  function noteFreq(note) {
    var m = /^([A-G]#?)(\d)$/.exec(note);
    if (!m) return 0;
    var semis = NOTE_OFFSETS[m[1]] + (parseInt(m[2], 10) - 4) * 12;
    return 440 * Math.pow(2, semis / 12);
  }

  // ---- core helpers -------------------------------------------------
  function ensureNoiseBuffer() {
    if (noiseBuffer || !ctx) return noiseBuffer;
    var len = ctx.sampleRate * 0.3;
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffer = buf;
    return noiseBuffer;
  }

  // Play a simple oscillator "blip" with a short attack/decay envelope.
  function tone(freq, when, dur, type, peak) {
    if (!ctx || !masterGain) return;
    type = type || 'square';
    peak = peak == null ? 0.5 : peak;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(peak, when + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  // A pitch that slides from freq1 to freq2 - handy for drops/whooshes.
  function sweep(freq1, freq2, when, dur, type, peak) {
    if (!ctx || !masterGain) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq1, when);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freq2, 1), when + dur);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(peak == null ? 0.5 : peak, when + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  // Short burst of filtered white noise - used for percussive clicks/thuds.
  function noiseHit(when, dur, freq, peak) {
    if (!ctx || !masterGain) return;
    var buf = ensureNoiseBuffer();
    if (!buf) return;
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = freq || 800;
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(peak == null ? 0.4 : peak, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(filt);
    filt.connect(gain);
    gain.connect(masterGain);
    src.start(when);
    src.stop(when + dur + 0.02);
  }

  function now() { return ctx ? ctx.currentTime : 0; }

  // ---- public API -----------------------------------------------------
  var SFX = {
    muted: storedMuted,

    // Create (or resume) the AudioContext. Call this from a user gesture
    // handler (click/keydown). Safe to call repeatedly.
    init: function () {
      try {
        if (!ctx) {
          var Ctor = window.AudioContext || window.webkitAudioContext;
          if (!Ctor) return;
          ctx = new Ctor();
          masterGain = ctx.createGain();
          masterGain.gain.value = SFX.muted ? 0 : MASTER_VOLUME;
          masterGain.connect(ctx.destination);
        }
        if (ctx.state === 'suspended') ctx.resume();
      } catch (e) { /* Web Audio unsupported/blocked - stay silent */ }
    },

    move: function () {
      try { tone(220, now(), 0.045, 'square', 0.35); } catch (e) {}
    },

    rotate: function () {
      try { sweep(300, 420, now(), 0.07, 'square', 0.35); } catch (e) {}
    },

    softDrop: function () {
      try { tone(150, now(), 0.04, 'square', 0.3); } catch (e) {}
    },

    hardDrop: function () {
      try {
        var t = now();
        sweep(500, 90, t, 0.12, 'sawtooth', 0.4);
        noiseHit(t + 0.08, 0.08, 200, 0.35);
      } catch (e) {}
    },

    lock: function () {
      try { noiseHit(now(), 0.05, 900, 0.3); } catch (e) {}
    },

    // n = number of lines cleared, 1..4. Bigger/longer + ascending
    // arpeggio for a 4-line "tetris".
    lineClear: function (n) {
      try {
        n = Math.max(1, Math.min(4, n | 0 || 1));
        var t = now();
        var base = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5 E5 G5 C6 E6
        var count = n === 4 ? 5 : n + 1;
        var step = n === 4 ? 0.07 : 0.09;
        for (var i = 0; i < count; i++) {
          tone(base[Math.min(i, base.length - 1)], t + i * step, n === 4 ? 0.18 : 0.12,
            'square', n === 4 ? 0.45 : 0.35);
        }
      } catch (e) {}
    },

    hold: function () {
      try { tone(392, now(), 0.06, 'triangle', 0.3); } catch (e) {}
    },

    levelUp: function () {
      try {
        var t = now();
        var notes = [261.63, 329.63, 392.0, 523.25]; // C4 E4 G4 C5
        for (var i = 0; i < notes.length; i++) {
          tone(notes[i], t + i * 0.08, 0.15, 'square', 0.4);
        }
      } catch (e) {}
    },

    gameOver: function () {
      try {
        var t = now();
        var notes = [392.0, 349.23, 293.66, 261.63]; // G4 F4 D4 C4, descending
        for (var i = 0; i < notes.length; i++) {
          tone(notes[i], t + i * 0.16, 0.3, 'sawtooth', 0.4);
        }
      } catch (e) {}
    },

    // Flip mute state, persist it, apply immediately, and return new state.
    toggle: function () {
      try {
        SFX.muted = !SFX.muted;
        if (masterGain) masterGain.gain.value = SFX.muted ? 0 : MASTER_VOLUME;
        try { localStorage.setItem(MUTE_KEY, String(SFX.muted)); } catch (e) {}
      } catch (e) {}
      return SFX.muted;
    },

    // ---- background music (Korobeiniki-style, public domain) ---------
    startMusic: function () {
      try {
        if (!ctx || musicPlaying) return;
        musicPlaying = true;
        scheduleMusicLoop();
      } catch (e) {}
    },

    stopMusic: function () {
      try {
        musicPlaying = false;
        if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
      } catch (e) {}
    }
  };

  // Simplified opening phrase of "Korobeiniki" (public-domain Russian folk
  // tune). [note, duration-in-eighth-notes]; '-' is a rest.
  var MELODY = [
    ['E5', 2], ['B4', 1], ['C5', 1], ['D5', 2], ['C5', 1], ['B4', 1],
    ['A4', 2], ['A4', 1], ['C5', 1], ['E5', 2], ['D5', 1], ['C5', 1],
    ['B4', 3], ['C5', 1], ['D5', 2], ['E5', 2],
    ['C5', 2], ['A4', 2], ['A4', 2], ['-', 2],
    ['D5', 2], ['F5', 1], ['A5', 2], ['G5', 1], ['F5', 1],
    ['E5', 3], ['C5', 1], ['E5', 2],
    ['D5', 1], ['C5', 1], ['B4', 2], ['B4', 1], ['C5', 1],
    ['D5', 2], ['E5', 2],
    ['C5', 2], ['A4', 2], ['A4', 2], ['-', 2]
  ];
  var EIGHTH = 0.16; // seconds per eighth note (~fast chiptune tempo)

  // Schedules one pass of the melody a little ahead of real time, then
  // re-invokes itself so the tune loops for as long as musicPlaying is true.
  function scheduleMusicLoop() {
    if (!musicPlaying || !ctx) return;
    var t = now() + 0.05;
    var total = 0;
    for (var i = 0; i < MELODY.length; i++) {
      var note = MELODY[i][0];
      var beats = MELODY[i][1];
      var dur = beats * EIGHTH;
      if (note !== '-' && !SFX.muted) {
        tone(noteFreq(note), t + total, dur * 0.9, 'square', 0.22);
      }
      total += dur;
    }
    musicTimer = setTimeout(scheduleMusicLoop, total * 1000);
  }

  window.SFX = SFX;
})();
