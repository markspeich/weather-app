# WeatherNow

A clean weather dashboard inspired by the first design concept in this project.

The app uses Open-Meteo directly from the browser:

- Geocoding API for city search
- Forecast API for current conditions, hourly weather, and a 5-day outlook
- No API key required for non-commercial use

Open `index.html` in a browser or serve the folder locally to try it.

Radar uses Leaflet 1.9.4, OpenStreetMap base tiles and RainViewer past radar tiles.
Select a city, then use Play/Pause or the time slider below the forecasts.
The first loop loads gradually; later loops reuse the loaded frames. The map is
a fixed regional view to keep tile requests modest. Frame times use the selected
city's timezone. Blank areas can mean no precipitation or missing coverage.
Refresh reuses the manifest for up to five minutes. No forecast radar is shown.
Third-party services can be unavailable independently of Open-Meteo.

Run regression checks with Node.js: `node --test tests/*.test.cjs`.
For map verification, serve over HTTP; OSM expects a browser Referer header.

The app reopens the last successfully selected city using the existing recent-city
storage. Missing or invalid storage falls back to Chicago. Daily rain percentages
use Open-Meteo's maximum daily precipitation probability (not rainfall amount),
including other precipitation types. Unavailable probabilities display a dash.
