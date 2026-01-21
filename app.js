// Start/Sit Weekly Lineup Challenge (v2 upgrade)
// - Keeps v1 Start/Sit mode fully intact
// - Adds Lineup mode (QB, RB, RB, WR, WR, TE, FLEX) with simulated "weekly outcomes"
// - Standard scoring simulation from plausible stat lines
// - Daily mode determinism (UTC date seed)
// - Leaderboards for both modes (localStorage)
// - "AI Coach" is explainable rules now; later swap to backend API

const MAX_MATCHUPS = 4;

// Player pool (still small MVP pool; can be expanded later or replaced by API)
const PLAYERS = [
  { name: "A. Brown", pos: "WR", team: "PHI", opp: "DAL", proj: 16.8, floor: 9.5, ceil: 26.0, tag: "good" },
  { name: "C. Lamb", pos: "WR", team: "DAL", opp: "PHI", proj: 17.2, floor: 10.0, ceil: 27.5, tag: "good" },
  { name: "J. Allen", pos: "QB", team: "BUF", opp: "MIA", proj: 21.4, floor: 14.0, ceil: 33.0, tag: "good" },
  { name: "T. Tagovailoa", pos: "QB", team: "MIA", opp: "BUF", proj: 18.6, floor: 11.5, ceil: 28.0, tag: "ok" },
  { name: "C. McCaffrey", pos: "RB", team: "SF", opp: "SEA", proj: 19.9, floor: 12.0, ceil: 32.0, tag: "good" },
  { name: "K. Walker", pos: "RB", team: "SEA", opp: "SF", proj: 14.1, floor: 7.5, ceil: 23.5, tag: "ok" },
  { name: "T. Kelce", pos: "TE", team: "KC", opp: "LAC", proj: 13.4, floor: 7.0, ceil: 22.0, tag: "ok" },
  { name: "G. Kittle", pos: "TE", team: "SF", opp: "SEA", proj: 12.9, floor: 6.5, ceil: 23.0, tag: "ok" },
  { name: "J. Taylor", pos: "RB", team: "IND", opp: "HOU", proj: 15.2, floor: 8.5, ceil: 25.0, tag: "ok" },
  { name: "D. Pierce", pos: "RB", team: "HOU", opp: "IND", proj: 11.2, floor: 5.5, ceil: 19.0, tag: "risk" },
  { name: "P. Mahomes", pos: "QB", team: "KC", opp: "LAC", proj: 20.2, floor: 13.0, ceil: 31.0, tag: "good" },
  { name: "J. Herbert", pos: "QB", team: "LAC", opp: "KC", proj: 19.4, floor: 12.0, ceil: 30.0, tag: "ok" },
  { name: "T. Hill", pos: "WR", team: "MIA", opp: "BUF", proj: 18.1, floor: 9.0, ceil: 31.0, tag: "good" },
  { name: "S. Diggs", pos: "WR", team: "BUF", opp: "MIA", proj: 15.9, floor: 8.0, ceil: 26.0, tag: "ok" },
  { name: "B. Hall", pos: "RB", team: "NYJ", opp: "NE", proj: 14.8, floor: 7.5, ceil: 25.0, tag: "ok" },
  { name: "R. Stevenson", pos: "RB", team: "NE", opp: "NYJ", proj: 12.6, floor: 6.0, ceil: 22.0, tag: "risk" },
  { name: "S. LaPorta", pos: "TE", team: "DET", opp: "GB", proj: 11.9, floor: 6.0, ceil: 20.0, tag: "ok" },
  { name: "D. Njoku", pos: "TE", team: "CLE", opp: "PIT", proj: 10.4, floor: 5.5, ceil: 18.0, tag: "risk" }
];

// -------------------- DOM --------------------
const matchupsEl = document.getElementById("matchups");
const msgEl = document.getElementById("message");
const weekLabelEl = document.getElementById("weekLabel");

const yourScoreEl = document.getElementById("yourScore");
const optimalScoreEl = document.getElementById("optimalScore");
const accuracyEl = document.getElementById("accuracy");
const outcomeEl = document.getElementById("outcome");

const streakEl = document.getElementById("streak");
const bestStreakEl = document.getElementById("bestStreak");
const bestScoreEl = document.getElementById("bestScore");

