const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
test("radar accepts only valid past frames, sorted and deduplicated", () => {
  const context = { window: {}, document: { querySelector: () => null } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("radar.js", "utf8"), context);
  const result = context.window.WeatherRadar.readFrames({
    host: "https://tilecache.rainviewer.com",
    radar: { past: [{ time: 2, path: "/v2/radar/2" }, { time: 1, path: "/v2/radar/1" }, { time: 2, path: "/v2/radar/2" }], nowcast: [{time: 3, path: "/future"}] }
  });
  assert.deepEqual(Array.from(result, f => f.time), [1, 2]);
  assert.throws(() => context.window.WeatherRadar.readFrames({host: "http://bad", radar: {past: []}}));
  assert.throws(() => context.window.WeatherRadar.readFrames({host: "https://tilecache.rainviewer.com", radar: {past: [{time: NaN, path: "/bad"}]}}));
});
function setup(fetcher) {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { textContent: "", disabled: false, value: 0, events: {}, setAttribute() {}, addEventListener(name, fn) { this.events[name] = fn; } });
    return nodes.get(id);
  };
  const layer = () => ({ on() { return this; }, addTo() { return this; }, setOpacity() {}, setLatLng() {}, bindTooltip() {} });
  const views = [];
  const map = { setView(point) { views.push(point); return this; }, removeLayer() {} };
  const L = { map: () => map, tileLayer: layer, circleMarker: layer };
  const context = { window: { L }, L, document: { querySelector: node, addEventListener() {} }, fetch: fetcher, AbortController, Intl, Date, setTimeout: () => 1, clearTimeout() {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("radar.js", "utf8"), context);
  return { radar: context.window.WeatherRadar, node, views };
}
const data = { host: "https://tilecache.rainviewer.com", radar: { past: [{ time: 1, path: "/v2/radar/1" }, { time: 2, path: "/v2/radar/2" }] } };
test("city changes recenter radar, reuse manifest and reset playback", async () => {
  let requests = 0;
  const { radar, node, views } = setup(async () => { requests++; return { ok: true, json: async () => data }; });
  await radar.show({name:"Chicago",latitude:41,longitude:-87}, "America/Chicago");
  assert.equal(node("#radar-play").disabled, false);
  node("#radar-play").events.click();
  assert.match(node("#radar-play").textContent, /Pause/);
  node("#radar-play").events.click();
  assert.match(node("#radar-play").textContent, /Play/);
  await radar.show({name:"London",latitude:51,longitude:0}, "Europe/London");
  assert.equal(requests, 1);
  assert.equal(node("#radar-place").textContent, "London · Regional view");
  assert.deepEqual(Array.from(views.at(-1)), [51, 0]);
  assert.match(node("#radar-play").textContent, /Play/);
});
test("provider failure leaves disabled controls and a useful retry message", async () => {
  const { radar, node } = setup(async () => { throw new Error("offline"); });
  await radar.show({name:"Chicago",latitude:41,longitude:-87}, "UTC");
  assert.equal(node("#radar-play").disabled, true);
  assert.equal(node("#radar-time").disabled, true);
  assert.match(node("#radar-status").textContent, /unavailable.*Refresh/);
});
test("concurrent cities share a request and keep the latest city", async () => {
  let resolve;
  const { radar, node } = setup(() => new Promise(r => { resolve = r; }));
  const first = radar.show({name:"Chicago",latitude:41,longitude:-87}, "UTC");
  const last = radar.show({name:"London",latitude:51,longitude:0}, "UTC");
  resolve({ok:true,json:async()=>data});
  await Promise.all([first,last]);
  assert.equal(node("#radar-place").textContent, "London · Regional view");
  assert.equal(node("#radar-time").max, 1);
});
