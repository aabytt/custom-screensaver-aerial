var
  kind = require('enyo/kind'),
  Panel = require('moonstone/Panel'),
  FittableRows = require('layout/FittableRows'),
  BodyText = require('moonstone/BodyText'),
  Marquee = require('moonstone/Marquee'),
  ExpandablePicker = require('moonstone/ExpandablePicker'),
  Button = require('moonstone/Button'),
  LunaService = require('enyo-webos/LunaService'),
  Divider = require('./Heading.js'),
  Scroller = require('moonstone/Scroller'),
  Item = require('moonstone/Item'),
  Popup = require('moonstone/Popup'),
  ToggleItem = require('moonstone/ToggleItem'),
  VideoSelectPanel = require('./VideoSelectPanel.js'),
  DisplayPanel = require('./DisplayPanel.js'),
  ProtectionPanel = require('./ProtectionPanel.js'),
  LanguagePanel = require('./LanguagePanel.js'),
  SettingsStore = require('./SettingsStore.js'),
  QrCode = require('./QrCode.js'),
  ReleaseNotes = require('./ReleaseNotes.js'),
  I18n = require('./I18n.js'),
  Theme = require('./Theme.js');
var basePath = SettingsStore.basePath;
var applyPath = basePath + "/assets/apply.sh";
var linkPath = "/var/lib/webosbrew/init.d/50-custom-screensaver-aerial";
var settingsPath = SettingsStore.appPath;
// One object for the whole lifetime of the app: sub-panels keep a reference to it,
// so applySettings() fills it in place instead of replacing it.
var settings = {};
// Homebrew Channel repository index: the version listed here is what HBC offers, and it is published
// later than the GitHub release, so the update check must use it instead of the GitHub releases.
var repoApi = 'https://repo.webosbrew.org/api/apps.json';
// The release pages (Markdown) of the versions between the installed one and the latest are shown in the update card
var releasesApi = 'https://api.github.com/repos/aabytt/custom-screensaver-aerial/releases?per_page=100';
var NOTES_MAX_PX = 400;   // height of the notes area; longer notes scroll
var appId = 'org.aabytt.webos.custom-screensaver-aerial';
var hbChannelId = 'org.webosbrew.hbchannel';
// Line icons (24x24 grid) as inline SVG that takes the text color (currentColor), so an icon matches
// the text both normally and when its item is focused.
var ICONS = {
  globe: '<circle cx="12" cy="12" r="9.5"/><ellipse cx="12" cy="12" rx="4.2" ry="9.5"/><path d="M2.5 12h19M4 7h16M4 17h16"/>',
  clock: '<circle cx="12" cy="12" r="9.5"/><path d="M12 6.5V12l3.5 2"/>',
  playlist: '<path d="M3 6h14M3 12h10M3 18h7"/><path d="M15.5 14.5l5.5 3.5-5.5 3.5z"/>',
  display: '<rect x="2.5" y="4.5" width="19" height="14" rx="2"/><path d="M6.5 9.5h11M6.5 13.5h6"/>',
  power: '<path d="M12 3v8.5"/><path d="M6.4 6.6a8.5 8.5 0 1 0 11.2 0"/>',
  video: '<rect x="2.5" y="4.5" width="19" height="14" rx="2"/><path d="M10 8.5l5 3-5 3z"/>',
  chat: '<path d="M4 4.5h16a1 1 0 0 1 1 1V15a1 1 0 0 1-1 1H10l-5 4v-4H4a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1z"/><path d="M7.5 9h9M7.5 12h5.5"/>',
  shield: '<path d="M12 2.8l7.5 2.9v6c0 4.7-3.1 8.4-7.5 9.5-4.4-1.1-7.5-4.8-7.5-9.5v-6z"/><path d="M8.6 12.2l2.5 2.5 4.4-4.9"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  uturn: '<path d="M7 20.5V10a5 5 0 0 1 10 0v9"/><path d="M13.5 15.5L17 19l3.5-3.5"/>'
};
// Moonstone highlight color (focused item background); the "update available" text uses it, and turns white on focus
var ACCENT = Theme.ACCENT;
var ICON_SIZE = 30, ICON_GAP = 14;   // px; text next to an icon starts ICON_SIZE + ICON_GAP further right
function svgMarkup(name) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="none" ' +
    'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + ICONS[name] + '</svg>';
}
// icon as a control (items that lay out icon + text themselves with flex)
function iconComponent(name) {
  return {
    allowHtml: true,
    style: 'flex: none; width: ' + ICON_SIZE + 'px; height: ' + ICON_SIZE + 'px; margin-right: ' + ICON_GAP + 'px; line-height: 0;',
    content: svgMarkup(name)
  };
}
// icon as inline HTML in front of a label (toggle items, picker header: their label is one text element)
function iconLabel(name, text) {
  return '<span style="display: inline-block; width: ' + ICON_SIZE + 'px; height: ' + ICON_SIZE + 'px; margin-right: ' +
    ICON_GAP + 'px; vertical-align: middle; line-height: 0;">' + svgMarkup(name) + '</span>' +
    String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
var ICON_ITEM = 'display: flex; align-items: center;';   // one-line item: icon and text on one axis
// two-line item: the icon stands at the title line, the description below starts under the title text
function titleRow(icon, titleProps) {
  titleProps.style = 'flex: 1 1 auto; min-width: 0;';
  return {style: ICON_ITEM, components: [iconComponent(icon), titleProps]};
}
var DESC_FONT = Theme.DESC_FONT;   // one size for every second line (description / current value)
var DESC_STYLE = 'margin: 0 0 0 ' + (ICON_SIZE + ICON_GAP) + 'px; font-size: ' + DESC_FONT + ';';

// Compatibility report: a QR code with a link to the GitHub issue form, already filled in with this TV's data.
// The query parameters are the ids of the fields of .github/ISSUE_TEMPLATE/compatibility.yml.
var REPORT_URL = 'https://github.com/aabytt/custom-screensaver-aerial/issues/new?template=compatibility.yml';
var REPORT_SHORT = 'github.com/aabytt/custom-screensaver-aerial';
// release from the TV ("10.3.0") -> the option of the "webOS version" dropdown of the form (exact text), '' if none fits
function webosLabel(release) {
  var m = String(release || '').match(/(\d+)(?:\.(\d+))?/), major, minor;
  var byMajor = {1: 'webOS 1', 2: 'webOS 2', 5: 'webOS 5', 6: 'webOS 6', 7: 'webOS 22 (7)', 8: 'webOS 23 (8)',
    9: 'webOS 24 (9)', 10: 'webOS 25 (10)', 11: 'webOS 26 (11)'};
  if (!m) { return ''; }
  major = parseInt(m[1], 10);
  minor = parseInt(m[2] || '0', 10);
  if (major === 3 || major === 4) { return 'webOS ' + major + (minor >= 5 ? '.5' : ''); }
  return byMajor[major] || '';
}

// translated text, or the English fallback while the key is not in the translation files yet
function tr(key, fallback) {
  var s = I18n.t(key);
  return (typeof s === 'string' && s && s.indexOf(key) < 0) ? s : fallback;
}
// "label   value" row of the report card: small gray label, large white value, thin separator
function infoRow(name) {
  return {style: 'display: flex; align-items: baseline; padding: 12px 0; border-bottom: 1px solid #2c2c2e;', components: [
    {tag: 'span', name: name + 'Label', style: 'flex: none; width: 270px; font-size: 25px; color: ' + Theme.MUTED + ';'},
    {tag: 'span', name: name, style: 'flex: 1 1 auto; min-width: 0; font-size: 34px; color: #fff; word-break: break-all;'}
  ]};
}

// "v1.2.3" / "1.2.3-beta" -> [1, 2, 3]; anything non-numeric after the leading number is ignored
function parseVersion(v) {
  var m = String(v || '').match(/\d+(\.\d+)*/);
  return m ? m[0].split('.').map(function (n) { return parseInt(n, 10); }) : [];
}
// > 0 if a is newer than b, < 0 if older, 0 if equal
function compareVersions(a, b) {
  var x = parseVersion(a), y = parseVersion(b), i, d;
  for (i = 0; i < Math.max(x.length, y.length); i++) {
    d = (x[i] || 0) - (y[i] || 0);
    if (d) { return d; }
  }
  return 0;
}
// ---- release notes translation helpers ----------------------------------------------------------------
// Names and terms that stay as they are in every language
var NO_TRANSLATE = ['Homebrew Channel', 'webOS', 'Aerial', 'Apple TV', 'Apple', 'GitHub', 'OSD', 'HDR10', 'HDR',
  'Dolby Vision', 'OLED', 'LG', 'HEVC', 'H.264', 'HLS', 'MP4', 'WebM', 'JSON', 'API', 'URL', 'USB', 'Wi-Fi', 'README'];
var NO_TRANSLATE_RE = new RegExp('\\b(?:' + NO_TRANSLATE.slice().sort(function (a, b) { return b.length - a.length; })
  .map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')\\b', 'g');
var LIST_PREFIX_RE = /^(\u2022[\s\u00a0]*|\d+\.[\s\u00a0]*)/;               // bullet / number the renderer put in front of a line
var MARKER_RE = /[\[\uFF3B\u3010]\s*([\/\uFF0F]?)\s*(c?)(\d+)\s*[\]\uFF3D\u3011]/gi;   // [3] [/3] [c2], also in full-width brackets

function escHtml(t) { return String(t).replace(/[&<>]/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c]; }); }

