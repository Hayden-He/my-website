const t = (key, params) => I18N.t(key, params);
const STORAGE_KEY = 'game_best_template';
const target = document.getElementById('target');
const soundBtn = document.getElementById('sound-btn');
const scoreEl = document.getElementById('score-el');
const bestEl = document.getElementById('best-el');
const overlay = document.getElementById('overlay');
const overlayDesc = document.getElementById('overlay-desc');

let score = 0;
let best = GameKit.readBest(STORAGE_KEY);
let soundEnabled = window.SiteData ? SiteData.getSound() : true;

GameKit.bindSoundButton(soundBtn, soundEnabled, (on) => {
  soundEnabled = on;
});

function render() {
  scoreEl.textContent = score;
  bestEl.textContent = best;
  if (overlay.classList.contains('show')) {
    overlayDesc.textContent = t('本局得分：{score}（本模式最高：{best}）', { score, best });
  }
}

function playTone(freq, duration) {
  if (!soundEnabled || !window.SiteData) return;
  SiteData.withAudio((ac) => {
    try {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      gain.gain.setValueAtTime(0.06, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + duration);
    } catch {}
  });
}

target.addEventListener('click', () => {
  if (overlay.classList.contains('show')) return;
  score += 1;
  if (score > best) {
    best = score;
    GameKit.saveBestIfHigher(STORAGE_KEY, best);
  }
  playTone(520, 0.06);
  render();
  if (score >= 10) {
    overlay.classList.add('show');
    render();
  }
});

async function restart() {
  if (score > 0) {
    const ok = await window.SiteData.confirmDialog({
      title: t('重开本局'),
      message: t('当前进度将被清除，确定重开吗？'),
      confirmText: t('重开'),
      cancelText: t('继续本局'),
      danger: true,
    });
    if (!ok) return;
  }
  score = 0;
  overlay.classList.remove('show');
  render();
}

document.getElementById('restart-btn').addEventListener('click', restart);
document.getElementById('overlay-btn').addEventListener('click', () => {
  score = 0;
  overlay.classList.remove('show');
  render();
});

render();
document.addEventListener('i18n:change', render);
