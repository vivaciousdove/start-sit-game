# DEVLOG — Start/Sit Weekly Lineup Challenge

## v1 — Foundation build
### Goal
Create a fantasy-sports decision game that’s:
- simple
- fast to play
- easy to host
- portfolio-ready

### Key Decisions
- Use static HTML/CSS/JS for frictionless Netlify deploy.
- Use deterministic "Daily Mode" based on UTC date so everyone sees the same slate.
- Use localStorage for streaks + best score persistence.

### Scoring Model (Start/Sit)
- Each player has a projection (proj), floor, and ceiling.
- "Optimal" pick per matchup is the higher projection.
- Win condition: >= 3 correct picks out of 4.

### QA Notes (what to test)
- Cannot score without 4 picks
- Picks lock after scoring
- Daily mode changes by date (UTC)
- Streak increments on win, resets on loss
- Best score updates only when beaten

---

## v2 — MVP Upgrade (Lineup Mode + Leaderboards)
### What Shipped
- Mode toggle: **Start/Sit** ↔ **Lineup Builder**
- Lineup slots: **QB / RB / RB / WR / WR / TE / FLEX**
- Standard scoring simulation using floor/proj/ceil ranges
- Explainable “AI Coach” notes (rule-based)
- Dual leaderboards (Start/Sit + Lineup), localStorage-backed

### QA Notes (what to test)
- Lineup slots enforce allowed positions (FLEX = RB/WR/TE)
- Player uniqueness: same player cannot be selected in two slots
- Lineup cannot be scored until all slots are filled
- Leaderboard:
  - Keeps top 10
  - Sorted descending
  - Separate boards per mode

---

## Next Upgrades (backlog)
- Share results (copy-to-clipboard “results card”)
- Bigger player pool + realistic weekly slate generation
- Difficulty settings (injury/weather flags, volatility mode)
- Real leaderboard (backend API + DB)
- QA Automation: Playwright smoke/regression + GitHub Actions CI
- Backend-ready Coach API contract (e.g., `/api/recommendations`)
