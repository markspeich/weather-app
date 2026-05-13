const geocodingBaseUrl = "https://geocoding-api.open-meteo.com/v1/search";
const forecastBaseUrl = "https://api.open-meteo.com/v1/forecast";

const state = {
  currentUnit: "fahrenheit",
  windUnit: "mph",
  precipitationUnit: "inch",
  recentCities: loadRecentCities(),
  activeCityKey: "",
};

const elements = {
  form: document.querySelector("#search-form"),
  input: document.querySelector("#city-input"),
  addLocationButton: document.querySelector("#add-location-button"),
  recentList: document.querySelector("#recent-list"),
  status: document.querySelector("#status-message"),
  cityName: document.querySelector("#city-name"),
  dateline: document.querySelector("#dateline"),
  currentTemp: document.querySelector("#current-temp"),
  weatherArt: document.querySelector("#weather-art"),
  condition: document.querySelector("#condition"),
  feelsLike: document.querySelector("#feels-like"),
  hourlyStrip: document.querySelector("#hourly-strip"),
  metrics: document.querySelector("#metrics"),
  dailyList: document.querySelector("#daily-list"),
};

const weatherCodes = {
  0: ["Clear sky", "☀️"],
  1: ["Mainly clear", "🌤️"],
  2: ["Partly cloudy", "⛅"],
  3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"],
  48: ["Rime fog", "🌫️"],
  51: ["Light drizzle", "🌦️"],
  53: ["Drizzle", "🌦️"],
  55: ["Heavy drizzle", "🌧️"],
  56: ["Freezing drizzle", "🌧️"],
  57: ["Freezing drizzle", "🌧️"],
  61: ["Light rain", "🌧️"],
  63: ["Rain", "🌧️"],
  65: ["Heavy rain", "🌧️"],
  66: ["Freezing rain", "🌧️"],
  67: ["Freezing rain", "🌧️"],
  71: ["Light snow", "🌨️"],
  73: ["Snow", "🌨️"],
  75: ["Heavy snow", "❄️"],
  77: ["Snow grains", "❄️"],
  80: ["Rain showers", "🌦️"],
  81: ["Rain showers", "🌦️"],
  82: ["Heavy showers", "⛈️"],
  85: ["Snow showers", "🌨️"],
  86: ["Snow showers", "🌨️"],
  95: ["Thunderstorm", "⛈️"],
  96: ["Thunderstorm", "⛈️"],
  99: ["Thunderstorm", "⛈️"],
};

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const city = elements.input.value.trim();

  if (city) {
    loadWeatherForCity(city);
  }
});

elements.addLocationButton.addEventListener("click", () => {
  elements.input.focus();
});

elements.recentList.addEventListener("click", (event) => {
  const cityButton = event.target.closest("[data-city]");

  if (cityButton) {
    loadWeatherForCity(cityButton.dataset.city);
  }
});

renderRecentCities();
loadWeatherForCity("Chicago");

async function loadWeatherForCity(city) {
  setStatus(`Looking up ${city}...`);

  try {
    const location = await findLocation(city);
    setStatus(`Loading ${location.name} weather...`);
    const forecast = await fetchForecast(location);

    renderWeather(location, forecast);
    elements.input.value = "";
    setStatus("");
  } catch (error) {
    setStatus(error.message || "Something went wrong while loading weather.");
  }
}

async function findLocation(city) {
  const url = new URL(geocodingBaseUrl);
  url.searchParams.set("name", city);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Could not search for that city.");
  }

  const data = await response.json();
  const [location] = data.results || [];

  if (!location) {
    throw new Error(`No matching city found for "${city}".`);
  }

  return location;
}

async function fetchForecast(location) {
  const url = new URL(forecastBaseUrl);
  url.searchParams.set("latitude", location.latitude);
  url.searchParams.set("longitude", location.longitude);
  url.searchParams.set(
    "current",
    [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
      "wind_direction_10m",
      "pressure_msl",
      "is_day",
    ].join(","),
  );
  url.searchParams.set(
    "hourly",
    ["temperature_2m", "precipitation_probability", "weather_code"].join(","),
  );
  url.searchParams.set(
    "daily",
    [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "wind_speed_10m_max",
      "sunrise",
      "sunset",
    ].join(","),
  );
  url.searchParams.set("temperature_unit", state.currentUnit);
  url.searchParams.set("wind_speed_unit", state.windUnit);
  url.searchParams.set("precipitation_unit", state.precipitationUnit);
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Could not load the forecast.");
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.reason || "The weather service returned an error.");
  }

  return data;
}

function renderWeather(location, forecast) {
  const place = formatPlace(location);
  const current = forecast.current;
  const units = forecast.current_units;
  const condition = describeWeather(current.weather_code);
  const city = {
    key: getLocationKey(location),
    name: location.name,
    region: formatRegion(location),
    temperature: `${round(current.temperature_2m)}${units.temperature_2m}`,
    icon: chooseDayNightIcon(condition.icon, current.is_day),
  };

  state.activeCityKey = city.key;
  elements.cityName.textContent = place;
  elements.dateline.textContent = formatDateline(current.time, forecast.timezone);
  elements.currentTemp.textContent = `${round(current.temperature_2m)}${units.temperature_2m}`;
  elements.weatherArt.textContent = chooseDayNightIcon(condition.icon, current.is_day);
  elements.condition.textContent = condition.label;
  elements.feelsLike.textContent = `Feels like ${round(current.apparent_temperature)}${units.apparent_temperature}`;

  renderMetrics(forecast);
  renderHourly(forecast);
  renderDaily(forecast);
  rememberCity(city);
}

