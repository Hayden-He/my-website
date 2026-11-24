export function createFruitAudio({ isEnabled }) {
  let cachedNoiseBuf = null;
  let lastSwooshAt = 0;

  function getNoiseBuffer(ac) {
    if (cachedNoiseBuf && cachedNoiseBuf.sampleRate === ac.sampleRate) return cachedNoiseBuf;
    const len = Math.floor(ac.sampleRate * 0.5);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    cachedNoiseBuf = buf;
    return buf;
  }

  function withAudio(fn) {
    if (!isEnabled() || !window.SiteData) return;
    window.SiteData.withAudio((ac) => {
      try { fn(ac); } catch {}
    });
  }

  function playSwoosh() {
    const now = performance.now();
    if (now - lastSwooshAt < 220) return;
    lastSwooshAt = now;
    withAudio((ac) => {
      const t0 = ac.currentTime;
      const src = ac.createBufferSource();
      src.buffer = getNoiseBuffer(ac);
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1450, t0);
      bp.frequency.exponentialRampToValueAtTime(360, t0 + 0.075);
      bp.Q.setValueAtTime(2.2, t0);
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.linearRampToValueAtTime(0.11, t0 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
      src.connect(bp);
      bp.connect(gain);
      gain.connect(ac.destination);
      src.start(t0);
      src.stop(t0 + 0.085);
    });
  }

  function playSlice(pitchBoost) {
    withAudio((ac) => {
      const t0 = ac.currentTime;
      const boost = Math.min(pitchBoost || 0, 8);

      const src = ac.createBufferSource();
      src.buffer = getNoiseBuffer(ac);
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(3100, t0);
      bp.frequency.exponentialRampToValueAtTime(920, t0 + 0.045);
      bp.Q.setValueAtTime(1.5, t0);
      const nGain = ac.createGain();
      nGain.gain.setValueAtTime(0.15, t0);
      nGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);
      src.connect(bp);
      bp.connect(nGain);
      nGain.connect(ac.destination);
      src.start(t0);
      src.stop(t0 + 0.055);

      const thud = ac.createOscillator();
      const tGain = ac.createGain();
      thud.type = 'triangle';
      thud.frequency.setValueAtTime(250 + boost * 12, t0);
      thud.frequency.exponentialRampToValueAtTime(115, t0 + 0.055);
      tGain.gain.setValueAtTime(0.13, t0);
      tGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.06);
      thud.connect(tGain);
      tGain.connect(ac.destination);
      thud.start(t0);
      thud.stop(t0 + 0.065);

      const base = 390 + boost * 48;
      for (let i = 0; i < 2; i += 1) {
        const delay = i * 0.018;
        const pop = ac.createOscillator();
        const pGain = ac.createGain();
        const fStart = i === 0 ? base : base * 1.18;
        pop.type = 'sine';
        pop.frequency.setValueAtTime(fStart * 0.78, t0 + delay);
        pop.frequency.exponentialRampToValueAtTime(fStart * 1.48, t0 + delay + 0.058);
        pGain.gain.setValueAtTime(i === 0 ? 0.14 : 0.1, t0 + delay);
        pGain.gain.exponentialRampToValueAtTime(0.001, t0 + delay + 0.068);
        pop.connect(pGain);
        pGain.connect(ac.destination);
        pop.start(t0 + delay);
        pop.stop(t0 + delay + 0.072);
      }
    });
  }

  function playBombFuse() {
    withAudio((ac) => {
      const t0 = ac.currentTime;
      const src = ac.createBufferSource();
      src.buffer = getNoiseBuffer(ac);
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(3200, t0);
      bp.frequency.exponentialRampToValueAtTime(4400, t0 + 0.34);
      bp.Q.setValueAtTime(2.6, t0);
      const nGain = ac.createGain();
      nGain.gain.setValueAtTime(0.11, t0);
      nGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.34);
      src.connect(bp);
      bp.connect(nGain);
      nGain.connect(ac.destination);
      src.start(t0);
      src.stop(t0 + 0.36);

      for (const [freq, delay] of [[880, 0], [1046, 0.14]]) {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t0 + delay);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.72, t0 + delay + 0.085);
        gain.gain.setValueAtTime(0.13, t0 + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + delay + 0.095);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(t0 + delay);
        osc.stop(t0 + delay + 0.1);
      }
    });
  }

  function playMiss() {
    withAudio((ac) => {
      const t0 = ac.currentTime;
      const freqs = [[340, 230, 0], [240, 155, 0.075]];
      for (const [f1, f2, d] of freqs) {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f1, t0 + d);
        osc.frequency.exponentialRampToValueAtTime(f2, t0 + d + 0.085);
        gain.gain.setValueAtTime(0.14, t0 + d);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + d + 0.095);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(t0 + d);
        osc.stop(t0 + d + 0.1);
      }
    });
  }

  function playCombo(n) {
    withAudio((ac) => {
      const notes = [523, 659, 784, 1046];
      const count = Math.min(4, Math.max(2, n - 1));
      for (let i = 0; i < count; i += 1) {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        const start = ac.currentTime + i * 0.048;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(notes[i], start);
        gain.gain.setValueAtTime(0.13, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(start);
        osc.stop(start + 0.17);
      }
    });
  }

  function playBomb() {
    withAudio((ac) => {
      const t0 = ac.currentTime;
      const crack = ac.createBufferSource();
      crack.buffer = getNoiseBuffer(ac);
      const hp = ac.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(1600, t0);
      const cGain = ac.createGain();
      cGain.gain.setValueAtTime(0.24, t0);
      cGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.06);
      crack.connect(hp);
      hp.connect(cGain);
      cGain.connect(ac.destination);
      crack.start(t0);
      crack.stop(t0 + 0.065);

      const src = ac.createBufferSource();
      src.buffer = getNoiseBuffer(ac);
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1800, t0);
      lp.frequency.exponentialRampToValueAtTime(140, t0 + 0.5);
      const nGain = ac.createGain();
      nGain.gain.setValueAtTime(0.3, t0);
      nGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.52);
      src.connect(lp);
      lp.connect(nGain);
      nGain.connect(ac.destination);
      src.start(t0);
      src.stop(t0 + 0.54);

      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(240, t0);
      osc.frequency.exponentialRampToValueAtTime(48, t0 + 0.45);
      gain.gain.setValueAtTime(0.24, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.48);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + 0.49);
    });
  }

  function playShieldBlock() {
    withAudio((ac) => {
      const t0 = ac.currentTime;
      for (const [freq, delay] of [[523, 0], [784, 0.055], [1046, 0.11]]) {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t0 + delay);
        gain.gain.setValueAtTime(0.16, t0 + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + delay + 0.16);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(t0 + delay);
        osc.stop(t0 + delay + 0.17);
      }
    });
  }

  function playCountdownTick(sec) {
    withAudio((ac) => {
      const t0 = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(sec === 1 ? 988 : 740, t0);
      osc.frequency.exponentialRampToValueAtTime(sec === 1 ? 660 : 520, t0 + 0.065);
      gain.gain.setValueAtTime(0.09, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.075);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + 0.08);
    });
  }

  function playSpecial(kind) {
    withAudio((ac) => {
      const t0 = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = kind === 'lightning' ? 'sawtooth' : 'triangle';
      const f1 = kind === 'freeze' ? 920
        : kind === 'lightning' ? 1100
        : kind === 'magnet' ? 420
        : kind === 'clock' ? 784
        : kind === 'fever' ? 523
        : 587;
      const f2 = kind === 'freeze' ? 460
        : kind === 'lightning' ? 280
        : kind === 'magnet' ? 840
        : kind === 'clock' ? 1318
        : kind === 'fever' ? 1396
        : 1174;
      osc.frequency.setValueAtTime(f1, t0);
      osc.frequency.exponentialRampToValueAtTime(f2, t0 + 0.22);
      gain.gain.setValueAtTime(0.13, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.24);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + 0.25);
    });
  }

  return {
    playSwoosh,
    playSlice,
    playBombFuse,
    playMiss,
    playCombo,
    playBomb,
    playShieldBlock,
    playCountdownTick,
    playSpecial,
  };
}