const newWeekBtn = document.getElementById("newWeekBtn");
const dailyBtn = document.getElementById("dailyBtn");
const hintBtn = document.getElementById("hintBtn");
const scoreBtn = document.getElementById("scoreBtn");

// v2 DOM
const modeBtn = document.getElementById("modeBtn");
const lineupSection = document.getElementById("lineup");
const slotsEl = document.getElementById("slots");
const lineupStatusEl = document.getElementById("lineupStatus");
const coachEl = document.getElementById("coach");
const ssBoardEl = document.getElementById("ssBoard");
const luBoardEl = document.getElementById("luBoard");

const resultsTitleEl = document.getElementById("resultsTitle");
const labelYourScoreEl = document.getElementById("labelYourScore");
const labelOptimalScoreEl = document.getElementById("labelOptimalScore");
const labelAccuracyEl = document.getElementById("labelAccuracy");
const labelOutcomeEl = document.getElementById("labelOutcome");
const resultsTipEl = document.getElementById("resultsTip");

// -------------------- State --------------------
let week = 1;
let hintOn = false;
let matchups = []; // Start/Sit: [{a,b, pick: 'a'|'b'|null}]
let scored = false;

let mode = "startsit"; // "startsit" | "lineup"

// Lineup mode state
const LINEUP_SLOTS = [
  { key: "QB", label: "QB", allowed: ["QB"] },
  { key: "RB1", label: "RB", allowed: ["RB"] },
  { key: "RB2", label: "RB", allowed: ["RB"] },
  { key: "WR1", label: "WR", allowed: ["WR"] },
  { key: "WR2", label: "WR", allowed: ["WR"] },
  { key: "TE", label: "TE", allowed: ["TE"] },
  { key: "FLEX", label: "FLEX", allowed: ["RB","WR","TE"] }
];

let lineup = {}; // {slotKey: playerName}

