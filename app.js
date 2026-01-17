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

// ---------- DOM ----------
const matchupsEl = document.getElementById("matchups");
const lineupEl = document.getElementById("lineup");
const slotsEl = document.getElementById("slots");
const coachEl = document.getElementById("coach");
const lineupStatusEl = document.getElementById("lineupStatus");

const msgEl = document.getElementById("message");
const weekLabelEl = document.getElementById("weekLabel");

const yourScoreEl = document.getElementById("yourScore");
const optimalScoreEl = document.getElementById("optimalScore");
const accuracyEl = document.getElementById("accuracy");
const outcomeEl = document.getElementById("outcome");

const resultsTitleEl = document.getElementById("resultsTitle");
const labelYourScoreEl = document.getElementById("labelYourScore");
const labelOptimalScoreEl = document.getElementById("labelOptimalScore");
const labelAccuracyEl = document.getElementById("labelAccuracy");
const labelOutcomeEl = document.getElementById("labelOutcome");
const resultsTipEl = document.getElementById("resultsTip");

const streakEl = document.getElementById("streak");
const bestStreakEl = document.getElementById("bestStreak");
const bestScoreEl = document.getElementById("bestScore");

const ssBoardEl = document.getElementById("ssBoard");
const luBoardEl = document.getElementById("luBoard");

const newWeekBtn = document.getElementById("newWeekBtn");
const dailyBtn = document.getElementById("dailyBtn");
const hintBtn = document.getElementById("hintBtn");
const scoreBtn = document.getElementById("scoreBtn");
const modeBtn = document.getElementById("modeBtn");

// ---------- State ----------
let week = 1;
let hintOn = false;           // Start/Sit hint OR Lineup coach toggle (same button)
let matchups = [];            // [{a,b, pick: 'a'|'b'|null}]
let scored = false;

let mode = "startsit";        // "startsit" | "lineup"
const LINEUP_SLOTS = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX"];
let lineup = {};              // slotKey -> playerName
let lineupSlate = [];         // player objects used for this "week" slate (can be whole pool for MVP)
let lastLineupSim = null;     // stores last sim detail for display

