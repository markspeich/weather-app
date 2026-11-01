const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function app(stored = null) {
  const nodes = new Map();
  const requests = [];
  const context = {
    document: { querySelector(id) { if (!nodes.has(id)) nodes.set(id, { innerHTML:'', textContent:'', value:'', addEventListener() {} }); return nodes.get(id); } },
    localStorage: { getItem: () => stored, setItem: (_, value) => { stored = value; } },
    fetch: url => { requests.push(String(url)); return new Promise(() => {}); },
    URL, Intl, Date, window: {}
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('app.js', 'utf8'), context);
  return { context, nodes, requests, stored: () => stored };
}
const city = name => ({ key:name, name, region:'', temperature:'70°F', icon:'sun' });

test('startup restores last successful recent city without a new storage key', () => {
  const result = app(JSON.stringify([city('Leander'), city('Chicago')]));
  assert.equal(new URL(result.requests[0]).searchParams.get('name'), 'Leander');
});

test('missing, malformed and invalid recent storage falls back to Chicago', () => {
  for (const stored of [null, '{bad', '{}', 'null', '[null]', '[{"name":""}]']) {
    const result = app(stored);
    assert.equal(new URL(result.requests[0]).searchParams.get('name'), 'Chicago');
  }
});

test('a newly remembered city becomes the startup city after reopening', () => {
  const first = app(JSON.stringify([city('Chicago')]));
  first.context.rememberCity(city('London'));
  const reopened = app(first.stored());
  assert.equal(new URL(reopened.requests[0]).searchParams.get('name'), 'London');
});

test('a failed city lookup preserves the last successful selection', async () => {
  const saved = JSON.stringify([city('Leander')]);
  const result = app(saved);
  result.context.findLocation = async () => { throw new Error('No matching city'); };
  await result.context.loadWeatherForCity('invalid');
  assert.equal(result.stored(), saved);
  assert.match(result.nodes.get('#status-message').textContent, /No matching city/);
});

test('daily probabilities follow the five future dates and preserve zero and missing values', () => {
  const { context, nodes } = app();
  context.renderDaily({ timezone:'UTC', daily_units:{temperature_2m_max:'°F',temperature_2m_min:'°F'}, daily:{
    time:['2026-11-01','2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06'],
    weather_code:[0,0,0,0,0,0],temperature_2m_max:[70,71,72,73,74,75],temperature_2m_min:[60,61,62,63,64,65],
    precipitation_probability_max:[99,0,23.6,null,100,undefined]
  }});
  const html = nodes.get('#daily-list').innerHTML;
  assert.equal((html.match(/class="daily-rain"/g) || []).length, 5);
  assert.match(html, />0%<\/span>/);
  assert.match(html, />24%<\/span>/);
  assert.match(html, />100%<\/span>/);
  assert.equal((html.match(/aria-label="Precipitation chance unavailable"/g) || []).length, 2);
  assert.doesNotMatch(html, /99%|null%|undefined%/);
});

test('daily probabilities reject out-of-range and non-numeric values', () => {
  const { context } = app();
  for (const value of [-1,101,NaN,Infinity,'25',null,undefined]) assert.equal(context.formatRainChance(value), '—');
});
