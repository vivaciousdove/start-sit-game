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

### Scoring Model
- Each player has a projection (proj), floor, and ceiling.
- "Optimal" pick per matchup is the higher projection.
- Win condition: >= 3 correct picks out of 4.

### QA Notes (what to test)
- Cannot score without 4 picks
- Picks lock after scoring
- Daily mode changes by date (UTC)
- Streak increments on win, resets on loss
- Best score updates only when beaten

### Next Upgrades (backlog)
- Share button (copy results)
- Position constraints (must start specific positions)
- Real weekly slate generator
- Mobile UX polish
