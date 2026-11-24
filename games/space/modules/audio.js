import { SKINS, PICKUP_THEMES } from './rules.js';

const WEAPON_ACCENTS = {
  armorHit: { wave: 'square', from: 780, to: 260, duration: 0.085, gain: 0.065, interval: 95 },
  blastImpact: { wave: 'sawtooth', from: 148, to: 44, duration: 0.29, gain: 0.15, interval: 0 },
  overdriveStart: { wave: 'triangle', from: 125, to: 315, duration: 0.22, gain: 0.12, interval: 0 },
  overdriveEnding: { wave: 'sine', from: 680, to: 470, duration: 0.15, gain: 0.07, interval: 0 },
};

export function createSpaceAudio({ isEnabled, getSkin }) {
  let noiseBuffer = null;
  let lastShootSfxAt = 0;
  let lastHitSfxAt = 0;
  const lastAccentAt = new Map();

  function getNoiseBuffer(ac) {
    if (noiseBuffer && noiseBuffer.sampleRate === ac.sampleRate) return noiseBuffer;
    const len = Math.floor(ac.sampleRate * 0.55);
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

  function playWeaponAccent(kind, ship = getSkin()) {
    const now = performance.now();
    const sound = WEAPON_ACCENTS[kind] || SKINS[ship].heavy[kind];
    if (now - (lastAccentAt.get(kind) ?? -Infinity) < sound.interval) return;
    lastAccentAt.set(kind, now);
    withAudio((ac) => {
      const t0 = ac.currentTime;
      const end = t0 + sound.duration;
      const oscillator = ac.createOscillator();
      const envelope = ac.createGain();
      oscillator.type = sound.wave;
      oscillator.frequency.setValueAtTime(sound.from, t0);
      oscillator.frequency.exponentialRampToValueAtTime(sound.to, end);
      envelope.gain.setValueAtTime(0.001, t0);
      envelope.gain.linearRampToValueAtTime(sound.gain, t0 + 0.008);
      envelope.gain.exponentialRampToValueAtTime(0.001, end);
      oscillator.connect(envelope);
      envelope.connect(ac.destination);
      oscillator.start(t0);
      oscillator.stop(end);
    });
  }

  function playShoot(shot, overdrive, volume = 1) {
    const now = performance.now();
    if (now - lastShootSfxAt < 95) return;
    lastShootSfxAt = now;
    withAudio((ac) => {
      const t0 = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = shot.wave;
      osc.frequency.setValueAtTime(shot.from * (overdrive ? 1.20 : 1), t0);
      osc.frequency.exponentialRampToValueAtTime(shot.to, t0 + shot.duration);
      gain.gain.setValueAtTime(shot.gain * volume, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + shot.duration + 0.005);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + shot.duration + 0.01);
    });
  }

  function playHit(heavy = false, armored = false, ship = getSkin()) {
    if (heavy) {
      playWeaponAccent(armored ? 'armorHit' : 'heavyHit', ship);
      return;
    }
    const now = performance.now();
    if (now - lastHitSfxAt < 65) return;
    lastHitSfxAt = now;
    withAudio((ac) => {
      const t0 = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, t0);
      osc.frequency.exponentialRampToValueAtTime(160, t0 + 0.04);
      gain.gain.setValueAtTime(0.04, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.045);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + 0.05);
    });
  }

  function playExplode(big) {
    withAudio((ac) => {
      const t0 = ac.currentTime;
      const dur = big ? 0.45 : 0.22;
      const src = ac.createBufferSource();
      src.buffer = getNoiseBuffer(ac);
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(big ? 1400 : 1100, t0);
      lp.frequency.exponentialRampToValueAtTime(140, t0 + dur);
      const nGain = ac.createGain();
      nGain.gain.setValueAtTime(big ? 0.24 : 0.13, t0);
      nGain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.connect(lp);
      lp.connect(nGain);
      nGain.connect(ac.destination);
      src.start(t0);
      src.stop(t0 + dur + 0.02);

      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(big ? 190 : 160, t0);
      osc.frequency.exponentialRampToValueAtTime(45, t0 + dur);
      gain.gain.setValueAtTime(big ? 0.18 : 0.09, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    });
  }

  function playPowerup(type) {
    const theme = PICKUP_THEMES[type];
    withAudio((ac) => {
      const t0 = ac.currentTime;
      theme.notes.forEach((freq, index) => {
        const delay = index * 0.055;
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = theme.wave;
        osc.frequency.setValueAtTime(freq, t0 + delay);
        gain.gain.setValueAtTime(0.095, t0 + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + delay + 0.13);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(t0 + delay);
        osc.stop(t0 + delay + 0.14);
      });
    });
  }

  function playEmp() {
    withAudio((ac) => {
      const t0 = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(680, t0);
      osc.frequency.exponentialRampToValueAtTime(85, t0 + 0.42);
      gain.gain.setValueAtTime(0.18, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.45);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + 0.46);
    });
  }

  function playBossAlert() {
    withAudio((ac) => {
      const t0 = ac.currentTime;
      for (const delay of [0, 0.22]) {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, t0 + delay);
        osc.frequency.linearRampToValueAtTime(560, t0 + delay + 0.14);
        gain.gain.setValueAtTime(0.12, t0 + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + delay + 0.18);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(t0 + delay);
        osc.stop(t0 + delay + 0.19);
      }
    });
  }

  function playPlayerHit() {
    withAudio((ac) => {
      const t0 = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, t0);
      osc.frequency.exponentialRampToValueAtTime(75, t0 + 0.24);
      gain.gain.setValueAtTime(0.18, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.26);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + 0.27);
    });
  }

  function playBossLaserCharge() {
    withAudio((ac) => {
      const t0 = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, t0);
      osc.frequency.exponentialRampToValueAtTime(880, t0 + 0.72);
      gain.gain.setValueAtTime(0.02, t0);
      gain.gain.linearRampToValueAtTime(0.11, t0 + 0.65);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.78);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + 0.8);
    });
  }

  function playBossLaserFire() {
    withAudio((ac) => {
      const t0 = ac.currentTime;
      const src = ac.createBufferSource();
      src.buffer = getNoiseBuffer(ac);
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(950, t0);
      bp.Q.setValueAtTime(1.5, t0);
      const nGain = ac.createGain();
      nGain.gain.setValueAtTime(0.16, t0);
      nGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.45);
      src.connect(bp);
      bp.connect(nGain);
      nGain.connect(ac.destination);
      src.start(t0);
      src.stop(t0 + 0.48);

      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(480, t0);
      osc.frequency.exponentialRampToValueAtTime(140, t0 + 0.42);
      gain.gain.setValueAtTime(0.12, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.44);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + 0.46);
    });
  }

  function playWaveClear() {
    withAudio((ac) => {
      const t0 = ac.currentTime;
      for (const [freq, delay] of [[523, 0], [659, 0.07], [784, 0.14], [1046, 0.22]]) {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t0 + delay);
        gain.gain.setValueAtTime(0.11, t0 + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + delay + 0.2);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(t0 + delay);
        osc.stop(t0 + delay + 0.22);
      }
    });
  }

  function playPrismReflectCue(shattered) {
    withAudio((ac) => {
      const notes = shattered ? [1480, 990, 540] : [370, 740, 1110];
      notes.forEach((frequency, index) => {
        const start = ac.currentTime + index * 0.08;
        const end = start + 0.19;
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = index === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(frequency, start);
        osc.frequency.exponentialRampToValueAtTime(frequency * (shattered ? 0.72 : 1.18), end);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.09, start + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.001, end);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(start);
        osc.stop(end);
      });
    });
  }

  function playComboMilestone() {
    withAudio((ac) => {
      const t0 = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, t0);
      osc.frequency.exponentialRampToValueAtTime(1320, t0 + 0.11);
      gain.gain.setValueAtTime(0.09, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.13);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + 0.14);
    });
  }

  return {
    playWeaponAccent,
    playShoot,
    playHit,
    playExplode,
    playPowerup,
    playEmp,
    playBossAlert,
    playPlayerHit,
    playBossLaserCharge,
    playBossLaserFire,
    playWaveClear,
    playPrismReflectCue,
    playComboMilestone,
  };
}
