// Tiny web server for adding OSD fonts from a phone. Started by font-server.sh (from the app's
// Display panel, through the Homebrew Channel service, i.e. as root), stopped by the app, by
// GET /quit, or by itself after IDLE_MS without a request.
//
//   node font-server.js --persist /var/lib/webosbrew/custom-screensaver-aerial/fonts \
//                       --app /media/developer/apps/usr/palm/applications/<id>/assets/fonts/custom
//
// A font is stored twice, like settings.json: in --persist (survives reinstall, apply.sh copies it
// back) and in --app (where the screensaver page can read it). Written in old-style JS (no
// arrow functions, async, copyFileSync) so it also runs on the older node of older webOS.
var http = require('http'), https = require('https'), fs = require('fs'), os = require('os'),
    path = require('path'), url = require('url'), crypto = require('crypto'), cp = require('child_process');

var args = {}, i;
for (i = 2; i < process.argv.length; i += 2) { args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1]; }
var PERSIST = args.persist, APPDIR = args.app, PORT = parseInt(args.port, 10) || 8765;
var TTF_ONLY = args['ttf-only'] === '1';
var INFO = '/tmp/aerial-fontserver.json';
var MAX_BYTES = 12 * 1024 * 1024, IDLE_MS = 10 * 60 * 1000;
var TOKEN = crypto.randomBytes(8).toString('hex');
if (!PERSIST || !APPDIR) { console.error('usage: --persist DIR --app DIR'); process.exit(2); }

function mkdirs(dir) {
  dir.split('/').reduce(function (acc, part) {
    acc = acc + (part ? '/' + part : '');
    if (acc && !fs.existsSync(acc)) { fs.mkdirSync(acc); }
    return acc;
  }, '');
}

// font kind from the first bytes (the extension of a download can't be trusted, or is missing)
function sniff(buf) {
  var h = buf.slice(0, 4).toString('latin1');
  if (h === 'wOFF') { return 'woff'; }
  if (h === 'wOF2') { return 'woff2'; }
  if (h === 'OTTO') { return 'otf'; }
  if (h === '\u0000\u0001\u0000\u0000' || h === 'true') { return 'ttf'; }
  return null;
}

// "My Font (Bold).ttf" -> "My_Font_Bold.ttf"; the extension comes from the content
function safeName(name, kind) {
  var base = path.basename(String(name || 'font')).replace(/\.(ttf|otf|woff2?)$/i, '');
  base = base.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[._]+/, '').slice(0, 60) || 'font';
  return base + '.' + kind;
}

function save(name, buf) {
  var kind = sniff(buf), file;
  if (!kind) { throw new Error('This is not a TTF, OTF, WOFF or WOFF2 font file.'); }
  if (TTF_ONLY && kind !== 'ttf' && kind !== 'otf') { throw new Error('This screensaver supports TTF and OTF fonts only.'); }
  if (buf.length > MAX_BYTES) { throw new Error('The file is larger than 12 MB.'); }
  file = safeName(name, kind);
  mkdirs(PERSIST);
  mkdirs(APPDIR);
  // the persistent copy first: it is the one that must not be lost
  fs.writeFileSync(path.join(PERSIST, file), buf);
  var appFile = path.join(APPDIR, file), tmpFile = path.join(APPDIR, '.' + file + '.' + process.pid + '.tmp');
  try {
    fs.writeFileSync(tmpFile, buf);
    fs.renameSync(tmpFile, appFile);
  } catch (e) {
    try { fs.unlinkSync(tmpFile); } catch (ignore) {}
    throw new Error('Font saved for the next screensaver apply, but the active app copy failed: ' + e.message);
  }
  return file;
}

function list() {
  try {
    return fs.readdirSync(PERSIST).filter(function (f) {
      return TTF_ONLY ? /\.(ttf|otf)$/i.test(f) : /\.(ttf|otf|woff2?)$/i.test(f);
    }).sort();
  } catch (e) { return []; }
}

