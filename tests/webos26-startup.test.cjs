// Run with: npm test
// Execute the actual HTML/Enyo source functions with mocked Luna responses.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const web = fs.readFileSync(path.join(root, 'assets/web-screensaver.html'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'frontend/views/MainPanel.js'), 'utf8');

function between(source, start, end) {
  const a = source.indexOf(start);
  assert.notEqual(a, -1, 'missing start marker: ' + start);
  const b = source.indexOf(end, a + start.length);
  assert.notEqual(b, -1, 'missing end marker: ' + end);
  return source.slice(a, b);
}

function evaluate(source, globals = {}) {
  const ctx = vm.createContext({
    Promise, setTimeout, clearTimeout, setInterval, clearInterval,
    console: { error() {}, info() {} },
    ...globals
  });
  vm.runInContext(source, ctx);
  return ctx;
}

const decoder = between(web, 'var decoderStatus = "not checked";', '// screenmanager ends');
const manual = between(web, 'var manualModeStatus = "not checked";', 'function moveClock()');
const playback = between(web, '// afterError: true when the video before failed to play', 'function checkStatus()');
const notifications = between(web, 'var notifyOff = false;', '// Same fallbacks as screensaver-main.qml');
function panelMethod(name) {
  const match = new RegExp('^\\t' + name + ': function[^]*?^\\t\\},', 'm').exec(panel);
  assert.ok(match, 'missing panel method: ' + name);
  return match[0];
}
const testHandler = panelMethod('onTestExec');
const testRun = panelMethod('doTestRun');

for (const [name, reply, expected, status] of [
  ['free pipelines', [], false, 'free'],
  ['decoder busy', [{ type: 'video', resource: [{ resource: 'VDEC HEVC' }] }], true, 'in use'],
  ['live TV exempt', [{ type: 'tv', resource: [{ resource: 'VDEC' }] }], false, 'free'],
  ['query timed out', null, false, 'unknown (query failed, trying playback)'],
  ['service rejected query', { returnValue: false }, false, 'unknown (query failed, trying playback)']
]) {
  test('decoder: ' + name, async () => {
    const ctx = evaluate(decoder, { luna: () => Promise.resolve(reply) });
    assert.equal(await ctx.videoDecoderInUse(), expected);
    assert.equal(ctx.decoderStatus, status);
  });
}

test('manual mode failure is reported without preventing other launch paths', async () => {
  const errors = [];
  const ctx = evaluate(manual, {
    luna: () => Promise.resolve({ returnValue: false }),
    console: { error: message => errors.push(message) }
  });
  assert.equal((await ctx.setManualMode()).returnValue, false);
  assert.equal(ctx.manualModeStatus, 'not confirmed');
  assert.equal(errors.length, 1);
});

function videoContext(overrides = {}) {
  const listeners = {};
  const classes = { remove() {}, add() {} };
  const video = {
    classList: classes,
    currentTime: 0,
    addEventListener: (name, fn) => { listeners[name] = fn; },
    play: () => Promise.resolve()
  };
  const ctx = evaluate(playback, {
    clockMode: false, closing: false, randomIndex: -1,
    PROT: { panelOff: false },
    poolNow: () => false, candidatesFor: () => [0],
    playList: { assets: [{ url: 'video.mp4', localizedNameKey: 'x' }] },
    video, osd: { classList: classes, style: {} },
    poi: { strings: { x: 'Sample' } },
    document: { getElementById: () => ({ textContent: '' }) },
    fixUrl: value => value,
    pickSource: asset => asset.url,
    setNotifications() {},
    ...overrides
  });
  return { ctx, listeners, video };
}

test('exhausted playlist falls back to the moving clock', () => {
  let starts = 0;
  const { ctx } = videoContext({
    candidatesFor: () => [],
    startClock: () => { starts++; }
  });
  ctx.playRandomVideo(true);
  assert.equal(starts, 1);
});

test('rejected play promise and media error do not schedule duplicate retries', async () => {
  let retries = 0;
  const { ctx, video, listeners } = videoContext({
    setTimeout: () => { retries++; }
  });
  video.play = () => Promise.reject(new Error('autoplay blocked'));
  ctx.playRandomVideo();
  listeners.error();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(retries, 1);
});

test('synchronous play exception is handled', () => {
  let retries = 0;
  const { ctx, video } = videoContext({
    setTimeout: () => { retries++; }
  });
  video.play = () => { throw new Error('decoder fault'); };
  assert.doesNotThrow(() => ctx.playRandomVideo());
  assert.equal(retries, 1);
});