// One block (a line of the notes) -> one sentence for the translation service: the inline tags (bold, italic)
// become numbered markers [1]...[/1] the service moves along with the words, code and protected terms become
// atoms [c0] that are put back untouched. Returns {text, tags, atoms, prefix}.
function noteSerialize(block) {
  var tags = [], atoms = [], text = '', prefix = '', first = true;
  function atom(html) { atoms.push(html); return '[c' + (atoms.length - 1) + ']'; }
  function walk(parent) {
    var c, i, outer, p, v;
    for (c = parent.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) {
        v = c.nodeValue;
        if (first && (p = LIST_PREFIX_RE.exec(v))) { prefix = p[0]; v = v.slice(p[0].length); }
        text += v.replace(NO_TRANSLATE_RE, function (t) { return atom(escHtml(t)); });
      } else if (c.nodeType === 1) {
        if (c.getAttribute('data-nt')) { text += atom(c.outerHTML); }
        else {
          outer = c.cloneNode(false).outerHTML;
          tags.push({open: outer.slice(0, outer.lastIndexOf('</')), close: '</' + c.nodeName.toLowerCase() + '>'});
          i = tags.length - 1;
          text += '[' + i + ']';
          walk(c);
          text += '[/' + i + ']';
        }
      }
      first = false;
    }
  }
  walk(block);
  return {text: text, tags: tags, atoms: atoms, prefix: prefix};
}

// The translated sentence -> HTML. null if the service lost or scrambled a marker (the caller then falls back).
function noteRebuild(m, out) {
  var html = '', last = 0, seen = {}, stack = [], bad = false, i, r = new RegExp(MARKER_RE.source, 'gi'), x;
  function plain(t) { html += escHtml(t); }
  while ((x = r.exec(out))) {
    plain(out.slice(last, x.index));
    last = r.lastIndex;
    i = parseInt(x[3], 10);
    if (x[2]) {                                            // [cN]
      if (!m.atoms[i] || seen['c' + i]) { bad = true; break; }
      seen['c' + i] = 1; html += m.atoms[i];
    } else if (!x[1]) {                                    // [N]
      if (!m.tags[i] || seen['o' + i]) { bad = true; break; }
      seen['o' + i] = 1; stack.push(i); html += m.tags[i].open;
    } else {                                               // [/N]
      if (!m.tags[i] || seen['x' + i] || stack.pop() !== i) { bad = true; break; }
      seen['x' + i] = 1; html += m.tags[i].close;
    }
  }
  if (bad || stack.length) { return null; }
  plain(out.slice(last));
  for (i = 0; i < m.atoms.length; i++) { if (!seen['c' + i]) { return null; } }
  for (i = 0; i < m.tags.length; i++) { if (!seen['o' + i] || !seen['x' + i]) { return null; } }
  return escHtml(m.prefix) + html;
}

// text -> translated text through the web service (3 attempts); cb(error, text)
function noteTranslate(tl, core, cb) {
  (function send(attempt) {
    var xhr = new XMLHttpRequest();
    function retry(why) {
      console.info('Notes translation: ' + why + (attempt < 3 ? ', retry' : ', giving up'));
      if (attempt < 3) { setTimeout(function () { send(attempt + 1); }, 600 * attempt); } else { cb(new Error(why)); }
    }
    xhr.open('GET', 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&dt=t&tl=' +
      encodeURIComponent(tl) + '&q=' + encodeURIComponent(core));
    xhr.timeout = 10000;
    xhr.onload = function () {
      var out = '', i, src, keep;
      try {
        if (xhr.status !== 200) { throw new Error('status ' + xhr.status); }
        src = JSON.parse(xhr.responseText)[0];
        for (i = 0; i < src.length; i++) { out += src[i][0] || ''; }
        if (!out) { throw new Error('empty'); }
      } catch (e) { retry(e.message); return; }
      // names, links, numbers must survive; if the service garbled one, keep the English line
      keep = core.match(/@[\w-]+|https?:\/\/\S+|#\d+|\d+(\.\d+)+/g) || [];
      for (i = 0; i < keep.length; i++) { if (out.indexOf(keep[i]) < 0) { out = core; break; } }
      cb(null, out);
    };
    xhr.onerror = xhr.ontimeout = function () { retry('network'); };
    xhr.send();
  })(1);
}

// Fallback for a line whose markers did not come back: every text piece separately (the old way)
function noteTranslatePieces(tl, block, cb) {
  var nodes = [], left, bad = 0;
  (function walk(n) {
    var c;
    for (c = n.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) { if (/[A-Za-z]/.test(c.nodeValue)) { nodes.push(c); } }
      else if (c.nodeType === 1 && !c.getAttribute('data-nt')) { walk(c); }
    }
  })(block);
  left = nodes.length;
  if (!left) { cb(true); return; }
  nodes.forEach(function (node) {
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(node.nodeValue), p = LIST_PREFIX_RE.exec(m[2]) || [''];
    noteTranslate(tl, m[2].slice(p[0].length), function (err, out) {
      if (err) { bad++; } else { node.nodeValue = m[1] + p[0] + out + m[3]; }
      if (--left === 0) { cb(!bad); }
    });
  });
}

