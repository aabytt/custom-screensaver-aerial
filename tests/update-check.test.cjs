const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {spawnSync} = require('node:child_process');
const hook = require('../assets/update-check.js');
const index = require('../frontend/views/update-index.js');
const store = require('../frontend/views/SettingsStore.js');
const manifest = require('../appinfo.json');
const now = 1800000000, day = 86400;
const prefs = {updateNoticeEnabled: false, nested: {"user's": ['}', {updateNotice: 'keep'}]}};
const notice = {version: '2.0.0', text: 'Update available: v2.0.0'};
const body = version => JSON.stringify({packages: [
    {id: manifest.id + '.other', manifest: {version: '99.9'}},
    {id: manifest.id, version: '99.9', manifest: {version}},
    {id: manifest.id, manifest: {version: '88.8'}}
]});
const ok = [null, {status: 200, etag: 'W/"example"'}, body('v2.0.0')];
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const write = (p, obj) => fs.writeFileSync(p, JSON.stringify(obj) + '\n');
const shPath = p => p.replace(/\\/g, '/');
const shell = spawnSync('sh', ['-c', 'true']).status === 0;

function fixture(t) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aerial-update-'));
    t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
    const state = path.join(dir, 'state', 'update-state.json');
    const live = path.join(dir, 'settings.json');
    const info = path.join(dir, 'appinfo.json');
    write(info, {...manifest, version: '1.2.0'});
    write(live, prefs);
    const requests = [];
    function run(time, reply) {
        let next;
        hook.check({state, live, manifest: info, now: time, log() {}, fetch(etag, done) {
            requests.push(etag);
            assert.ok(reply, 'unexpected request');
            done(...reply);
        }}, value => { next = value; });
        return next;
    }
    return {dir, live, state, info, run, requests};
}

test('UI and hook use the same index result and dotted comparator', t => {
    const f = fixture(t);
    const main = fs.readFileSync(path.join(__dirname, '../frontend/views/MainPanel.js'), 'utf8');
    const source = main.slice(main.indexOf('\tcheckUpdate: function'), main.indexOf('\n\t// Release notes:'));
    const view = vm.runInNewContext('({' + source + '})', {
        UpdateIndex: index, compareVersions: index.compare,
        XMLHttpRequest: function () {
            this.open = (_, url) => assert.equal(url, index.url);
            this.send = () => { this.status = 200; this.responseText = ok[2]; this.onload(); };
        }
    });
    Object.assign(view, {appId: manifest.id, version: '1.2.0', $: {}, loadNotes() {}, renderVersion() {}, refit() {}});
    view.checkUpdate();
    f.run(now, ok);
    assert.equal(view.latest, read(f.live).updateNotice.version);
    for (const [a, b, sign] of [['1.9', '1.10', -1], ['1.2', '1.2.0', 0], ['2.0', '2.0', 0],
        ['v1.2', '1.2', 0], ['1.2.3-beta.9', '1.2.3', 0]]) {
        assert.equal(Math.sign(index.compare(a, b)), sign);
    }
    assert.equal(index.version(JSON.parse(body(undefined)), manifest.id), undefined);
});

test('preserve preferences and inode, replay cache, clear locally after upgrade', t => {
    const f = fixture(t);
    const inode = fs.statSync(f.live).ino;
    assert.notEqual(inode, 0);
    assert.equal(f.run(now, ok), now + day);
    assert.deepEqual(read(f.live), {...prefs, updateNotice: notice});
    assert.equal(fs.statSync(f.live).ino, inode);
    write(f.live, prefs);
    assert.equal(f.run(now + 30), now + day);
    assert.deepEqual(read(f.live).updateNotice, notice);
    write(f.info, {...manifest, version: '2.0.0'});
    assert.equal(f.run(now + 60), now + day);
    assert.deepEqual(read(f.live), prefs);
    assert.equal(fs.statSync(f.live).ino, inode);
    assert.equal(f.requests.length, 1);
});

test('missing, empty and corrupt live settings are untouched', t => {
    const f = fixture(t);
    f.run(now, ok);
    fs.unlinkSync(f.live);
    assert.equal(f.run(now + 30), now + 60);
    assert.equal(fs.existsSync(f.live), false);
    for (const bad of ['', '{bad', '[]']) {
        fs.writeFileSync(f.live, bad);
        assert.equal(f.run(now + 60), now + 90);
        assert.equal(fs.readFileSync(f.live, 'utf8'), bad);
    }
});

test('failed checks preserve notice, back off, and reset on success or cached 304', t => {
    const f = fixture(t);
    const old = {version: '1.4.1', text: 'Existing notice'};
    write(f.live, {...prefs, updateNotice: old});
    let time = now;
    for (const [reply, delay] of [
        [['DNS failure'], 30], [['timeout'], 60], [[null, {status: 500}], 120],
        [[null, {status: 403, 'retry-after': '450'}], 450],
        [[null, {status: 429, 'retry-after': new Date((now + 1800) * 1000).toUTCString()}], 1140],
        [[null, {status: 200}, '{bad'], 3600], [[null, {status: 200}, '{"packages":[]}'], 3600],
        [[null, {status: 304}], 3600]
    ]) {
        assert.equal(f.run(time, reply), time + delay);
        assert.deepEqual(read(f.live).updateNotice, old);
        time += delay;
        assert.equal(f.run(time - 5), time);
    }
    assert.equal(f.run(time, ok), time + day);
    assert.equal(read(f.state).failures, 0);
    assert.equal(f.run(time + day, [null, {status: 304}]), time + 2 * day);
    assert.equal(f.requests[f.requests.length - 1], 'W/"example"');
});

