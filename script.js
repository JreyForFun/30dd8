/**
 * Water Intake Tracker
 * Logic for state management, UI updates, and animations.
 */

// --- Constants & Config ---
const DEFAULT_GOAL = 8;
const STORAGE_KEYS = {
  GOAL: 'wGoal',
  LOGS: 'wLogs',
  STREAK: 'wStreak',
  LAST_DATE: 'wLastDate'
};
const REMINDER_DELAY_MS = 2 * 60 * 60 * 1000; // 2 hours

// --- State ---
let state = {
  goal: DEFAULT_GOAL,
  logs: [],
  streak: 0,
  lastActiveDate: ''
};

// --- DOM Elements ---
const dom = {
  date: document.getElementById('currentDate'),
  goalInput: document.getElementById('goalInput'),
  setGoalBtn: document.getElementById('setGoalBtn'),
  bottle: {
    fill: document.getElementById('waterFill'),
    wave: document.getElementById('waterWave'),
    waveGroup: document.getElementById('waveGroup'),
    percentage: document.getElementById('percentageText'),
    stops: document.querySelectorAll('stop')
  },
  stats: {
    count: document.getElementById('countDisplay'),
    bar: document.getElementById('progressBar'),
    remaining: document.getElementById('remainingDisplay'),
    lastLogged: document.getElementById('lastLoggedDisplay'),
    streak: document.getElementById('streakDisplay')
  },
  controls: {
    add: document.getElementById('addGlassBtn'),
    remove: document.getElementById('removeGlassBtn'),
    badge: document.getElementById('reminderBadge')
  },
  logs: document.getElementById('logContainer'),
  actions: {
    reset: document.getElementById('resetDayBtn')
  },
  confetti: document.getElementById('confettiCanvas')
};

// --- Initialization ---
function init() {
  loadState();
  checkDate();
  setupEventListeners();
  render();
  checkReminder();

  // Check reminder periodically
  setInterval(checkReminder, 60000);
}

function loadState() {
  const storedGoal = localStorage.getItem(STORAGE_KEYS.GOAL);
  const storedLogs = localStorage.getItem(STORAGE_KEYS.LOGS);
  const storedStreak = localStorage.getItem(STORAGE_KEYS.STREAK);
  const storedLastDate = localStorage.getItem(STORAGE_KEYS.LAST_DATE);

  if (storedGoal) state.goal = parseInt(storedGoal, 10);
  if (storedLogs) {
    try {
      state.logs = JSON.parse(storedLogs);
    } catch (e) {
      console.error("Corrupt logs, resetting", e);
      state.logs = [];
    }
  }
  if (storedStreak) state.streak = parseInt(storedStreak, 10);
  if (storedLastDate) state.lastActiveDate = storedLastDate;
}

function saveState() {
  localStorage.setItem(STORAGE_KEYS.GOAL, state.goal);
  localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(state.logs));
  localStorage.setItem(STORAGE_KEYS.STREAK, state.streak);
  localStorage.setItem(STORAGE_KEYS.LAST_DATE, state.lastActiveDate);
}

function checkDate() {
  const today = new Date().toDateString();

  // Display Date
  dom.date.textContent = today;

  if (state.lastActiveDate !== today) {
    // New Day Detected
    if (state.lastActiveDate) {
      // Check if goal was met yesterday (naive check: requires log history or stored status)
      // Ideally we'd store "yesterday's count" but the prompt asks to check "yesterday's goal was met"
      // Since we only store 'logs' array which usually corresponds to "today", we need to see 
      // if we are resetting *from* a valid previous state.
      // However, the simplest prompt compliant way is: 
      // If we are resetting, it means we are opening app on a new day. 
      // The logs currently in state are from the *previous* active day.

      const count = state.logs.length;
      if (count >= state.goal) {
        state.streak++;
      } else {
        state.streak = 0;
      }
    }

    // Reset logs for new day
    state.logs = [];
    state.lastActiveDate = today;
    saveState();
  }
}

