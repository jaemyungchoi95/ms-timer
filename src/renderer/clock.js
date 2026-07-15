import { computeRemaining } from '../lib/countdown.js';
import { FlipDigit } from './flip-digit.js';

const clockEl = document.getElementById('clock');
const labelEl = document.getElementById('label');
const digits = [...document.querySelectorAll('[data-flip]')].map((el) => new FlipDigit(el));

const pad2 = (n) => String(n).padStart(2, '0');

let lastExpired = null;

function tick() {
  const { expired, h, m, s } = computeRemaining(new Date());

  const chars = pad2(h) + pad2(m) + pad2(s);
  for (let i = 0; i < digits.length; i++) {
    digits[i].set(chars[i]);
  }

  if (expired !== lastExpired) {
    clockEl.classList.toggle('expired', expired);
    labelEl.textContent = expired ? '퇴근' : '퇴근까지';
    lastExpired = expired;
  }

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