// Download with curl (or wget): the TV's own certificates and redirects handling, and no memory
// spent on a huge reply (--max-filesize).
function download(link, done) {
  var u = url.parse(String(link || ''));
  var tmp = '/tmp/aerial-font-' + process.pid + '-' + Date.now();
  var curl = ['-fsSL', '--max-time', '60', '--max-filesize', String(MAX_BYTES), '-o', tmp, link];
  if (!/^https?:$/.test(u.protocol || '') || !u.host) { return done(new Error('Enter a link that starts with http:// or https://')); }
  function finish(err) {
    var buf, name;
    if (err) { try { fs.unlinkSync(tmp); } catch (e) {} return done(new Error('Download failed: ' + String(err.message || err).split('\n')[0])); }
    try {
      buf = fs.readFileSync(tmp);
      fs.unlinkSync(tmp);
      name = decodeURIComponent(path.basename(u.pathname || '')) || 'font';
      done(null, save(name, buf));
    } catch (e) { done(e); }
  }
  cp.execFile('curl', curl, function (err) {
    if (err && err.code === 'ENOENT') {
      return cp.execFile('wget', ['-q', '-T', '60', '-O', tmp, link], finish);
    }
    if (err && /certificate|SSL/i.test(String(err.message))) {   // old CA bundle on the TV: fonts are public files
      return cp.execFile('curl', ['-k'].concat(curl), finish);
    }
    finish(err);
  });
}

function lanIp() {
  var nets = os.networkInterfaces(), best = null, name;
  for (name in nets) {
    nets[name].forEach(function (a) {
      if (a.family !== 'IPv4' || a.internal) { return; }
      if (!best || /^(eth|wlan|en|wl)/.test(name) && !/^(eth|wlan|en|wl)/.test(best.name)) { best = {name: name, address: a.address}; }
    });
  }
  return best ? best.address : '127.0.0.1';
}

var PAGE = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>Add a font</title><style>' +
  'body{font:17px/1.4 system-ui,sans-serif;margin:0;padding:20px;background:#17171c;color:#fff;max-width:560px;margin:auto}' +
  'h1{font-size:22px;margin:0 0 4px}p{color:#b9b9c4;margin:4px 0 16px}' +
  '.box{background:#23232b;border-radius:10px;padding:16px;margin:16px 0}' +
  'input[type=url]{width:100%;box-sizing:border-box;padding:12px;border-radius:8px;border:1px solid #444;background:#111;color:#fff;font-size:16px}' +
  'button,label.b{display:block;width:100%;box-sizing:border-box;text-align:center;margin-top:10px;padding:13px;border:0;border-radius:8px;background:#cf0652;color:#fff;font-size:17px}' +
  'input[type=file]{display:none}#msg{min-height:24px;margin-top:8px}.ok{color:#7ddc8a}.err{color:#ff8a8a}' +
  'ul{padding-left:20px;margin:6px 0}</style></head><body>' +
  '<h1>Add a font</h1><p>For the clock and title on the screensaver. ' +
  (TTF_ONLY ? 'TTF or OTF, up to 12 MB.' : 'TTF, OTF, WOFF or WOFF2, up to 12 MB.') + '</p>' +
  '<div class="box"><b>From this phone</b><label class="b" for="f">Choose a font file</label>' +
  '<input id="f" type="file" accept="' + (TTF_ONLY ? '.ttf,.otf' : '.ttf,.otf,.woff,.woff2,font/*') + '"></div>' +
  '<div class="box"><b>From a link</b><p>A direct link to the font file.</p>' +
  '<input id="u" type="url" placeholder="https://example.com/MyFont.ttf"><button id="go">Download</button></div>' +
  '<div id="msg"></div><div class="box"><b>On the TV</b><ul id="l"></ul>' +
  '<p>Pick it in the app: Display, Font. Delete it there too.</p></div>' +
  '<script>var T="@@TOKEN@@";function $(i){return document.getElementById(i)}' +
  'function say(t,c){var m=$("msg");m.textContent=t;m.className=c||""}' +
  'function refresh(){var x=new XMLHttpRequest();x.open("GET","/list?t="+T);x.onload=function(){try{var a=JSON.parse(x.responseText);' +
  '$("l").innerHTML="";a.forEach(function(n){var li=document.createElement("li");li.textContent=n;$("l").appendChild(li)});' +
  'if(!a.length)$("l").innerHTML="<li>No added fonts yet</li>"}catch(e){}};x.send()}' +
  'function send(method,u,body,type){say("Working...");var x=new XMLHttpRequest();x.open(method,u+(u.indexOf("?")<0?"?":"&")+"t="+T);' +
  'if(type)x.setRequestHeader("Content-Type",type);x.onload=function(){var r={};try{r=JSON.parse(x.responseText)}catch(e){}' +
  'if(x.status==200){say("Added: "+r.file+". It is in the font list on the TV.","ok");refresh()}else say(r.error||"Failed ("+x.status+")","err")};' +
  'x.onerror=function(){say("No connection to the TV","err")};x.send(body)}' +
  '$("f").onchange=function(){var f=this.files[0];if(f)send("POST","/upload?name="+encodeURIComponent(f.name),f,"application/octet-stream")};' +
  '$("go").onclick=function(){var v=$("u").value.trim();if(v)send("POST","/url",JSON.stringify({url:v}),"application/json")};refresh()' +
  '</script></body></html>';