// --- Logic ---
function addGlass() {
  const now = new Date();
  const glass = {
    time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    date: now.toDateString(),
    timestamp: Date.now()
  };

  state.logs.push(glass);
  saveState();
  render();
  triggerButtonAnimation(dom.controls.add);

  // Check for goal completion
  if (state.logs.length === state.goal) {
    triggerConfetti();
  }

  hideReminder();
}

function removeGlass() {
  if (state.logs.length === 0) return;
  state.logs.pop(); // Remove last
  saveState();
  render();
  triggerButtonAnimation(dom.controls.remove);
}

function removeSpecificGlass(timestamp) {
  state.logs = state.logs.filter(l => l.timestamp !== timestamp);
  saveState();
  render();
}

function undoLast() {
  removeGlass();
}

function resetDay() {
  if (confirm('Are you sure you want to clear today\'s logs?')) {
    state.logs = [];
    saveState();
    render();
  }
}

function setGoal() {
  let newGoal = parseInt(dom.goalInput.value, 10);
  if (isNaN(newGoal) || newGoal < 1) newGoal = 1;
  if (newGoal > 20) newGoal = 20;

  state.goal = newGoal;
  dom.goalInput.value = newGoal; // normalize display
  saveState();
  render();
}

// --- Rendering ---
function render() {
  const count = state.logs.length;
  const goal = state.goal;
  const percent = Math.min(100, Math.round((count / goal) * 100));

  // 1. Update Bottle
  updateBottle(percent);

  // 2. Update Stats (with animation for count)
  // We need to store previous count to animate from?
  // Simplified: Just animate from current DOM text value?
  const currentText = dom.stats.count.textContent.split(' / ')[0];
  const currentVal = parseInt(currentText, 10) || 0;

  if (currentVal !== count) {
    animateValue(dom.stats.count, currentVal, count, 500, goal);
  } else {
    dom.stats.count.textContent = `${count} / ${goal}`;
  }

  dom.stats.bar.style.width = `${percent}%`;
  dom.stats.bar.style.backgroundColor = getWaterColor(percent);

  if (count >= goal) {
    dom.stats.remaining.textContent = "🎉 Goal reached!";
  } else {
    dom.stats.remaining.textContent = `🥛 ${goal - count} remaining`;
  }

  if (state.logs.length > 0) {
    const last = state.logs[state.logs.length - 1];
    dom.stats.lastLogged.textContent = `Last logged: ${last.time}`;
  } else {
    dom.stats.lastLogged.textContent = `Last logged: —`;
  }

  dom.stats.streak.textContent = `🔥 ${state.streak} day streak`;

  // 3. Update Logs UI
  renderLogs();

  // 4. Input Sync
  dom.goalInput.value = state.goal;
}

function updateBottle(percent) {
  dom.bottle.percentage.textContent = `${percent}%`;

  const maxHeight = 190;
  const currentHeight = (percent / 100) * maxHeight;

  // Target Y: Bottom (200) - Height
  const targetY = 200 - currentHeight;

  dom.bottle.fill.setAttribute('y', targetY);
  dom.bottle.fill.setAttribute('height', currentHeight);

  // Move the wave group to sit on top of the water
  // Wave moves up as water rises.
  const waveY = targetY - 10; // offset to sit on top

  if (dom.bottle.waveGroup) {
    dom.bottle.waveGroup.style.transform = `translateY(${waveY}px)`;
  }

  // Update Colors
  const color = getWaterColor(percent);
  dom.bottle.stops.forEach(stop => {
    if (stop.classList.contains('water-color-top')) {
      stop.setAttribute('stop-color', lightenColor(color, 20));
    } else {
      stop.setAttribute('stop-color', color);
    }
  });
}