// -------------------- storage helpers --------------------
function getNum(key, fallback = 0) {
  const v = Number(localStorage.getItem(key));
  return Number.isFinite(v) ? v : fallback;
}
function setNum(key, val) {
  localStorage.setItem(key, String(val));
}
function getStr(key, fallback = "") {
  const v = localStorage.getItem(key);
  return v == null ? fallback : v;
}
function setStr(key, val) {
  localStorage.setItem(key, String(val));
}
function getJSON(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function setJSON(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

// -------------------- daily mode --------------------
function todayKeyUTC() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}
function hashToInt(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}
function seededRand(seed) {
  // mulberry32 PRNG
  let t = seed >>> 0;
  return function() {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function isDailyMode() {
  return getStr("ss_mode", "random") === "daily";
}
function setDailyMode(on) {
  setStr("ss_mode", on ? "daily" : "random");
  renderModeToggle();
}
function renderModeToggle() {
  dailyBtn.textContent = `Daily: ${isDailyMode() ? "On" : "Off"}`;
}

// -------------------- streak/score persistence (Start/Sit) --------------------
function renderStats() {
  const streak = getNum("ss_streak", 0);
  const bestStreak = getNum("ss_bestStreak", 0);
  const bestScore = getNum("ss_bestScore", 0);

  streakEl.textContent = `Win Streak: ${streak}`;
  bestStreakEl.textContent = `Best Streak: ${bestStreak}`;
  bestScoreEl.textContent = `Best Score: ${bestScore.toFixed ? bestScore.toFixed(1) : bestScore}`;
}
function winWeek(yourCorrect) {
  // win = 3 or 4 correct matchups
  const win = yourCorrect >= 3;
  if (win) {
    const streak = getNum("ss_streak", 0) + 1;
    const best = Math.max(getNum("ss_bestStreak", 0), streak);
    setNum("ss_streak", streak);
    setNum("ss_bestStreak", best);
  } else {
    setNum("ss_streak", 0);
  }
  renderStats();
  return win;
}
function updateBestScore(score) {
  const best = getNum("ss_bestScore", 0);
  if (score > best) setNum("ss_bestScore", Number(score.toFixed(1)));
  renderStats();
}

// -------------------- matchup generation (Start/Sit) --------------------
function chooseUniquePlayers(rng, count) {
  const pool = PLAYERS.slice();
  // shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function generateMatchups() {
  const seed = isDailyMode()
    ? hashToInt(`daily:${todayKeyUTC()}`)
    : hashToInt(`random:${Date.now()}:${Math.random()}`);

  const rng = seededRand(seed);

  const picked = chooseUniquePlayers(rng, MAX_MATCHUPS * 2);
  const pairs = [];
  for (let i = 0; i < picked.length; i += 2) {
    pairs.push({ a: picked[i], b: picked[i + 1], pick: null });
  }
  return pairs;
}

// -------------------- rendering (Start/Sit) --------------------
function badgeClass(tag) {
  if (tag === "good") return "badge good";
  if (tag === "ok") return "badge ok";
  return "badge risk";
}

function playerCard(p) {
  return `
    <div class="player">
      <div class="name">${p.name}</div>
      <div class="meta">
        <div>${p.pos} • ${p.team} vs ${p.opp}</div>
        <div>Proj: <strong>${p.proj.toFixed(1)}</strong> • Floor: ${p.floor.toFixed(1)} • Ceil: ${p.ceil.toFixed(1)}</div>
      </div>
      <span class="${badgeClass(p.tag)}">${p.tag === "good" ? "High Confidence" : p.tag === "ok" ? "Solid Play" : "Risky"}</span>
    </div>
  `;
}

function renderMatchups() {
  matchupsEl.innerHTML = "";

  matchups.forEach((m, idx) => {
    const edge = (m.a.proj - m.b.proj);
    const favored = edge === 0 ? null : (edge > 0 ? "A" : "B");
    const hintText = favored
      ? `Edge: <strong>${favored}</strong> by ${Math.abs(edge).toFixed(1)} projected points`
      : `Edge: <strong>Even</strong>`;

    const el = document.createElement("div");
    el.className = "matchup";
    el.innerHTML = `
      <h3>Matchup ${idx + 1}</h3>
      <div class="cards">
        ${playerCard(m.a)}
        ${playerCard(m.b)}
      </div>

      <div class="pick-row">
        <button class="pick ${m.pick === "a" ? "selected" : ""}" data-idx="${idx}" data-pick="a">
          Start ${m.a.name}
        </button>
        <button class="pick ${m.pick === "b" ? "selected" : ""}" data-idx="${idx}" data-pick="b">
          Start ${m.b.name}
        </button>
      </div>

      <div class="hint">${hintOn ? hintText : ""}</div>
    `;

    matchupsEl.appendChild(el);
  });
}

function setMessage(text) {
  msgEl.textContent = text;
}

function clearResults() {
  yourScoreEl.textContent = "—";
  optimalScoreEl.textContent = "—";
  accuracyEl.textContent = "—";
  outcomeEl.textContent = "—";
}

// -------------------- scoring (Start/Sit) --------------------
function computeWeekScore() {
  // require all picks
  for (const m of matchups) {
    if (!m.pick) return { ok: false, reason: "Make all 4 Start picks first." };
  }

  let yourScore = 0;
  let optimalScore = 0;
  let correct = 0;

  for (const m of matchups) {
    const a = m.a;
    const b = m.b;

    const your = m.pick === "a" ? a : b;
    const optimal = a.proj >= b.proj ? a : b;

    yourScore += your.proj;
    optimalScore += optimal.proj;

    if (your.name === optimal.name) correct += 1;
  }

  const accuracyPct = Math.round((correct / MAX_MATCHUPS) * 100);

  return {
    ok: true,
    yourScore: Number(yourScore.toFixed(1)),
    optimalScore: Number(optimalScore.toFixed(1)),
    correct,
    accuracyPct
  };
}

// -------------------- v2: Lineup mode helpers --------------------
function getPlayersByPos(pos) {
  return PLAYERS.filter(p => p.pos === pos);
}
function getPlayersByAllowed(allowed) {
  return PLAYERS.filter(p => allowed.includes(p.pos));
}
function uniquePlayerOptions(players, alreadyPickedNames) {
  return players.filter(p => !alreadyPickedNames.has(p.name));
}
function getLineupPickedNames() {
  return new Set(Object.values(lineup).filter(Boolean));
}

function renderSlots() {
  slotsEl.innerHTML = "";
  const picked = getLineupPickedNames();

  LINEUP_SLOTS.forEach(slot => {
    const candidates = uniquePlayerOptions(getPlayersByAllowed(slot.allowed), picked);
    // Also allow keeping current selection (so you can re-open dropdown)
    const current = lineup[slot.key];
    const pool = current
      ? [PLAYERS.find(p => p.name === current)].filter(Boolean).concat(candidates)
      : candidates;

    const el = document.createElement("div");
    el.className = "slot";
    el.innerHTML = `
      <div class="slot-header">
        <div class="slot-title">${slot.label}</div>
        <small>Allowed: ${slot.allowed.join("/")}</small>
      </div>
      <select class="select" data-slot="${slot.key}">
        <option value="">Select player…</option>
        ${pool.map(p => `
          <option value="${p.name}" ${p.name === current ? "selected" : ""}>
            ${p.name} (${p.pos} • ${p.team}) — Proj ${p.proj.toFixed(1)}
          </option>
        `).join("")}
      </select>
    `;
    slotsEl.appendChild(el);
  });

  lineupStatusEl.textContent = isLineupComplete()
    ? "Lineup complete. Click Score Week to simulate this slate."
    : "Fill all lineup slots to simulate the week.";
}

function isLineupComplete() {
  return LINEUP_SLOTS.every(s => !!lineup[s.key]);
}

function renderCoach() {
  coachEl.innerHTML = "";
  const picked = LINEUP_SLOTS
    .map(s => ({ slot: s.key, player: PLAYERS.find(p => p.name === lineup[s.key]) }))
    .filter(x => x.player);

  if (picked.length === 0) {
    coachEl.innerHTML = `<div class="coach-card">Pick some players to get coaching notes.</div>`;
    return;
  }

  const cards = [];
  for (const { slot, player } of picked) {
    const risk = player.tag;
    const upside = player.ceil - player.proj;
    const downside = player.proj - player.floor;

    const style = risk === "good" ? "High confidence" : risk === "ok" ? "Solid" : "Risky";
    const note = risk === "good"
      ? "Safe floor with strong projection."
      : risk === "ok"
        ? "Reasonable play; consider matchup and ceiling."
        : "High variance; only worth it if you need upside.";

    const recommendation = (upside > downside && risk !== "risk")
      ? "Upside lean"
      : (downside >= upside || risk === "risk")
        ? "Floor lean"
        : "Balanced";

    cards.push(`
      <div class="coach-card">
        <div><strong>${slot}</strong> — ${player.name} (${player.pos})</div>
        <div class="muted">${style}. ${note}</div>
        <div class="muted">Coach read: <strong>${recommendation}</strong> • Floor ${player.floor.toFixed(1)} / Proj ${player.proj.toFixed(1)} / Ceil ${player.ceil.toFixed(1)}</div>
      </div>
    `);
  }

  coachEl.innerHTML = cards.join("");
}

// -------------------- v2: Standard scoring simulation --------------------
// Standard scoring (typical): Passing: 1 pt per 25 yards, 4 per pass TD, -2 per INT
// Rushing/Receiving: 1 per 10 yards, 6 per TD, 1 per reception (PPR is common but we keep it simple-ish)
// We'll simulate plausible stat lines around projection using floor/ceiling.

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function randNormal(rng) {
  // Box-Muller transform
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function simulatePointsForPlayer(p, rng) {
  // target points around proj with spread based on floor/ceil
  const spread = Math.max(1, (p.ceil - p.floor) / 4);
  const raw = p.proj + randNormal(rng) * spread;

  // bias riskier players to more volatility
  const tagBoost = p.tag === "risk" ? 1.25 : p.tag === "ok" ? 1.0 : 0.85;
  const points = clamp(raw * tagBoost, p.floor, p.ceil);

  // Return points (already "fantasy points"); for an API future, we'd return stat lines too.
  return Number(points.toFixed(1));
}

function simulateLineupWeek(lineupPlayers, rng) {
  const results = lineupPlayers.map(p => ({
    name: p.name,
    pos: p.pos,
    points: simulatePointsForPlayer(p, rng)
  }));

  const total = results.reduce((s, r) => s + r.points, 0);
  return { results, total: Number(total.toFixed(1)) };
}

function computeOptimalLineup(rngSeedKey) {
  // brute force a small "optimal" from current pool by picking best projected per slot (with uniqueness constraint)
  // For MVP pool size this is fine.
  const chosen = {};
  const used = new Set();

  for (const slot of LINEUP_SLOTS) {
    const candidates = getPlayersByAllowed(slot.allowed)
      .slice()
      .sort((a,b) => b.proj - a.proj);

    const pick = candidates.find(p => !used.has(p.name));
    if (pick) {
      chosen[slot.key] = pick;
      used.add(pick.name);
    }
  }

  // simulate with deterministic seed for "optimal" too
  const seed = hashToInt(`lineup-sim:${rngSeedKey}:optimal`);
  const rng = seededRand(seed);

  const lineupPlayers = LINEUP_SLOTS.map(s => chosen[s.key]).filter(Boolean);
  return simulateLineupWeek(lineupPlayers, rng);
}

// -------------------- v2: Leaderboards --------------------
function lbKeyForMode(m) {
  return m === "lineup" ? "lb_lineup" : "lb_startsit";
}
function addToLeaderboard(m, entry) {
  const key = lbKeyForMode(m);
  const board = getJSON(key, []);
  board.push(entry);
  board.sort((a,b) => b.score - a.score);
  setJSON(key, board.slice(0, 10));
}
function renderLeaderboards() {
  const ss = getJSON("lb_startsit", []);
  const lu = getJSON("lb_lineup", []);

  ssBoardEl.innerHTML = ss.length
    ? ss.map(e => `<li><strong>${e.score.toFixed(1)}</strong> <span class="lb-meta">(${e.when})</span></li>`).join("")
    : `<li class="lb-meta">No scores yet.</li>`;

  luBoardEl.innerHTML = lu.length
    ? lu.map(e => `<li><strong>${e.score.toFixed(1)}</strong> <span class="lb-meta">(${e.when})</span></li>`).join("")
    : `<li class="lb-meta">No scores yet.</li>`;
}

// -------------------- mode switching --------------------
function setMode(m) {
  mode = m;
  setStr("ss_mode_game", mode);
  renderModeUI();
}
function getSavedMode() {
  const v = getStr("ss_mode_game", "startsit");
  return (v === "lineup" || v === "startsit") ? v : "startsit";
}
function renderModeUI() {
  const isLineup = mode === "lineup";
  modeBtn.textContent = `Mode: ${isLineup ? "Lineup" : "Start/Sit"}`;

  matchupsEl.hidden = isLineup;
  lineupSection.hidden = !isLineup;

  // Adjust results labels
  resultsTitleEl.textContent = isLineup ? "Lineup Results" : "Start/Sit Results";
  labelYourScoreEl.textContent = isLineup ? "Your Lineup" : "Your Score";
  labelOptimalScoreEl.textContent = isLineup ? "Optimal Lineup" : "Optimal Score";
  labelAccuracyEl.textContent = isLineup ? "Slots Filled" : "Accuracy";
  labelOutcomeEl.textContent = isLineup ? "Outcome" : "Outcome";

  resultsTipEl.textContent = isLineup
    ? "Tip: Optimize for floor if you’re protecting a lead; chase ceiling if you need upside."
    : "Tip: “Win” = you matched the optimal pick in at least 3 of 4 matchups.";

  clearResults();
  renderLeaderboards();

  if (isLineup) {
    renderSlots();
    renderCoach();
    setMessage("Lineup mode: build a roster and simulate the week.");
  } else {
    setMessage("Start/Sit mode: make your picks and score the slate.");
  }
}

// -------------------- events --------------------
matchupsEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button.pick");
  if (!btn || scored) return;

  if (mode !== "startsit") return;

  const idx = Number(btn.dataset.idx);
  const pick = btn.dataset.pick;

  matchups[idx].pick = pick;
  renderMatchups();
});

hintBtn.addEventListener("click", () => {
  hintOn = !hintOn;
  hintBtn.textContent = `Hint: ${hintOn ? "On" : "Off"}`;
  if (mode === "startsit") renderMatchups();
});

dailyBtn.addEventListener("click", () => {
  setDailyMode(!isDailyMode());
  startWeek(true);
});

newWeekBtn.addEventListener("click", () => {
  startWeek(false);
});

modeBtn.addEventListener("click", () => {
  setMode(mode === "startsit" ? "lineup" : "startsit");
});

slotsEl.addEventListener("change", (e) => {
  const sel = e.target.closest("select.select");
  if (!sel) return;

  const slotKey = sel.dataset.slot;
  const val = sel.value;

  // Ensure uniqueness: if selected player is already used elsewhere, clear that other slot
  if (val) {
    for (const k of Object.keys(lineup)) {
      if (k !== slotKey && lineup[k] === val) lineup[k] = "";
    }
  }
  lineup[slotKey] = val;

  renderSlots();
  renderCoach();
});

scoreBtn.addEventListener("click", () => {
  if (scored) {
    setMessage("This slate is already scored. Hit New Week to play again.");
    return;
  }

  // Common seed key for simulations
  const seedKey = isDailyMode() ? `daily:${todayKeyUTC()}` : `week:${week}`;

  if (mode === "startsit") {
    const r = computeWeekScore();
    if (!r.ok) {
      setMessage(r.reason);
      return;
    }

    scored = true;

    yourScoreEl.textContent = r.yourScore.toFixed(1);
    optimalScoreEl.textContent = r.optimalScore.toFixed(1);
    accuracyEl.textContent = `${r.correct}/${MAX_MATCHUPS} (${r.accuracyPct}%)`;

    const didWin = winWeek(r.correct);
    outcomeEl.textContent = didWin ? "WIN ✅" : "LOSS ❌";

    updateBestScore(r.yourScore);

    addToLeaderboard("startsit", { score: r.yourScore, when: new Date().toLocaleString() });
    renderLeaderboards();

    setMessage(didWin
      ? "Nice! You won the week. Streak updated."
      : "Tough week. Streak reset. Run it back.");

    renderMatchups();
    return;
  }

  // Lineup mode scoring
  if (!isLineupComplete()) {
    setMessage("Fill all lineup slots before scoring.");
    return;
  }

  // Deterministic sim RNG for lineup
  const seed = hashToInt(`lineup-sim:${seedKey}:yours`);
  const rng = seededRand(seed);

  const lineupPlayers = LINEUP_SLOTS
    .map(s => PLAYERS.find(p => p.name === lineup[s.key]))
    .filter(Boolean);

  const yours = simulateLineupWeek(lineupPlayers, rng);
  const optimal = computeOptimalLineup(seedKey);

  scored = true;

  yourScoreEl.textContent = `${yours.total.toFixed(1)} pts`;
  optimalScoreEl.textContent = `${optimal.total.toFixed(1)} pts`;
  accuracyEl.textContent = `${lineupPlayers.length}/${LINEUP_SLOTS.length}`;
  outcomeEl.textContent = yours.total >= optimal.total ? "GREAT WEEK ✅" : "ROOM TO IMPROVE ❌";

  addToLeaderboard("lineup", { score: yours.total, when: new Date().toLocaleString() });
  renderLeaderboards();

  setMessage("Lineup simulated. Try swapping one player and run it back next slate.");
});

// -------------------- week lifecycle --------------------
function startWeek(preserveWeekNumber) {
  scored = false;
  hintOn = false;
  hintBtn.textContent = "Hint: Off";

  if (!preserveWeekNumber) week += 1;
  if (week < 1) week = 1;

  weekLabelEl.textContent = isDailyMode()
    ? `Daily: ${todayKeyUTC()} (UTC)`
    : `Week: ${week}`;

  matchups = generateMatchups();

  // reset lineup slate selections each new week
  lineup = {};
  renderSlots();
  renderCoach();

  clearResults();
  renderModeToggle();
  renderStats();
  renderMatchups();
  renderLeaderboards();

  setMessage(isDailyMode()
    ? "Daily slate loaded. Everyone gets the same matchups today."
    : "New slate loaded. Make picks (or build a lineup) and score it.");
}

// init
setMode(getSavedMode());
renderModeToggle();
renderStats();
startWeek(true);
