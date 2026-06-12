// Premium breathing sound effects using Web Audio API
// Ambient, calming tones instead of clicks

let audioCtx: AudioContext | null = null;

function getCtx() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/** Smooth ambient pad tone with gentle attack and long release */
function playPad(
  frequency: number,
  duration = 1.5,
  volume = 0.08,
) {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;

    // Main oscillator - sine for warmth
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(frequency, now);

    // Subtle detuned layer for richness
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(frequency * 1.002, now); // slight detune

    // Sub layer for depth
    const osc3 = ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(frequency * 0.5, now);

    // Gain envelopes
    const gain1 = ctx.createGain();
    const gain2 = ctx.createGain();
    const gain3 = ctx.createGain();

    // Smooth attack (0.3s) and long release
    const attack = 0.3;
    const release = duration * 0.6;
    
    [gain1, gain2, gain3].forEach((g, i) => {
      const v = i === 2 ? volume * 0.3 : i === 1 ? volume * 0.5 : volume;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(v, now + attack);
      g.gain.setValueAtTime(v, now + duration - release);
      g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    });

    // Low-pass filter for warmth
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, now);
    filter.Q.setValueAtTime(0.5, now);

    osc1.connect(gain1).connect(filter);
    osc2.connect(gain2).connect(filter);
    osc3.connect(gain3).connect(filter);
    filter.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);
    osc3.stop(now + duration);
  } catch {
    // Audio not available
  }
}

/** Gentle singing bowl sound */
function playSingingBowl(frequency: number, duration = 2, volume = 0.06) {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, now);
    // Subtle vibrato
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(3, now);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(2, now);
    lfo.connect(lfoGain).connect(osc.frequency);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, now);
    filter.frequency.exponentialRampToValueAtTime(800, now + duration);

    osc.connect(gain).connect(filter).connect(ctx.destination);
    lfo.start(now);
    osc.start(now);
    lfo.stop(now + duration);
    osc.stop(now + duration);
  } catch {
    // Audio not available
  }
}

/** Soft chime for start */
export function playChime() {
  playSingingBowl(528, 2.5, 0.07); // C5 — Solfeggio 528Hz
}

/** Completion: warm ascending chord */
export function playComplete() {
  playPad(396, 2.5, 0.06);         // G4
  setTimeout(() => playPad(528, 2.5, 0.07), 300);  // C5
  setTimeout(() => playPad(660, 3, 0.06), 600);    // E5
}

/** Phase-specific ambient sounds */
export const phaseSounds = {
  inhale: () => playPad(264, 2, 0.06),        // C4 — grounding
  hold: () => playPad(330, 1.5, 0.04),        // E4 — gentle
  exhale: () => playPad(198, 2.5, 0.06),      // G3 — deep, releasing
  rest: () => playPad(264, 1.2, 0.03),        // C4 — very quiet
};

/** Gentle tick — soft tone instead of harsh click */
export function playTick() {
  try {
    const ctx = getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.03, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  } catch {
    // Audio not available
  }
}

// ─── Haptics (Vibration API) ────────────────────────────────────────────────

export function vibrate(pattern: number | number[]) {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Not supported
  }
}

export const phaseHaptics = {
  inhale: () => vibrate([20, 40, 20]),
  hold: () => vibrate(15),
  exhale: () => vibrate([30, 20, 30, 20, 30]),
  rest: () => vibrate(10),
};

export function vibrateComplete() {
  vibrate([60, 80, 60, 80, 120]);
}