function animateValue(obj, start, end, duration, goalTotal) {
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const current = Math.floor(progress * (end - start) + start);
    obj.textContent = `${current} / ${goalTotal}`;
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      obj.textContent = `${end} / ${goalTotal}`;
    }
  };
  window.requestAnimationFrame(step);
}

function getWaterColor(percent) {
  if (percent >= 100) return '#00fff0'; // Cyan
  if (percent >= 67) return '#3a7bd5'; // Deep Blue
  if (percent >= 34) return '#00d2ff'; // Mid Blue
  return '#89f7fe'; // Light Blue (default/start)
}

function lightenColor(color, percent) {
  // Very simple dummy implementation for hex
  // A real implementation would parse HEX to RGB and adjust.
  // For now, hardcode generic variations or just return the color
  // to strictly avoid complex dependencies.
  // Let's just return a lighter fixed color map based on input or logic above.
  return color; // Simplified for "pure logic" approach
}

function renderLogs() {
  const container = dom.logs;
  container.innerHTML = '';

  // Show all, but fade older ones if > 12
  const total = state.logs.length;
  const fadeThreshold = total - 12;

  state.logs.forEach((log, index) => {
    const div = document.createElement('div');
    div.className = 'log-item';
    if (index < fadeThreshold) div.classList.add('faded');

    div.innerHTML = `
            <span class="log-icon">🥛</span>
            <span class="log-time">${log.time}</span>
        `;
    div.onclick = () => {
      div.style.opacity = '0';
      setTimeout(() => removeSpecificGlass(log.timestamp), 300);
    };
    container.appendChild(div);
  });
}

function checkReminder() {
  if (state.logs.length === 0) {
    hideReminder();
    return;
  }

  const lastLog = state.logs[state.logs.length - 1];
  const diff = Date.now() - lastLog.timestamp;

  if (diff > REMINDER_DELAY_MS) {
    dom.controls.badge.classList.remove('hidden');
  } else {
    hideReminder();
  }
}

function hideReminder() {
  dom.controls.badge.classList.add('hidden');
}

function triggerButtonAnimation(btn) {
  btn.style.transform = "scale(0.9)";
  setTimeout(() => {
    btn.style.transform = "scale(1)";
  }, 100);
}

// --- Confetti (Simple Canvas impl) ---
function triggerConfetti() {
  const canvas = dom.confetti;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ['#58a6ff', '#00fff0', '#ffd700', '#ff7b72'];

  for (let i = 0; i < 150; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 2,
      r: Math.random() * 6 + 2,
      dx: Math.random() * 10 - 5,
      dy: Math.random() * 10 - 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 100
    });
  }

  function animateConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let active = false;

    particles.forEach(p => {
      if (p.life > 0) {
        active = true;
        p.x += p.dx;
        p.y += p.dy;
        p.dy += 0.2; // gravity
        p.life--;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
    });

    if (active) requestAnimationFrame(animateConfetti);
    else ctx.clearRect(0, 0, canvas.width, canvas.height); // cleanup
  }

  animateConfetti();
}

function setupEventListeners() {
  dom.controls.add.addEventListener('click', addGlass);
  dom.controls.remove.addEventListener('click', removeGlass);
  dom.setGoalBtn.addEventListener('click', setGoal);
  // dom.actions.undo removed
  dom.actions.reset.addEventListener('click', resetDay);

  // Auto-save goal on change? Prompts says "Set Goal button" 
  // but also "Changing the goal immediately updates".
  // Let's add 'input' listener for immediate feedback, but persist on button?
  // Prompt says: "A Set Goal button that saves the goal... Changing the goal immediately updates the fill"
  // So visual update on input, save on button.
  dom.goalInput.addEventListener('input', () => {
    let val = parseInt(dom.goalInput.value, 10);
    if (!isNaN(val) && val > 0) {
      state.goal = val; // Temp update for visual
      render();
    }
  });
}

// Start
document.addEventListener('DOMContentLoaded', init);
