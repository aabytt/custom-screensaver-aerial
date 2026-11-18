// TV-side JSON and HTTP. Use ES5 for older webOS Node runtimes.
var fs = require('fs');
var path = require('path');
var proc = require('child_process');
var index = require('../frontend/views/update-index.js');
var settings = require('../frontend/views/update-settings.js');
var day = 86400;
var cap = 2 * 1024 * 1024;
function read(file) { return fs.readFileSync(file, 'utf8'); }
function json(value) { return JSON.stringify(value) + '\n'; }
function mkdir(dir) {
    if (fs.existsSync(dir)) { return; }
    mkdir(path.dirname(dir));
    try { fs.mkdirSync(dir); } catch (e) { if (e.code !== 'EEXIST') { throw e; } }
}

// Stage before touching the bind-mounted file. A snapshot check narrows, but
// cannot eliminate, the race with another writer or an unlocked reader.
function writeLive(file, before, obj) {
    var data = json(obj), tmp = file + '.update-' + process.pid;
    if (data === before) { return; }
    fs.writeFileSync(tmp, data, {flag: 'wx', mode: 384});
    try {
        data = read(tmp);
        settings.parse(data);
        var fd = fs.openSync(file, 'r+'); // do not truncate or create a new inode
        try {
            if (fs.readFileSync(fd, 'utf8') !== before) { throw new Error('live settings changed'); }
            var bytes = Buffer.from ? Buffer.from(data, 'utf8') : new Buffer(data, 'utf8');
            if (fs.writeSync(fd, bytes, 0, bytes.length, 0) !== bytes.length) { throw new Error('short settings write'); }
            fs.ftruncateSync(fd, bytes.length);
        } finally { fs.closeSync(fd); }
    } finally { fs.unlinkSync(tmp); }
}
function saveLive(live, prefs) {
    var before = read(live), current;
    try { current = settings.parse(before); } catch (e) { current = null; }
    writeLive(live, before, settings.carryNotice(prefs, current));
}
function save(live, persistent, incoming) {
    var prefs = settings.preferences(settings.parse(incoming)), saved = false;
    try {
        mkdir(path.dirname(persistent));
        fs.writeFileSync(persistent, json(prefs));
        saved = true;
    } catch (e) { console.error('persistent settings save failed: ' + (e.code || e.message)); }
    saveLive(live, prefs);
    return saved;
}
function restore(live, persistent) {
    var prefs = settings.preferences(settings.parse(read(persistent)));
    try { saveLive(live, prefs); }
    catch (e) {
        // Apply can recover a missing file; never replace an existing, possibly mounted inode.
        if (e.code !== 'ENOENT' || fs.existsSync(live)) { throw e; }
        fs.writeFileSync(live, json(prefs), {flag: 'wx'});
    }
}

