export function createAudio(isSoundEnabled) {
  const busMap = new WeakMap();
  let lastMoveAt = 0;
  let lastSoftDropAt = 0;

  function getOutputNode(ac) {
    let bus = busMap.get(ac);
    if (bus) return bus;
    try {
      const masterGain = ac.createGain();
      masterGain.gain.value = 0.75;
      if (typeof ac.createDynamicsCompressor === 'function') {
        const compressor = ac.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-14, ac.currentTime);
        compressor.knee.setValueAtTime(12, ac.currentTime);
        compressor.ratio.setValueAtTime(6, ac.currentTime);
        compressor.attack.setValueAtTime(0.003, ac.currentTime);
        compressor.release.setValueAtTime(0.12, ac.currentTime);
        masterGain.connect(compressor);
        compressor.connect(ac.destination);
      } else {
        masterGain.connect(ac.destination);
      }
      bus = masterGain;
    } catch {
      bus = ac.destination;
    }
    busMap.set(ac, bus);
    return bus;
  }

  function tone(freqStart, freqEnd, duration, type = 'triangle', volume = 0.04, delay = 0) {
    if (!isSoundEnabled() || !window.SiteData) return;
    window.SiteData.withAudio((ac) => {
      try {
        const now = ac.currentTime + delay;
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freqStart, now);
        if (freqEnd !== freqStart) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);
        }
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.connect(gain);
        gain.connect(getOutputNode(ac));
        osc.start(now);
        osc.stop(now + duration + 0.01);
      } catch {}
    });
  }

  function noiseBurst(duration, cutoffHz, volume = 0.05, delay = 0) {
    if (!isSoundEnabled() || !window.SiteData) return;
    window.SiteData.withAudio((ac) => {
      try {
        const now = ac.currentTime + delay;
        const samples = Math.max(1, Math.floor(ac.sampleRate * duration));
        const buffer = ac.createBuffer(1, samples, ac.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < samples; i++) {
          data[i] = (Math.random() * 2 - 1) * (1 - i / samples);
        }
        const src = ac.createBufferSource();
        src.buffer = buffer;
        const filter = ac.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(cutoffHz, now);
        const gain = ac.createGain();
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(getOutputNode(ac));
        src.start(now);
      } catch {}
    });
  }

  return {
    playMove() {
      const now = performance.now();
      if (now - lastMoveAt < 65) return;
      lastMoveAt = now;
      tone(220, 175, 0.022, 'triangle', 0.022);
    },
    playRotate() {
      tone(340, 520, 0.036, 'triangle', 0.03);
      tone(680, 780, 0.024, 'sine', 0.014, 0.008);
    },
    playSoftDrop() {
      const now = performance.now();
      if (now - lastSoftDropAt < 75) return;
      lastSoftDropAt = now;
      tone(160, 130, 0.02, 'sine', 0.018);
    },
    playLock() {
      tone(145, 92, 0.045, 'triangle', 0.042);
    },
    playHardDrop() {
      tone(165, 52, 0.095, 'triangle', 0.075);
      tone(95, 42, 0.07, 'sine', 0.045);
      noiseBurst(0.045, 780, 0.05);
    },
    playHold() {
      tone(420, 560, 0.055, 'sine', 0.035);
    },
    playClear(lines, isBackToBack, combo) {
      const pitchShift = 1 + Math.min(Math.max(0, combo), 8) * 0.045;
      if (lines >= 4) {
        const notes = isBackToBack ? [523, 659, 784, 1046, 1318] : [523, 659, 784, 1046];
        notes.forEach((f, i) => {
          tone(f * pitchShift, f * pitchShift, 0.11, 'triangle', 0.052, i * 0.045);
          tone(f * 2 * pitchShift, f * 2 * pitchShift, 0.075, 'sine', 0.016, i * 0.045 + 0.01);
        });
      } else if (lines === 3) {
        [440, 554, 659].forEach((f, i) => {
          tone(f * pitchShift, f * pitchShift, 0.09, 'triangle', 0.048, i * 0.045);
          tone(f * 2 * pitchShift, f * 2 * pitchShift, 0.06, 'sine', 0.012, i * 0.045 + 0.01);
        });
      } else if (lines === 2) {
        [392, 523].forEach((f, i) => {
          tone(f * pitchShift, f * pitchShift, 0.08, 'triangle', 0.044, i * 0.045);
          tone(f * 2 * pitchShift, f * 2 * pitchShift, 0.055, 'sine', 0.012, i * 0.045 + 0.01);
        });
      } else {
        tone(392 * pitchShift, 494 * pitchShift, 0.075, 'triangle', 0.04);
      }
    },
    playTSpin() {
      [587, 740, 880, 1175].forEach((f, i) => tone(f, f, 0.1, 'sine', 0.05, i * 0.04));
    },
    playAllClear() {
      [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, f, 0.13, 'triangle', 0.055, i * 0.045));
    },
    playBomb() {
      tone(140, 42, 0.22, 'sawtooth', 0.065);
      noiseBurst(0.18, 480, 0.085);
    },
    playLaser() {
      tone(1100, 260, 0.14, 'sawtooth', 0.045);
      tone(880, 1320, 0.09, 'sine', 0.04, 0.02);
    },
    playIce() {
      [988, 1318, 1568].forEach((f, i) => tone(f, f * 1.05, 0.11, 'sine', 0.04, i * 0.04));
    },
    playGarbageRise() {
      tone(140, 110, 0.12, 'square', 0.032);
      tone(175, 135, 0.1, 'triangle', 0.035, 0.06);
    },
    playLevelUp() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.09, 'sine', 0.045, i * 0.06));
    },
    playWin() {
      [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, f, 0.12, 'triangle', 0.055, i * 0.065));
    },
    playGameOver() {
      [392, 330, 262, 196].forEach((f, i) => tone(f, f * 0.92, 0.14, 'sawtooth', 0.03, i * 0.09));
    },
  };
}
