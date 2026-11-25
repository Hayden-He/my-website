export function createBreakoutAudio({ isEnabled }) {
  let noiseBuffer = null;
  let lastWallAt = 0;
  let lastBrickAt = 0;

  function getNoiseBuffer(ac) {
    if (noiseBuffer && noiseBuffer.sampleRate === ac.sampleRate) return noiseBuffer;
    const len = Math.floor(ac.sampleRate * 0.25);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    noiseBuffer = buf;
    return buf;
  }

  function withAudio(fn) {
    if (!isEnabled() || !window.SiteData) return;
    window.SiteData.withAudio((ac) => {
      try {
        fn(ac);
      } catch {}
    });
  }

  function playTone({ type = 'sine', from = 440, to = null, duration = 0.06, gain = 0.06, delay = 0 }) {
    withAudio((ac) => {
      const start = ac.currentTime + delay;
      const osc = ac.createOscillator();
      const env = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, start);
      if (to) osc.frequency.exponentialRampToValueAtTime(to, start + duration);
      env.gain.setValueAtTime(0.001, start);
      env.gain.linearRampToValueAtTime(gain, start + 0.006);
      env.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(env);
      env.connect(ac.destination);
      osc.start(start);
      osc.stop(start + duration + 0.01);
    });
  }

  function playPaddleHit(magnet = false) {
    playTone({ type: 'triangle', from: magnet ? 520 : 340, to: magnet ? 760 : 460, duration: 0.055, gain: 0.065 });
  }

  function playWallHit() {
    const now = performance.now();
    if (now - lastWallAt < 45) return;
    lastWallAt = now;
    playTone({ type: 'sine', from: 250, to: 190, duration: 0.04, gain: 0.035 });
  }

  function playBrickHit({ destroyed = true, indestructible = false, combo = 1 } = {}) {
    const now = performance.now();
    if (now - lastBrickAt < 28) return;
    lastBrickAt = now;
    if (indestructible) {
      playTone({ type: 'square', from: 980, to: 820, duration: 0.045, gain: 0.035 });
      return;
    }
    const base = 420 + Math.min(combo, 10) * 34;
    if (destroyed) {
      playTone({ type: 'triangle', from: base, to: base * 1.25, duration: 0.065, gain: 0.06 });
    } else {
      playTone({ type: 'square', from: 320, to: 260, duration: 0.045, gain: 0.04 });
    }
  }

  function playBombExplode() {
    withAudio((ac) => {
      const start = ac.currentTime;
      const src = ac.createBufferSource();
      src.buffer = getNoiseBuffer(ac);
      const filter = ac.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(640, start);
      filter.frequency.exponentialRampToValueAtTime(110, start + 0.22);
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.14, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ac.destination);
      src.start(start);
      src.stop(start + 0.25);
    });
  }

  function playLaser() {
    playTone({ type: 'sawtooth', from: 920, to: 380, duration: 0.06, gain: 0.035 });
  }

  function playPowerup(kind) {
    const up = kind === 'life' ? [523, 659, 784, 1047] : [480, 640, 820];
    up.forEach((freq, i) => {
      playTone({ type: 'triangle', from: freq, duration: 0.08, gain: 0.055, delay: i * 0.045 });
    });
  }

  function playLifeLost() {
    playTone({ type: 'sawtooth', from: 310, to: 120, duration: 0.22, gain: 0.08 });
  }

  function playLevelClear() {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      playTone({ type: 'triangle', from: freq, duration: 0.16, gain: 0.065, delay: i * 0.07 });
    });
  }

  function playGameOver() {
    [392, 330, 262, 196].forEach((freq, i) => {
      playTone({ type: 'sawtooth', from: freq, duration: 0.14, gain: 0.05, delay: i * 0.085 });
    });
  }

  return {
    playPaddleHit,
    playWallHit,
    playBrickHit,
    playBombExplode,
    playLaser,
    playPowerup,
    playLifeLost,
    playLevelClear,
    playGameOver,
  };
}
