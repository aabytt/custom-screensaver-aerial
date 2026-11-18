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
var LANGUAGE = /^[A-Za-z0-9-]+$/.test(args.lang || '') ? args.lang : 'en-US';
var I18N_DATA = {};
try { I18N_DATA = JSON.parse(fs.readFileSync(args.i18n, 'utf8')); } catch (e) { console.error('Could not load interface translations:', e.message); }
var INFO = '/tmp/aerial-fontserver.json';
var MAX_BYTES = 12 * 1024 * 1024, IDLE_MS = 10 * 60 * 1000;
var TOKEN = crypto.randomBytes(8).toString('hex');
if (!PERSIST || !APPDIR) { console.error('usage: --persist DIR --app DIR'); process.exit(2); }

function dictionary(tag) {
  var entry = I18N_DATA[tag], hops = 0;
  while (typeof entry === 'string' && hops++ < 5) { entry = I18N_DATA[entry]; }
  return entry && typeof entry === 'object' ? entry : null;
}
function translationChain() {
  var base = LANGUAGE.split('-')[0].toLowerCase(), chain = [];
  function add(tag) {
    var d = dictionary(tag);
    if (d && chain.indexOf(d) < 0) { chain.push(d); }
  }
  add(LANGUAGE);
  Object.keys(I18N_DATA).forEach(function (tag) {
    if (tag.split('-')[0].toLowerCase() === base) { add(tag); }
  });
  add('en-US');
  return chain;
}
var TRANSLATIONS = translationChain();
var ENGLISH = {
  fontPhoneTitle: 'Add a font', fontPhoneIntro: 'For the clock and title on the screensaver.',
  fontPhoneFormatsTtf: 'TTF or OTF, up to 12 MB.', fontPhoneFormatsAll: 'TTF, OTF, WOFF or WOFF2, up to 12 MB.',
  fontPhoneFromPhone: 'From this phone', fontPhoneChooseFile: 'Choose a font file',
  fontPhoneFromLink: 'From a link', fontPhoneDirectLink: 'A direct link to the font file.',
  fontPhoneDownload: 'Download', fontPhoneUrlPlaceholder: 'https://example.com/MyFont.ttf',
  fontPhoneOnTv: 'On the TV', fontPhonePick: 'Pick it in the app: Display, Font. Delete it there too.',
  fontPhoneNoFonts: 'No added fonts yet', fontPhoneWorking: 'Working...',
  fontPhoneAdded: 'Added: {file}. It is in the font list on the TV.',
  fontPhoneFailed: 'Failed ({status})', fontPhoneNoConnection: 'No connection to the TV',
  fontPhoneInvalidType: 'This is not a TTF, OTF, WOFF or WOFF2 font file.',
  fontPhoneUnsupportedType: 'This screensaver supports TTF and OTF fonts only.',
  fontPhoneTooLarge: 'The file is larger than 12 MB.',
  fontPhoneAppCopyFailed: 'Font saved for the next screensaver apply, but the active app copy failed: {error}',
  fontPhoneDownloadFailed: 'Download failed: {error}',
  fontPhoneLinkRequired: 'Enter a link that starts with http:// or https://',
  fontPhoneNotFound: 'Not found',
  fontPhoneOpenFromQr: 'Open the address from the QR code on the TV.',
  fontPhoneSaveFailed: 'Could not save the font: {error}',
  fontPhoneRequestFailed: 'Could not process the request: {error}',
  fontServerProcessUnknown: 'Cannot verify the existing font server process.',
  fontServerRestartFailed: 'The existing font server could not be restarted.',
  fontServerNodeMissing: 'Node was not found on this TV.',
  fontServerStartFailed: 'The server did not start: {error}'
};
function fontError(key, params) {
  var e = new Error(t(key, params));
  e.fontServerText = true;
  return e;
}
function t(key, params) {
  var text, n;
  for (n = 0; n < TRANSLATIONS.length; n++) {
    if (TRANSLATIONS[n][key] !== undefined) { text = TRANSLATIONS[n][key]; break; }
  }
  if (text === undefined) { text = ENGLISH[key] !== undefined ? ENGLISH[key] : key; }
  return String(text).replace(/\{(\w+)\}/g, function (match, name) {
    return params && params[name] !== undefined ? params[name] : match;
  });
}
function html(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function scriptJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

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
  if (!kind) { throw fontError('fontPhoneInvalidType'); }
  if (TTF_ONLY && kind !== 'ttf' && kind !== 'otf') { throw fontError('fontPhoneUnsupportedType'); }
  if (buf.length > MAX_BYTES) { throw fontError('fontPhoneTooLarge'); }
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
    throw fontError('fontPhoneAppCopyFailed', {error: e.message});
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
  if (!/^https?:$/.test(u.protocol || '') || !u.host) { return done(fontError('fontPhoneLinkRequired')); }
  function finish(err) {
    var buf, name;
    if (err) { try { fs.unlinkSync(tmp); } catch (e) {} return done(fontError('fontPhoneDownloadFailed', {error: String(err.message || err).split('\n')[0]})); }
    try {
      buf = fs.readFileSync(tmp);
      fs.unlinkSync(tmp);
      name = decodeURIComponent(path.basename(u.pathname || '')) || 'font';
      done(null, save(name, buf));
    } catch (e) { done(e.fontServerText ? e : fontError('fontPhoneSaveFailed', {error: e.message})); }
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

var CLIENT_MESSAGES = {
  working: t('fontPhoneWorking'),
  added: t('fontPhoneAdded'),
  failed: t('fontPhoneFailed'),
  noConnection: t('fontPhoneNoConnection'),
  noFonts: t('fontPhoneNoFonts')
};
var PAGE = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>' + html(t('fontPhoneTitle')) + '</title><style>' +
  'body{font:17px/1.4 system-ui,sans-serif;margin:0;padding:20px;background:#17171c;color:#fff;max-width:560px;margin:auto}' +
  'h1{font-size:22px;margin:0 0 4px}p{color:#b9b9c4;margin:4px 0 16px}' +
  '.box{background:#23232b;border-radius:10px;padding:16px;margin:16px 0}' +
  'input[type=url]{width:100%;box-sizing:border-box;padding:12px;border-radius:8px;border:1px solid #444;background:#111;color:#fff;font-size:16px}' +
  'button,label.b{display:block;width:100%;box-sizing:border-box;text-align:center;margin-top:10px;padding:13px;border:0;border-radius:8px;background:#cf0652;color:#fff;font-size:17px}' +
  'input[type=file]{display:none}#msg{min-height:24px;margin-top:8px}.ok{color:#7ddc8a}.err{color:#ff8a8a}' +
  'ul{padding-left:20px;margin:6px 0}</style></head><body>' +
  '<h1>' + html(t('fontPhoneTitle')) + '</h1><p>' + html(t('fontPhoneIntro')) + ' ' +
  html(t(TTF_ONLY ? 'fontPhoneFormatsTtf' : 'fontPhoneFormatsAll')) + '</p>' +
  '<div class="box"><b>' + html(t('fontPhoneFromPhone')) + '</b><label class="b" for="f">' + html(t('fontPhoneChooseFile')) + '</label>' +
  '<input id="f" type="file" accept="' + (TTF_ONLY ? '.ttf,.otf' : '.ttf,.otf,.woff,.woff2,font/*') + '"></div>' +
  '<div class="box"><b>' + html(t('fontPhoneFromLink')) + '</b><p>' + html(t('fontPhoneDirectLink')) + '</p>' +
  '<input id="u" type="url" placeholder="' + html(t('fontPhoneUrlPlaceholder')) + '"><button id="go">' + html(t('fontPhoneDownload')) + '</button></div>' +
  '<div id="msg"></div><div class="box"><b>' + html(t('fontPhoneOnTv')) + '</b><ul id="l"></ul>' +
  '<p>' + html(t('fontPhonePick')) + '</p></div>' +
  '<script>var T="@@TOKEN@@",M=' + scriptJson(CLIENT_MESSAGES) + ';function $(i){return document.getElementById(i)}' +
  'function msg(k,p){return M[k].replace(/\\{(\\w+)\\}/g,function(m,n){return p&&p[n]!==undefined?p[n]:m})}' +
  'function say(t,c){var m=$("msg");m.textContent=t;m.className=c||""}' +
  'function refresh(){var x=new XMLHttpRequest();x.open("GET","/list?t="+T);x.onload=function(){var a;try{a=JSON.parse(x.responseText)}catch(e){say(msg("failed",{status:x.status}),"err");return}' +
  '$("l").innerHTML="";a.forEach(function(n){var li=document.createElement("li");li.textContent=n;$("l").appendChild(li)});' +
  'if(!a.length){var li=document.createElement("li");li.textContent=M.noFonts;$("l").appendChild(li)}};x.onerror=function(){say(M.noConnection,"err")};x.send()}' +
  'function send(method,u,body,type){say(M.working);var x=new XMLHttpRequest();x.open(method,u+(u.indexOf("?")<0?"?":"&")+"t="+T);' +
  'if(type)x.setRequestHeader("Content-Type",type);x.onload=function(){var r={};try{r=JSON.parse(x.responseText)}catch(e){}' +
  'if(x.status==200){say(msg("added",{file:r.file}),"ok");refresh()}else say(r.error||msg("failed",{status:x.status}),"err")};' +
  'x.onerror=function(){say(M.noConnection,"err")};x.send(body)}' +
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
  if (u.query.t !== TOKEN) { return reply(res, 403, t('fontPhoneOpenFromQr'), 'text/plain'); }
  if (req.method === 'GET' && u.pathname === '/') { return reply(res, 200, PAGE.replace('@@TOKEN@@', TOKEN), 'text/html; charset=utf-8'); }
  if (req.method === 'GET' && u.pathname === '/list') { return reply(res, 200, list()); }
  if (req.method === 'GET' && u.pathname === '/quit') { reply(res, 200, {ok: true}); return setTimeout(quit, 100); }
  if (req.method !== 'POST') { return reply(res, 404, {error: t('fontPhoneNotFound')}); }
  req.on('data', function (c) {
    size += c.length;
    if (size > MAX_BYTES + 1024) { reply(res, 413, {error: t('fontPhoneTooLarge')}); req.destroy(); return; }
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
      reply(res, 404, {error: t('fontPhoneNotFound')});
    } catch (e) { reply(res, 400, {error: e.fontServerText ? e.message : t('fontPhoneRequestFailed', {error: e.message})}); }
  });
});

function listen(port, triesLeft) {
  server.once('error', function (e) {
    if (e.code === 'EADDRINUSE' && triesLeft > 0) { listen(port + 1, triesLeft - 1); } else { console.error(e.message); process.exit(1); }
  });
  server.listen(port, '0.0.0.0', function () {
    server.removeAllListeners('error');
    fs.writeFileSync(INFO, JSON.stringify({pid: process.pid, ttfOnly: TTF_ONLY, lang: LANGUAGE,
      url: 'http://' + lanIp() + ':' + port + '/?t=' + TOKEN}));
    touch();
  });
}
process.on('SIGTERM', quit);
listen(PORT, 10);