function reply(res, code, obj, type) {
  var body = typeof obj === 'string' ? obj : JSON.stringify(obj);
  res.writeHead(code, {'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
  res.end(body);
}

var idle;
function touch() {
  clearTimeout(idle);
  idle = setTimeout(function () { quit(); }, IDLE_MS);
}
function quit() {
  try { fs.unlinkSync(INFO); } catch (e) {}
  process.exit(0);
}

var server = http.createServer(function (req, res) {
  var u = url.parse(req.url, true), chunks = [], size = 0;
  touch();
  if (u.query.t !== TOKEN) { return reply(res, 403, 'Open the address from the QR code on the TV.', 'text/plain'); }
  if (req.method === 'GET' && u.pathname === '/') { return reply(res, 200, PAGE.replace('@@TOKEN@@', TOKEN), 'text/html; charset=utf-8'); }
  if (req.method === 'GET' && u.pathname === '/list') { return reply(res, 200, list()); }
  if (req.method === 'GET' && u.pathname === '/quit') { reply(res, 200, {ok: true}); return setTimeout(quit, 100); }
  if (req.method !== 'POST') { return reply(res, 404, {error: 'Not found'}); }
  req.on('data', function (c) {
    size += c.length;
    if (size > MAX_BYTES + 1024) { reply(res, 413, {error: 'The file is larger than 12 MB.'}); req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', function () {
    var body = Buffer.concat(chunks), file;
    if (res.finished) { return; }
    try {
      if (u.pathname === '/upload') {
        file = save(u.query.name, body);
        return reply(res, 200, {file: file});
      }
      if (u.pathname === '/url') {
        return download(JSON.parse(body.toString('utf8')).url, function (err, f) {
          if (err) { reply(res, 400, {error: err.message}); } else { reply(res, 200, {file: f}); }
        });
      }
      reply(res, 404, {error: 'Not found'});
    } catch (e) { reply(res, 400, {error: e.message}); }
  });
});

function listen(port, triesLeft) {
  server.once('error', function (e) {
    if (e.code === 'EADDRINUSE' && triesLeft > 0) { listen(port + 1, triesLeft - 1); } else { console.error(e.message); process.exit(1); }
  });
  server.listen(port, '0.0.0.0', function () {
    server.removeAllListeners('error');
    fs.writeFileSync(INFO, JSON.stringify({pid: process.pid, ttfOnly: TTF_ONLY,
      url: 'http://' + lanIp() + ':' + port + '/?t=' + TOKEN}));
    touch();
  });
}
process.on('SIGTERM', quit);
listen(PORT, 10);