// translates one line of the notes in place; cb(true) if it was translated
function noteTranslateBlock(tl, block, cb) {
  var m = noteSerialize(block);
  if (!/[A-Za-z]/.test(m.text.replace(/\[\/?c?\d+\]/g, ''))) { setTimeout(function () { cb(true); }, 0); return; }   // numbers only
  noteTranslate(tl, m.text, function (err, out) {
    var html = err ? null : noteRebuild(m, out);
    if (html !== null) { block.innerHTML = html; cb(true); return; }
    console.info('Notes translation: markers lost, line translated in pieces');
    noteTranslatePieces(tl, block, cb);
  });
}

module.exports = kind({
  name: 'MainPanel',
  kind: Panel,
  title: 'webOS Aerial Screensaver',
  headerType: 'small',
  events: {
    onRequestPushPanel: ''
  },
  components: [
    {kind: FittableRows, name: 'rows', style: 'height: 100%;', components: [
      {kind: Scroller, fit: true, components: [
        {name: 'content', style: 'margin-left: 7%; width: 78%;', components: [
          {components: [
            // one line (wraps if the screen is narrow): the language in use as an item that opens the
            // language list, then the version
            {style: 'display: flex; flex-wrap: wrap; align-items: center; margin: 0 0 8px;', components: [
              // icon and text are centered on the same axis (flex), not baseline-aligned
              {kind: Item, name: 'langLink', style: 'flex: none; margin-right: 40px; ' + ICON_ITEM, ontap: 'openLanguage', components: [
                iconComponent('globe'),
                {tag: 'span', name: 'langText', style: 'flex: none;'}
              ]},
              // the version opens the compatibility report card (QR code)
              // icon + text + chevron: it is a button (feedback card, update), and it looks like one
              {kind: Item, name: 'versionLink', style: 'flex: none; ' + ICON_ITEM, ontap: 'openReport',
                onSpotlightFocused: 'versionFocused', onSpotlightBlur: 'versionBlurred', components: [
                {name: 'versionIcon', allowHtml: true, style: 'flex: none; width: ' + ICON_SIZE + 'px; height: ' + ICON_SIZE + 'px; margin-right: ' + ICON_GAP + 'px; line-height: 0;', content: svgMarkup('chat')},
                {kind: BodyText, name: 'versionInfo', style: 'margin: 0;', content: ''},
                {name: 'versionChev', allowHtml: true, style: 'flex: none; width: 22px; height: 22px; margin-left: 10px; line-height: 0; opacity: 0.7;', content: svgMarkup('chevron')}
              ]}
            ]},
            // texts with an `i18n` key are filled in by I18n.apply() (see refreshStrings)
            {kind: ToggleItem, name: 'autostart', allowHtml: true, disabled: true, onchange: 'autostartToggle'},
            {kind: Item, components: [
              titleRow('clock', {kind: Marquee.Text, i18n: 'applyTemp'}),
              {kind: BodyText, style: DESC_STYLE, i18n: 'applyTempInfo'}
            ], ontap: 'temporaryApply'},
            {kind: ExpandablePicker, name: 'source', onChange: 'selectSource', components: [
              {content: 'FullHD (H265)', value: 'url-1080-SDR'},
              {content: 'FullHD (H264)', value: 'url-1080-H264'},
              {content: 'FullHD Dolby Vision (HEVC)', value: 'url-1080-HDR'},
              {content: '4k (HEVC)', value: 'url-4K-SDR'},
              {content: '4k Dolby Vision (HEVC)', value: 'url-4K-HDR'},
              {i18n: 'format240', value: 'url-4K-SDR-240FPS'}
            ]},
            {kind: Item, components: [
              titleRow('playlist', {kind: Marquee.Text, i18n: 'playlist'}),
              {kind: BodyText, style: DESC_STYLE, name: 'videoSelectInfo', i18n: 'playlistInfo'}
            ], ontap: 'openVideoSelect'},
            {kind: ToggleItem, name: 'playLowerQuality', allowHtml: true, onchange: 'playLowerQualityToggle'},
            {kind: Item, components: [
              titleRow('display', {kind: Marquee.Text, i18n: 'osd'}),
              {kind: BodyText, style: DESC_STYLE, name: 'displayInfo', content: ''}
            ], ontap: 'openDisplay'},
            {kind: Item, components: [
              titleRow('shield', {kind: Marquee.Text, name: 'protectionTitle'}),
              {kind: BodyText, style: DESC_STYLE + ' white-space: nowrap; overflow: hidden; text-overflow: ellipsis;', name: 'protectionInfo', content: ''}
            ], ontap: 'openProtection'},
            {style: 'margin: 28px 0 0', components: [
              {kind: Button, style: 'margin: 0', i18n: 'testRun', ontap: 'testRun'}
            ]}
          ]}
        ]}
      ]},
      // bottom block: its height changes with the text, so every text change calls refit()
      {components: [
        {kind: Divider, i18n: 'result'},
        {kind: BodyText, name: 'result', content: ''}
      ]}
    ]},
    // compatibility report card: not full screen, data on the left, QR code on the right,
    // footer with the Update button (only when a newer version exists) and Close
    {kind: Popup, name: 'reportPopup', centered: true, floating: true, modal: true, autoDismiss: true,
      style: 'width: 1280px; max-width: 94%; padding: 22px 44px 20px; background: ' + Theme.MODAL_BG + '; color: ' + Theme.TEXT + '; border: ' + Theme.MODAL_BORDER_PX + 'px solid ' + Theme.MODAL_BORDER + '; border-radius: ' + Theme.MODAL_RADIUS + 'px;', components: [
      {style: 'position: relative; padding-bottom: 16px; border-bottom: 2px solid ' + Theme.RULE + ';', components: [
        {name: 'reportTitle', style: 'font-size: 36px; font-weight: bold; color: #fff;', content: ''},
        {style: 'position: absolute; left: 0; bottom: -2px; width: 120px; height: 2px; background: ' + ACCENT + ';'}
      ]},
      {style: 'display: flex; align-items: stretch; margin: 14px 0 0;', components: [
        // left: data rows on top, the hint card pinned to the bottom (level with the QR caption)
        {style: 'flex: 1 1 auto; min-width: 0; margin-right: 52px; display: flex; flex-direction: column;', components: [
          {style: 'margin: 0 0 22px;', components: [infoRow('rModel'), infoRow('rWebos'), infoRow('rFirmware'), infoRow('rApp')]},
          {kind: BodyText, name: 'reportHint', style: 'margin: auto 0 0; padding: 16px 22px; background: ' + Theme.CARD + '; border-radius: 12px; font-size: 26px; line-height: 1.4; color: #b4b4b9;', content: ''}
        ]},
        {name: 'qrCol', style: 'flex: none; text-align: center;', components: [
          {name: 'qr', allowHtml: true, style: 'line-height: 0; border-radius: 14px; overflow: hidden;', content: ''},
          {name: 'reportCaption', allowHtml: true, style: 'margin: 14px 0 0; font-size: 24px; line-height: 1.35; color: ' + Theme.MUTED + '; text-align: center;', content: ''}
        ]}
      ]},
      {style: 'display: flex; align-items: center; margin: 18px 0 0; padding-top: 18px; border-top: 2px solid ' + Theme.RULE + ';', components: [
        {name: 'reportUpdateBox', showing: false, style: 'flex: 1 1 auto; min-width: 0; margin-right: 24px;', components: [
          {tag: 'span', name: 'reportUpdateText', style: 'font-size: 24px; font-weight: bold; color: ' + ACCENT + '; margin-right: 22px; vertical-align: middle;'},
          {kind: Button, name: 'reportUpdate', small: true, style: 'margin: 0; vertical-align: middle;', ontap: 'openHbChannel'}
        ]},
        {kind: Button, name: 'notesBtn', small: true, showing: false, style: 'flex: none; margin: 0 0 0 auto;', ontap: 'openNotes'},
        {kind: Button, name: 'reportClose', small: true, style: 'flex: none; margin: 0 0 0 16px;', ontap: 'closeReport'}
      ]}
    ]},
    // release notes: a separate card, so the report card always fits on the screen
    {kind: Popup, name: 'notesPopup', centered: true, floating: true, modal: true, autoDismiss: true,
      style: 'width: 1100px; max-width: 94%; padding: 28px 44px 24px; background: ' + Theme.MODAL_BG + '; color: ' + Theme.TEXT + '; border: ' + Theme.MODAL_BORDER_PX + 'px solid ' + Theme.MODAL_BORDER + '; border-radius: ' + Theme.MODAL_RADIUS + 'px;', components: [
      {name: 'notesTitle', style: 'font-size: 34px; font-weight: bold; color: ' + ACCENT + '; margin: 0 0 14px;'},
      // message shown instead of the text while it is being translated
      {name: 'notesWait', showing: false, style: 'height: 160px; display: flex; align-items: center; justify-content: center; background: ' + Theme.CARD + '; border-radius: 12px;', components: [
        {name: 'notesSpinner', style: 'font-size: 28px; color: ' + Theme.MUTED + ';', content: ''}
      ]},
      {kind: Scroller, name: 'notesScroller', horizontal: 'hidden', style: 'height: ' + NOTES_MAX_PX + 'px; background: ' + Theme.CARD + '; border-radius: 12px;', components: [
        // focusable so the remote can scroll it: Up / Down move the text, and leave it at the ends
        {name: 'notes', allowHtml: true, spotlight: true, onSpotlightUp: 'notesUp', onSpotlightDown: 'notesDown',
          onSpotlightFocused: 'notesFocused', onSpotlightBlur: 'notesBlurred',
          style: 'padding: 14px 24px; font-size: 24px; line-height: 1.4; color: #d6d6db; outline: 3px solid transparent; border-radius: 12px;', content: ''}
      ]},
      {style: 'display: flex; margin: 18px 0 0; padding-top: 18px; border-top: 2px solid ' + Theme.RULE + ';', components: [
        {kind: Button, name: 'notesClose', small: true, style: 'margin: 0 0 0 auto;', ontap: 'closeNotes'}
      ]}
    ]},
    {kind: LunaService, name: 'statusCheck', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec', onResponse: 'onStatusCheck', onError: 'onStatusCheck'},
    {kind: LunaService, name: 'exec', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec', onResponse: 'onExec', onError: 'onExec'},
    {kind: LunaService, name: 'init', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec', onResponse: 'onInit', onError: 'onInit'},
    {kind: LunaService, name: 'restore', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec'},
    {kind: LunaService, name: 'sysinfo', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec', onResponse: 'onSysInfo', onError: 'onSysInfo'},
    {kind: LunaService, name: 'locale', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec', onResponse: 'onLocale', onError: 'onLocale'},
    // covers the whole panel until the settings are read (see hideSplash), so the half-filled panel is never seen
    {name: 'splash', style: 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 1000; ' +
      'background: #000 url(assets/imageForRecents.png) center / contain no-repeat;'}
  ],

  bindings: [],

  create: function () {
    this.inherited(arguments);
    // Until the settings are read the interface follows the TV (browser) language.
    this.guessLang = this.langFor(navigator.language);
    this.splashDone = false;
    this.startJob('splashSafety', 'hideSplash', 10000);   // never stay on the splash if loading hangs
    // Nothing else starts before the translations are there, so no message is ever shown as a bare key.
    I18n.load(this.bindSafely('begin'));
  },

  // value of the DisplayPanel.LANGUAGES entry that fits a system locale tag; en-US if there is none
  langFor: function (tag) {
    var i = DisplayPanel.matchLocale(tag);
    return i >= 0 ? DisplayPanel.LANGUAGES[i].value : I18n.DEFAULT_LANG;
  },

  begin: function () {
    var header = this.$.source.$.header;   // ExpandableListItemHeader: label ($.header) and current value ($.text)
    header.$.header.set('allowHtml', true);   // the label carries the icon
    header.$.text.applyStyle('margin-left', (ICON_SIZE + ICON_GAP) + 'px');   // value under the label text, not the icon
    header.$.text.applyStyle('font-size', DESC_FONT);   // same size as the descriptions of the other items
    I18n.setLang(this.guessLang);
    this.refreshStrings();
    // Two sources, merged when both have answered:
    //  packaged  - assets/settings.json of the installed app (defaults, may bring new keys after an update)
    //  persisted - copy in /var/lib/webosbrew/..., survives reinstall / update; wins over packaged
    this.sources = {};
    this.loaded = false;
    this.persistBroken = false;
    this.$.statusCheck.send({
      command: 'readlink ' + linkPath
    });
    this.loadSettingsLocal();
    // A missing file is a normal answer (empty output, exit 0), so a real failure can be told apart from it
    this.$.init.send({
      command: 'if [ -f ' + SettingsStore.persistPath + ' ]; then cat ' + SettingsStore.persistPath + '; else echo; fi'
    });
    this.startJob('settingsTimeout', 'settingsTimeout', 5000);
    this.loadVersion();
    this.loadDeviceInfo();
  },

  // (re)write every translated text; called when the language changes
  refreshStrings: function () {
    I18n.apply(this);
    this.$.autostart.set('content', iconLabel('power', I18n.t('autostart')));
    this.$.source.set('content', iconLabel('video', I18n.t('videoFormat')));
    this.$.playLowerQuality.set('content', iconLabel('uturn', I18n.t('fallbackSdr')));
    this.$.protectionTitle.set('content', tr('protection', 'Panel protection'));
    this.updateProtectionInfo();
    if (!this.resultShown) {
      this.$.result.set('content', I18n.t('nothing'));
      this.$.result.applyStyle('opacity', 0.45);   // the empty state is quiet; a real message is full strength
    }
    this.renderVersion();
    this.updateDisplayInfo();
    this.updateLangLink();
    this.refit();
  },

  // FittableRows lays out once at render time and does not notice that the text of the bottom block (or
  // the wrapping of the version line) changed afterwards: recalculate after the DOM has been updated.
  refit: function () {
    this.startJob('refit', function () {
      if (this.$.rows) { this.$.rows.reflow(); }
    }, 0);
  },

  // the name of the language in use, in that language (the globe icon stands for "interface language")
  updateLangLink: function () {
    var lang = I18n.getLang(),
      item = DisplayPanel.LANGUAGES.filter(function (l) { return l.value === lang; })[0];
    this.$.langText.set('content', item ? item.content : lang);
  },

  // the result box: once it shows a real message it is no longer replaced by the "nothing yet" text
  setResult: function (text) {
    this.resultShown = true;
    this.$.result.applyStyle('opacity', null);
    this.$.result.set('content', text);
    this.refit();
  },

  // The app's own files are readable without the luna service
  loadSettingsLocal: function () {
    var self = this, xhr = new XMLHttpRequest();
    xhr.open('GET', 'assets/settings.json');
    xhr.onload = function () {
      var data = null;
      if (xhr.status === 200 || (xhr.status === 0 && xhr.responseText)) {
        try {
          data = JSON.parse(xhr.responseText);
        } catch (e) {
          console.error(e);
        }
      }
      self.gotSettings('packaged', data);
    };
    xhr.onerror = function () { self.gotSettings('packaged', null); };
    xhr.send();
  },

  gotSettings: function (name, data) {
    if (this.loaded) { return; }
    this.sources[name] = data || false;
    this.finishLoading(false);
  },

  settingsTimeout: function () {
    this.finishLoading(true);
  },

  finishLoading: function (force) {
    var src = this.sources, merged = {};
    if (this.loaded) { return; }
    if (!force && (src.packaged === undefined || src.persisted === undefined)) { return; }
    this.loaded = true;
    this.stopJob('settingsTimeout');
    if (!src.packaged && !src.persisted) {
      this.setResult(I18n.t('settingsReadFail'));
      this.useUiLang();
      this.hideSplash();
      return;
    }
    [src.packaged, src.persisted].forEach(function (o) {
      if (o) { Object.keys(o).forEach(function (k) { merged[k] = o[k]; }); }
    });
    this.applySettings(merged);
    // Bring both copies in line: after a reinstall the app directory holds the default file, the persistent
    // one is restored there; on the first run after this feature appeared the persistent copy gets created.
    // Skipped if the persistent read did not finish or the file is broken: never overwrite what was not read.
    if (src.persisted !== undefined && !this.persistBroken) {
      if (src.persisted === false || !settings.uiLang) {
        // very first run (or the first run after the interface language appeared): pick the languages
        // first, the copies are written after that
        this.detectLocale(src.persisted === false);
      } else {
        this.writeCopies();
        this.hideSplash();
      }
    } else {
      this.hideSplash();   // nothing to write or detect: the panel is ready
    }
  },

  // fade the splash out once the panel shows the read settings
  hideSplash: function () {
    var splash = this.$.splash;
    if (this.splashDone) { return; }
    this.splashDone = true;
    this.stopJob('splashSafety');
    if (!splash) { return; }
    splash.applyStyle('transition', 'opacity 250ms ease-out');
    splash.applyStyle('opacity', 0);
    this.startJob('hideSplash', function () {
      if (this.$.splash) { this.$.splash.set('showing', false); }
    }, 300);
  },

  writeCopies: function () {
    this.$.restore.send({command: SettingsStore.saveCommand(settings)});
  },

  // The languages follow the TV's UI language (if it is in the list), otherwise the defaults stay.
  //  firstRun: the OSD text language is picked as well; otherwise (an update of an existing install)
  //  the interface language is picked, and the OSD language only if it still equals the default of the
  //  packaged settings.json (so a language the user chose on purpose is left alone, an untouched default
  //  follows the TV).
  detectLocale: function (firstRun) {
    this.localeDone = false;
    this.localeFirstRun = !!firstRun;
    this.localeBefore = settings.localeLang;
    this.localeDefault = this.sources && this.sources.packaged ? this.sources.packaged.localeLang : undefined;
    this.$.locale.send({
      command: "luna-send -n 1 'luna://com.webos.settingsservice/getSystemSettings' '{\"keys\":[\"localeInfo\"]}'"
    });
    this.startJob('localeTimeout', 'onLocale', 3000);
  },

  onLocale: function (sender, evt) {
    var tag, i, osdAuto;
    if (this.localeDone) { return; }
    this.localeDone = true;
    this.stopJob('localeTimeout');
    try {
      // {"settings":{"localeInfo":{"locales":{"UI":"ko-KR"}}},"returnValue":true}
      tag = JSON.parse(evt.stdoutString).settings.localeInfo.locales.UI;
    } catch (e) {
      tag = navigator.language;   // service unavailable or unexpected answer
    }
    i = DisplayPanel.matchLocale(tag);
    // OSD language: untouched in the meantime (the user may have opened the display options already)
    osdAuto = this.localeFirstRun || (this.localeDefault !== undefined && settings.localeLang === this.localeDefault);
    if (osdAuto && i >= 0 && settings.localeLang === this.localeBefore) {
      settings.localeLang = DisplayPanel.LANGUAGES[i].value;
      settings.localeLangIndex = i;
      this.updateDisplayInfo();
    }
    // interface language: always stored, so the detection does not run again (no match -> English)
    if (!settings.uiLang) {
      settings.uiLang = i >= 0 ? DisplayPanel.LANGUAGES[i].value : I18n.DEFAULT_LANG;
      this.useUiLang();
    }
    this.writeCopies();
    this.hideSplash();
  },

  // show the interface in settings.uiLang (or in the guess while it is not known yet)
  useUiLang: function () {
    var lang = settings.uiLang || this.guessLang;
    I18n.setLang(lang);
    this.fadeStrings();
    // the release notes are translated in the background as soon as the language is known (no-op if there is
    // no update, the notes have not arrived yet or the language is English)
    this.translateNotes();
  },

  // The texts are swapped under a short fade-out / fade-in instead of jumping (only once the panel is on
  // screen; before that they are simply written).
  fadeStrings: function () {
    var parts = this.fadeParts();
    if (!parts.length) { this.refreshStrings(); return; }
    parts.forEach(function (c) { c.applyStyle('transition', 'opacity 150ms ease-out'); c.applyStyle('opacity', 0); });
    this.startJob('fadeStrings', function () {
      this.refreshStrings();
      this.fadeParts().forEach(function (c) { c.applyStyle('transition', 'opacity 350ms ease-in'); c.applyStyle('opacity', 1); });
    }, 160);
  },

  fadeParts: function () {
    if (!this.splashDone) { return []; }   // hidden behind the splash: write the texts without fading
    return [this.$.content, this.$.header].filter(function (c) { return c && c.hasNode(); });
  },

  // the user picked a language in the language list
  languagePicked: function (value) {
    if (!value || value === I18n.getLang()) { return; }
    settings.uiLang = value;
    this.useUiLang();
    if (settings.sourceType) { this.settingsSave(); }   // never write settings that were not read
  },

  // Installed version comes from the app's own appinfo.json (readable without the luna service)
  loadVersion: function () {
    var self = this, xhr = new XMLHttpRequest();
    xhr.open('GET', 'appinfo.json');
    xhr.onload = function () {
      try {
        var info = JSON.parse(xhr.responseText);
        self.version = info.version;
        if (info.id) { self.appId = info.id; }
      } catch (e) {
        console.error(e);
      }
      if (self.version) {
        self.renderVersion();
        self.checkUpdate();
      }
    };
    xhr.send();
  },

  // "Version 1.2.3", or the highlighted "update available" line (accent color, bold) if a newer release exists.
  // The accent-colored text would vanish on the accent-colored focus background, so it is white while focused.
  renderVersion: function () {
    var info = this.$.versionInfo;
    if (!this.version) { return; }
    if (this.latest) {
      info.set('content', I18n.t('updateAvailable', {version: this.version, latest: this.latest}));
      info.applyStyle('font-weight', 'bold');
    } else {
      info.set('content', I18n.t('version', {version: this.version}));
    }
    this.paintVersion();
    this.refit();
  },

  // text, icon and chevron of the version line share one color: the accent while an update is available
  // (the accent would vanish on the accent-colored focus background, so it is white while focused)
  paintVersion: function () {
    var color = this.latest ? (this.versionFocus ? '#fff' : ACCENT) : null;
    ['versionInfo', 'versionIcon', 'versionChev'].forEach(function (n) { this.$[n].applyStyle('color', color); }, this);
  },

  versionFocused: function () {
    this.versionFocus = true;
    this.paintVersion();
  },

  versionBlurred: function () {
    this.versionFocus = false;
    this.paintVersion();
  },

  // Compares with the version listed in the webosbrew (Homebrew Channel) repository; the update is offered
  // in the report card (opened by tapping the version line) only if it is newer. Failures (no network, timeout, unexpected format) are silent.
  checkUpdate: function () {
    var self = this, xhr = new XMLHttpRequest();
    xhr.open('GET', repoApi);
    xhr.timeout = 10000;
    xhr.onload = function () {
      var latest, id = self.appId || appId, pkgs, i;
      if (xhr.status !== 200) { self.loadNotes(); return; }   // no repository answer: the changelog is still shown
      try {
        pkgs = JSON.parse(xhr.responseText).packages || [];
        for (i = 0; i < pkgs.length; i++) {
          if (pkgs[i].id === id) {
            latest = pkgs[i].manifest && pkgs[i].manifest.version;
            break;
          }
        }
      } catch (e) {
        console.error(e);
        self.loadNotes();
        return;
      }
      if (latest && compareVersions(latest, self.version) > 0) {
        self.latest = String(latest).replace(/^v/i, '');
        self.loadNotes();
        self.renderVersion();
        self.refit();
        if (self.$.reportPopup && self.$.reportPopup.showing) { self.refreshReport(); }
      } else {
        self.loadNotes();   // up to date: the button shows the changelog of all versions
      }
    };
    xhr.onerror = xhr.ontimeout = function () { console.info('Update check failed'); self.loadNotes(); };
    xhr.send();
  },

  // Release notes: one request for the list of releases, then the ones from the installed version up to the
  // offered one are rendered (the repository index lags behind GitHub, so newer ones are left out). Silent on failure:
  // the card is then the same as before.
  loadNotes: function () {
    var self = this, xhr, stamp = this.version + '>' + (this.latest || '');
    if (this.notesLoading) { return; }
    if (this.notesHtml && this.notesStamp === stamp) { return; }   // already loaded for these versions
    this.notesHtml = '';                                          // versions changed: never show the old notes
    this.notesLoading = true;
    xhr = new XMLHttpRequest();
    xhr.open('GET', releasesApi);
    xhr.setRequestHeader('Accept', 'application/vnd.github+json');
    xhr.timeout = 10000;
    xhr.onload = function () {
      var list;
      self.notesLoading = false;
      if (xhr.status !== 200) { return; }
      if (stamp !== self.version + '>' + (self.latest || '')) { self.loadNotes(); return; }   // changed while loading
      try {
        // update available: the releases after the installed one; otherwise all releases up to the installed one
        list = ReleaseNotes.select(JSON.parse(xhr.responseText), self.latest ? self.version : '0', self.latest || self.version, compareVersions);
        self.notesHtml = list.length ? ReleaseNotes.render(list, !self.latest) : '';
        self.notesStamp = stamp;
        self.translateNotes();
      } catch (e) {
        console.error(e);
        return;
      }
      if (self.$.reportPopup && self.$.reportPopup.showing) { self.showNotes(); }
    };
    xhr.onerror = xhr.ontimeout = function () { self.notesLoading = false; console.info('Release notes failed'); };
    xhr.send();
  },

  // the "What's new" button of the report card (only while an update with notes exists) + the text of the notes card
  showNotes: function () {
    var on = !!this.notesHtml, label = tr('whatsNew', 'What\u2019s new') + (this.latest ? ' \u00b7 ' + this.latest : '');
    this.$.notesBtn.set('showing', on);
    if (!on) { return; }
    this.$.notesBtn.set('content', label);
    this.$.notesTitle.set('content', label);
    this.$.notesClose.set('content', tr('reportClose', 'Close'));
    this.$.notes.set('content', this.notesText());
    // while the translation is running a message replaces the (English) text
    this.$.notesSpinner.set('content', tr('translating', 'Translating\u2026'));
    this.$.notesWait.set('showing', this.notesWaiting);
    this.$.notesScroller.set('showing', !this.notesWaiting);
    if (this.$.notesPopup.showing && !this.notesWaiting) { this.startJob('notesFit', 'fitNotes', 60); }
  },

  // ---- release notes translation -------------------------------------------------------------------------
  // The notes are written in English on GitHub. For any other interface language the text nodes of the rendered
  // HTML are translated over the internet (once per version and language, then cached in localStorage). Until the
  // translation is ready, or if it fails (offline, blocked), the English text is shown as before.

  // translation service language code for the interface language, '' for English
  notesTl: function () {
    var tag = String(I18n.getLang() || 'en').replace('_', '-'), base = tag.split('-')[0].toLowerCase();
    if (base === 'en') { return ''; }
    if (base === 'zh') { return /-(tw|hk|mo|hant)/i.test(tag) ? 'zh-TW' : 'zh-CN'; }
    if (base === 'nb' || base === 'nn') { return 'no'; }
    if (base === 'he') { return 'iw'; }
    return base;
  },

  // Cache key of the translated notes. It holds everything the translation depends on: the installed version and
  // the offered one (they decide which releases are in the notes), the language, and a hash of the English notes
  // (so a release page edited on GitHub is translated again). Anything that changes -> a fresh translation.
  notesKey: function (tl) {
    var s = String(this.notesHtml || ''), h = 5381, i;
    for (i = 0; i < s.length; i++) { h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; }
    return this.version + '>' + (this.latest || '') + '|' + tl + '|' + h.toString(36);
  },

  // drops the stored translations of other versions / texts (other languages of the same notes stay)
  pruneNotesCache: function (keep) {
    var keys = [], i, k, a = keep.split('|'), b;
    try {
      for (i = 0; i < window.localStorage.length; i++) {
        k = window.localStorage.key(i);
        if (!k || k.indexOf('notesTr:') !== 0) { continue; }
        b = k.slice(8).split('|');
        if (b[0] !== a[0] || b[2] !== a[2]) { keys.push(k); }
      }
      keys.forEach(function (k) { window.localStorage.removeItem(k); });
    } catch (e) { /* no storage */ }
  },

  notesText: function () {
    var tl = this.notesTl(), key = this.notesKey(tl), html;
    this.notesWaiting = false;
    if (!tl) { return this.notesHtml; }
    html = (this.notesTrCache || {})[key];
    if (!html) {
      try { html = window.localStorage.getItem('notesTr:' + key); } catch (e) { html = null; }
      if (html) { (this.notesTrCache = this.notesTrCache || {})[key] = html; }
    }
    if (html) { return html; }
    this.translateNotes();
    this.notesWaiting = (this.notesTrState || {})[key] === 'run';
    return (!this.notesWaiting && (this.notesPartial || {})[key]) || this.notesHtml;
  },

  // Translates the notes line by line: a whole line (with its bold / code marked up as placeholders) goes to the
  // service as one sentence, so the grammar comes out right; see noteSerialize / noteRebuild above.
  translateNotes: function () {
    var self = this, tl = this.notesTl(), key = this.notesKey(tl), box, blocks, next = 0, active = 0, failed = 0, finished = false;
    if (!tl || !this.notesHtml || !settings.uiLang) { return; }   // uiLang: language is final
    this.notesTrState = this.notesTrState || {};
    if (this.notesTrState[key] === 'failed' && this.notesRetryOk) { delete this.notesTrState[key]; }   // user opened the notes again
    if (this.notesTrState[key]) { return; }                    // running, done or failed in this session
    if ((this.notesTrCache || {})[key]) { return; }
    try { if (window.localStorage.getItem('notesTr:' + key)) { return; } } catch (e) { /* no storage */ }
    this.notesTrState[key] = 'run';

    box = document.createElement('div');
    box.innerHTML = this.notesHtml;
    blocks = Array.prototype.slice.call(box.children);

    function finish() {
      var html;
      if (finished) { return; }
      finished = true;
      html = box.innerHTML;
      if (failed) {
        // some lines could not be translated even after retries: show what we have (the rest stays English),
        // keep it in memory only, so the next start tries again
        console.info('Notes translation incomplete: ' + failed + ' of ' + blocks.length + ' lines failed');
        if (failed < blocks.length) { (self.notesPartial = self.notesPartial || {})[key] = html; }
        self.notesTrState[key] = 'failed';
        if (self.notesTl() === tl && self.$.notesBtn.showing) { self.showNotes(); }
        return;
      }
      self.notesTrState[key] = 'done';
      (self.notesTrCache = self.notesTrCache || {})[key] = html;
      try { window.localStorage.setItem('notesTr:' + key, html); } catch (e) { /* no storage */ }
      self.pruneNotesCache(key);
      if (self.notesTl() === tl && self.$.notesBtn.showing) { self.showNotes(); }
    }
    function pump() {
      while (active < 3 && next < blocks.length) {
        active++;
        noteTranslateBlock(tl, blocks[next++], function (ok) {
          if (!ok) { failed++; }
          active--;
          pump();
        });
      }
      if (!active && next >= blocks.length) { finish(); }
    }
    pump();
  },

  openNotes: function () {
    this.notesRetryOk = true;
    this.notesText();
    this.notesRetryOk = false;
    this.$.reportPopup.hide();
    this.$.notesPopup.show();
    // the area is as high as the text, up to NOTES_MAX_PX; measured once the text is in the page
    this.startJob('notesFit', 'fitNotes', 60);
  },

  closeNotes: function () {
    this.$.notesPopup.hide();
    this.openReport();
  },

  fitNotes: function () {
    if (this.notesWaiting) { return; }
    var node = this.$.notes.hasNode(), h = node ? Math.min(NOTES_MAX_PX, node.scrollHeight) : NOTES_MAX_PX;
    this.$.notesScroller.applyStyle('height', h + 'px');
    this.$.notesScroller.resized();
  },

  // Up / Down scroll the notes while there is more text that way; at the ends the focus moves on
  notesScrollBy: function (dy) {
    var sc = this.$.notesScroller, b = sc.getScrollBounds(), y = Math.max(0, Math.min(b.maxTop, b.top + dy));
    if (y === b.top) { return false; }
    sc.scrollTo(b.left, y);
    return true;
  },
  notesUp: function () { return this.notesScrollBy(-140); },
  notesDown: function () { return this.notesScrollBy(140); },
  notesFocused: function () { this.$.notes.applyStyle('outline-color', ACCENT); },
  notesBlurred: function () { this.$.notes.applyStyle('outline-color', 'transparent'); },

  // TV model, firmware and webOS release for the report card. Read once at startup (so the card opens at once):
  //  model / firmware / sdk version: the system property service; webOS release: nyx os_info.json
  loadDeviceInfo: function () {
    this.$.sysinfo.send({
      command: "luna-send -n 1 'luna://com.webos.service.tv.systemproperty/getSystemInfo' " +
        "'{\"keys\":[\"modelName\",\"firmwareVersion\",\"sdkVersion\"]}'; echo '@@'; cat /var/run/nyx/os_info.json 2>/dev/null"
    });
  },

  onSysInfo: function (sender, evt) {
    console.info('sysinfo', evt);
    var parts = String((evt && evt.stdoutString) || '').split('@@'), sys = {}, os = {};
    try { sys = JSON.parse(parts[0]) || {}; } catch (e) { console.info('getSystemInfo: no data'); }
    try { os = JSON.parse(parts[1]) || {}; } catch (e) { console.info('os_info.json: no data'); }
    this.device = {
      model: sys.modelName || '',
      firmware: sys.firmwareVersion || '',
      release: os.webos_release || sys.sdkVersion || ''
    };
    if (this.$.reportPopup && this.$.reportPopup.showing) { this.refreshReport(); }
  },

  // link to the issue form with the fields that are known already filled in (the user picks the status)
  reportUrl: function () {
    var d = this.device || {}, params = [
      ['tv_model', d.model], ['webos', webosLabel(d.release)], ['webos_full', d.release], ['firmware', d.firmware],
      ['aerial', this.version]
    ];
    return REPORT_URL + params.filter(function (p) { return p[1]; }).map(function (p) {
      return '&' + p[0] + '=' + encodeURIComponent(p[1]).replace(/%20/g, '+');
    }).join('');
  },

  // fills the card: texts in the current language, device data, QR code
  refreshReport: function () {
    var d = this.device, none = '\u2014', qr = null;
    this.$.reportTitle.set('content', tr('reportTitle', 'Compatibility feedback'));
    this.$.rModelLabel.set('content', tr('reportModel', 'TV model'));
    this.$.rWebosLabel.set('content', 'webOS');
    this.$.rFirmwareLabel.set('content', tr('reportFirmware', 'Firmware'));
    this.$.rAppLabel.set('content', tr('reportApp', 'App version'));
    this.$.rModel.set('content', (d && d.model) || (d ? none : '\u2026'));
    this.$.rWebos.set('content', d && d.release ? 'webOS ' + d.release : (d ? none : '\u2026'));
    this.$.rFirmware.set('content', (d && d.firmware) || (d ? none : '\u2026'));
    this.$.rApp.set('content', this.version || none);
    this.$.reportHint.set('content', tr('reportHint',
      'Scan the QR code with your phone: the form opens with this data filled in. Choose the status and send it.'));
    this.$.reportCaption.set('allowHtml', true);
    this.$.reportCaption.set('content', tr('reportCaption', 'Feedback on compatibility (GitHub issue)') +
      '<br /><span style="color: #fff;">' + REPORT_SHORT + '</span>');
    this.$.reportClose.set('content', tr('reportClose', 'Close'));
    // the same Update button as on the main screen, only while a newer version exists
    this.$.reportUpdateBox.set('showing', !!this.latest);
    if (this.latest) {
      this.$.reportUpdateText.set('content', I18n.t('updateAvailable', {version: this.version, latest: this.latest}));
      this.$.reportUpdate.set('content', tr('update', 'Update'));
    }
    this.showNotes();
    try {
      qr = QrCode.svg(this.reportUrl(), 'M', 300);
    } catch (e) {
      console.error(e);
    }
    this.$.qr.set('content', qr ? qr.markup : '');
    // the caption wraps at the width of the code
    this.$.qrCol.applyStyle('width', qr ? qr.px + 'px' : 'auto');
  },

  openReport: function () {
    this.refreshReport();
    this.$.reportPopup.show();
  },

  closeReport: function () {
    this.$.reportPopup.hide();
  },

  openHbChannel: function () {
    this.exec("luna-send -n 1 'luna://com.webos.applicationManager/launch' '{\"id\":\"" + hbChannelId + "\"}'");
  },

  applySettings: function (s) {
    // in place: DisplayPanel / VideoSelectPanel hold a reference to this object
    Object.keys(settings).forEach(function (k) { delete settings[k]; });
    Object.keys(s).forEach(function (k) { settings[k] = s[k]; });
    this.$.source.set('selectedIndex', settings.sourceTypeIndex);
    this.$.playLowerQuality.set('checked', settings.playLowerQuality);
    this.settingsApplied = true;
    this.useUiLang();   // also refreshes the summary line
  },

  // summary line under "On-screen display"
  updateDisplayInfo: function () {
    var lang, parts = [];
    if (!this.settingsApplied) {   // settings not read yet: the general description
      this.$.displayInfo.set('content', I18n.t('osdInfo'));
      return;
    }
    lang = DisplayPanel.LANGUAGES.filter(function (l) { return l.value === settings.localeLang; })[0];
    if (lang) { parts.push(lang.content); }
    if (settings.osdOpacitySplit) {   // two opacities: Dolby Vision / HDR and SDR
      parts.push('DV ' + (settings.osdOpacityDv !== undefined ? settings.osdOpacityDv : settings.osdOpacity) + '% / SDR ' +
        (settings.osdOpacity !== undefined ? settings.osdOpacity : 100) + '%');
    } else if (settings.osdOpacity !== undefined) {
      parts.push(I18n.t('opacityShort', {value: settings.osdOpacity}));
    }
    parts.push(I18n.t(settings.debug ? 'debugOn' : 'debugOff'));
    this.$.displayInfo.set('content', parts.join(' \u00b7 '));
    this.refit();
  },

  // answer of reading the persistent settings.json: empty output = no file yet (normal on the first run)
  onInit: function (sender, evt) {
    var data = null;
    console.info(sender, evt);
    if (!evt || !evt.returnValue) {
      // the read itself failed: the file may exist, so it must not be overwritten at startup
      this.persistBroken = true;
    } else if (evt.stdoutString && evt.stdoutString.trim()) {
      try {
        data = JSON.parse(evt.stdoutString);
      } catch (e) {
        this.persistBroken = true;
        this.setResult(I18n.t('badJson', {error: e.message}));
      }
    }
    this.gotSettings('persisted', data);
  },

  testRun: function () {
    this.exec("luna-send -n 1 'luna://com.webos.service.tvpower/power/turnOnScreenSaver' '{}'");
  },

  temporaryApply: function () {
    this.exec(applyPath);
  },

  exec: function (command) {
    console.info(command);
    this.setResult(I18n.t('processing'));
    this.$.exec.send({
      command: command
    });
  },

  onExec: function (sender, evt) {
    var err;
    console.info(evt);
    if (evt.returnValue) {
      // stdout (mount info etc.) is not shown, only logged by console.info(evt) above;
      // stderr is shown if there is any, so warnings are not lost
      err = evt.stderrString && String(evt.stderrString).trim();
      this.setResult(I18n.t('success') + (err ? '<br />' + err : ''));
    } else {
      this.setResult(I18n.t('failed') + ' ' + evt.errorText + ' ' + evt.stdoutString + evt.stderrString);
    }
  },

  onStatusCheck: function (sender, evt) {
    console.info(sender, evt);
    this.$.autostart.set('disabled', false);
    this.$.autostart.set('checked', !!(evt && evt.stdoutString) && evt.stdoutString.trim() == applyPath);
  },

  selectSource: function () {
    var index = this.$.source.get('selectedIndex'), sel = this.$.source.get('selected');
    if (sel && settings.sourceTypeIndex != index) {
      settings.sourceType = sel.value;
      settings.sourceTypeIndex = index;
      this.settingsSave();
    }
  },

  autostartToggle: function (sender) {
    if (sender.active) {
      this.exec('mkdir -p /var/lib/webosbrew/init.d && ln -sf ' + applyPath + ' ' + linkPath);
    } else {
      this.exec('rm -rf ' + linkPath);
    }
  },

  playLowerQualityToggle: function (sender) {
    settings.playLowerQuality = !!sender.active;
    this.settingsSave();
  },

  openVideoSelect: function () {
    console.info('openVideoSelect, settings:', settings);
    if (!settings.sourceType) {
      this.setResult(I18n.t('noSettings'));
      return;
    }
    try {
      this.doRequestPushPanel({panel: {
        kind: VideoSelectPanel,
        settings: settings,
        settingsPath: settingsPath,
        basePath: basePath
      }});
    } catch (e) {
      console.error(e);
      this.setResult(I18n.t('openFail', {error: e.message}));
    }
  },

  openDisplay: function () {
    if (!settings.sourceType) {
      this.setResult(I18n.t('noSettings'));
      return;
    }
    try {
      this.doRequestPushPanel({panel: {
        kind: DisplayPanel,
        settings: settings,
        settingsPath: settingsPath,
        webosRelease: (this.device && this.device.release) || '',
        onChange: this.bindSafely('updateDisplayInfo')
      }});
    } catch (e) {
      console.error(e);
      this.setResult(I18n.t('openFail', {error: e.message}));
    }
  },

  // summary line under "Panel protection": what is switched on with its values ("Brightness 30% · Dimming 10 min ↓20%"),
  // or the general description. It is always one line: if the detailed text is wider than the line, it is replaced by
  // the short one (names only, brightness still with its %); if even that does not fit, the CSS ellipsis cuts it.
  updateProtectionInfo: function () {
    var text = ProtectionPanel.summary(settings, true);
    this.$.protectionInfo.set('content', text || tr('protectionInfo', 'Protects the screen from burn-in'));
    if (text) { this.fitProtectionInfo(true); }
  },

  fitProtectionInfo: function (retry) {
    var info = this.$.protectionInfo, node = info.hasNode();
    if (!node) { return; }
    if (!node.clientWidth) {   // not laid out yet (hidden): measure once more a bit later
      if (retry) { this.startJob('protFit', function () { this.fitProtectionInfo(false); }, 500); }
      return;
    }
    if (node.scrollWidth > node.clientWidth) {
      info.set('content', ProtectionPanel.summary(settings, false));
    }
  },

  openProtection: function () {
    if (!settings.sourceType) {
      this.setResult(I18n.t('noSettings'));
      return;
    }
    try {
      this.doRequestPushPanel({panel: {
        kind: ProtectionPanel,
        settings: settings,
        settingsPath: settingsPath,
        onChange: this.bindSafely('updateProtectionInfo')
      }});
    } catch (e) {
      console.error(e);
      this.setResult(I18n.t('openFail', {error: e.message}));
    }
  },

  openLanguage: function () {
    try {
      this.doRequestPushPanel({panel: {
        kind: LanguagePanel,
        current: I18n.getLang(),
        onChange: this.bindSafely('languagePicked')
      }});
    } catch (e) {
      console.error(e);
      this.setResult(I18n.t('openFail', {error: e.message}));
    }
  },

  settingsSave: function () {
    this.exec(SettingsStore.saveCommand(settings));   // app copy + persistent copy
  }
});