test('launch and saves ignore persisted notice and preserve current live value or absence', t => {
    const f = fixture(t);
    const persistent = path.join(f.dir, 'persistent', 'settings.json');
    const stale = {version: '1.5', text: 'old'};
    const disk = {...prefs, updateNotice: notice};
    const oldPrefs = {updateNoticeEnabled: true, updateNotice: stale};
    assert.deepEqual({...store.merge(disk, oldPrefs)}, {...disk, updateNoticeEnabled: true});
    assert.deepEqual({...store.merge(prefs, oldPrefs)}, {...prefs, updateNoticeEnabled: true});
    write(f.live, disk);
    hook.save(f.live, persistent, JSON.stringify({...prefs, ...oldPrefs}));
    assert.deepEqual(read(f.live), {...disk, updateNoticeEnabled: true});
    assert.deepEqual(read(persistent), {...prefs, updateNoticeEnabled: true});
    write(f.live, prefs);
    hook.save(f.live, persistent, JSON.stringify(oldPrefs));
    assert.deepEqual(read(f.live), {updateNoticeEnabled: true});
    write(persistent, {...prefs, updateNotice: stale});
    hook.restore(f.live, persistent);
    assert.deepEqual(read(f.live), prefs);
});

test('no-Node fallback preserves live notice and rejects stale snapshots', {skip: !shell}, t => {
    const f = fixture(t);
    const persistent = path.join(f.dir, 'persistent', 'settings.json');
    const before = {...store};
    t.after(() => Object.assign(store, before));
    Object.assign(store, {appPath: shPath(f.live), assetsDir: shPath(f.dir),
        persistDir: shPath(path.dirname(persistent)), persistPath: shPath(persistent)});
    fs.writeFileSync(path.join(f.dir, 'aerial-node.sh'), 'find_aerial_node() { return 1; }\n');
    write(f.live, {...prefs, updateNotice: notice});
    const cmd = store.saveCommand({...prefs, sourceType: "user's value"}, fs.readFileSync(f.live, 'utf8'));
    let result = spawnSync('sh', ['-c', cmd], {encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(read(f.live), {...prefs, sourceType: "user's value", updateNotice: notice});
    assert.deepEqual(read(persistent), {...prefs, sourceType: "user's value"});
    result = spawnSync('sh', ['-c', cmd], {encoding: 'utf8'});
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Live settings changed/);
});

test('POSIX launcher handles mocked curl 200 and conditional 304', {skip: !shell}, t => {
    const f = fixture(t);
    const assets = path.join(f.dir, 'assets');
    const views = path.join(f.dir, 'frontend', 'views');
    fs.mkdirSync(assets);
    fs.mkdirSync(views, {recursive: true});
    for (const file of ['aerial-node.sh', 'update-check.sh', 'update-check.js']) {
        fs.copyFileSync(path.join(__dirname, '../assets', file), path.join(assets, file));
    }
    for (const file of ['update-index.js', 'update-settings.js']) {
        fs.copyFileSync(path.join(__dirname, '../frontend/views', file), path.join(views, file));
    }
    fs.copyFileSync(f.live, path.join(assets, 'settings.json'));
    const preload = path.join(f.dir, 'mock-client.cjs');
    // A Node preload makes the mock executable work on Git Bash as well as Linux.
    fs.writeFileSync(preload, `const cp = require('node:child_process');
const spawn = cp.spawn, sync = cp.spawnSync;
const full = ${JSON.stringify('HTTP/1.1 200 OK\r\nETag: W/"example"\r\n\r\n' + ok[2])};
cp.spawn = (cmd, args, opts) => cmd === 'curl' ? spawn(process.execPath, ['-e',
    'process.stdout.write(' + JSON.stringify(args.includes('If-None-Match: W/"example"') ? 'HTTP/1.1 304 Not Modified\\r\\n\\r\\n' : full) + ')'],
    {...opts, env: {...process.env, NODE_OPTIONS: ''}}) : spawn(cmd, args, opts);
cp.spawnSync = (cmd, args, opts) => cmd === 'logger' ? {status:0} : sync(cmd,args,opts);`);
    const lock = path.join(f.dir, 'test.lock');
    for (const time of [now, now + day]) {
        const result = spawnSync('sh', [shPath(path.join(assets, 'update-check.sh'))], {encoding: 'utf8',
            env: {...process.env, NODE_OPTIONS: '--require="' + shPath(preload) + '"',
                AERIAL_UPDATE_LOCK: shPath(lock), AERIAL_UPDATE_NOW: String(time),
                AERIAL_UPDATE_STATE_DIR: path.dirname(f.state)}});
        assert.equal(result.status, 0, result.stderr);
        assert.equal(Number(result.stdout), time + day, result.stderr);
        assert.equal(fs.existsSync(lock), false);
        assert.equal(read(f.state).lastSuccess, time);
    }
    assert.deepEqual(read(path.join(assets, 'settings.json')).updateNotice, notice);
});
