# Radar verification — 2026-11-01

- Node: 4/4 regression checks pass (valid past metadata only, manifest cache and playback reset, provider failure, concurrent city changes).
- JavaScript syntax: app.js and radar.js pass node --check.
- git diff --check: no whitespace errors.
- Real Chromium with network: Chicago current/hourly/daily weather and OSM/RainViewer radar tiles render; Play advances timestamp, Pause stops playback.
- Searching London updates weather and radar together and stores London/Chicago in weatherNowRecentCities.
- Desktop radar visually inspected at 1440px; phone panel visually inspected at 390px. Phone document scrollWidth equals 390px, map width 354px.
- Only browser console error: existing missing /favicon.ico (404).
- Screenshots: output/playwright/radar-desktop.png and radar-mobile.png (ignored QA artifacts).
- No deployment, push, commit, paid service setup, or credentials changed. Existing untracked AGENTS.md preserved.
- Preview: http://127.0.0.1:5174/ while local server remains running.
- Publication next step: review diff, commit intended files excluding AGENTS.md/QA artifacts, then deploy through the existing Vercel project after publication authorization.

Constraints: past radar only; fixed regional view; first loop loads at five-second intervals, cached frames loop faster. Provider failure/coverage gaps do not imply dry weather. Manifest refresh cached for five minutes.
