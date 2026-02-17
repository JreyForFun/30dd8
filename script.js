
const DEFAULT_GOAL = 8;
const STORAGE_KEYS = {
  GOAL: 'wGoal',
  LOGS: 'wLogs',
  STREAK: 'wStreak',
  LAST_DATE: 'wLastDate'
};
const REMINDER_DELAY_MS = 2 * 60 * 60 * 1000; // 2 hours

let state = {
  goal: DEFAULT_GOAL,
  logs: [],
  streak: 0,
  lastActiveDate: ''
};

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

    if (state.lastActiveDate) {

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

  if (state.logs.length === state.goal) {
    triggerConfetti();
  }

  hideReminder();
}

function removeGlass() {
  if (state.logs.length === 0) return;
  state.logs.pop(); 
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
  dom.goalInput.value = newGoal; 
  saveState();
  render();
}


function render() {
  const count = state.logs.length;
  const goal = state.goal;
  const percent = Math.min(100, Math.round((count / goal) * 100));


  updateBottle(percent);
  
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


  renderLogs();

  dom.goalInput.value = state.goal;
}

function updateBottle(percent) {
  dom.bottle.percentage.textContent = `${percent}%`;

  const maxHeight = 190;
  const currentHeight = (percent / 100) * maxHeight;

  const targetY = 200 - currentHeight;

  dom.bottle.fill.setAttribute('y', targetY);
  dom.bottle.fill.setAttribute('height', currentHeight);


  const waveY = targetY - 10; 

  if (dom.bottle.waveGroup) {
    dom.bottle.waveGroup.style.transform = `translateY(${waveY}px)`;
  }

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
  if (percent >= 100) return '#00fff0';
  if (percent >= 67) return '#3a7bd5'; 
  if (percent >= 34) return '#00d2ff'; 
  return '#89f7fe'; 
}

function lightenColor(color, percent) {
  return color;
}

function renderLogs() {
  const container = dom.logs;
  container.innerHTML = '';
  
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
        p.dy += 0.2;
        p.life--;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
    });

    if (active) requestAnimationFrame(animateConfetti);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  animateConfetti();
}

function setupEventListeners() {
  dom.controls.add.addEventListener('click', addGlass);
  dom.controls.remove.addEventListener('click', removeGlass);
  dom.setGoalBtn.addEventListener('click', setGoal);
  
  dom.actions.reset.addEventListener('click', resetDay);


  
  dom.goalInput.addEventListener('input', () => {
    let val = parseInt(dom.goalInput.value, 10);
    if (!isNaN(val) && val > 0) {
      state.goal = val; 
      render();
    }
  });
}


document.addEventListener('DOMContentLoaded', init);