function log(message) {
    message = String(message).replace(/[\r\n]/g, ' ').slice(0, 200);
    var result = proc.spawnSync('logger', ['-t', 'aerial-update', message], {timeout: 1000, stdio: 'ignore'});
    if (result.error || result.status !== 0) {
        try { fs.writeFileSync('/tmp/aerial-update.log', message + '\n'); } catch (e) { console.error(message); }
    }
}
function headers(text) {
    var response = Object.create(null);
    text.split(/\r?\n/).forEach(function (line) {
        var status = line.match(/^\s*HTTP\/\S+\s+([0-9]{3})(?:\s|$)/i);
        var field = line.match(/^\s*(etag|retry-after):\s*(.*?)\s*$/i);
        if (status) { response = Object.create(null); response.status = Number(status[1]); }
        else if (field) { response[field[1].toLowerCase()] = field[2]; }
    });
    return response;
}
function etag(value) {
    return typeof value === 'string' && value.length <= 256 && /^(?:W\/)?"[\x21\x23-\x7e]*"$/.test(value) ? value : '';
}
function fetch(client, cached, done) {
    if (client !== 'curl' && client !== 'wget') { return done('no HTTPS client'); }
    // Curl combines headers/body on stdout; wget prints server headers on stderr.
    var args = client === 'curl' ? ['-q', '-siS', '--connect-timeout', '10', '--max-time', '25',
        '--max-filesize', String(cap)] : ['--check-certificate', '-S', '-T', '25', '-O', '-'];
    if (cached) { args.push(client === 'curl' ? '-H' : '--header', 'If-None-Match: ' + cached); }
    args.push(index.url);
    var child = proc.spawn(client, args, {stdio: ['ignore', 'pipe', 'pipe']});
    var body = [], errors = [], total = 0, errorSize = 0, failure;
    function stop(why) { if (!failure) { failure = why; child.kill('SIGKILL'); } }
    var timer = setTimeout(function () { stop('timeout'); }, 27000);
    child.stdout.on('data', function (chunk) {
        total += chunk.length;
        if (total > cap) { stop('index too large'); } else { body.push(chunk); }
    });
    child.stderr.on('data', function (chunk) {
        errorSize += chunk.length;
        if (errorSize > 32768) { stop('client output too large'); } else { errors.push(chunk); }
    });
    child.on('error', function (e) { failure = 'client ' + (e.code || 'failed'); });
    child.on('close', function (code) {
        clearTimeout(timer);
        var data = Buffer.concat(body).toString('utf8'), response;
        if (client === 'curl') {
            // Skip proxy CONNECT / informational header blocks before the actual response.
            while (/^HTTP\//i.test(data)) {
                var boundary = /\r?\n\r?\n/.exec(data);
                if (!boundary) { break; }
                response = headers(data.slice(0, boundary.index));
                var tunnel = data.split(String.fromCharCode(10), 1)[0].toLowerCase().indexOf('200 connection established') !== -1;
                data = data.slice(boundary.index + boundary[0].length);
                if (!tunnel && !(response.status >= 100 && response.status < 200)) { break; }
            }
        } else { response = headers(Buffer.concat(errors).toString()); }
        if (failure || (code !== 0 && (client === 'curl' || !response || !response.status || response.status === 200))) {
            return done(failure || 'client exit ' + code);
        }
        done(null, response, data);
    });
}
function validTime(v) { return typeof v === 'number' && isFinite(v) && v >= 0 && v <= 8640000000000 && v % 1 === 0; }
function retryTime(value, now) {
    if (!value) { return 0; }
    var due = /^[0-9]+$/.test(value) ? now + Number(value) : Math.ceil(Date.parse(value) / 1000);
    return validTime(due) ? due : 0;
}
function check(opts, done) {
    var now = opts.now, state = {}, installed;
    function finish(next) { done(Math.max(now + 5, next)); }
    function persist() {
        var tmp = opts.state + '.tmp'; // protected by the shell hook's mkdir lock
        try {
            mkdir(path.dirname(opts.state));
            fs.writeFileSync(tmp, json(state));
            fs.renameSync(tmp, opts.state);
        } catch (e) { opts.log('state write failed: ' + (e.code || e.message)); }
    }
    function reconcile(refresh) {
        try {
            var before = read(opts.live), current = settings.parse(before);
            if (!state.latest) { return true; }
            var newer = index.compare(state.latest, installed.version) > 0;
            var latest = state.latest.replace(/^v/i, '');
            var notice = {version: latest, text: 'Update available: v' + latest};
            if (newer && current[settings.key] &&
                (!refresh || JSON.stringify(current[settings.key]) === JSON.stringify(notice))) { return true; }
            if (!newer && !Object.prototype.hasOwnProperty.call(current, settings.key)) { return true; }
            if (newer) { current[settings.key] = notice; } else { delete current[settings.key]; }
            writeLive(opts.live, before, current);
            opts.log(newer ? 'update found: v' + latest : 'notice cleared (installed is current)');
            return true;
        } catch (e) { opts.log('live settings write skipped: ' + (e.code || e.message)); return false; }
    }
    try {
        installed = settings.parse(read(opts.manifest));
        if (!index.validVersion(installed.version) || !installed.id) { throw new Error('missing package id or version'); }
    } catch (e) { opts.log('appinfo skipped: ' + (e.code || e.message)); return finish(now + 30); }
    try { state = settings.parse(read(opts.state)); }
    catch (e) { if (e.code !== 'ENOENT') { opts.log('ignoring invalid update state'); } }
    if (!index.validVersion(state.latest)) { delete state.latest; }
    // Recover local state before applying network throttles, including while waiting for NTP.
    var ready = reconcile(validTime(state.lastSuccess) && now - state.lastSuccess < day);
    if (now < 1700000000 || !ready) { return finish(now + 30); }
    var due = 0;
    if (validTime(state.lastSuccess) && state.lastSuccess <= now && state.latest) { due = state.lastSuccess + day; }
    if (validTime(state.nextRetry) && validTime(state.lastAttempt) && state.lastAttempt <= now) { due = Math.max(due, state.nextRetry); }
    if (due > now) { return finish(due); }
    var cached = state.latest && etag(state.etag);
    opts.log('check started');
    opts.fetch(cached, function (error, response, body) {
        response = response || {};
        var latest, completed = opts.clock ? opts.clock() : now;
        if (!validTime(completed) || completed < now) { completed = now; }
        state.lastAttempt = now;
        if (!error && response.status === 200) {
            try { latest = index.version(JSON.parse(body), installed.id); } catch (e) { error = 'invalid index JSON'; }
            if (!latest && !error) { error = 'package or version missing'; }
        } else if (!error && response.status === 304 && cached && (!response.etag || etag(response.etag) === cached)) {
            latest = state.latest;
        } else if (!error) { error = 'HTTP ' + (response.status || 'unknown'); }
        if (error) {
            var backoff = [30, 60, 120, 300, 900, 3600];
            var failures = validTime(state.failures) ? state.failures : 0;
            state.failures = Math.min(failures + 1, backoff.length);
            state.nextRetry = Math.max(completed + backoff[state.failures - 1],
                response.status === 403 || response.status === 429 ? retryTime(response['retry-after'], completed) : 0);
            persist();
            opts.log('check failed: ' + error + '; next retry at ' + state.nextRetry);
            return finish(state.nextRetry);
        }
        state.latest = latest;
        state.etag = response.status === 304 ? cached : etag(response.etag);
        state.lastSuccess = completed;
        state.failures = 0;
        state.nextRetry = 0;
        persist();
        opts.log('check succeeded: ' + latest);
        finish(reconcile(true) ? completed + day : completed + 30);
    });
}
function main(args) {
    if (args[0] === 'save') { if (!save(args[1], args[2], args[3])) { process.exitCode = 1; } return; }
    if (args[0] === 'restore') { restore(args[1], args[2]); return; }
    if (args[0] !== 'check') { throw new Error('unknown update command'); }
    var env = process.env;
    var clock = function () { return Number(env.AERIAL_UPDATE_NOW || Math.floor(Date.now() / 1000)); };
    check({now: clock(), clock: clock, live: path.join(__dirname, 'settings.json'),
        manifest: path.join(__dirname, '..', 'appinfo.json'),
        state: path.join(env.AERIAL_UPDATE_STATE_DIR || '/var/lib/webosbrew/custom-screensaver-aerial', 'update-state.json'),
        log: log, fetch: function (cached, done) { fetch(args[1], cached, done); }
    }, function (next) { console.log(next); });
}
module.exports = {check: check, fetch: fetch, save: save, restore: restore};
if (require.main === module) {
    try { main(process.argv.slice(2)); }
    catch (e) { console.error('aerial-update: ' + (e.code || e.message)); process.exitCode = 1; }
}
