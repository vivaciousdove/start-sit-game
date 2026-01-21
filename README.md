# Start/Sit Weekly Lineup Challenge (Fantasy Football MVP)

A fantasy-football-inspired decision game built with **HTML, CSS, and JavaScript**.  
Play it two ways:

- **Start/Sit**: pick the better player in 4 matchups and score your slate
- **Lineup Builder**: build a **QB / 2 RB / 2 WR / TE / FLEX** lineup and simulate the week (standard scoring)

## Live Demo
https://ff-roster.netlify.app/

## What It Is
This is a portfolio-ready MVP that shows:
- clean front-end UI/UX
- deterministic “Daily Mode” (same slate for everyone each day, UTC-based)
- scoring logic + local persistence (streaks, best scores)
- a roadmap for **automation + backend API** upgrades

## Features
### Start/Sit Mode
- 4 matchups per slate (8 players total)
- Start buttons per matchup
- Hint toggle (shows projected edge)
- Score Week: your score vs optimal score
- Win streak + best streak + best score (localStorage)

### Lineup Mode (Standard Scoring Simulation)
- Build: QB, RB, RB, WR, WR, TE, FLEX (RB/WR/TE)
- Simulated weekly outcomes using floor/projection/ceiling ranges
- “AI Coach” notes (rule-based + explainable now, easy to swap to an API later)
- Separate leaderboard for lineup scores

### Leaderboards
- Start/Sit top scores + Lineup top scores
- Stored locally on the device (localStorage)

## Run Locally
Option A:
- Open `index.html` in your browser

Option B (recommended):
- Use VS Code **Live Server** and open the generated localhost URL

## Deploy (Netlify)
This is a static site.
- Connect the GitHub repo to Netlify
- Deploy from `main`
- Publish directory: `/` (project root)

## Roadmap (V3+)
- Bigger player pool + weekly “live” slate generator
- True position constraints from real roster rules (bench, injuries, byes)
- Real leaderboard (backend API + database)
- QA Automation: Playwright tests + GitHub Actions CI
- Replace Coach rules with a real API: `/api/recommendations` (explainable output)

## QA / Testing Ideas
- Cannot score without required picks (Start/Sit) / required slots (Lineup)
- Daily mode is deterministic (same date => same slate)
- Streak increments only on wins; resets on loss
- Best score updates only when beaten
- Leaderboard keeps top 10 and is sorted correctly