test('notification disable failure still results in an enable request', async () => {
  const calls = [];
  const ctx = evaluate(notifications, {
    notifyCtl: true,
    luna: uri => {
      calls.push(uri.split('/').pop());
      return Promise.resolve({ returnValue: uri.endsWith('/enable') });
    }
  });
  ctx.watcherAlive = true;
  ctx.setNotifications(false);
  await ctx.notifyQueue;
  assert.equal(ctx.notifyRestoreNeeded, true);
  ctx.setNotifications(true);
  await ctx.notifyQueue;
  assert.deepEqual(calls, ['disable', 'enable']);
  assert.equal(ctx.notifyRestoreNeeded, false);
});

test('opposite notification requests are serialized', async () => {
  const calls = [];
  const ctx = evaluate(notifications, {
    notifyCtl: true,
    luna: async uri => {
      calls.push(uri.split('/').pop());
      return { returnValue: true };
    }
  });
  ctx.watcherAlive = true;
  ctx.setNotifications(false);
  ctx.setNotifications(true);
  ctx.setNotifications(true);
  await ctx.notifyQueue;
  assert.deepEqual(calls, ['disable', 'enable']);
  assert.equal(ctx.notifyOff, false);
});

test('closing prevents previously queued notification disable', async () => {
  const calls = [];
  const ctx = evaluate(notifications, {
    notifyCtl: true,
    luna: async uri => {
      calls.push(uri);
      return { returnValue: true };
    }
  });
  ctx.watcherAlive = true;
  ctx.setNotifications(false);
  ctx.closing = true;
  ctx.setNotifications(true);
  await ctx.notifyQueue;
  assert.equal(calls.some(uri => uri.endsWith('/disable')), false);
});

function makePanel() {
  return vm.runInNewContext('({' + testHandler + '})', {
    I18n: { t: name => name },
    console: { info() {} }
  });
}

test('test button says request accepted, not playback successful', () => {
  const instance = { setResult(message) { this.message = message; } };
  makePanel().onTestExec.call(instance, null, {
    returnValue: true, stdoutString: '{"returnValue":true}'
  });
  assert.equal(instance.message, 'testLaunchAccepted');
});

test('test button rejects a negative Luna response despite successful shell exec', () => {
  const instance = { setResult(message) { this.message = message; } };
  makePanel().onTestExec.call(instance, null, {
    returnValue: true,
    stdoutString: '{"returnValue":false,"errorText":"blocked"}'
  });
  assert.equal(instance.message, 'testLaunchUnconfirmed');
});

test('test button asks Luna for a response', () => {
  const instance = {
    setResult() {},
    $: { testExec: { send(value) { this.command = value.command; } } }
  };
  vm.runInNewContext('({' + testRun + '})', { I18n: { t: name => name } })
    .doTestRun.call(instance);
  assert.match(instance.$.testExec.command, /luna-send -n 1 -f/);
});

for (const [name, overrides] of [
  ['panel is off', { PROT: { panelOff: true } }],
  ['clock mode is active', { clockMode: true }],
  ['screensaver is closing', { closing: true }]
]) {
  test('playback does not restart when ' + name, () => {
    let selections = 0;
    const { ctx } = videoContext({
      ...overrides,
      candidatesFor: () => { selections++; return [0]; }
    });
    ctx.playRandomVideo();
    assert.equal(selections, 0);
  });
}

test('solar fallback retains day phase rather than reporting a night playlist', () => {
  const pools = [];
  const { ctx } = videoContext({
    poolNow: () => 'sunrise',
    candidatesFor: pool => { pools.push(pool); return pool === 'day' ? [0] : []; }
  });
  ctx.playRandomVideo();
  assert.deepEqual(pools, ['sunrise', 'day']);
  assert.equal(ctx.solarPlaying, 'day');
  assert.equal(ctx.nightPlaying, false);
});

test('test button refreshes apply status before choosing the launch path', () => {
  let checked = false;
  const callback = () => {};
  const instance = {
    bindSafely(name) { assert.equal(name, 'testRunChecked'); return callback; },
    checkApplyStatus(cb) { assert.equal(cb, callback); checked = true; }
  };
  vm.runInNewContext('({' + panelMethod('testRun') + '})').testRun.call(instance);
  assert.equal(checked, true);
});

test('unapplied test asks for confirmation; applied test launches directly', () => {
  let launches = 0;
  let confirmation;
  const instance = {
    doTestRun() { launches++; },
    askConfirm(...args) { confirmation = args; }
  };
  const handler = vm.runInNewContext('({' + panelMethod('testRunChecked') + '})', {
    tr: (key, fallback) => fallback
  });
  handler.testRunChecked.call(instance, false);
  assert.equal(launches, 0);
  assert.equal(confirmation[3], 'testApplyAndRun');
  handler.testRunChecked.call(instance, true);
  assert.equal(launches, 1);
});
