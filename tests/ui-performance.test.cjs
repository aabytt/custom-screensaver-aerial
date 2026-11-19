const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const panel = fs.readFileSync(path.join(__dirname, '../frontend/views/VideoSelectPanel.js'), 'utf8');
const web = fs.readFileSync(path.join(__dirname, '../assets/web-screensaver.html'), 'utf8');
function between(source, start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, 'missing source markers');
  return source.slice(a, b);
}

test('category snapshots count multiple categories once and reflect selection changes', () => {
  const methods = between(panel, '  collectCategoryStats: function', '  // categories that actually contain videos');
  const ctx = vm.createContext({ durationOf: a => Number(a.duration) > 0 && isFinite(Number(a.duration)) ? Number(a.duration) : 0 });
  const model = vm.runInContext('({' + methods + '})', ctx);
  model.assets = [
    {id: 'a', categories: ['city', 'night', 'city'], duration: 60},
    {id: 'b', categories: ['city'], duration: 120},
    {id: 'c', categories: [], duration: null}
  ];
  model.disabled = {b: true};
  const plain = x => JSON.parse(JSON.stringify(x));
  let stats = model.collectCategoryStats();
  assert.deepEqual(plain(model.categoryStats('', stats)), {on: 2, total: 3, sec: 60});
  assert.deepEqual(plain(model.categoryStats('city', stats)), {on: 1, total: 2, sec: 60});
  assert.deepEqual(plain(model.categoryStats('night', stats)), {on: 1, total: 1, sec: 60});
  assert.deepEqual(plain(model.categoryStats('missing', stats)), {on: 0, total: 0, sec: 0});
  delete model.disabled.b;
  stats = model.collectCategoryStats();
  assert.deepEqual(plain(model.categoryStats('city', stats)), {on: 2, total: 2, sec: 180});
});

test('group geometry stops reading row positions once group is large', () => {
  const method = between(panel, '  groupOf: function', '  adjustScroll: function');
  const ctx = vm.createContext({ CENTER_MAX_ROWS: 2 });
  const model = vm.runInContext('({' + method + '})', ctx);
  let reads = 0;
  const header = {groupIds: ['a'], hasNode: () => ({})};
  const tiles = Array.from({length: 100}, (_, i) => ({showing: true, hasNode: () => ({get offsetTop() { reads++; return Math.floor(i / 4); }})}));
  model.$ = {grid: {getClientControls: () => [header, ...tiles]}};
  const group = model.groupOf(tiles[0]);
  assert.equal(group.rows, 3);
  assert.equal(group.tiles.length, 100);
  assert.equal(reads, 9);
});

test('clock and date avoid unchanged DOM writes', () => {
  const source = between(web, 'function updateOSD()', '// Calls a luna method.');
  let writes = 0;
  function element() {
    let text = '';
    return {get textContent() { return text; }, set textContent(value) { writes++; text = value; }};
  }
  const elements = {time: element(), date: element()};
  const ctx = vm.createContext({Date, settings: {localeLang: 'en-US'}, poi: {}, osdGet: () => false,
    document: {getElementById: id => elements[id]}});
  vm.runInContext(source, ctx);
  ctx.updateOSD();
  assert.equal(writes, 2);
  ctx.updateOSD();
  assert.equal(writes, 2);
  elements.time.textContent = 'changed externally';
  ctx.updateOSD();
  assert.equal(writes, 4);
});
