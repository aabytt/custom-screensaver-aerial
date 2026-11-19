const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const web = fs.readFileSync(path.join(__dirname, '../assets/web-screensaver.html'), 'utf8');
function between(start, end) {
  const a = web.indexOf(start);
  const b = web.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, 'missing source markers');
  return web.slice(a, b);
}
const source = between('var watcherAlive = false;', '// Serialize opposite-state requests') +
  between('function protGet(key, def)', '// The brightness is changed only') +
  between('function protStart()', 'function protDebug()');

function setup(protection = { brightnessOn: true, brightness: 30 }) {
  let heartbeat = { time: Date.now() / 1000 };
  const calls = [];
  const ctx = vm.createContext({
    Promise, Date, Math, Number, isNaN,
    notifyCtl: true, basePath: '', settings: { protection },
    PROT: { elapsed: 0, orig: -1, base: -1, last: -1, panelOff: false, standbyDone: false },
    loadJSONData: () => Promise.resolve(heartbeat),
    luna: (uri, payload) => { calls.push(payload.settings.backlight); return Promise.resolve({ returnValue: true }); },
    video: { pause() {} }, setProtectionWarning() {}, protTextStart() {}, protTextTick() {}
  });
  vm.runInContext(source, ctx);
  return { ctx, calls, heartbeat: value => { heartbeat = value; } };
}

test('late watcher original initializes brightness once and dimming runs', async () => {
  const t = setup({ brightnessOn: true, brightness: 40, dimOn: true, dimAfter: 1, dimDuration: 1, dimTo: 50 });
  await t.ctx.checkWatcher();
  t.ctx.protStart();
  assert.equal(t.ctx.PROT.orig, -1);
  t.heartbeat({ time: Date.now() / 1000, orig: 80 });
  await t.ctx.checkWatcher();
  assert.equal(t.ctx.PROT.orig, 80);
  assert.equal(t.ctx.PROT.base, 40);
  assert.deepEqual(t.calls, [40]);
  t.heartbeat({ time: Date.now() / 1000, orig: 90 });
  await t.ctx.checkWatcher();
  assert.equal(t.ctx.PROT.orig, 80);
  t.ctx.PROT.elapsed = 89;
  t.ctx.protTick();
  assert.deepEqual(t.calls, [40, 30]);
});

test('initial watcher original initializes at startup, not before', async () => {
  const t = setup();
  t.heartbeat({ time: Date.now() / 1000, orig: 80 });
  await t.ctx.checkWatcher();
  assert.equal(t.ctx.PROT.orig, -1);
  t.ctx.protStart();
  assert.equal(t.ctx.PROT.orig, 80);
  assert.deepEqual(t.calls, [30]);
});

test('late original is ignored when stale, disabled, off, standby, or closing', async () => {
  for (const condition of ['stale', 'disabled', 'off', 'standby', 'closing']) {
    const t = setup(condition === 'disabled' ? {} : undefined);
    t.ctx.protStart();
    if (condition === 'closing') t.ctx.closing = true;
    t.heartbeat({ time: Date.now() / 1000 - (condition === 'stale' ? 120 : 0), orig: 80,
      panelOff: condition === 'off' ? 1 : 0, standbyDone: condition === 'standby' ? 1 : 0 });
    await t.ctx.checkWatcher();
    assert.equal(t.ctx.PROT.orig, -1, condition);
    assert.deepEqual(t.calls, [], condition);
  }
});
