/* Radar is independent of forecast loading: a provider outage leaves weather usable. */
(() => {
  const get = (id) => document.querySelector(`#radar-${id}`);
  const ui = { map: get("map"), play: get("play"), time: get("time"), stamp: get("timestamp"), status: get("status"), place: get("place"), refresh: get("refresh"), start: get("start"), end: get("end") };
  let map, marker, location, timezone, frames = [], layers = new Map();
  let generation = 0, playing = false, timer, cache, pending, index = 0;
  let lastNewFrame = 0;

  function readFrames(data) {
    if (data.host !== "https://tilecache.rainviewer.com") throw new Error("Invalid radar host");
    const past = (data.radar?.past || []).filter((frame) => Number.isFinite(frame.time) && frame.time > 0 && /^\/v2\/radar\/[\w/-]+$/.test(frame.path));
    const unique = [...new Map(past.map((frame) => [frame.time, frame])).values()].sort((a, b) => a.time - b.time).slice(-13);
    if (!unique.length) throw new Error("No past radar frames available");
    return unique.map((frame) => ({ ...frame, host: data.host }));
  }

  function pause() {
    playing = false;
    clearTimeout(timer);
    ui.play.textContent = "▶ Play";
    ui.play.setAttribute("aria-pressed", "false");
  }

  function clock(time) {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short", timeZone: timezone }).format(new Date(time * 1000));
  }

  function schedule(delay) {
    clearTimeout(timer);
    if (playing) timer = setTimeout(() => display((index + 1) % frames.length), delay);
  }

  function display(next) {
    clearTimeout(timer);
    index = next;
    const frame = frames[index];
    if (!frame) return;
    ui.time.value = index;
    ui.stamp.textContent = clock(frame.time);
    ui.time.setAttribute("aria-valuetext", clock(frame.time));
    const age = Math.round((Date.now() / 1000 - frames[frames.length - 1].time) / 60);
    const note = age > 30 ? `Delayed data · latest image is ${age} minutes old.` : "Past radar · images at 10-minute intervals.";
    if (layers.has(frame.path)) {
      layers.forEach((layer) => layer.setOpacity(0));
      layers.get(frame.path).setOpacity(0.72);
      ui.status.textContent = note;
      schedule(900);
      return;
    }
    // The 900px map needs at most six 512px radar tiles per frame.
    // Five-second pacing keeps new playback tiles below 100 requests/minute.
    // Subsequent loops reuse these layers without fetching the same tiles again.
    const wait = Math.max(0, 5000 - (Date.now() - lastNewFrame));
    if (wait > 0) {
      ui.status.textContent = "Preparing radar image… First playback loads gradually.";
      timer = setTimeout(() => display(index), wait);
      return;
    }
    lastNewFrame = Date.now();
    layers.forEach((layer) => layer.setOpacity(0));
    ui.status.textContent = "Loading radar image…";
    const token = generation;
    let failed = false;
    const layer = L.tileLayer(`${frame.host}${frame.path}/512/{z}/{x}/{y}/2/1_1.png`, {
      tileSize: 512, zoomOffset: -1, maxNativeZoom: 7, maxZoom: 7,
      opacity: 0.72, noWrap: true, keepBuffer: 0, updateWhenIdle: true
    });
    layer.on("tileerror", () => { failed = true; });
    layer.on("load", () => {
      if (token !== generation || frames[index]?.path !== frame.path) return;
      ui.status.textContent = failed ? "Some radar tiles are unavailable. Try Refresh in a moment." : note;
      if (failed) { pause(); layers.delete(frame.path); map.removeLayer(layer); }
      else schedule(5000);
    });
    layers.set(frame.path, layer);
    layer.addTo(map);
  }

  async function manifest() {
    if (cache && Date.now() - cache.at < 300000) return cache.frames;
    if (!pending) {
      pending = (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
          const response = await fetch("https://api.rainviewer.com/public/weather-maps.json", { signal: controller.signal });
          if (!response.ok) throw new Error("Radar unavailable");
          const result = readFrames(await response.json());
          cache = { at: Date.now(), frames: result };
          return result;
        } finally { clearTimeout(timeout); }
      })().finally(() => { pending = null; });
    }
    return pending;
  }

  async function show(city, zone) {
    location = city;
    timezone = zone;
    const token = ++generation;
    pause();
    ui.play.disabled = true;
    ui.time.disabled = true;
    ui.place.textContent = `${city.name} · Regional view`;
    ui.status.textContent = "Loading radar…";
    try {
      if (!window.L) throw new Error("Map library unavailable");
      if (!map) {
        map = L.map(ui.map, { scrollWheelZoom: false, dragging: false, touchZoom: false, doubleClickZoom: false, boxZoom: false, zoomControl: false, minZoom: 6, maxZoom: 6, keyboard: false }).setView([city.latitude, city.longitude], 6);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', keepBuffer: 0 }).on("tileerror", () => { ui.status.textContent = "Base map unavailable. Radar may still load."; }).addTo(map);
        marker = L.circleMarker([city.latitude, city.longitude], { radius: 5, color: "#fff", weight: 2, fillColor: "#102345", fillOpacity: 1 }).addTo(map);
      }
      layers.forEach((layer) => map.removeLayer(layer));
      layers.clear();
      map.setView([city.latitude, city.longitude], 6);
      marker.setLatLng([city.latitude, city.longitude]);
      const safeName = city.name.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
      marker.bindTooltip(safeName, { permanent: true, direction: "top" });
      frames = await manifest();
      if (token !== generation) return;
      ui.time.max = frames.length - 1;
      ui.start.textContent = clock(frames[0].time);
      ui.end.textContent = "Latest";
      ui.play.disabled = frames.length < 2;
      ui.time.disabled = false;
      display(frames.length - 1);
    } catch {
      if (token === generation) ui.status.textContent = "Radar is unavailable right now. Try Refresh in a moment.";
    }
  }

  window.WeatherRadar = { show, readFrames };
  if (!ui.map) return;
  ui.play.addEventListener("click", () => {
    if (playing) return pause();
    playing = true;
    ui.play.textContent = "Ⅱ Pause";
    ui.play.setAttribute("aria-pressed", "true");
    display((index + 1) % frames.length);
  });
  ui.time.addEventListener("input", () => { pause(); display(Number(ui.time.value)); });
  ui.refresh.addEventListener("click", () => { if (location) show(location, timezone); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
})();