// ---------- storage helpers ----------
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
function getJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function setJson(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

// ---------- daily mode ----------
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

// ---------- streak / best ----------
function renderStats() {
  const streak = getNum("ss_streak", 0);
  const bestStreak = getNum("ss_bestStreak", 0);
  const bestScore = getNum("ss_bestScore", 0);

  streakEl.textContent = `Win Streak: ${streak}`;
  bestStreakEl.textContent = `Best Streak: ${bestStreak}`;
  bestScoreEl.textContent = `Best Score: ${bestScore.toFixed ? bestScore.toFixed(1) : bestScore}`;
}

function winWeekStartSit(yourCorrect) {
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

// ---------- leaderboards ----------
function pushLeaderboard(key, entry, limit = 10) {
  const arr = getJson(key, []);
  arr.push(entry);
  arr.sort((a, b) => (b.score - a.score));
  const trimmed = arr.slice(0, limit);
  setJson(key, trimmed);
  return trimmed;
}

function renderLeaderboards() {
  const ss = getJson("lb_startsit", []);
  const lu = getJson("lb_lineup", []);

  ssBoardEl.innerHTML = ss.length ? "" : "<li><span class='lb-meta'>No scores yet.</span></li>";
  luBoardEl.innerHTML = lu.length ? "" : "<li><span class='lb-meta'>No scores yet.</span></li>";

  if (ss.length) {
    ssBoardEl.innerHTML = ss.map(e => `
      <li>
        ${Number(e.score).toFixed(1)}
        <div class="lb-meta">${e.label}</div>
      </li>
    `).join("");
  }
  if (lu.length) {
    luBoardEl.innerHTML = lu.map(e => `
      <li>
        ${Number(e.score).toFixed(1)}
        <div class="lb-meta">${e.label}</div>
      </li>
    `).join("");
  }
}

// ---------- matchup generation (Start/Sit) ----------
function chooseUniquePlayers(rng, count) {
  const pool = PLAYERS.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function generateMatchups() {
  const seed = isDailyMode()
    ? hashToInt(`daily:${todayKeyUTC()}:startsit`)
    : hashToInt(`random:${Date.now()}:${Math.random()}:startsit`);

  const rng = seededRand(seed);

  const picked = chooseUniquePlayers(rng, MAX_MATCHUPS * 2);
  const pairs = [];
  for (let i = 0; i < picked.length; i += 2) {
    pairs.push({ a: picked[i], b: picked[i + 1], pick: null });
  }
  return pairs;
}

// ---------- rendering helpers ----------
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

function setResultsUIForMode() {
  if (mode === "startsit") {
    resultsTitleEl.textContent = "Results";
    labelYourScoreEl.textContent = "Your Score";
    labelOptimalScoreEl.textContent = "Optimal Score";
    labelAccuracyEl.textContent = "Accuracy";
    labelOutcomeEl.textContent = "Outcome";
    resultsTipEl.textContent = "Tip: “Win” = you matched the optimal pick in at least 3 of 4 matchups.";

    newWeekBtn.textContent = "New Week";
    hintBtn.textContent = `Hint: ${hintOn ? "On" : "Off"}`;
    modeBtn.textContent = "Mode: Start/Sit";
    scoreBtn.textContent = "Score Week";

    matchupsEl.hidden = false;
    lineupEl.hidden = true;
  } else {
    resultsTitleEl.textContent = "Lineup Results";
    labelYourScoreEl.textContent = "Week Score";
    labelOptimalScoreEl.textContent = "Projected Optimal";
    labelAccuracyEl.textContent = "Your Projection";
    labelOutcomeEl.textContent = "Grade";
    resultsTipEl.textContent = "Tip: Fill all lineup slots. Daily mode makes the slate repeatable by date (UTC).";

    newWeekBtn.textContent = "New Slate";
    hintBtn.textContent = `Coach: ${hintOn ? "On" : "Off"}`;
    modeBtn.textContent = "Mode: Lineup";
    scoreBtn.textContent = "Simulate Week";

    matchupsEl.hidden = true;
    lineupEl.hidden = false;
  }
}

// ---------- Start/Sit scoring ----------
function computeWeekScoreStartSit() {
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

// ---------- Lineup mode (builder + simulation) ----------

// eligibility checks
function eligibleForSlot(pos, slot) {
  if (slot === "FLEX") return pos === "RB" || pos === "WR" || pos === "TE";
  return pos === slot;
}

function slateForWeek() {
  // MVP: use full pool, but deterministic order for daily vs random
  const seed = isDailyMode()
    ? hashToInt(`daily:${todayKeyUTC()}:lineup`)
    : hashToInt(`random:${Date.now()}:${Math.random()}:lineup`);
  const rng = seededRand(seed);
  const pool = PLAYERS.slice();

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // keep entire pool for MVP; later this becomes a "weekly slate" from API
  return pool;
}

function slotKey(slot, idx) {
  if (slot === "RB") return `RB${idx}`;
  if (slot === "WR") return `WR${idx}`;
  return slot;
}

function getSlotOrder() {
  // produce keys in order: QB, RB1, RB2, WR1, WR2, TE, FLEX
  return ["QB", "RB1", "RB2", "WR1", "WR2", "TE", "FLEX"];
}

function renderSlots() {
  slotsEl.innerHTML = "";

  const slotKeys = getSlotOrder();
  const selectedNames = new Set(Object.values(lineup).filter(Boolean));

  slotKeys.forEach((k) => {
    const slotType = k.startsWith("RB") ? "RB" : k.startsWith("WR") ? "WR" : k;

    const eligible = lineupSlate.filter(p => eligibleForSlot(p.pos, slotType));

    const div = document.createElement("div");
    div.className = "slot";

    const current = lineup[k] || "";
    const options = eligible
      .map(p => {
        const usedElsewhere = selectedNames.has(p.name) && p.name !== current;
        const disabled = usedElsewhere ? "disabled" : "";
        const tagLabel = p.tag === "good" ? "High" : p.tag === "ok" ? "Solid" : "Risk";
        return `<option value="${escapeHtml(p.name)}" ${disabled} ${p.name === current ? "selected" : ""}>
          ${p.name} (${p.pos} • ${p.team}) — Proj ${p.proj.toFixed(1)} — ${tagLabel}
        </option>`;
      })
      .join("");

    div.innerHTML = `
      <div class="slot-header">
        <div class="slot-title">${k}</div>
        <small>${slotType === "FLEX" ? "RB/WR/TE" : slotType}</small>
      </div>
      <select class="select" data-slot="${k}">
        <option value="" ${current === "" ? "selected" : ""}>— Select a player —</option>
        ${options}
      </select>
    `;

    slotsEl.appendChild(div);
  });

  updateLineupStatus();
  renderCoach();
}

function updateLineupStatus() {
  const slotKeys = getSlotOrder();
  const filled = slotKeys.filter(k => lineup[k]).length;
  const valid = filled === slotKeys.length && new Set(Object.values(lineup)).size === slotKeys.length;

  const projTotal = computeLineupProjection();
  lineupStatusEl.textContent =
    `Lineup status: ${valid ? "VALID ✅" : "INCOMPLETE ❌"} • Filled ${filled}/${slotKeys.length}` +
    (projTotal > 0 ? ` • Projection: ${projTotal.toFixed(1)}` : "");
}

function computeLineupProjection() {
  const slotKeys = getSlotOrder();
  let total = 0;
  for (const k of slotKeys) {
    const name = lineup[k];
    if (!name) continue;
    const p = lineupSlate.find(x => x.name === name);
    if (p) total += p.proj;
  }
  return total;
}

function computeGreedyOptimalProjection() {
  // Greedy "optimal" based on projections, respecting lineup rules
  const pool = lineupSlate.slice().sort((a, b) => b.proj - a.proj);
  const used = new Set();

  function pickOne(posAllowed) {
    const p = pool.find(x => !used.has(x.name) && posAllowed(x));
    if (!p) return null;
    used.add(p.name);
    return p;
  }

  const qb = pickOne(x => x.pos === "QB");
  const rb1 = pickOne(x => x.pos === "RB");
  const rb2 = pickOne(x => x.pos === "RB");
  const wr1 = pickOne(x => x.pos === "WR");
  const wr2 = pickOne(x => x.pos === "WR");
  const te = pickOne(x => x.pos === "TE");
  const flex = pickOne(x => x.pos === "RB" || x.pos === "WR" || x.pos === "TE");

  const picks = [qb, rb1, rb2, wr1, wr2, te, flex].filter(Boolean);
  const total = picks.reduce((sum, p) => sum + p.proj, 0);
  return Number(total.toFixed(1));
}

function renderCoach() {
  coachEl.innerHTML = "";

  if (!hintOn) {
    coachEl.innerHTML = `<div class="coach-card"><div class="muted">Coach is off. Toggle Coach: On to see recommendations.</div></div>`;
    return;
  }

  const slotKeys = getSlotOrder();
  const recommendations = [];

  slotKeys.forEach((k) => {
    const slotType = k.startsWith("RB") ? "RB" : k.startsWith("WR") ? "WR" : k;
    const chosenName = lineup[k];
    const chosen = chosenName ? lineupSlate.find(p => p.name === chosenName) : null;

    const eligible = lineupSlate
      .filter(p => eligibleForSlot(p.pos, slotType))
      .slice()
      .sort((a, b) => b.proj - a.proj);

    const best = eligible[0] || null;

    if (!best) return;

    if (!chosen) {
      recommendations.push({
        title: `${k}: pick suggestion`,
        body: `Start with ${best.name} (Proj ${best.proj.toFixed(1)}).`,
        why: `Rule: In a vacuum, take the highest projection for the slot.`
      });
      return;
    }

    const diff = best.proj - chosen.proj;
    const chosenRisk = chosen.tag === "risk";
    const bestSafer = best.tag === "good" && chosen.tag !== "good";

    if (diff > 1.5 || bestSafer) {
      const whyBits = [];
      if (diff > 1.5) whyBits.push(`projection edge +${diff.toFixed(1)}`);
      if (bestSafer) whyBits.push(`safer profile (${best.tag} vs ${chosen.tag})`);
      if (chosenRisk) whyBits.push(`avoid risk in standard scoring`);

      recommendations.push({
        title: `${k}: consider swap`,
        body: `You picked ${chosen.name}. Coach leans ${best.name}.`,
        why: `Why: ${whyBits.join(", ")}.`
      });
    } else {
      recommendations.push({
        title: `${k}: looks good`,
        body: `Your pick ${chosen.name} is close to optimal.`,
        why: `Why: within ~1.5 projected points; keep it strategy-focused.`
      });
    }
  });

  coachEl.innerHTML = recommendations.map(r => `
    <div class="coach-card">
      <div><strong>${escapeHtml(r.title)}</strong></div>
      <div class="muted">${escapeHtml(r.body)}</div>
      <div class="muted">${escapeHtml(r.why)}</div>
    </div>
  `).join("");
}

// ---------- Standard scoring simulation ----------
function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function varianceByTag(tag) {
  // smaller = more stable; bigger = more volatile
  if (tag === "good") return 0.9;
  if (tag === "ok") return 1.15;
  return 1.45;
}

function randInt(rng, lo, hi) {
  return Math.floor(rng() * (hi - lo + 1)) + lo;
}

function simulateSkillStats(rng, p) {
  // RB/WR/TE: rushing + receiving + TD + fumble
  // We build a "target fantasy points" then convert into plausible yards/TD.
  const v = varianceByTag(p.tag);
  const target = clamp(p.proj * (0.75 + rng() * 0.5) * v, p.floor, p.ceil);

  let recTd = 0;
  let rushTd = 0;

  // TD likelihood scaled by projection
  const tdChances = clamp(target / 12, 0.2, 2.2);
  const tdRoll = rng() * tdChances;

  if (tdRoll > 1.6) { recTd = 1; }
  if (tdRoll > 2.0) { recTd = 2; }
  if (p.pos === "RB" && tdRoll > 1.2) { rushTd = 1; }
  if (p.pos === "RB" && tdRoll > 2.1) { rushTd = 2; }

  // rare fumble
  const fumbles = (p.tag === "risk" && rng() < 0.12) ? 1 : (rng() < 0.05 ? 1 : 0);

  const tdPts = (recTd + rushTd) * 6;
  const fumPts = fumbles * (-2);

  // remaining points to distribute to yards
  let remaining = target - tdPts - fumPts;
  remaining = Math.max(0, remaining);

  // split rush vs rec based on position
  const rushShare = p.pos === "RB" ? 0.55 : (p.pos === "TE" ? 0.10 : 0.25);
  const rushPts = remaining * (rushShare + (rng() * 0.12 - 0.06));
  const recPts = remaining - rushPts;

  // convert points to yards: 1 pt per 10 yards
  let rushYds = Math.round(clamp(rushPts * 10, 0, 180));
  let recYds = Math.round(clamp(recPts * 10, 0, 220));

  // mild realism nudge using floor/ceil
  if (target < (p.proj * 0.85)) {
    rushYds = Math.round(rushYds * 0.9);
    recYds = Math.round(recYds * 0.9);
  }

  const points = (rushYds / 10) + (recYds / 10) + (recTd * 6) + (rushTd * 6) + (fumbles * -2);
  return {
    type: "skill",
    rushYds, recYds, rushTd, recTd, fumbles,
    points: Number(points.toFixed(1))
  };
}

function simulateQBStats(rng, p) {
  const v = varianceByTag(p.tag);
  const target = clamp(p.proj * (0.75 + rng() * 0.5) * v, p.floor, p.ceil);

  // TDs and INTs
  const passTd = clamp(randInt(rng, 1, 4) + (target > 22 ? 1 : 0), 0, 5);
  const rushTd = (rng() < (p.tag === "risk" ? 0.10 : 0.06)) ? 1 : 0;
  const ints = (rng() < (p.tag === "risk" ? 0.30 : 0.18)) ? randInt(rng, 1, 2) : 0;

  const tdPts = passTd * 4 + rushTd * 6;
  const intPts = ints * (-2);

  let remaining = target - tdPts - intPts;
  remaining = Math.max(0, remaining);

  // allocate some to rushing
  const rushPts = clamp(remaining * (0.20 + (rng() * 0.10 - 0.05)), 0, remaining);
  const passPts = remaining - rushPts;

  let rushYds = Math.round(clamp(rushPts * 10, 0, 90));
  let passYds = Math.round(clamp(passPts * 25, 0, 450));

  const points =
    (passYds / 25) +
    (passTd * 4) +
    (ints * -2) +
    (rushYds / 10) +
    (rushTd * 6);

  return {
    type: "qb",
    passYds, passTd, ints, rushYds, rushTd,
    points: Number(points.toFixed(1))
  };
}

function simulatePlayerWeek(rng, p) {
  if (p.pos === "QB") return simulateQBStats(rng, p);
  return simulateSkillStats(rng, p);
}

function simulateLineupWeek() {
  const slotKeys = getSlotOrder();
  const selected = [];

  for (const k of slotKeys) {
    const name = lineup[k];
    if (!name) return { ok: false, reason: "Fill all lineup slots first." };
    const p = lineupSlate.find(x => x.name === name);
    if (!p) return { ok: false, reason: `Missing player for slot ${k}.` };
    selected.push({ slot: k, player: p });
  }

  // ensure unique players
  const uniq = new Set(selected.map(x => x.player.name));
  if (uniq.size !== selected.length) {
    return { ok: false, reason: "A player is selected more than once. Fix duplicates." };
  }

  const seed = isDailyMode()
    ? hashToInt(`daily:${todayKeyUTC()}:simulate`)
    : hashToInt(`random:${Date.now()}:${Math.random()}:simulate`);

  const rng = seededRand(seed);

  const details = selected.map(x => {
    const sim = simulatePlayerWeek(rng, x.player);
    return { slot: x.slot, p: x.player, sim };
  });

  const weekScore = details.reduce((sum, x) => sum + x.sim.points, 0);
  const proj = computeLineupProjection();
  const optimalProj = computeGreedyOptimalProjection();

  // grade based on projection ratio (strategy-focused)
  const ratio = optimalProj > 0 ? (proj / optimalProj) : 0;
  const grade = ratio >= 0.95 ? "A" : ratio >= 0.90 ? "B" : ratio >= 0.85 ? "C" : "D";

  return {
    ok: true,
    weekScore: Number(weekScore.toFixed(1)),
    proj: Number(proj.toFixed(1)),
    optimalProj: Number(optimalProj.toFixed(1)),
    grade,
    details
  };
}

function formatSimLine(x) {
  const p = x.p;
  const s = x.sim;

  if (s.type === "qb") {
    return `${p.name} — ${s.points.toFixed(1)} pts • ${s.passYds} pass yds, ${s.passTd} pass TD, ${s.ints} INT, ${s.rushYds} rush yds, ${s.rushTd} rush TD`;
  }
  return `${p.name} — ${s.points.toFixed(1)} pts • ${s.rushYds} rush yds, ${s.recYds} rec yds, ${s.rushTd} rush TD, ${s.recTd} rec TD, ${s.fumbles} fum`;
}

// ---------- mode lifecycle ----------
function setMode(nextMode) {
  mode = nextMode;
  hintOn = false; // reset hint/coach toggle per mode
  scored = false;
  clearResults();
  setResultsUIForMode();
  renderModeToggle();
  renderStats();
  renderLeaderboards();

  if (mode === "startsit") {
    matchups = generateMatchups();
    renderMatchups();
    setMessage(isDailyMode()
      ? "Daily matchups loaded. Everyone gets the same slate today."
      : "New week loaded. Make your Start picks and score it.");
  } else {
    lineupSlate = slateForWeek();
    lineup = {};
    lastLineupSim = null;
    renderSlots();
    setMessage(isDailyMode()
      ? "Daily lineup slate loaded. Everyone gets the same slate today."
      : "New lineup slate loaded. Build your lineup and simulate the week.");
  }
}

function updateWeekLabel(preserveWeekNumber) {
  if (!preserveWeekNumber) week += 1;
  if (week < 1) week = 1;

  if (isDailyMode()) {
    weekLabelEl.textContent = `Daily: ${todayKeyUTC()} (UTC)`;
  } else {
    weekLabelEl.textContent = `Week: ${week}`;
  }
}

// ---------- utilities ----------
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------- event wiring ----------
matchupsEl.addEventListener("click", (e) => {
  if (mode !== "startsit") return;

  const btn = e.target.closest("button.pick");
  if (!btn || scored) return;

  const idx = Number(btn.dataset.idx);
  const pick = btn.dataset.pick;

  matchups[idx].pick = pick;
  renderMatchups();
});

slotsEl.addEventListener("change", (e) => {
  if (mode !== "lineup") return;
  const sel = e.target.closest("select[data-slot]");
  if (!sel) return;

  const slot = sel.dataset.slot;
  const value = sel.value;

  lineup[slot] = value || "";
  renderSlots();
});

hintBtn.addEventListener("click", () => {
  hintOn = !hintOn;
  setResultsUIForMode();

  if (mode === "startsit") {
    renderMatchups();
  } else {
    renderCoach();
  }
});

dailyBtn.addEventListener("click", () => {
  setDailyMode(!isDailyMode());
  updateWeekLabel(true);
  // refresh current mode slate/matchups deterministically
  setMode(mode);
});

newWeekBtn.addEventListener("click", () => {
  updateWeekLabel(false);
  setMode(mode);
});

modeBtn.addEventListener("click", () => {
  setMode(mode === "startsit" ? "lineup" : "startsit");
});

scoreBtn.addEventListener("click", () => {
  if (mode === "startsit") {
    if (scored) {
      setMessage("This week is already scored. Hit New Week to play again.");
      return;
    }

    const r = computeWeekScoreStartSit();
    if (!r.ok) {
      setMessage(r.reason);
      return;
    }

    scored = true;

    yourScoreEl.textContent = r.yourScore.toFixed(1);
    optimalScoreEl.textContent = r.optimalScore.toFixed(1);
    accuracyEl.textContent = `${r.correct}/${MAX_MATCHUPS} (${r.accuracyPct}%)`;

    const didWin = winWeekStartSit(r.correct);
    outcomeEl.textContent = didWin ? "WIN ✅" : "LOSS ❌";

    updateBestScore(r.yourScore);

    const label = isDailyMode() ? `Daily ${todayKeyUTC()} (UTC)` : `Week ${week}`;
    pushLeaderboard("lb_startsit", { score: r.yourScore, label });
    renderLeaderboards();

    setMessage(didWin
      ? "Nice! You won the week. Streak updated."
      : "Tough week. Streak reset. Run it back.");

    renderMatchups();
    return;
  }

  // Lineup mode
  const r = simulateLineupWeek();
  if (!r.ok) {
    setMessage(r.reason);
    return;
  }

  lastLineupSim = r;

  yourScoreEl.textContent = r.weekScore.toFixed(1);
  optimalScoreEl.textContent = r.optimalProj.toFixed(1);
  accuracyEl.textContent = r.proj.toFixed(1);
  outcomeEl.textContent = `${r.grade}`;

  const label = isDailyMode() ? `Daily ${todayKeyUTC()} (UTC)` : `Week ${week}`;
  pushLeaderboard("lb_lineup", { score: r.weekScore, label });
  renderLeaderboards();

  setMessage(`Week simulated. Grade ${r.grade}. Scroll AI Coach for lineup feedback.`);

  // Append simulation detail under coach area (strategy + realism)
  if (hintOn) {
    const detailHtml = `
      <div class="coach-card">
        <div><strong>Simulation Detail</strong></div>
        <div class="muted">${escapeHtml(label)}</div>
        <div class="muted">${escapeHtml(r.details.map(formatSimLine).join(" | "))}</div>
      </div>
    `;
    coachEl.insertAdjacentHTML("beforeend", detailHtml);
  }
});

// ---------- init ----------
function init() {
  renderModeToggle();
  renderStats();
  renderLeaderboards();
  updateWeekLabel(true);
  setMode("startsit");
}

init();
