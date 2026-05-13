# Weather App Notes

## App Structure

- Static frontend app with `index.html`, `styles.css`, and `app.js`.
- No build step is currently required.
- Local preview can run with `python -m http.server 5173 --bind 127.0.0.1`.

## Product Direction

- WeatherNow is a weather dashboard inspired by `weather-design-concepts/concept-1-clean-desktop-dashboard.png`.
- Keep the Concept 1 feel where practical: blue left sidebar, airy pale weather panel, large current city and temperature, and a right-side details/forecast column on desktop widths.
- The first screen should be the usable dashboard, not a landing page.

## Current Features

- City search uses Open-Meteo geocoding and forecast APIs.
- Recently searched cities appear in the left sidebar.
- Recent city data is stored in `localStorage` under `weatherNowRecentCities`.
- Recent city rows are clickable and reload that city's weather.
- The Add Location button focuses the city search input.

## Layout Gotchas

- The sidebar reduces the available width for the main dashboard, so viewport breakpoints alone can be misleading.
- `weather-dashboard` uses container queries to respond to its own available width.
- The temperature and weather icon should shrink at mid-widths before they can overlap the right details column.
- Keep the right details column visible at desktop widths; stack it only when the dashboard itself becomes genuinely narrow.

## Design Preferences

- Use restrained dashboard styling: 8px radius, compact controls, clear scanning hierarchy, and no decorative card nesting.
- Preserve the bright blue sidebar and soft weather-panel contrast from Concept 1.
- Avoid oversized explanatory text inside the app; controls and data should carry the interface.
