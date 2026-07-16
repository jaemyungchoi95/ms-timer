import { computeRemaining } from '../lib/countdown.js';
import { FlipDigit } from './flip-digit.js';
import { Reel } from './reel.js';
import { initTheme } from './theme.js';

const clockEl = document.getElementById('clock');
const labelEl = document.getElementById('label');
const digits = [...document.querySelectorAll('[data-flip]')].map((el) => new FlipDigit(el));

const reels = [
  new Reel(document.querySelector('[data-reel="100"]'), 100, 0),
  new Reel(document.querySelector('[data-reel="10"]'), 10, 1),
  new Reel(document.querySelector('[data-reel="1"]'), 1, 3),
];

const pad2 = (n) => String(n).padStart(2, '0');

let lastExpired = null;

function tick() {
  const { expired, h, m, s, ms } = computeRemaining(new Date());

  const chars = pad2(h) + pad2(m) + pad2(s);
  for (let i = 0; i < digits.length; i++) {
    digits[i].set(chars[i]);
  }

  for (const reel of reels) {
    reel.update(ms);
  }

  if (expired !== lastExpired) {
    clockEl.classList.toggle('expired', expired);
    labelEl.textContent = expired ? '퇴근' : '퇴근까지';
    lastExpired = expired;
  }

  requestAnimationFrame(tick);
}

initTheme();
requestAnimationFrame(tick);