function rememberCity(city) {
  const matchingIndex = state.recentCities.findIndex((item) => item.key === city.key);
  const nextCities = state.recentCities.filter((_, index) => index !== matchingIndex);

  state.recentCities = [city, ...nextCities].slice(0, 6);
  saveRecentCities();
  renderRecentCities();
}

function renderRecentCities() {
  if (!state.recentCities.length) {
    elements.recentList.innerHTML = `
      <p class="empty-recents">Search for a city to add it here.</p>
    `;
    return;
  }

  elements.recentList.innerHTML = state.recentCities
    .map(
      (city) => `
        <button
          class="recent-city ${city.key === state.activeCityKey ? "is-active" : ""}"
          type="button"
          data-city="${escapeAttribute(city.name)}"
        >
          <span class="recent-pin" aria-hidden="true">⌖</span>
          <span class="recent-copy">
            <span class="recent-name">${escapeHtml(city.name)}</span>
            <span class="recent-region">${escapeHtml(city.region)}</span>
          </span>
          <span class="recent-temp">${escapeHtml(city.temperature)}</span>
          <span class="recent-icon" aria-hidden="true">${escapeHtml(city.icon)}</span>
        </button>
      `,
    )
    .join("");
}

function renderMetrics(forecast) {
  const current = forecast.current;
  const units = forecast.current_units;
  const daily = forecast.daily;
  const windDirection = compassDirection(current.wind_direction_10m);

  const metrics = [
    ["💧", "Humidity", `${current.relative_humidity_2m}${units.relative_humidity_2m}`],
    ["💨", "Wind", `${windDirection} ${round(current.wind_speed_10m)} ${units.wind_speed_10m}`],
    ["♢", "Pressure", `${round(current.pressure_msl)} ${units.pressure_msl}`],
    ["🌅", "Sunrise", formatTime(daily.sunrise[0], forecast.timezone)],
    ["🌇", "Sunset", formatTime(daily.sunset[0], forecast.timezone)],
  ];

  elements.metrics.innerHTML = metrics
    .map(
      ([icon, label, value]) => `
        <div class="metric-row">
          <span class="metric-icon" aria-hidden="true">${icon}</span>
          <span class="metric-label">${label}</span>
          <span class="metric-value">${value}</span>
        </div>
      `,
    )
    .join("");
}

function renderHourly(forecast) {
  const now = new Date(forecast.current.time).getTime();
  const startIndex = forecast.hourly.time.findIndex((time) => new Date(time).getTime() >= now);
  const safeStart = Math.max(0, startIndex);
  const hours = forecast.hourly.time.slice(safeStart, safeStart + 10);
  const tempUnit = forecast.hourly_units.temperature_2m;

  elements.hourlyStrip.innerHTML = hours
    .map((time, offset) => {
      const index = safeStart + offset;
      const condition = describeWeather(forecast.hourly.weather_code[index]);
      const rainChance = forecast.hourly.precipitation_probability[index] ?? 0;

      return `
        <article class="hour-card">
          <span class="hour-time">${offset === 0 ? "Now" : formatHour(time, forecast.timezone)}</span>
          <span class="hour-icon" aria-hidden="true">${condition.icon}</span>
          <span class="hour-temp">${round(forecast.hourly.temperature_2m[index])}${tempUnit}</span>
          <span class="hour-rain">♧ ${rainChance}%</span>
        </article>
      `;
    })
    .join("");
}

function renderDaily(forecast) {
  const daily = forecast.daily;
  const highUnit = forecast.daily_units.temperature_2m_max;
  const lowUnit = forecast.daily_units.temperature_2m_min;
  const days = daily.time.slice(1, 6);

  elements.dailyList.innerHTML = days
    .map((day, offset) => {
      const index = offset + 1;
      const condition = describeWeather(daily.weather_code[index]);

      return `
        <article class="daily-row">
          <span>${formatDay(day, forecast.timezone)}</span>
          <span class="daily-icon" aria-hidden="true">${condition.icon}</span>
          <span class="daily-high">${round(daily.temperature_2m_max[index])}${highUnit}</span>
          <span class="daily-low">${round(daily.temperature_2m_min[index])}${lowUnit}</span>
        </article>
      `;
    })
    .join("");
}

function describeWeather(code) {
  const [label, icon] = weatherCodes[code] || ["Variable conditions", "🌤️"];
  return { label, icon };
}

function chooseDayNightIcon(icon, isDay) {
  if (isDay) {
    return icon;
  }

  if (icon === "☀️" || icon === "🌤️" || icon === "⛅") {
    return "🌙";
  }

  return icon;
}

function formatPlace(location) {
  const region = location.admin1 || location.country_code;
  return region ? `${location.name}` : location.name;
}

function formatRegion(location) {
  return [location.admin1, location.country_code].filter(Boolean).join(", ") || location.country || "";
}

function getLocationKey(location) {
  return [location.name, location.admin1, location.country_code].filter(Boolean).join("|").toLowerCase();
}

function formatDateline(time, timezone) {
  const date = new Date(time);
  const day = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  }).format(date);
  const clock = formatTime(time, timezone);

  return `${day} • ${clock}`;
}

function formatDay(time, timezone) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: timezone,
  }).format(new Date(`${time}T12:00`));
}

function formatHour(time, timezone) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    timeZone: timezone,
  }).format(new Date(time));
}

function formatTime(time, timezone) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(time));
}

function compassDirection(degrees) {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(degrees / 45) % 8];
}

function round(value) {
  return Math.round(Number(value));
}

function setStatus(message) {
  elements.status.textContent = message;
}

function loadRecentCities() {
  try {
    return JSON.parse(localStorage.getItem("weatherNowRecentCities")) || [];
  } catch {
    return [];
  }
}

function saveRecentCities() {
  localStorage.setItem("weatherNowRecentCities", JSON.stringify(state.recentCities));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
