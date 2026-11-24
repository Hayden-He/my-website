export function createBasketballAudio({ isEnabled }) {
  let soundTimers = [];

  function clearSoundTimers() {
    soundTimers.forEach((id) => clearTimeout(id));
    soundTimers = [];
  }

  function scheduleSound(fn, delay) {
    const id = setTimeout(() => {
      soundTimers = soundTimers.filter((timerId) => timerId !== id);
      fn();
    }, delay);
    soundTimers.push(id);
  }

  // 通过全站共用的音频上下文发声（见 assets/site-data.js），避免 iOS 等浏览器的自动播放限制
  function withAudio(fn) {
    if (!isEnabled() || !window.SiteData) return;
    window.SiteData.withAudio(fn);
  }

  function playTone(freq, duration, type, volume, slideTo) {
    withAudio((ac) => {
      try {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, ac.currentTime);
        if (slideTo) {
          osc.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + duration);
        }
        gain.gain.setValueAtTime(volume || 0.12, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start();
        osc.stop(ac.currentTime + duration);
      } catch {}
    });
  }

  function playNoise(duration, filterFreq, volume) {
    withAudio((ac) => {
      try {
        const bufSize = Math.floor(ac.sampleRate * duration);
        const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const src = ac.createBufferSource();
        src.buffer = buf;
        const filter = ac.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(filterFreq, ac.currentTime);
        filter.Q.setValueAtTime(1.2, ac.currentTime);
        const gain = ac.createGain();
        gain.gain.setValueAtTime(volume, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(ac.destination);
        src.start();
        src.stop(ac.currentTime + duration);
      } catch {}
    });
  }

  function playSound(kind, combo) {
    if (!isEnabled()) return;
    if (kind === 'jump') playTone(260, 0.08, 'sine', 0.09, 420);
    if (kind === 'bounce') playTone(110, 0.07, 'sine', 0.1, 62);
    if (kind === 'board') playTone(145, 0.09, 'triangle', 0.16, 85);
    if (kind === 'rim') playTone(380, 0.07, 'square', 0.055, 220);
    if (kind === 'net') playNoise(0.09, 1400, 0.08);
    if (kind === 'shield') playTone(300, 0.1, 'sawtooth', 0.06, 160);
    if (kind === 'swish') {
      playNoise(0.16, 2200, 0.14);
      const step = Math.min(combo || 1, 6) - 1;
      const baseFreq = 523 * Math.pow(1.06, step * 2);
      playTone(baseFreq, 0.12, 'sine', 0.13, baseFreq * 1.5);
      scheduleSound(() => playTone(baseFreq * 1.5, 0.16, 'sine', 0.11, baseFreq * 2), 65);
    }
    if (kind === 'gold') {
      playTone(659, 0.12, 'triangle', 0.12, 880);
      scheduleSound(() => playTone(880, 0.18, 'sine', 0.12, 1318), 60);
    }
    if (kind === 'score') playTone(440, 0.14, 'triangle', 0.13, 660);
    if (kind === 'tick') playTone(880, 0.04, 'sine', 0.05);
    if (kind === 'buzzer') {
      playTone(190, 0.28, 'sawtooth', 0.09, 140);
      scheduleSound(() => playTone(150, 0.3, 'sawtooth', 0.08, 120), 120);
    }
  }

  return { clearSoundTimers, playSound };
}
