var
  kind = require('enyo/kind'),
  Panel = require('moonstone/Panel'),
  Scroller = require('moonstone/Scroller'),
  Item = require('moonstone/Item'),
  Button = require('moonstone/Button'),
  BodyText = require('moonstone/BodyText'),
  Marquee = require('moonstone/Marquee'),
  InputDecorator = require('moonstone/InputDecorator'),
  Input = require('moonstone/Input'),
  ExpandablePicker = require('moonstone/ExpandablePicker'),
  Popup = require('moonstone/Popup'),
  ToggleItem = require('moonstone/ToggleItem'),
  SimpleIntegerPicker = require('moonstone/SimpleIntegerPicker'),
  Control = require('enyo/Control'),
  Spotlight = require('spotlight'),
  LunaService = require('enyo-webos/LunaService'),
  SettingsStore = require('./SettingsStore.js'),
  Solar = require('./solar.js'),
  I18n = require('./I18n.js'),
  Theme = require('./Theme.js');

// Toast: bottom center. It is a plain DOM node in the floating layer, NOT an Enyo control inside the
// panel: a control next to the fit:true scroller makes the Fittable layout resize the scroller every
// time the toast is shown / hidden, and the focus then ends up outside of the visible area.
var TOAST_STYLE = 'display:none; position:fixed; left:50%; bottom:50px; -webkit-transform:translateX(-50%); transform:translateX(-50%); ' +
  'z-index:100000; padding:16px 36px; border-radius:40px; font-family:inherit; font-size:30px; color:#fff; white-space:nowrap; ' +
  'background:rgba(0,0,0,0.88); border:2px solid #cf0652; pointer-events:none;';
var TOAST_MS = 5000;

// Scrolling inside a category with groups (Moonstone only scrolls the focused item into view).
// The position depends on the number of tile rows in the group (header + rows = the "block"):
//  - up to CENTER_MAX_ROWS rows: if the whole block is not visible, it is centered in the list
//    (it has to fit, otherwise the next rule applies);
//  - more rows: the header goes to the very top, the rows below it scroll as usual (Moonstone).
// Set HEADER_SCROLL to false for plain Moonstone scrolling.
var HEADER_SCROLL = true;
var CENTER_MAX_ROWS = 2;
var HEADER_PAD = 16;            // free space above the header / minimal space around a centered block
var GROUP_BOTTOM_PAD = 8;       // bottom margin of a tile
var HEADER_SCROLL_DELAY_MS = 300;   // let Moonstone finish its own scroll first

var TILE_STYLE = 'display:inline-block; vertical-align:top; position:relative; width:300px; margin:8px; padding:6px; ';
// Time-of-day icons (sunrise / day / sunset / night): thin line icons drawn for this app (1.5 stroke). They are used on the
// video tiles (watermark) and as the buttons in the preview. Each icon has its own viewBox, so that its drawing is
// centred and fills the square (sunrise / sunset are lower and wider than tall).
var TOD_KINDS = ['sunrise', 'day', 'sunset', 'night'];
var TOD_HORIZON = 'M2 20h20M5 23h14M7.5 20a4.5 4.5 0 0 1 9 0M16.95 15.05L18.7 13.3M7.05 15.05L5.3 13.3';
var TOD_DEFS = {
  day: {vb: '0 0 24 24', body: '<circle cx="12" cy="12" r="4.5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/>'},
  // crescent and two small sparkles in its opening
  night: {vb: '0 0 24 24', body: '<path d="M11.19 3.6A9 9 0 1 0 21.19 14.84A7.6 7.6 0 0 1 11.19 3.6z"/>' +
    '<path fill="#fff" stroke-width="1" d="M16.6 6.2Q17.348 8.852 20 9.6Q17.348 10.348 16.6 13Q15.852 10.348 13.2 9.6Q15.852 8.852 16.6 6.2z"/>' +
    '<path fill="#fff" stroke-width="1" d="M20.6 2.3Q21.062 3.938 22.7 4.4Q21.062 4.862 20.6 6.5Q20.138 4.862 18.5 4.4Q20.138 3.938 20.6 2.3z"/>'},
  // half sun on the horizon with a short arrow: up = sunrise, down = sunset
  sunrise: {vb: '1 4.5 22 22', body: '<path d="' + TOD_HORIZON + 'M12 13V8M8.5 11.5L12 8l3.5 3.5"/>'},
  sunset: {vb: '1 4.5 22 22', body: '<path d="' + TOD_HORIZON + 'M12 8v5M8.5 9.5L12 13l3.5-3.5"/>'}
};
// the svg is placed by coordinates (no flex: the TV's browser is old): `size` px, centred in a `box` px square
function todIcon(kind, box, size) {
  var d = TOD_DEFS[kind], off = Math.round((box - size) / 2);
  if (!d) { return ''; }
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="' + d.vb + '" fill="none" stroke="#fff" ' +
    'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="position:absolute; left:' + off + 'px; top:' + off +
    'px; display:block">' + d.body + '</svg>';
}

var CAT_TILE_STYLE = 'display:inline-block; vertical-align:top; position:relative; width:470px; margin:10px; padding:6px; ';
// 75 -> "1:15", 3725 -> "1:02:05"
function formatTime(sec) {
  var t = Math.max(0, Math.floor(sec || 0)), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), r = t % 60;
  function two(x) { return (x < 10 ? '0' : '') + x; }
  return h ? h + ':' + two(m) + ':' + two(r) : m + ':' + two(r);
}

// focus zoom of the preview badges only. Tiles have just the plain Moonstone highlight: a zoom on every
// focus move made scrolling the lists slow on a TV.
var FOCUS_SCALE = 1.05;
var CAT_IMG_RATIO = 0.324;     // category picture height / width
var CAT_SCROLL_RESERVE = 80;   // px of the list width kept free next to the category tiles
var CAT_IMG_STYLE = 'display:block; width:100%; height:250px; object-fit:cover; background:#2d353d;';
var IMG_STYLE = 'display:block; width:100%; height:170px; object-fit:cover; background:#2d353d;';

// subcategories with fewer videos than this are merged into one "Other" group
var MIN_SUB = 3;
var OTHER = '__other';

// Nothing below is a filter: categories, subcategories and sources are all discovered from the
// videos themselves. These lists only set the ORDER of known names; anything not listed (new
// categories / sources) is shown after them, alphabetically. Empty lists are fine.
//
// Data contract (videos.json): {assets: [{id, localizedNameKey | name, source?, categories?: [key],
//   subcategories?: [key], previewImage?, url*: '...', pointsOfInterest?: {seconds: key}}],
//   categories?: [{localizedNameKey, previewImage}]}   <- optional thumbnails of the categories,
//   e.g. {localizedNameKey: 'AerialCategoryCities', previewImage: 'assets/tn/cities.webp'}
//   (a plain map {key: 'path'} works too). No entry / image fails to load -> a random video
//   of the category is used as the thumbnail.
// Names are looked up in assets/locales/<lang>.json ({strings: {key: text}}) for the interface language; a missing
// translation falls back to the asset's `name` or a prettified key.
var DEFAULT_LANG = 'en-GB';

// order of the categories on the first level (others go after these, alphabetically)
var CATEGORY_ORDER = ['AerialCategoryLandscapes', 'AerialCategoryCities', 'AerialCategoryUnderwater',
  'AerialCategorySpace', 'AerialCategoryPatterns', 'AerialCategoryFire'];

// order of sources in the Source picker (others go after these, alphabetically)
var SOURCE_ORDER = ['Apple Aerials', 'Amazon Fire OS', 'Jetson Creative', 'Robin Fourcade'];

// Night mode: default hours, and which videos the night playlist starts with (the ones Apple and
// Amazon tag "night", plus the ones whose English name says Night)
var NIGHT_START = 22, NIGHT_END = 7;
var NIGHT_NAME = /\bnight\b/i;

// Solar mode: minutes around sunrise / sunset in which the videos tagged sunrise / sunset play
var SOLAR_WINDOW = 60;
// English texts of the solar mode; translated ones are taken from I18n under the same keys when there are any
var SOLAR_STR = {
  solarMode: 'Solar mode', solarModeInfo: 'Plays the videos that fit the time of day (sunrise, day, sunset, night) at your city',
  solarCity: 'City', solarWindow: 'Sunrise and sunset last, minutes',
  solarNoCity: 'Type the name of a city to choose it', solarFetching: 'Getting sunrise and sunset times\u2026',
  solarSunrise: 'Sunrise', solarDay: 'Day', solarSunset: 'Sunset', solarNight: 'Night', solarNow: 'now it is',
  solarPolar: 'the sun does not rise or set here now',
  solarCalculated: 'Times are calculated.', solarOffline: 'No network: the times are calculated, and fetched when it is back.',
  solarTagged: 'Tagged videos:',
  solarTodFailed: 'Could not save videos.json',
  durH: 'h', durMin: 'min',
  reportClose: 'Close',
  solarCityNone: 'No city found', solarCityOffline: 'The city search needs the internet'
};
function st(key) {
  var v;
  try { v = I18n.t(key); } catch (e) { v = null; }
  return (v && typeof v === 'string' && v !== key) ? v : (SOLAR_STR[key] || key);
}

// Playback time of a set of videos. `duration` (whole seconds) comes from videos.json. A video without it counts as 0, and a
// time is shown only when it is above zero: no data, or nothing selected -> nothing is shown.
function durationOf(a) {
  var d = a ? Number(a.duration) : 0;
  return d > 0 && isFinite(d) ? d : 0;
}
// 2429 -> "40 min", 5158 -> "1 h 26 min" (the units come from I18n keys durMin / durH, English by default)
function formatTotal(sec) {
  var m = Math.max(1, Math.round(sec / 60)), h = Math.floor(m / 60), r = m % 60;
  if (!h) { return m + ' ' + st('durMin'); }
  return h + ' ' + st('durH') + (r ? ' ' + r + ' ' + st('durMin') : '');
}
// "6 / 6" -> "6 / 6 \u00b7 40 min"; unchanged when no video is selected or none of the selected ones has a duration
function withTime(text, sec, on) {
  return on > 0 && sec > 0 ? text + ' \u00b7 ' + formatTotal(sec) : text;
}

// Whether the screensavers can play a video with the chosen format (same rules as pickSourceKey in
// web-screensaver.html and playRandomVideo in screensaver-main.qml)
function playableWith(a, s) {
  var type = s.sourceType;
  if (a[type]) { return true; }
  if (!s.playLowerQuality) { return false; }
  if (type === 'url-4K-HDR') { return !!a['url-4K-SDR']; }
  if (type === 'url-1080-HDR') { return !!(a['url-1080-SDR'] || a['url-1080-H264']); }
  return false;
}

function hourOr(v, def) {
  v = parseInt(v, 10);
  return v >= 0 && v <= 23 ? v : def;
}

// how long OK / click has to be held to start a preview
var LONG_PRESS_MS = 600;

// give up on a preview source after this long without playback and try the next one
var PREVIEW_TIMEOUT_MS = 15000;
// how long the hint under the badges (choose variant / OK / Back) stays on screen
var PREVIEW_HELP_MS = 5000;

// Size and position of the preview window for a screen of vw x vh CSS pixels.
// 16:9 video, never larger than 1280 wide, always inside the screen (30px margin) whatever the
// real viewport is (1920x1080, 1280x720, ...).
var PREVIEW_PAD = 12;     // padding inside the window
var PREVIEW_TEXT = 92;    // two text lines under the video (title + variant)
function previewGeometry(vw, vh) {
  var margin = 30,
    videoW = Math.min(1280, vw - 80) - 2 * PREVIEW_PAD,
    videoH = Math.round(videoW * 9 / 16),
    maxH = vh - 2 * PREVIEW_PAD - PREVIEW_TEXT - 2 * margin,
    w, h;
  if (videoH > maxH) {
    videoH = Math.max(120, maxH);
    videoW = Math.round(videoH * 16 / 9);
  }
  w = videoW + 2 * PREVIEW_PAD;
  h = videoH + PREVIEW_TEXT + 2 * PREVIEW_PAD;
  return {
    videoW: videoW, videoH: videoH, width: w, height: h,
    left: Math.max(0, Math.round((vw - w) / 2)),
    top: Math.max(0, Math.round((vh - h) / 2))
  };
}

// All playable URLs of a video, best preview first: prefers 1080p / SDR / H.264 and avoids
// 4K and HDR/Dolby Vision. The rest follow as fallbacks, so any existing video can be tried.
function previewCandidates(a) {
  var seen = {}, list = [];
  Object.keys(a).forEach(function (k, index) {
    var v = a[k];
    if (!/^url/i.test(k) || typeof v !== 'string' || !v || seen[v]) { return; }
    seen[v] = true;
    list.push({
      key: k,
      url: v,
      index: index,
      score: (/1080/.test(k) ? 2 : 0) + (/sdr/i.test(k) ? 1 : 0) + (/h264|avc/i.test(k) ? 1 : 0) -
        (/4k|2160/i.test(k) ? 2 : 0) - (/hdr|dolby|\bdv\b/i.test(k) ? 3 : 0)
    });
  });
  list.sort(function (x, y) { return (y.score - x.score) || (x.index - y.index); });
  return list;
}

// "url-4K-HDR" -> "4K HDR", "url-1080-H264" -> "1080p H.264", "url-4K-SDR-240FPS" -> "4K SDR 240 FPS"
function describeKey(key) {
  var out = [];
  String(key).replace(/^url[-_]?/i, '').split(/[-_]+/).forEach(function (p) {
    var u = p.toUpperCase(), m;
    if (!p) { return; }
    if (u === '1080' || u === '1080P') { out.push('1080p'); }
    else if (u === '2160' || u === '2160P') { out.push('4K'); }
    else if (u === 'H264' || u === 'AVC') { out.push('H.264'); }
    else if ((m = /^(\d+)FPS$/.exec(u))) { out.push(m[1] + ' FPS'); }
    else { out.push(p.length <= 4 ? u : p); }
  });
  return out.join(' ') || String(key);
}

function has(list, id) {
  return !!list && list.indexOf(id) !== -1;
}

/**
 * Marquee text that is not fooled by the zoom of a focused tile. Moonstone measures the overflow with
 * getBoundingClientRect(), which includes the scale() of the tile, so a text that fits is 5% "too wide"
 * and starts scrolling. offsetWidth is the layout width, without transforms.
 */
var TileLabel = kind({
  name: 'aerial.TileLabel',
  kind: Marquee.Text,
  _marquee_calcDistance: function () {
    var node;
    if (this.$.marqueeText) {
      node = this.$.marqueeText.hasNode();
      if (node && this._marquee_distance == null && this.getAbsoluteShowing()) {
        this._marquee_distance = Math.floor(Math.abs(node.scrollWidth - node.offsetWidth));
        // distance 0: the text fits, no animation needed (same as Moonstone)
        this.applyStyle('text-overflow', this._marquee_distance === 0 ? 'clip' : 'ellipsis');
        this.$.marqueeText.applyStyle('text-overflow', this._marquee_distance === 0 ? 'clip' : 'ellipsis');
      }
    }
    return this._marquee_distance;
  }
});

/**
 * One video tile. Tap / OK opens the preview; a long press (hold OK / click and hold) toggles it.
 * Selected = video is in the playlist.
 */
var VideoTile = kind({
  name: 'aerial.VideoTile',
  kind: Item,
  style: TILE_STYLE,
  published: {
    selected: true
  },
  events: {
    onToggled: '',
    onPreview: '',
    onTileFocused: ''
  },
  handlers: {
    ontap: 'tapped',
    // magic remote / mouse: click and hold
    onholdpulse: 'holdPulse',
    onrelease: 'released',
    // 5-way remote: OK held down
    onkeydown: 'keyDown',
    onkeyup: 'keyUp'
  },
  components: [
    {name: 'img', tag: 'img', style: IMG_STYLE},
    // time of day of the video (top left of the picture, like a watermark)
    {name: 'tod', allowHtml: true, showing: false, style: 'position:absolute; top:12px; left:12px; width:44px; height:44px; box-sizing:border-box; overflow:hidden; ' +
      'line-height:0; border-radius:22px; background:rgba(0,0,0,0.5); opacity:0.9; pointer-events:none;'},
    {name: 'badge', content: '\u2713', style: 'position:absolute; top:12px; right:12px; width:36px; height:36px; line-height:36px; text-align:center; border-radius:18px; font-size:24px; background:#cf0652; color:#fff;'},
    // the name sits on the bottom of the picture (dark gradient keeps it readable)
    {name: 'caption', style: 'position:absolute; left:6px; right:6px; bottom:6px; padding:28px 12px 2px; color:#fff; ' +
      'background:linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.85)); pointer-events:none;', components: [
      {kind: TileLabel, name: 'label', style: 'margin:0; font-size:22px; line-height:24px; height:24px; color:#fff; text-shadow:0 1px 4px #000;'}
    ]}
  ],
  create: function () {
    this.inherited(arguments);
    if (this.src) {
      this.$.img.setAttribute('src', this.src);
    }
    this.$.label.set('content', this.label || '');
    this.todChanged();
    this.selectedChanged();
  },
  // the video's time of day: the watermark (nothing for a video without a known tag)
  todChanged: function () {
    var ok = !!TOD_DEFS[this.timeOfDay];
    this.$.tod.set('content', ok ? todIcon(this.timeOfDay, 44, 28) : '');
    this.$.tod.set('showing', ok);
  },
  setTimeOfDay: function (kind) {
    this.timeOfDay = kind;
    this.todChanged();
  },
  selectedChanged: function () {
    this.$.badge.set('showing', !!this.selected);
    this.$.img.applyStyle('opacity', this.selected ? 1 : 0.3);
    this.$.label.applyStyle('color', this.selected ? '#fff' : '#80808a');
    this.$.tod.applyStyle('opacity', this.selected ? 0.9 : 0.35);   // dimmed with the picture and the name when the video is off
  },
  // Item's own handler (onRequestScrollIntoView: the list follows the focus) must keep working,
  // so it is extended here, not replaced through `handlers`
  spotlightFocused: function (sender, evt) {
    this.inherited(arguments);
    if (evt.originator === this) { this.doTileFocused({tile: this}); }
  },
  // short press / click: preview the video
  tapped: function () {
    if (this.heldFired) { return true; }   // the tap that ends a long press
    this.doPreview({id: this.assetId});
    return true;
  },
  // long press: add to / remove from the playlist
  fireHold: function () {
    this.heldFired = true;
    this.startJob('clearHeld', 'clearHeld', 1500);
    this.set('selected', !this.selected);
    this.doToggled({id: this.assetId, selected: this.selected});
  },
  clearHeld: function () {
    this.heldFired = false;
  },
  holdPulse: function (sender, evt) {
    if (!this.heldFired && evt.holdTime >= LONG_PRESS_MS) { this.fireHold(); }
  },
  released: function () {
    this.startJob('clearHeld', 'clearHeld', 400);
  },
  keyDown: function (sender, evt) {
    if (evt.keyCode === 13 && !this.keyHeld) {
      this.keyHeld = true;
      this.startJob('longpress', 'fireHold', LONG_PRESS_MS);
    }
  },
  keyUp: function (sender, evt) {
    if (evt.keyCode === 13) {
      this.keyHeld = false;
      this.stopJob('longpress');
      this.startJob('clearHeld', 'clearHeld', 400);
    }
  }
});

/**
 * One category tile (first level). Tap / OK opens the category.
 */
var CategoryTile = kind({
  name: 'aerial.CategoryTile',
  kind: Item,
  style: CAT_TILE_STYLE,
  events: {
    onOpenCategory: ''
  },
  handlers: {
    ontap: 'open'
  },
  components: [
    {name: 'img', tag: 'img', style: CAT_IMG_STYLE},
    // title and counter sit on the bottom of the picture (dark gradient keeps them readable)
    {name: 'caption', style: 'position:absolute; left:6px; right:6px; bottom:6px; padding:36px 16px 10px; ' +
      'display:flex; align-items:baseline; color:#fff; ' +
      'background:linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.85)); pointer-events:none;', components: [
      {kind: TileLabel, name: 'label', style: 'flex:1 1 auto; min-width:0; margin:0; font-size:28px; color:#fff; text-shadow:0 1px 4px #000;'},
      {name: 'info', style: 'flex:0 0 auto; margin-left:16px; white-space:nowrap; font-size:22px; color:#fff; opacity:0.8; text-shadow:0 1px 4px #000;'}
    ]}
  ],
  create: function () {
    this.inherited(arguments);
    if (this.src) {
      this.$.img.setAttribute('src', this.src);
    }
    this.$.label.set('content', this.label || '');
    this.$.info.set('content', this.info || '');
  },
  setInfo: function (text) {
    this.$.info.set('content', text);
  },
  // tile width and picture height in px (see VideoSelectPanel.fitCategoryTiles)
  fitTo: function (w, h) {
    this.applyStyle('width', w + 'px');
    this.$.img.applyStyle('height', h + 'px');
  },
  // the configured image is missing / broken: show the fallback one instead
  rendered: function () {
    this.inherited(arguments);
    var img = this.$.img.hasNode(), fallback = this.fallback;
    if (img && fallback && fallback !== this.src) {
      img.onerror = function () {
        img.onerror = null;
        img.src = fallback;
      };
    }
  },
  open: function () {
    this.doOpenCategory({id: this.categoryId, name: this.label});
    return true;
  }
});

/**
 * Group header inside a category. Tap / OK toggles every video of the group.
 */
var SectionHeader = kind({
  name: 'aerial.SectionHeader',
  kind: Item,
  style: 'display:block; margin:18px 8px 4px; padding:8px 12px;',
  events: {
    onToggleGroup: '',
    onToggleCollapse: '',
    onHeaderFocused: ''
  },
  handlers: {
    ontap: 'toggleAll',
    onSpotlightDown: 'spotDown',
    onSpotlightUp: 'spotUp',
    // Right: collapse / expand the group
    onSpotlightRight: 'collapseKey'
  },
  components: [
    // arrow at the right edge: down = collapsed (can be expanded), up = expanded (can be collapsed)
    // (a click / tap on it collapses the group and is not passed on to the header, which toggles the videos)
    {name: 'chev', ontap: 'chevTapped', style: 'float:right; width:48px; height:36px; margin:0 0 0 12px; position:relative; cursor:pointer;', components: [
      {name: 'chevShape', style: 'position:absolute; left:18px; top:6px; width:12px; height:12px; ' +
        'border-right:4px solid currentColor; border-bottom:4px solid currentColor;'}
    ]},
    {name: 'label', tag: 'span', style: 'font-size:28px;'},
    {name: 'info', tag: 'span', style: 'font-size:22px; opacity:0.7; margin-left:24px;'}
  ],
  create: function () {
    this.inherited(arguments);
    this.$.label.set('content', this.label || '');
    this.$.info.set('content', this.info || '');
    this.setCollapsed(!!this.isCollapsed);
  },
  setInfo: function (text) {
    this.$.info.set('content', text);
  },
  setCollapsed: function (on) {
    this.isCollapsed = !!on;
    // the shape is a rotated corner: 45deg points down, 225deg points up
    this.$.chevShape.applyStyle('transform', this.isCollapsed ? 'rotate(45deg)' : 'rotate(225deg)');
    this.$.chevShape.applyStyle('top', this.isCollapsed ? '6px' : '13px');
  },
  chevTapped: function () {
    this.doToggleCollapse({header: this});
    return true;
  },
  collapseKey: function () {
    this.doToggleCollapse({header: this});
    return true;
  },
  // extends Item's own handler (the list follows the focus), see VideoTile
  spotlightFocused: function (sender, evt) {
    this.inherited(arguments);
    if (evt.originator === this) { this.doHeaderFocused({header: this}); }
  },
  // The header is as wide as the list, so Spotlight would pick the tile closest to its middle.
  // Down goes to the first (left) tile of the group, up to the left tile of the last row above.
  spotDown: function () {
    var list = this.container.getClientControls(),
      j = list.indexOf(this) + 1, next = list[j];
    if (next && next.assetId !== undefined && !next.showing) {
      // collapsed group: down goes to the next header
      while (j < list.length && !list[j].groupIds) { j++; }
      return j >= list.length ? true : !!Spotlight.spot(list[j]);
    }
    return !!(next && next.assetId !== undefined && Spotlight.spot(next));
  },
  spotUp: function () {
    var list = this.container.getClientControls(),
      i = list.indexOf(this) - 1,
      lastNode = list[i] && list[i].assetId !== undefined && list[i].hasNode(),
      left = i;
    if (list[i] && list[i].assetId !== undefined && !list[i].showing) {
      // the group above is collapsed: up goes to its header
      while (i >= 0 && list[i].assetId !== undefined) { i--; }
      return i >= 0 && !!Spotlight.spot(list[i]);
    }
    if (!lastNode) { return false; }
    while (left > 0 && list[left - 1].assetId !== undefined && list[left - 1].hasNode() &&
      Math.abs(list[left - 1].hasNode().offsetTop - lastNode.offsetTop) < 3) {
      left--;
    }
    return !!Spotlight.spot(list[left]);
  },
  toggleAll: function () {
    this.doToggleGroup({ids: this.groupIds});
    return true;
  }
});

/**
 * Full screen button in the preview: an icon drawn with CSS, no text. Focusable: OK / click presses it.
 * Four corner marks: pointing outwards = "go full screen", pointing inwards = "back to the window".
 */
var CORNER = 'position:absolute; box-sizing:border-box; width:8px; height:8px; ';
var CORNER_LINE = '3px solid #fff';
var PreviewButton = kind({
  name: 'aerial.PreviewButton',
  spotlight: true,
  style: 'position:absolute; right:16px; z-index:3; width:44px; height:38px; border-radius:10px; box-sizing:border-box; ' +
    'background:rgba(0,0,0,0.55); border:3px solid transparent; cursor:pointer;',
  events: {onPressed: ''},
  handlers: {
    ontap: 'tapped',
    onSpotlightFocused: 'focused',
    onSpotlightBlur: 'blurred'
  },
  components: [
    {name: 'c1'}, {name: 'c2'}, {name: 'c3'}, {name: 'c4'}
  ],
  create: function () {
    this.inherited(arguments);
    this.setIcon(false);
  },
  // full: the window is full screen now -> show the "exit" icon
  setIcon: function (full) {
    var x = (full ? 9 : 7) + 'px', y = (full ? 7 : 5) + 'px', L = CORNER_LINE;
    // inner area of the button is 38x32; outwards = marks near the edges, inwards = marks closer to the centre
    this.$.c1.set('style', CORNER + 'left:' + x + '; top:' + y + '; ' + (full ? 'border-right:' + L + '; border-bottom:' + L : 'border-left:' + L + '; border-top:' + L) + ';');
    this.$.c2.set('style', CORNER + 'right:' + x + '; top:' + y + '; ' + (full ? 'border-left:' + L + '; border-bottom:' + L : 'border-right:' + L + '; border-top:' + L) + ';');
    this.$.c3.set('style', CORNER + 'left:' + x + '; bottom:' + y + '; ' + (full ? 'border-right:' + L + '; border-top:' + L : 'border-left:' + L + '; border-bottom:' + L) + ';');
    this.$.c4.set('style', CORNER + 'right:' + x + '; bottom:' + y + '; ' + (full ? 'border-left:' + L + '; border-top:' + L : 'border-right:' + L + '; border-bottom:' + L) + ';');
  },
  tapped: function () {
    this.doPressed();
    return true;
  },
  focused: function () {
    this.applyStyle('border-color', '#fff');
    this.applyStyle('background', '#cf0652');
  },
  blurred: function () {
    this.applyStyle('border-color', 'transparent');
    this.applyStyle('background', 'rgba(0,0,0,0.55)');
  }
});

/**
 * Progress line of the preview. Focusable: Left / Right seek, OK pauses / resumes, a click on the line
 * (magic remote) jumps to that point. The line grows and gets a knob while it has the focus.
 */
var PreviewSeek = kind({
  name: 'aerial.PreviewSeek',
  spotlight: true,
  style: 'position:absolute; left:0; right:0; z-index:3; height:36px; cursor:pointer;',
  events: {onSeekBy: '', onSeekAt: '', onSeekOk: ''},
  handlers: {
    ontap: 'tapped',
    onSpotlightLeft: 'leftKey',
    onSpotlightRight: 'rightKey',
    onSpotlightFocused: 'focused',
    onSpotlightBlur: 'blurred'
  },
  components: [
    {name: 'track', style: 'position:absolute; left:12px; right:12px; top:15px; height:6px; border-radius:3px; background:rgba(255,255,255,0.3);', components: [
      {name: 'fill', style: 'width:0; height:100%; border-radius:3px; background:#cf0652;'},
      {name: 'knob', showing: false, style: 'position:absolute; left:0; top:-6px; width:18px; height:18px; margin-left:-9px; border-radius:50%; background:#fff;'}
    ]}
  ],
  setProgress: function (frac) {
    var pct = Math.max(0, Math.min(1, frac || 0)) * 100 + '%';
    this.$.fill.applyStyle('width', pct);
    this.$.knob.applyStyle('left', pct);
  },
  focused: function () {
    this.$.track.applyStyle('top', '12px');
    this.$.track.applyStyle('height', '12px');
    this.$.track.applyStyle('border-radius', '6px');
    this.$.knob.applyStyle('top', '-3px');
    this.$.knob.set('showing', true);
  },
  blurred: function () {
    this.$.track.applyStyle('top', '15px');
    this.$.track.applyStyle('height', '6px');
    this.$.track.applyStyle('border-radius', '3px');
    this.$.knob.set('showing', false);
  },
  leftKey: function () { this.doSeekBy({delta: -1}); return true; },
  rightKey: function () { this.doSeekBy({delta: 1}); return true; },
  tapped: function (sender, evt) {
    var node = this.$.track.hasNode(), r, pointer = Spotlight.getPointerMode && Spotlight.getPointerMode();
    if (pointer && node && typeof evt.clientX === 'number') {
      r = node.getBoundingClientRect();
      this.doSeekAt({fraction: (evt.clientX - r.left) / Math.max(1, r.width)});
    } else {
      this.doSeekOk();
    }
    return true;
  }
});

/**
 * One source badge in the preview (1080p SDR, 4K HDR, ...). Focusable: OK / click plays this variant.
 */
var BADGE_STYLE = 'display:inline-block; margin:4px 6px; padding:4px 16px; border-radius:22px; font-size:24px; ' +
  'color:#fff; border:3px solid transparent; pointer-events:auto; cursor:pointer;';

var PreviewBadge = kind({
  name: 'aerial.PreviewBadge',
  tag: 'span',
  spotlight: true,
  style: BADGE_STYLE,
  events: {
    onPlayVariant: ''
  },
  handlers: {
    ontap: 'tapped',
    onSpotlightFocused: 'focused',
    onSpotlightBlur: 'blurred'
  },
  tapped: function () {
    this.doPlayVariant({index: this.index});
    return true;
  },
  focused: function () {
    this.applyStyle('border-color', '#fff');
    this.applyStyle('transform', 'scale(' + FOCUS_SCALE + ')');
  },
  blurred: function () {
    this.applyStyle('border-color', 'transparent');
    this.applyStyle('transform', 'scale(1)');
  },
  // st: {text, current, failed}
  setState: function (st) {
    this.set('content', st.text);
    this.applyStyle('background', st.current ? '#cf0652' : 'rgba(0,0,0,0.6)');
    this.applyStyle('font-weight', st.current ? 'bold' : 'normal');
    this.applyStyle('text-decoration', st.failed ? 'line-through' : 'none');
    this.applyStyle('opacity', st.failed ? '0.5' : (st.current ? '1' : '0.9'));
  }
});

/**
 * Time-of-day button in the preview (sunrise / day / sunset / night): OK / click sets the video's tag. The active one is
 * accent coloured; the focused one gets a white ring.
 */
var PreviewTod = kind({
  name: 'aerial.PreviewTod',
  spotlight: true,
  allowHtml: true,
  style: 'display:inline-block; position:relative; vertical-align:top; width:44px; height:44px; margin-left:8px; box-sizing:border-box; ' +
    'border:3px solid transparent; border-radius:22px; background:rgba(0,0,0,0.6); cursor:pointer; pointer-events:auto;',
  events: {onPickTod: ''},
  handlers: {
    ontap: 'tapped',
    onSpotlightFocused: 'focused',
    onSpotlightBlur: 'blurred'
  },
  create: function () {
    this.inherited(arguments);
    this.set('content', todIcon(this.tod, 38, 28));
  },
  tapped: function () {
    this.doPickTod({tod: this.tod});
    return true;
  },
  focused: function () {
    this.applyStyle('border-color', '#fff');
    this.applyStyle('transform', 'scale(' + FOCUS_SCALE + ')');
  },
  blurred: function () {
    this.applyStyle('border-color', 'transparent');
    this.applyStyle('transform', 'scale(1)');
  },
  setActive: function (on) {
    this.applyStyle('background', on ? '#cf0652' : 'rgba(0,0,0,0.6)');
  }
});

/**
 * Preview window. Moonstone closes a popup as soon as Spotlight focus lands on a control outside
 * of it (a short OK press, pointer jitter of the magic remote, ...). The preview must only be
 * closed with Back, so focus that tries to leave is pulled back instead.
 */
var PreviewPopup = kind({
  name: 'aerial.PreviewPopup',
  kind: Popup,
  capturedFocus: function () {
    var cur = Spotlight.getCurrent();
    if (!cur || !cur.isDescendantOf(this)) {
      Spotlight.spot(this);
    }
    return true;
  }
});

var VideoSelectPanel = kind({
  name: 'aerial.VideoSelectPanel',
  kind: Panel,
  title: '',   // first level: set in create() (translated); second level: the category name
  headerType: 'small',
  // passed in by MainPanel
  settings: null,
  settingsPath: '',
  // 'categories' = first level (category tiles), 'videos' = video tiles
  mode: 'categories',
  // which playlist the tiles select: 'day' = the normal one (disabledVideos), 'night' = nightVideos
  list: 'day',
  // set on the second-level panel
  categoryId: '',
  isChild: false,
  shared: null,
  handlers: {
    onToggled: 'tileToggled',
    onOpenCategory: 'openCategory',
    onToggleGroup: 'toggleGroup',
    onToggleCollapse: 'toggleCollapse',
    onHeaderFocused: 'itemFocused',
    onTileFocused: 'itemFocused',
    onPreview: 'previewVideo'
  },
  components: [
    {kind: Scroller, name: 'scroller', fit: true, components: [
      {style: 'margin: 0 20px', components: [
        {kind: BodyText, name: 'count', i18n: 'loading'},
        {name: 'filters', showing: false, components: [
          {name: 'sourceBox'},
          {name: 'stateBox'}
        ]},
        {name: 'bulk', showing: false, style: 'margin: 10px 0', components: [
          {kind: Button, i18n: 'selectAll', ontap: 'selectAll'},
          {kind: Button, i18n: 'deselectAll', ontap: 'deselectAll'}
        ]},
        {name: 'grid'},
        // night mode: below the main playlist, only on the first level of the normal playlist
        {name: 'night', showing: false, style: 'margin: 16px 0 0', components: [
          // solar mode: the videos' timeOfDay tags follow the sun at the chosen city (replaces night mode while on)
          {kind: ToggleItem, name: 'solarMode', onchange: 'solarToggle'},
          {kind: BodyText, name: 'solarModeInfo', style: 'margin: 0 0 6px 20px; font-size: ' + Theme.DESC_FONT + '; opacity: 0.8;'},
          {name: 'solarOptions', showing: false, components: [
            // a plain list row (reachable with the d-pad like every other row); OK opens the popup with the input
            {kind: Item, name: 'cityItem', ontap: 'openCityDialog', components: [
              {kind: Marquee.Text, name: 'solarCityLabel'},
              {kind: BodyText, name: 'cityValue', style: 'margin: 0; font-size: ' + Theme.DESC_FONT + '; opacity: 0.8;'}
            ]},
            {kind: BodyText, name: 'solarInfo', style: 'margin: 8px 20px 0; font-size: ' + Theme.DESC_FONT + ';'},
            {kind: BodyText, name: 'solarCounts', style: 'margin: 0 20px 6px; font-size: ' + Theme.DESC_FONT + '; opacity: 0.8;'},
            {kind: Item, components: [
              {kind: Marquee.Text, name: 'solarWindowLabel'},
              {kind: SimpleIntegerPicker, name: 'solarWindow', min: 15, max: 180, step: 15, unit: '', onChange: 'solarWindowChanged'}
            ]}
          ]},
          {name: 'nightBox', components: [
          {kind: ToggleItem, name: 'nightMode', i18n: 'nightMode', onchange: 'nightToggle'},
          {name: 'nightOptions', showing: false, components: [
            {kind: Item, components: [
              {kind: Marquee.Text, i18n: 'nightStart'},
              {kind: SimpleIntegerPicker, name: 'nightStart', min: 0, max: 23, step: 1, unit: '', onChange: 'nightHourChanged'}
            ]},
            {kind: Item, components: [
              {kind: Marquee.Text, i18n: 'nightEnd'},
              {kind: SimpleIntegerPicker, name: 'nightEnd', min: 0, max: 23, step: 1, unit: '', onChange: 'nightHourChanged'}
            ]},
            {kind: Item, name: 'nightOpen', ontap: 'openNight', components: [
              {kind: Marquee.Text, i18n: 'nightPlaylist'},
              {kind: BodyText, name: 'nightInfo', style: 'margin: 0; font-size: ' + Theme.DESC_FONT + '; opacity: 0.8;'}
            ]}
          ]}
          ]}
        ]}
      ]}
    ]},
    // centered preview window; Back closes it (instead of leaving the panel)
    {kind: PreviewPopup, name: 'preview', modal: true, spotlightModal: true, autoDismiss: true, animate: false,
      onHide: 'previewHidden', onkeydown: 'previewKey', onkeyup: 'previewKey', onPlayVariant: 'playVariant',
      onSpotlightUp: 'previewUp', onSpotlightDown: 'previewDown',
      style: 'left:0; top:0; right:auto; bottom:auto; width:1280px; height:822px; margin:0; padding:12px; box-sizing:border-box; '
        + 'background:#17171c; color:#fff; outline:2px solid #3a3a44; border-radius:6px; box-shadow:0 0 40px rgba(0,0,0,0.8); '
        + 'transform:none !important; -webkit-transform:none !important; transition:none !important; -webkit-transition:none !important;',
      components: [
        {kind: Control, name: 'pvBox', spotlight: 'container', style: 'outline:none; position:relative;', components: [
          {name: 'pv', tag: 'video', attributes: {autoplay: 'autoplay', loop: 'loop', muted: 'muted'}, style: 'display:block; width:100%; height:706px; background:#000;'},
          // shown over the video when it cannot be played
          {name: 'pvError', showing: false, style: 'position:absolute; left:0; right:0; top:0; height:706px; z-index:1; pointer-events:none;', components: [
            {style: 'display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%;', components: [
              {content: '!', style: 'width:84px; height:84px; line-height:76px; text-align:center; border:4px solid #cf0652; border-radius:50%; font-size:56px; font-weight:bold; color:#cf0652;'},
              {name: 'pvErrorText', style: 'margin-top:20px; max-width:70%; text-align:center; font-size:30px; color:#fff;'}
            ]}
          ]},
          {name: 'previewBadges', style: 'position:absolute; top:14px; left:0; right:0; text-align:center; z-index:2; pointer-events:none;'},
          // time of day of the video (sunrise / day / sunset / night): the buttons change the tag in videos.json
          {name: 'pvTod', style: 'position:absolute; top:753px; right:12px; z-index:3; white-space:nowrap; pointer-events:none;'},
          {name: 'poi', showing: false, style: 'position:absolute; left:0; right:0; top:560px; text-align:center; z-index:2; pointer-events:none;'},
          // position / duration, progress line and the full screen button along the bottom of the video
          {kind: PreviewSeek, name: 'pvSeek', showing: false, style: 'top:670px;', onSeekBy: 'seekBy', onSeekAt: 'seekAt', onSeekOk: 'seekOk'},
          {name: 'pvTime', showing: false, style: 'position:absolute; left:16px; top:654px; z-index:2; font-size:22px; color:#fff; text-shadow:0 0 6px #000; pointer-events:none;'},
          {kind: PreviewButton, name: 'pvFs', style: 'top:640px;', onPressed: 'toggleFullscreen'},
          {name: 'previewHelp', showing: false, i18n: 'previewHelp', style: 'position:absolute; left:0; right:0; top:64px; text-align:center; font-size:22px; color:#fff; opacity:0.8; text-shadow:0 0 6px #000; pointer-events:none;'},
          {kind: BodyText, name: 'previewTitle', style: 'color:#fff; margin:0; padding:0; height:46px; line-height:46px; font-size:30px; text-align:left; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;'},
          {kind: BodyText, name: 'previewInfo', style: 'color:#c9c9d1; margin:0 240px 0 0; padding:0; height:46px; line-height:46px; font-size:26px; text-align:left; opacity:0.8; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;'}
        ]}
      ]},
    // city card: the same modal as the compatibility report (MainPanel): centered, themed, title with the accent rule,
    // footer with Close. The input gets the focus as soon as it is shown.
    // Not centered: it sits near the top of the screen, because the webOS virtual keyboard covers the bottom third of it
    {kind: Popup, name: 'cityPopup', floating: true, modal: true, spotlightModal: true, autoDismiss: true, animate: false,
      onShow: 'cityPopupShown', onHide: 'cityPopupHidden',
      style: 'left: 0; right: 0; top: 24px; bottom: auto; margin: 0 auto; box-sizing: border-box; ' +
        'transform: none !important; -webkit-transform: none !important; transition: none !important; -webkit-transition: none !important; ' +
        'width: 900px; max-width: 94%; padding: 30px 44px 28px; background: ' + Theme.MODAL_BG + '; color: ' + Theme.TEXT + '; border: ' + Theme.MODAL_BORDER_PX + 'px solid ' + Theme.MODAL_BORDER + '; border-radius: ' + Theme.MODAL_RADIUS + 'px;', components: [
      {style: 'position: relative; padding-bottom: 16px; border-bottom: 2px solid ' + Theme.RULE + ';', components: [
        {name: 'cityTitle', style: 'font-size: 36px; font-weight: bold; color: #fff;', content: ''},
        {style: 'position: absolute; left: 0; bottom: -2px; width: 120px; height: 2px; background: ' + Theme.ACCENT + ';'}
      ]},
      {kind: InputDecorator, name: 'cityDecorator', style: 'width: 100%; margin: 22px 0 1em;', onSpotlightDown: 'cityDown', onSpotlightSelect: 'cityInputSelect', onSpotlightFocused: 'cityDecoratorFocused', onSpotlightBlur: 'cityDecoratorBlurred', ontap: 'cityInputSelect', components: [
        {kind: Input, name: 'cityInput', spotlight: false, style: 'width: 100%', dismissOnEnter: true, oninput: 'cityTyped'}
      ]},
      {name: 'cityResults'},
      {style: 'display: flex; align-items: center; margin: 26px 0 0; padding-top: 22px; border-top: 2px solid ' + Theme.RULE + ';', components: [
        {kind: Button, name: 'cityClose', small: true, style: 'flex: none; margin: 0 0 0 auto;', ontap: 'closeCity'}
      ]}
    ]},
    {kind: LunaService, name: 'cat', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec', onResponse: 'onCat', onError: 'onCat'},
    {kind: LunaService, name: 'save', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec'},
    {kind: LunaService, name: 'tagSave', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec', onResponse: 'onTagSaved', onError: 'onTagSaveFailed'},
    {kind: LunaService, name: 'solarRun', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec', onResponse: 'onSolarRun', onError: 'onSolarRun'}
  ],

  create: function () {
    if (!this.isChild) { this.title = I18n.t('playlist'); }
    this.inherited(arguments);
    I18n.apply(this);   // texts of the controls with an `i18n` key
    // webOS TV tells the app when the virtual keyboard appears / disappears (see keyboardChanged)
    this.kbListener = this.bindSafely('keyboardChanged');
    document.addEventListener('keyboardStateChange', this.kbListener, false);
    // Moonstone Popup resets inline `bottom` when animate is off; the preview positions itself with top/left
    this.$.preview.applyStyle('bottom', 'auto');
    this.$.cityPopup.applyStyle('bottom', 'auto');
    this.dirty = false;
    this.settings = this.settings || {};

    if (this.shared) {
      // second level: data already loaded by the first level
      this.assets = this.shared.assets;
      this.categories = this.shared.categories;
      this.strings = this.shared.strings;
      this.disabled = this.shared.disabled;
      this.videosData = this.shared.videosData;
      this.videosRaw = this.shared.videosRaw;
      this.tagDisk = this.shared.tagDisk;
      // first level of the night playlist: refreshed when its categories change
      if (this.list === 'night' && this.mode === 'categories') { this.shared.root = this; }
      this.start();
      return;
    }

    this.assets = [];
    this.categories = [];
    this.strings = {};
    this.disabled = {};
    (this.settings.disabledVideos || []).forEach(function (id) {
      this.disabled[id] = true;
    }, this);
    this.loadJSON('assets/videos.json', this.basePath + '/assets/videos.json', this.onVideos);
  },

  destroy: function () {
    // flush a pending save so nothing is lost when going back
    if (this.dirty) {
      this.stopJob('save');
      this.save();
    }
    if (this.settingsDirty) {
      this.stopJob('saveSettings');
      this.saveSettings();
    }
    this.stopJob('nightApply');
    this.stopJob('nightApplied');
    this.stopJob('nightRedraw');
    this.stopJob('cityLookup');
    this.stopJob('cityFocus');
    this.stopJob('cityKbHidden');
    this.stopJob('cityInputFocus');
    this.stopJob('cityNoKb');
    this.stopJob('cityDownCheck');
    if (this.kbListener) { document.removeEventListener('keyboardStateChange', this.kbListener, false); this.kbListener = null; }
    this.stopJob('cityBack');
    if (this.cityXhr) { this.cityXhr.abort(); this.cityXhr = null; }
    if (this.solarXhr) { this.solarXhr.abort(); this.solarXhr = null; }
    this.stopJob('batch');
    this.stopJob('toastHide');
    this.stopJob('focusScroll');
    if (this.toastNode && this.toastNode.parentNode) { this.toastNode.parentNode.removeChild(this.toastNode); }
    this.toastNode = null;
    this.stopPreview();
    this.inherited(arguments);
  },

  // XHR first (app files are local), luna `cat` as fallback; `fallback` runs if both fail
  loadJSON: function (url, lunaPath, callback, fallback) {
    var self = this, xhr = new XMLHttpRequest();
    function viaLuna() { self.lunaLoad(lunaPath, callback, fallback); }
    xhr.open('GET', url);
    xhr.onload = function () {
      var data;
      if (xhr.status === 200 || (xhr.status === 0 && xhr.responseText)) {
        try { data = JSON.parse(xhr.responseText); } catch (e) { viaLuna(); return; }
        self.lastRaw = xhr.responseText;
        callback.call(self, data);
        return;
      }
      viaLuna();
    };
    xhr.onerror = viaLuna;
    xhr.send();
  },

  lunaLoad: function (path, callback, fallback) {
    this.catCallback = callback;
    this.catFallback = fallback;
    this.$.cat.send({command: 'cat ' + path});
  },

  onCat: function (sender, evt) {
    var cb = this.catCallback, fb = this.catFallback, data;
    this.catCallback = this.catFallback = null;
    if (!cb) { return; }
    try {
      data = JSON.parse(evt.stdoutString);
    } catch (e) {
      if (fb) { fb.call(this); } else { this.$.count.set('content', I18n.t('loadFail')); }
      return;
    }
    this.lastRaw = evt.stdoutString;
    cb.call(this, data);
  },

  // data.categories -> {categoryKey: imagePath}; accepts [{localizedNameKey|id, previewImage|image|thumbnail}] or {key: path}
  parseCategoryImages: function (section) {
    var map = {};
    function add(key, item) {
      var img = typeof item === 'string' ? item : (item && (item.previewImage || item.image || item.thumbnail));
      if (key && img) { map[key] = img; }
    }
    if (Array.isArray(section)) {
      section.forEach(function (c) { if (c) { add(c.localizedNameKey || c.id, c); } });
    } else if (section && typeof section === 'object') {
      Object.keys(section).forEach(function (k) { add(k, section[k]); });
    }
    return map;
  },

  onVideos: function (data) {
    this.videosData = data;            // kept whole: the time-of-day buttons of the preview rewrite videos.json
    this.videosRaw = this.lastRaw || '';
    this.assets = data.assets || [];
    this.tagDisk = this.tagMap();      // the tags as they are in the file
    this.categoryImages = this.parseCategoryImages(data.categories);
    this.categories = [];
    // names follow the interface language
    this.loadLocale(this.settings.uiLang || this.settings.localeLang || DEFAULT_LANG);
  },

  // missing locale -> default language -> no translations at all (names fall back to keys)
  loadLocale: function (lang) {
    var self = this;
    this.loadJSON('assets/locales/' + lang + '.json', this.basePath + '/assets/locales/' + lang + '.json',
      this.onLocale, function () {
        if (lang !== DEFAULT_LANG) { self.loadLocale(DEFAULT_LANG); } else { self.onLocale({}); }
      });
  },

  onLocale: function (data) {
    this.strings = (data && data.strings) || {};
    this.normalizeCategories();
    this.shared = {
      assets: this.assets,
      categories: this.categories,
      strings: this.strings,
      disabled: this.disabled,
      thumbs: {},
      categoryImages: this.categoryImages,
      videosData: this.videosData,
      videosRaw: this.videosRaw,
      tagDisk: this.tagDisk,
      onChange: this.bindSafely('refreshCounts')
    };
    this.start();
  },

  start: function () {
    // no categories in the data: single level with all videos
    if (this.mode === 'categories' && !this.visibleCategories().length) {
      this.mode = 'videos';
    }
    this.$.filters.set('showing', this.mode === 'videos');
    if (this.mode === 'videos') {
      this.buildSourcePicker();
      this.buildStatePicker();
      this.showToast(I18n.t('toastHelp'));
    }
    // Select all / Deselect all only make sense inside a category, not on the categories page
    this.$.bulk.set('showing', this.mode === 'videos');
    if (this.list === 'day' && !this.isChild && this.mode === 'categories') { this.initNight(); }
    this.renderTiles();
  },

  // ---- helpers ----

  nameOf: function (item) {
    return item.name || this.strings[item.localizedNameKey] || this.prettyKey(item.localizedNameKey || item.id);
  },

  // "AerialSubcategoryPalauJellies" -> "Palau Jellies" (only used when there is no translation)
  prettyKey: function (key) {
    return String(key || '')
      .replace(/^[A-Za-z]*?(Sub)?[Cc]ategory(Description)?(?=[A-Z0-9])/, '')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ') || String(key || '');
  },

  // Build the category / subcategory lists from the videos: each video holds the localizedNameKey
  // of its categories and subcategories (no separate categories list in the data any more).
  normalizeCategories: function () {
    var self = this, map = {}, list = [],
      anyCat = this.assets.some(function (a) { return a.categories && a.categories.length; });
    this.assets.forEach(function (a) {
      var subs = a.subcategories || [];
      a.categories = a.categories || [];
      // videos without a category go to an "Other" category so none of them is unreachable
      if (anyCat && !a.categories.length) { a.categories = [OTHER]; }
      a.subcategories = subs;
      a.categories.forEach(function (key) {
        var cat = map[key];
        if (!cat) {
          cat = map[key] = {id: key, localizedNameKey: key, name: key === OTHER ? I18n.t('other') : '', subcategories: [], subMap: {}};
          list.push(cat);
        }
        subs.forEach(function (sk) {
          if (!cat.subMap[sk]) {
            cat.subMap[sk] = true;
            cat.subcategories.push({id: sk, localizedNameKey: sk});
          }
        });
      });
    });
    list.forEach(function (c) {
      delete c.subMap;
      c.subcategories.sort(function (x, y) {
        var nx = self.nameOf(x).toLowerCase(), ny = self.nameOf(y).toLowerCase();
        return nx < ny ? -1 : (nx > ny ? 1 : 0);
      });
    });
    list.sort(function (x, y) {
      if (x.id === OTHER || y.id === OTHER) { return x.id === OTHER ? 1 : -1; }
      var i = CATEGORY_ORDER.indexOf(x.id), j = CATEGORY_ORDER.indexOf(y.id);
      if (i === -1 && j === -1) { return self.nameOf(x) < self.nameOf(y) ? -1 : 1; }
      if (i === -1) { return 1; }
      if (j === -1) { return -1; }
      return i - j;
    });
    this.categories = list;
  },

  currentValue: function (pickerName) {
    var picker = this.$[pickerName], sel = picker && picker.get('selected');
    return sel ? sel.value : '';
  },

  // Source picker with only the sources that are used by the videos of this category.
  // With a single source there is nothing to choose, so the picker is not shown at all.
  buildSourcePicker: function () {
    var self = this, seen = {}, sources = [], items;
    this.assets.forEach(function (a) {
      if (a.source && !seen[a.source] && (!self.categoryId || has(a.categories, self.categoryId))) {
        seen[a.source] = true;
        sources.push(a.source);
      }
    });
    sources.sort(function (x, y) {
      var i = SOURCE_ORDER.indexOf(x), j = SOURCE_ORDER.indexOf(y);
      if (i === -1 && j === -1) { return x < y ? -1 : (x > y ? 1 : 0); }
      if (i === -1) { return 1; }
      if (j === -1) { return -1; }
      return i - j;
    });
    this.$.sourceBox.set('showing', sources.length > 1);
    if (sources.length < 2) { return; }
    items = [{content: I18n.t('allSources'), value: ''}].concat(sources.map(function (name) {
      return {content: name, value: name};
    }));
    this.$.sourceBox.createComponent({
      name: 'filter',
      kind: ExpandablePicker,
      content: I18n.t('source'),
      selectedIndex: 0,
      onChange: 'filterChanged',
      components: items
    }, {owner: this}).render();
  },

  // "Show: All / In playlist / Not in playlist". Created here, not statically: its items must already
  // hold the translated texts when the picker is built, or the header would not show the selected one.
  buildStatePicker: function () {
    this.$.stateBox.createComponent({
      name: 'state',
      kind: ExpandablePicker,
      content: I18n.t('show'),
      selectedIndex: 0,
      onChange: 'filterChanged',
      components: [
        {content: I18n.t('all'), value: ''},
        {content: I18n.t('inPlaylist'), value: 'on'},
        {content: I18n.t('notInPlaylist'), value: 'off'}
      ]
    }, {owner: this}).render();
  },

  // {on, total} for a category ('' = everything)
  categoryStats: function (id) {
    var total = 0, on = 0, sec = 0;
    this.assets.forEach(function (a) {
      if (!id || has(a.categories, id)) {
        total++;
        if (!this.disabled[a.id]) { on++; sec += durationOf(a); }
      }
    }, this);
    return {on: on, total: total, sec: sec};
  },

  // categories that actually contain videos
  visibleCategories: function () {
    return (this.categories || []).filter(function (c) {
      return c && c.id && this.categoryStats(c.id).total > 0;
    }, this);
  },

  // Random video of a category (fallback thumbnail). Cached in `shared`, so the choice is stable
  // while the app is open.
  randomPreviewFor: function (category) {
    var key = category.id,
      cache = this.shared && this.shared.thumbs,
      pool, pick;
    if (cache && cache[key]) { return cache[key]; }
    pool = this.assets.filter(function (a) { return has(a.categories, key) && a.previewImage; });
    pick = pool.length ? pool[Math.floor(Math.random() * pool.length)].previewImage : '';
    if (cache && pick) { cache[key] = pick; }
    return pick;
  },

  infoText: function (id) {
    var s = this.categoryStats(id);
    return withTime(s.on + ' / ' + s.total, s.sec, s.on);
  },

  // ---- first level: categories ----

  renderCategories: function () {
    var images = (this.shared && this.shared.categoryImages) || {};
    this.visibleCategories().forEach(function (c) {
      // thumbnail from videos.json first; a random video of the category as the fallback
      var fallback = this.randomPreviewFor(c);
      this.$.grid.createComponent({
        kind: CategoryTile,
        categoryId: c.id,
        src: images[c.id] || fallback,
        fallback: fallback,
        label: this.nameOf(c),
        info: this.infoText(c.id)
      }).render();
    }, this);
    this.fitTries = 0;
    this.startJob('fitCats', 'fitCategoryTiles', 50);
  },

  // Category tiles use all the room the screen gives them: 3 columns across the whole list width and
  // 2 rows of the available height, so 6 categories fit without scrolling (more rows still scroll).
  // The picture gets what is left after the margins / padding of the tile; the title is on the picture.
  fitCategoryTiles: function () {
    var tiles = this.$.grid.getClientControls().filter(function (t) { return !!t.fitTo; }),
      sc = this.$.scroller && this.$.scroller.hasNode(), gn = this.$.grid.hasNode(),
      cols = 3, chrome = 32, v, g, top, rows, w, h;
    if (!tiles.length || this.mode !== 'categories') { return; }
    if (!sc || !gn || !sc.getBoundingClientRect().height || !gn.getBoundingClientRect().width) {
      // not laid out yet: try again a few times
      if (this.fitTries++ < 10) { this.startJob('fitCats', 'fitCategoryTiles', 150); }
      return;
    }
    v = sc.getBoundingClientRect();
    g = gn.getBoundingClientRect();
    top = g.top + sc.scrollTop;   // grid top as if the list was not scrolled
    rows = Math.min(2, Math.ceil(tiles.length / cols));
    // reserve room for a scrollbar that may appear later (night mode, more categories): without it
    // the row would no longer fit 3 tiles and one would wrap
    w = Math.floor((g.width - CAT_SCROLL_RESERVE) / cols) - chrome;
    // standard picture shape: wide and low (about 3.1 : 1); only a very small screen makes it lower still
    h = Math.floor((v.bottom - top - 8) / rows) - chrome;
    h = Math.max(100, Math.min(h, Math.round(w * CAT_IMG_RATIO)));
    tiles.forEach(function (t) { t.fitTo(w, h); });
    if (this.list === 'day' && !this.isChild) { this.startJob('nightRedraw', 'redrawNightPickers', 100); }
  },

  openCategory: function (sender, evt) {
    var panels = this.findPanels();
    if (panels) {
      panels.pushPanel({
        kind: VideoSelectPanel,
        title: evt.name,
        headerType: 'small',
        mode: 'videos',
        isChild: true,
        list: this.list,
        categoryId: evt.id,
        shared: this.shared,
        settings: this.settings,
        settingsPath: this.settingsPath
      });
    }
    return true;
  },

  // walk up to the (moonstone) Panels that holds this panel
  findPanels: function () {
    var c = this.container || this.parent;
    while (c && !c.pushPanel) {
      c = c.container || c.parent;
    }
    return c;
  },

  // ---- second level: videos ----

  visibleAssets: function () {
    if (this.mode === 'categories') { return this.assets; }
    var src = this.currentValue('filter'),
      state = this.currentValue('state'),
      cat = this.categoryId,
      disabled = this.disabled;
    return this.assets.filter(function (a) {
      return (!src || a.source === src) &&
        (!cat || has(a.categories, cat)) &&
        (!state || (state === 'off') === !!disabled[a.id]);
    });
  },

  // Groups of one category: [{id, name}] + map assetId -> group id.
  // Subcategories with fewer than MIN_SUB videos are merged into "Other".
  // Returns null when the category has no usable subcategories (flat list).
  groupsFor: function (catId) {
    var cat = (this.categories || []).filter(function (c) { return c && c.id === catId; })[0],
      subs = ((cat && cat.subcategories) || []).filter(function (x) { return x && x.id; }),
      assets = this.assets.filter(function (a) { return has(a.categories, catId); }),
      good = subs.filter(function (x) {
        return assets.filter(function (a) { return has(a.subcategories, x.id); }).length >= MIN_SUB;
      }),
      of = {}, groups, usesOther = false;
    if (!good.length) { return null; }
    assets.forEach(function (a) {
      var i;
      for (i = 0; i < good.length; i++) {
        if (has(a.subcategories, good[i].id)) { of[a.id] = good[i].id; return; }
      }
      of[a.id] = OTHER;
      usesOther = true;
    });
    groups = good.map(function (x) { return {id: x.id, name: this.nameOf(x)}; }, this);
    if (usesOther) { groups.push({id: OTHER, name: I18n.t('other')}); }
    return {groups: groups, of: of};
  },

  groupInfo: function (ids) {
    var on = 0, sec = 0;
    ids.forEach(function (id) { if (!this.disabled[id]) { on++; sec += this.durationById(id); } }, this);
    return withTime(on + ' / ' + ids.length, sec, on);
  },

  durationById: function (id) {
    if (!this.idMap) {
      this.idMap = {};
      this.assets.forEach(function (a) { this.idMap[a.id] = a; }, this);
    }
    return durationOf(this.idMap[id]);
  },

  renderTiles: function () {
    this.stopJob('batch');
    this.$.grid.destroyClientControls();
    this.updateCount();
    if (this.mode === 'categories') {
      this.renderCategories();
      return;
    }
    var list = this.visibleAssets(),
      grouping = this.categoryId ? this.groupsFor(this.categoryId) : null,
      queue = [];
    this.curGroup = null;
    this.collapsedGroups = this.collapsedGroups || {};
    if (grouping) {
      grouping.groups.forEach(function (g) {
        var items = list.filter(function (a) { return grouping.of[a.id] === g.id; });
        if (!items.length) { return; }
        queue.push({header: g, ids: items.map(function (a) { return a.id; })});
        items.forEach(function (a) { queue.push({asset: a}); });
      });
    } else {
      list.forEach(function (a) { queue.push({asset: a}); });
    }
    this.pending = queue;
    this.renderBatch();
  },

  renderBatch: function () {
    var batch = this.pending.splice(0, 12), i, it, a;
    for (i = 0; i < batch.length; i++) {
      it = batch[i];
      if (it.header) {
        this.curGroup = this.categoryId + '|' + it.header.id;
        this.$.grid.createComponent({
          kind: SectionHeader,
          groupKey: this.curGroup,
          isCollapsed: !!this.collapsedGroups[this.curGroup],
          groupIds: it.ids,
          label: it.header.name,
          info: this.groupInfo(it.ids)
        }).render();
      } else {
        a = it.asset;
        this.$.grid.createComponent({
          kind: VideoTile,
          assetId: a.id,
          src: a.previewImage,
          timeOfDay: a.timeOfDay,
          label: this.nameOf(a),
          selected: !this.disabled[a.id],
          showing: !(this.curGroup && this.collapsedGroups[this.curGroup])
        }).render();
      }
    }
    if (this.pending.length) {
      this.startJob('batch', 'renderBatch', 40);
    }
  },

  // tap on a group header: everything on -> all off, otherwise all on
  toggleGroup: function (sender, evt) {
    var allOn = evt.ids.every(function (id) { return !this.disabled[id]; }, this);
    evt.ids.forEach(function (id) {
      if (allOn) { this.disabled[id] = true; } else { delete this.disabled[id]; }
    }, this);
    this.markDirty();
    this.syncTiles();
    return true;
  },

  // Right on a group header: hide / show the tiles of the group
  toggleCollapse: function (sender, evt) {
    var h = evt.header, list = this.$.grid.getClientControls(), i = list.indexOf(h), on;
    if (i < 0) { return true; }
    this.collapsedGroups = this.collapsedGroups || {};
    on = this.collapsedGroups[h.groupKey] = !this.collapsedGroups[h.groupKey];
    h.setCollapsed(on);
    for (i++; i < list.length && !list[i].groupIds; i++) { list[i].set('showing', !on); }
    this.focusedItem = h;
    this.startJob('focusScroll', 'adjustScroll', HEADER_SCROLL_DELAY_MS);
    return true;
  },

  itemFocused: function (sender, evt) {
    // with the pointer (magic remote hover) the list must not move under the cursor
    var pointer = Spotlight.getPointerMode && Spotlight.getPointerMode();
    if (HEADER_SCROLL && !pointer) {
      this.focusedItem = evt.header || evt.tile;
      this.startJob('focusScroll', 'adjustScroll', HEADER_SCROLL_DELAY_MS);   // restarted while the key is held
    }
    return true;
  },

  // geometry of the list: viewport and content origin
  scrollGeometry: function () {
    var viewport = this.$.scroller.hasNode(),
      content = this.$.count.hasNode() && this.$.count.hasNode().parentNode;
    return viewport && content ? {v: viewport.getBoundingClientRect(), c: content.getBoundingClientRect()} : null;
  },

  // scroll so that `node` ends up `top` px below the top of the list
  scrollNodeTo: function (g, node, top) {
    var scroller = this.$.scroller, b = scroller.getScrollBounds(),
      // the position of the node inside the scrolled content does not depend on the current scroll offset
      y = (node.getBoundingClientRect().top - g.c.top) - top,
      // the scroller's cached maxTop is stale right after the content grew (keyboard space shown): the DOM is not
      maxTop = Math.max(b.maxTop || 0, Math.round(g.c.height - g.v.height));
    scroller.scrollTo(b.left, Math.max(0, Math.min(y, maxTop)));
  },

  // the group of a focused header / tile: its header, tiles and the number of tile rows
  groupOf: function (item) {
    var list = this.$.grid.getClientControls(), h = list.indexOf(item), end, tiles, tops = {};
    while (h >= 0 && !list[h].groupIds) { h--; }
    if (h < 0 || !list[h].hasNode()) { return null; }   // flat list: no headers
    end = h + 1;
    while (end < list.length && !list[end].groupIds) { end++; }
    tiles = list.slice(h + 1, end).filter(function (t) { return t.hasNode() && t.showing; });
    tiles.forEach(function (t) { tops[t.hasNode().offsetTop] = true; });
    return tiles.length ? {header: list[h], tiles: tiles, rows: Object.keys(tops).length} : null;
  },

  adjustScroll: function () {
    var item = this.focusedItem, g = this.scrollGeometry(), grp, headerNode, bottom, height;
    if (!item || !item.hasNode() || !g) { return; }
    grp = this.groupOf(item);
    if (!grp) { return; }
    headerNode = grp.header.hasNode();
    bottom = grp.tiles[grp.tiles.length - 1].hasNode().getBoundingClientRect().bottom + GROUP_BOTTOM_PAD;
    height = bottom - headerNode.getBoundingClientRect().top;

    if (grp.rows <= CENTER_MAX_ROWS && height <= g.v.height - 2 * HEADER_PAD) {
      // small group: the whole block should be visible, in the middle if it has to be moved
      if (headerNode.getBoundingClientRect().top >= g.v.top && bottom <= g.v.bottom) { return; }
      this.scrollNodeTo(g, headerNode, Math.max(HEADER_PAD, (g.v.height - height) / 2));
    } else if (item === grp.header || (
      // a tile of the first row focused while the header is out of view (moving up) brings it back;
      // lower rows scroll as usual, otherwise going down inside the group would jump back
      Math.abs(item.hasNode().offsetTop - grp.tiles[0].hasNode().offsetTop) < 3 &&
      headerNode.getBoundingClientRect().top < g.v.top + HEADER_PAD - 1)) {
      // big group: header to the very top, the rows below it scroll as usual
      this.scrollNodeTo(g, headerNode, HEADER_PAD);
    }
  },

  syncHeaders: function () {
    this.$.grid.getClientControls().forEach(function (t) {
      if (t.groupIds) { t.setInfo(this.groupInfo(t.groupIds)); }
    }, this);
  },

  // update existing tiles in place (no re-render, scroll position stays)
  syncTiles: function () {
    this.$.grid.getClientControls().forEach(function (t) {
      if (t.assetId !== undefined) { t.set('selected', !this.disabled[t.assetId]); }
    }, this);
    this.syncHeaders();
  },

  previewVideo: function (sender, evt) {
    var asset = this.assets.filter(function (a) { return a.id === evt.id; })[0],
      list = asset ? previewCandidates(asset) : [];
    if (!list.length) {
      this.showToast(I18n.t('noPreview'));
      return true;
    }
    this.pvList = list;
    this.pvIndex = 0;
    this.pvFailed = {};
    this.pvOk = {};
    this.pvManual = false;
    this.pvPlaying = false;
    this.pvAsset = asset;
    this.pvPoi = this.poiList(asset);
    this.pvPoiText = null;
    this.showPoi('');
    this.$.previewTitle.set('content', this.nameOf(asset));
    this.hideTime(true);
    this.setPreviewFullscreen(false, true);
    this.buildBadges();     // before show(): the popup must already be spottable when it opens
    this.buildTod();
    this.layoutPreview();
    this.$.preview.show();
    this.bindPreviewNode();
    this.playCandidate();
    this.startJob('spotBadge', 'spotCurrentBadge', 150);
    return true;
  },

  // points of interest: {"0": key, "12": key, ...} -> [{t, text}] sorted by time (only translated ones)
  poiList: function (asset) {
    var poi = asset && asset.pointsOfInterest, list = [];
    if (!poi || typeof poi !== 'object') { return list; }
    Object.keys(poi).forEach(function (k) {
      var text = this.strings[poi[k]];
      if (text && !isNaN(parseFloat(k))) { list.push({t: parseFloat(k), text: text}); }
    }, this);
    list.sort(function (x, y) { return x.t - y.t; });
    return list;
  },

  // caption for the current playback time (the video loops, so this follows it naturally)
  updatePoi: function (time) {
    var list = this.pvPoi || [], text = '', i, n = 0;
    // no caption while nothing is actually playing (failed / still loading source)
    if (this.pvPlaying) {
      for (i = 0; i < list.length && list[i].t <= time; i++) { text = list[i].text; n = i + 1; }
    }
    // the caption is keyed by its number: two points can have the same text
    if ((text ? n : '') !== this.pvPoiText) {
      this.pvPoiText = text ? n : '';
      this.showPoi(text, n, list.length);
    }
  },

  // text of the caption with its number: "2/5  <text>"
  showPoi: function (text, n, total) {
    var poi = this.$.poi;
    poi.destroyClientControls();
    if (text) {
      poi.createComponent({tag: 'span', style: 'display:inline-block; max-width:80%; padding:8px 24px; border-radius:8px; font-size:30px; color:#fff; opacity:0.75; background:rgba(0,0,0,0.65); text-shadow:0 0 6px #000;', components: [
        {tag: 'span', content: n + '/' + total, style: 'margin-right:16px; color:#fff; opacity:1;'},
        {tag: 'span', content: text, style: 'color:#fff; opacity:1;'}
      ]}).render();
    }
    poi.set('showing', !!text);
  },

  // fit the window to the real screen: centered, 16:9, never outside the visible area
  layoutPreview: function () {
    var layer = Control.floatingLayer && Control.floatingLayer.hasNode(),
      vw = (layer && layer.clientWidth) || window.innerWidth || document.documentElement.clientWidth || 1920,
      vh = (layer && layer.clientHeight) || window.innerHeight || document.documentElement.clientHeight || 1080,
      g = this.pvFull ? {videoW: vw, videoH: vh, width: vw, height: vh, left: 0, top: 0} : previewGeometry(vw, vh),
      popup = this.$.preview;
    popup.applyStyle('left', g.left + 'px');
    popup.applyStyle('top', g.top + 'px');
    popup.applyStyle('width', g.width + 'px');
    popup.applyStyle('height', g.height + 'px');
    this.$.pv.applyStyle('height', g.videoH + 'px');
    this.$.pvError.applyStyle('height', g.videoH + 'px');
    // from the bottom: progress line (36), then one row with time / full screen button, POI above
    this.$.pvSeek.applyStyle('top', Math.max(0, g.videoH - 36) + 'px');
    this.$.pvTime.applyStyle('top', Math.max(0, g.videoH - 84) + 'px');
    this.$.pvFs.applyStyle('top', Math.max(0, g.videoH - 88) + 'px');
    this.$.pvTod.applyStyle('top', (g.videoH + 47) + 'px');   // bottom row (the info line), right
    this.$.previewHelp.applyStyle('top', '64px');   // right under the badges
    this.$.poi.applyStyle('top', Math.max(0, g.videoH - 146) + 'px');   // just above the bottom row
  },

  // native <video> events (Enyo does not forward them): error -> next source, playing -> stop the timer
  bindPreviewNode: function () {
    var self = this, node = this.$.pv.hasNode();
    if (!node || this.pvBoundNode === node) { return; }
    this.pvBoundNode = node;
    node.addEventListener('error', function () { self.previewFailed(); });
    node.addEventListener('timeupdate', function () {
      self.updatePoi(node.currentTime);
      self.updateTime(node.currentTime, node.duration);
    });
    node.addEventListener('durationchange', function () { self.updateTime(node.currentTime, node.duration); });
    node.addEventListener('playing', function () {
      self.clearPreviewTimer();
      if (self.pvList && !self.pvPlaying) {
        self.pvPlaying = true;
        self.pvOk[self.pvIndex] = true;
        self.refreshBadges();
        self.updateTime(node.currentTime, node.duration);
        self.showHelpOnce();
      }
    });
  },

  // "0:12 / 0:45" and a progress line, only while the video really plays
  updateTime: function (cur, dur) {
    var known = isFinite(dur) && dur > 0, text;
    if (!this.pvPlaying) { this.hideTime(); return; }
    text = formatTime(cur) + ' / ' + (known ? formatTime(dur) : '--:--');
    if (text !== this.pvTimeText) {
      this.pvTimeText = text;
      this.$.pvTime.set('content', text);
    }
    this.$.pvTime.set('showing', true);
    this.$.pvSeek.set('showing', true);
    this.$.pvSeek.setProgress(known ? cur / dur : 0);
  },
  hideTime: function (closing) {
    this.pvTimeText = null;
    this.$.pvTime.set('showing', false);
    // a hidden control cannot keep the focus: give it back to the badges first (not when the window closes)
    if (!closing && this.$.pvSeek.showing && Spotlight.getCurrent() === this.$.pvSeek) { this.spotCurrentBadge(); }
    this.$.pvSeek.set('showing', false);
  },

  // Left / Right on the progress line: jump 5 s (10 s for videos over a minute)
  seekBy: function (sender, evt) {
    var node = this.$.pv.hasNode(), dur = node && node.duration, step;
    if (!node || !isFinite(dur) || dur <= 0) { return true; }
    step = dur < 60 ? 5 : 10;
    node.currentTime = Math.max(0, Math.min(dur - 0.1, node.currentTime + evt.delta * step));
    this.updateTime(node.currentTime, dur);
    return true;
  },
  seekAt: function (sender, evt) {
    var node = this.$.pv.hasNode(), dur = node && node.duration;
    if (!node || !isFinite(dur) || dur <= 0) { return true; }
    node.currentTime = Math.max(0, Math.min(dur - 0.1, evt.fraction * dur));
    this.updateTime(node.currentTime, dur);
    return true;
  },
  // OK on the progress line: pause / resume
  seekOk: function () {
    var node = this.$.pv.hasNode();
    if (node) {
      try { if (node.paused) { node.play(); } else { node.pause(); } } catch (e) { /* ignore */ }
    }
    return true;
  },

  // window <-> whole screen. `quiet`: only reset the state (the window is about to be laid out anyway)
  setPreviewFullscreen: function (on, quiet) {
    var popup = this.$.preview;
    this.pvFull = !!on;
    popup.applyStyle('padding', on ? '0' : PREVIEW_PAD + 'px');
    popup.applyStyle('border-radius', on ? '0' : '6px');
    popup.applyStyle('outline', on ? 'none' : '2px solid #3a3a44');
    popup.applyStyle('box-shadow', on ? 'none' : '0 0 40px rgba(0,0,0,0.8)');
    this.$.previewTitle.set('showing', !on);
    this.$.previewInfo.set('showing', !on);
    this.$.pvTod.set('showing', !on);
    this.$.pvFs.setIcon(on);
    if (!quiet) { this.layoutPreview(); }
  },
  toggleFullscreen: function () {
    this.setPreviewFullscreen(!this.pvFull);
    return true;
  },

  // Up / Down inside the preview always go through the full screen button:
  // badges <-> full screen button <-> progress line
  previewDown: function () {
    var cur = Spotlight.getCurrent(), fs = this.$.pvFs, seek = this.$.pvSeek;
    if (this.onTodButton(cur)) { return true; }   // nothing below the buttons
    if (cur === seek) { this.spotTodButton(); return true; }
    if (cur === fs) {
      if (seek.showing) { Spotlight.spot(seek); } else { this.spotTodButton(); }
      return true;
    }
    Spotlight.spot(fs);
    return true;
  },
  // is the focus on one of the time-of-day buttons (under the video, right of the title)?
  onTodButton: function (cur) {
    return !!(cur && cur.tod && cur.isDescendantOf && cur.isDescendantOf(this.$.pvTod));
  },

  // the button of the video's current tag (or the first one)
  spotTodButton: function () {
    var kids = this.$.pvTod.getClientControls(), cur = this.pvAsset && this.pvAsset.timeOfDay,
      b = kids.filter(function (k) { return k.tod === cur; })[0] || kids[0];
    if (b) { try { Spotlight.spot(b); } catch (e) { /* ignore */ } }
  },

  previewUp: function () {
    var cur = Spotlight.getCurrent();
    if (this.onTodButton(cur)) { Spotlight.spot(this.$.pvSeek.showing ? this.$.pvSeek : this.$.pvFs); return true; }
    if (cur === this.$.pvSeek) { Spotlight.spot(this.$.pvFs); }
    else if (cur === this.$.pvFs) { this.spotCurrentBadge(); }
    return true;   // from the badges there is nothing above
  },

  // first time the video plays in this preview: show the hint for a few seconds (window or full screen)
  showHelpOnce: function () {
    if (this.pvHelpShown || !this.pvList || this.pvList.length < 2) { return; }
    this.pvHelpShown = true;
    this.$.previewHelp.set('showing', true);
    this.startJob('hideHelp', 'hidePreviewHelp', PREVIEW_HELP_MS);
  },
  hidePreviewHelp: function () {
    this.$.previewHelp.set('showing', false);
  },

  showPvError: function (text) {
    this.hideTime();
    this.stopJob('hideHelp');
    this.$.previewHelp.set('showing', false);
    this.pvPoiText = null;
    this.showPoi('');   // no point-of-interest caption over a video that does not play
    this.$.pvErrorText.set('content', text);
    this.$.pvError.set('showing', true);
  },
  hidePvError: function () {
    this.$.pvError.set('showing', false);
  },

  // play the current candidate and show which variant it is (4K HDR, 1080p H.264, ...)
  playCandidate: function () {
    var self = this, list = this.pvList, item = list && list[this.pvIndex],
      node = this.$.pv.hasNode(), p;
    if (!item) { return; }
    this.clearPreviewTimer();
    this.hidePvError();
    this.hideTime();
    this.$.previewInfo.set('content', describeKey(item.key) +
      (!this.pvManual && this.pvIndex ? '  ' + I18n.t('fallbackOf', {n: this.pvIndex + 1, total: list.length}) : ''));
    this.pvPlaying = false;
    this.refreshBadges();
    this.$.pv.setAttribute('src', item.url);
    if (node) {
      try {
        node.load();
        p = node.play();
        if (p && p.catch) { p.catch(function () { /* autoplay / error handled by events */ }); }
      } catch (e) { /* autoplay will start it */ }
    }
    this.pvTimer = setTimeout(function () {
      self.pvTimer = null;
      self.previewFailed();
    }, PREVIEW_TIMEOUT_MS);
  },

  // this source cannot be played (404, unsupported codec, too slow): try the next one
  previewFailed: function () {
    this.clearPreviewTimer();
    if (!this.pvList) { return; }
    this.pvFailed[this.pvIndex] = true;
    this.pvPlaying = false;
    if (this.pvManual) {
      // the user picked this variant by hand: report it, do not jump to another one
      this.$.previewInfo.set('content', I18n.t('cannotPlay', {variant: describeKey(this.pvList[this.pvIndex].key)}));
      this.showPvError(this.$.previewInfo.content);
      this.refreshBadges();
    } else if (this.pvIndex + 1 < this.pvList.length) {
      this.pvIndex++;
      this.playCandidate();
    } else {
      this.$.previewInfo.set('content', I18n.t('previewUnavailable', {n: this.pvList.length}));
      this.showPvError(this.$.previewInfo.content);
      this.refreshBadges();
    }
  },

  // one focusable badge per available source (created once per preview, so focus is not lost)
  buildBadges: function () {
    var box = this.$.previewBadges;
    box.destroyClientControls();
    (this.pvList || []).forEach(function (item, i) {
      var badge = box.createComponent({kind: PreviewBadge, index: i});
      if (box.generated) { badge.render(); }
    });
    // the hint appears only when playback has really started (see showHelpOnce) and goes away after 5 s
    this.stopJob('hideHelp');
    this.pvHelpShown = false;
    this.$.previewHelp.set('showing', false);
    this.refreshBadges();
  },

  // current = red (\u25B6 playing, \u2026 loading), \u2713 = played fine, \u2715 + strike-through = failed
  refreshBadges: function () {
    var self = this, list = this.pvList || [];
    try {
      this.$.previewBadges.getClientControls().forEach(function (b, i) {
        var item = list[i], failed, current, mark;
        if (!item || !b.setState) { return; }
        failed = !!self.pvFailed[i];
        current = i === self.pvIndex && !failed;
        mark = failed ? '\u2715 ' : (current ? (self.pvPlaying ? '\u25B6 ' : '\u2026 ') : (self.pvOk[i] ? '\u2713 ' : ''));
        b.setState({text: mark + describeKey(item.key), current: current, failed: failed});
      });
    } catch (e) {
      console.error('refreshBadges failed', e);
    }
  },

  // put the remote focus on the badge that is playing, so left / right browse the variants
  spotCurrentBadge: function () {
    var b = this.$.previewBadges.getClientControls()[this.pvIndex || 0];
    if (b) {
      try { Spotlight.spot(b); } catch (e) { /* focus is a convenience only */ }
    }
  },

  // ---- time of day of the video (sunrise / day / sunset / night) ----

  buildTod: function () {
    var box = this.$.pvTod;
    box.destroyClientControls();
    TOD_KINDS.forEach(function (k) {
      var b = box.createComponent({kind: PreviewTod, tod: k, onPickTod: 'pickTod'}, {owner: this});
      if (box.generated) { b.render(); }
    }, this);
    this.refreshTod();
  },

  // the tag of the video that is open = the highlighted button
  refreshTod: function () {
    var cur = this.pvAsset && this.pvAsset.timeOfDay;
    this.$.pvTod.getClientControls().forEach(function (b) { if (b.setActive) { b.setActive(b.tod === cur); } });
  },

  pickTod: function (sender, evt) {
    var asset = this.pvAsset, id, mine = this;
    if (!asset || !TOD_DEFS[evt.tod] || asset.timeOfDay === evt.tod) { return true; }
    asset.timeOfDay = evt.tod;     // the same object that is in the loaded videos.json
    this.refreshTod();
    // the tile of this video behind the preview, and the counters (solar mode)
    id = asset.id;
    this.$.grid.getClientControls().forEach(function (t) { if (t.assetId === id && t.setTimeOfDay) { t.setTimeOfDay(evt.tod); } });
    if (this.isChild && this.shared && this.shared.onChange) { this.shared.onChange(); } else { this.updateCount(); }
    if (this.shared && this.shared.mainChange) { this.shared.mainChange(); }
    this.showToast(st('solar' + evt.tod.charAt(0).toUpperCase() + evt.tod.slice(1)));
    this.tagDirty = true;
    this.startJob('tagSave', 'startTagSave', 600);   // several quick changes become one write
    return true;
  },

  // {id: timeOfDay} of the videos that have a tag
  tagMap: function () {
    var map = {};
    (this.assets || []).forEach(function (a) { if (a.timeOfDay !== undefined) { map[a.id] = a.timeOfDay; } });
    return map;
  },

  // videos.json as text: the indentation of the original is kept (so a diff shows only the tags that changed)
  videosText: function () {
    var raw = this.videosRaw || '', m = /\n([ \t]+)"/.exec(raw), text;
    text = JSON.stringify(this.videosData, null, m ? m[1] : undefined);
    if (/\n\s*$/.test(raw)) { text += '\n'; }
    return text;
  },

  // Overwrites assets/videos.json through the Homebrew Channel service. The text goes in pieces (one command line is
  // limited to ~128 KB) into a temporary file, which replaces videos.json only when it is complete (size checked), so a
  // failure leaves the old file as it was. The last piece also does the check and the move, so a file that fits one
  // piece is written even if the panel is closed right then.
  startTagSave: function () {
    var text, path, tmp, bytes, chunks = [], i, n, end;
    if (!this.videosData) { return; }
    if (this.tagBusy) { this.tagAgain = true; return; }
    this.tagDirty = false;
    this.tagAgain = false;
    this.tagSnapshot = this.tagMap();   // what this write puts into the file
    text = this.videosText();
    path = this.basePath + '/assets/videos.json';
    tmp = path + '.tmp';
    bytes = unescape(encodeURIComponent(text)).length;
    for (i = 0, n = text.length; i < n; i = end) {
      end = Math.min(n, i + 30000);
      // never cut between the two halves of a surrogate pair
      if (end < n && text.charCodeAt(end - 1) >= 0xD800 && text.charCodeAt(end - 1) <= 0xDBFF) { end++; }
      chunks.push(text.slice(i, end));
    }
    function q(x) { return "'" + String(x).replace(/'/g, "'\\''") + "'"; }
    this.tagCmds = chunks.map(function (c, k) {
      var cmd = (k === 0 ? 'rm -f ' + q(tmp) + '; ' : '') + "printf '%s' " + q(c) + ' >> ' + q(tmp);
      if (k === chunks.length - 1) {
        cmd += ' && [ "$(wc -c < ' + q(tmp) + ')" -eq ' + bytes + ' ] && mv -f ' + q(tmp) + ' ' + q(path) +
          ' && echo OK || { rm -f ' + q(tmp) + '; echo ERR; }';
      }
      return cmd;
    });
    this.tagBusy = true;
    this.tagStep = 0;
    this.sendTagStep();
  },

  sendTagStep: function () {
    this.$.tagSave.send({command: this.tagCmds[this.tagStep]});
  },

  onTagSaved: function (sender, evt) {
    var out = String((evt && evt.stdoutString) || '').trim();
    if (evt && evt.returnValue === false) { return this.onTagSaveFailed(sender, evt); }
    if (this.tagStep < this.tagCmds.length - 1) {
      this.tagStep++;
      this.sendTagStep();
      return true;
    }
    if (!/OK$/.test(out)) { return this.onTagSaveFailed(sender, evt); }
    this.tagBusy = false;
    this.tagCmds = null;
    this.setTagDisk(this.tagSnapshot);
    // keep the text of what is on disk: the next write has the same layout
    this.videosRaw = this.videosText();
    if (this.shared) { this.shared.videosRaw = this.videosRaw; }
    if (this.tagAgain || this.tagDirty) { this.startTagSave(); }
    return true;
  },

  // the map of the tags in the file is shared by the panels: changed in place
  setTagDisk: function (map) {
    var disk = this.tagDisk, k;
    if (!disk || !map) { return; }
    for (k in disk) { if (disk.hasOwnProperty(k)) { delete disk[k]; } }
    for (k in map) { if (map.hasOwnProperty(k)) { disk[k] = map[k]; } }
  },

  // The file could not be written: every video goes back to the tag the file has, on the tiles, in the preview and in the
  // counters, so the screen shows what the screensaver will use.
  onTagSaveFailed: function () {
    var disk = this.tagDisk || {}, byId = {}, changed = false;
    this.tagBusy = false;
    this.tagCmds = null;
    this.tagDirty = false;
    this.tagAgain = false;
    (this.assets || []).forEach(function (a) {
      byId[a.id] = a;
      if (a.timeOfDay !== disk[a.id]) {
        if (disk[a.id] === undefined) { delete a.timeOfDay; } else { a.timeOfDay = disk[a.id]; }
        changed = true;
      }
    });
    if (this.destroyed) { return true; }
    if (changed) {
      this.$.grid.getClientControls().forEach(function (t) {
        if (t.setTimeOfDay && byId[t.assetId]) { t.setTimeOfDay(byId[t.assetId].timeOfDay); }
      });
      this.refreshTod();
      if (this.isChild && this.shared && this.shared.onChange) { this.shared.onChange(); } else { this.updateCount(); }
      if (this.shared && this.shared.mainChange) { this.shared.mainChange(); }
    }
    this.showToast(st('solarTodFailed'));
    return true;
  },

  // OK / click on a badge: play exactly this variant
  playVariant: function (sender, evt) {
    if (!this.pvList || !this.pvList[evt.index]) { return true; }
    this.pvManual = true;
    this.pvIndex = evt.index;
    delete this.pvFailed[evt.index];
    this.playCandidate();
    return true;
  },

  clearPreviewTimer: function () {
    if (this.pvTimer) {
      clearTimeout(this.pvTimer);
      this.pvTimer = null;
    }
  },

  // release the video decoder when the preview closes
  stopPreview: function () {
    var node = this.$.pv && this.$.pv.hasNode();
    this.pvList = null;
    this.pvPoi = null;
    this.hidePvError();
    this.hideTime(true);
    this.stopJob('hideHelp');
    this.clearPreviewTimer();
    if (node) {
      try {
        node.pause();
        node.removeAttribute('src');
        node.load();
      } catch (e) { /* ignore */ }
    }
  },

  // Back (webOS 461, Esc / Backspace in the simulator) closes the preview and is swallowed
  previewKey: function (sender, evt) {
    if (evt.keyCode === 461 || evt.keyCode === 27 || evt.keyCode === 8) {
      if (evt.type === 'keyup') {
        if (this.pvFull) { this.setPreviewFullscreen(false); }   // first Back: back to the window
        else { this.$.preview.hide(); }
      }
      if (evt.preventDefault) { evt.preventDefault(); }
      return true;
    }
  },

  previewHidden: function () {
    this.stopPreview();
    this.pvAsset = null;
    if (this.tagDirty) { this.stopJob('tagSave'); this.startTagSave(); }   // write the changed tags now
    this.showToast(I18n.t('toastHold'));
  },

  showToast: function (html) {
    var node = this.toastNode;
    if (!node) {
      node = this.toastNode = document.createElement('div');
      node.style.cssText = TOAST_STYLE;
      ((Control.floatingLayer && Control.floatingLayer.hasNode()) || document.body).appendChild(node);
    }
    node.innerHTML = html;
    node.style.display = 'block';
    this.startJob('toastHide', 'hideToast', TOAST_MS);
  },

  hideToast: function () {
    if (this.toastNode) { this.toastNode.style.display = 'none'; }
  },

  filterChanged: function () {
    this.renderTiles();
  },

  tileToggled: function (sender, evt) {
    if (evt.selected) {
      delete this.disabled[evt.id];
    } else {
      this.disabled[evt.id] = true;
    }
    this.markDirty();
    this.syncHeaders();
    return true;
  },

  setVisible: function (selected) {
    this.visibleAssets().forEach(function (a) {
      if (selected) { delete this.disabled[a.id]; } else { this.disabled[a.id] = true; }
    }, this);
    this.markDirty();
    // no full re-render (keeps focus and scroll), unless the filter has to hide tiles
    if (this.currentValue('state')) { this.renderTiles(); } else { this.syncTiles(); }
  },

  selectAll: function () { this.setVisible(true); },
  deselectAll: function () { this.setVisible(false); },

  // counters on the first level + header text; also called by the child panel
  refreshCounts: function () {
    this.updateCount();
    if (this.mode === 'categories') {
      this.$.grid.getClientControls().forEach(function (t) {
        if (t.setInfo) { t.setInfo(this.infoText(t.categoryId)); }
      }, this);
    }
  },

  updateCount: function () {
    var all = this.categoryStats(''), text, night = this.list === 'night';
    if (this.list === 'day' && !this.isChild) { this.updateSolarCounts(); }
    if (this.mode === 'videos' && this.categoryId) {
      var cat = this.categoryStats(this.categoryId);
      text = I18n.t(night ? 'nightCountCategory' : 'countCategory', {on: cat.on, total: cat.total, allOn: all.on, allTotal: all.total});
      text = withTime(text, cat.sec, cat.on);
    } else {
      text = I18n.t(all.on === 0 ? (night ? 'nightCountNone' : 'countNone') : (night ? 'nightCountAll' : 'countAll'),
        {on: all.on, total: all.total});
      text = withTime(text, all.sec, all.on);
    }
    this.$.count.set('content', text);
  },

  markDirty: function () {
    this.dirty = true;
    if (this.list === 'night') { this.settings.nightVideos = this.selectedIds(); }
    this.updateCount();
    if (this.isChild && this.shared && this.shared.onChange) {
      this.shared.onChange();
    }
    this.startJob('save', 'save', 800);
  },

  save: function () {
    this.dirty = false;
    if (this.list === 'night') {
      this.settings.nightVideos = this.selectedIds();
    } else {
      this.settings.disabledVideos = Object.keys(this.disabled);
    }
    this.$.save.send({command: SettingsStore.saveCommand(this.settings)});   // app copy + persistent copy
  },

  // ids of the videos that are on, in videos.json order
  selectedIds: function () {
    return this.assets.filter(function (a) { return !this.disabled[a.id]; }, this).map(function (a) { return a.id; });
  },

  // ---- night mode (first level of the normal playlist) ----

  initNight: function () {
    var s = this.settings;
    this.applyNightValues();
    this.applySolarValues();
    this.$.night.set('showing', true);
    // the pickers are not laid out / rendered yet and may ignore the value (they show 0): set it again
    // once the block is visible. Changes reported by the pickers meanwhile are not the user's.
    this.startJob('nightApply', 'redrawNightPickers', 200);
    // switched on without hours or a list (settings.json edited by hand): save what the pickers
    // show, and start with the default list
    if (s.nightMode && (hourOr(s.nightStart, -1) < 0 || hourOr(s.nightEnd, -1) < 0)) {
      s.nightStart = hourOr(s.nightStart, NIGHT_START);
      s.nightEnd = hourOr(s.nightEnd, NIGHT_END);
      this.markSettingsDirty();
    }
    if (s.nightMode && !Array.isArray(s.nightVideos)) {
      this.ensureNightList(function () {
        this.updateNightInfo();
        this.markSettingsDirty();
      });
    } else {
      this.updateNightInfo();
    }
  },

  // put the saved values into the controls; their change events are ignored until it settles
  applyNightValues: function (redraw) {
    var s = this.settings, self = this;
    this.initializing = true;
    this.$.nightMode.set('checked', !!s.nightMode);
    this.$.nightOptions.set('showing', !!s.nightMode);
    [['nightStart', NIGHT_START], ['nightEnd', NIGHT_END]].forEach(function (p) {
      var picker = self.$[p[0]], v = hourOr(s[p[0]], p[1]);
      // the picker measured itself before the layout settled (tiles are resized after it): measure and
      // draw it again, otherwise it shows the first value (0) although `value` is right
      if (redraw === true && picker.hasNode()) {
        try {
          if (picker.resized) { picker.resized(); }
          picker.render();
        } catch (e) { /* ignore */ }
      }
      picker.set('value', v);
    });
    this.applySolarValues(redraw);
    this.startJob('nightApplied', function () { this.initializing = false; }, 300);
  },

  // after the layout has settled (category tiles resized, block shown)
  redrawNightPickers: function () {
    if (!this.$.night || !this.$.night.showing) { return; }
    this.applyNightValues(true);
  },

  nightToggle: function (sender) {
    var on = !!sender.active, s = this.settings;
    if (this.initializing || on === !!s.nightMode) { return; }
    s.nightMode = on;
    if (on) {
      s.nightStart = hourOr(s.nightStart, NIGHT_START);
      s.nightEnd = hourOr(s.nightEnd, NIGHT_END);
    }
    this.$.nightOptions.set('showing', on);
    if (on) { this.startJob('nightRedraw', 'redrawNightPickers', 100); }
    this.ensureNightList(function () {
      this.updateNightInfo();
      this.markSettingsDirty();
    });
  },

  nightHourChanged: function (sender) {
    var v = sender.get('value');
    if (this.initializing || this.settings[sender.name] === v) { return; }
    this.settings[sender.name] = v;
    this.updateNightInfo();
    this.markSettingsDirty();
  },

  // The first time: the night playlist starts with the videos tagged "night" and the ones with
  // Night in their English name
  ensureNightList: function (done) {
    var self = this;
    function fill(data) {
      var en = (data && data.strings) || {};
      if (self.destroyed) { return; }   // left the screen before the names were read
      self.settings.nightVideos = self.assets.filter(function (a) {
        return a.timeOfDay === 'night' || NIGHT_NAME.test(en[a.localizedNameKey] || a.name || '');
      }).map(function (a) { return a.id; });
      done.call(self);
    }
    if (Array.isArray(this.settings.nightVideos)) { done.call(this); return; }
    this.loadJSON('assets/locales/' + DEFAULT_LANG + '.json', this.basePath + '/assets/locales/' + DEFAULT_LANG + '.json',
      fill, function () { fill({}); });
  },

  updateNightInfo: function () {
    var s = this.settings, ids = {}, on = 0, playable = 0, sec = 0, text;
    (Array.isArray(s.nightVideos) ? s.nightVideos : []).forEach(function (id) { ids[id] = true; });
    this.assets.forEach(function (a) {
      if (ids[a.id]) {
        on++;
        if (playableWith(a, s)) { playable++; sec += durationOf(a); }
      }
    });
    if (hourOr(s.nightStart, NIGHT_START) === hourOr(s.nightEnd, NIGHT_END)) {
      text = I18n.t('nightInfoSameHours');
    } else if (!on) {
      text = I18n.t('nightInfoEmpty');
    } else if (!playable) {
      text = I18n.t('nightInfoNone');
    } else if (playable < on) {
      text = withTime(I18n.t('nightInfoSome', {on: on, playable: playable}), sec, playable);
    } else {
      text = withTime(I18n.t(on === 1 ? 'nightInfoOne' : 'nightInfo', {on: on}), sec, playable);
    }
    this.$.nightInfo.set('content', text);
  },

  // the night playlist: the same screens, selecting nightVideos
  openNight: function () {
    var panels = this.findPanels();
    if (!panels) { return true; }
    this.ensureNightList(function () {
      var ids = {}, disabled = {};
      this.settings.nightVideos.forEach(function (id) { ids[id] = true; });
      this.assets.forEach(function (a) { if (!ids[a.id]) { disabled[a.id] = true; } });
      this.nightShared = {
        assets: this.assets,
        categories: this.categories,
        strings: this.strings,
        disabled: disabled,
        thumbs: this.shared.thumbs,
        categoryImages: this.shared.categoryImages,
        videosData: this.shared.videosData,
        videosRaw: this.shared.videosRaw,
        tagDisk: this.shared.tagDisk,
        mainChange: this.bindSafely('refreshCounts'),   // the solar counts of this (main) panel
        onChange: this.bindSafely('nightChanged')
      };
      panels.pushPanel({
        kind: VideoSelectPanel,
        title: I18n.t('nightPlaylist'),
        headerType: 'small',
        mode: 'categories',
        isChild: true,
        list: 'night',
        shared: this.nightShared,
        settings: this.settings,
        settingsPath: this.settingsPath
      });
    });
    return true;
  },

  nightChanged: function () {
    var root = this.nightShared && this.nightShared.root;
    this.updateNightInfo();
    if (root && !root.destroyed) { root.refreshCounts(); }
  },

  // ---- solar mode (first level of the normal playlist) ----
  // The screensaver picks videos by their timeOfDay tag (sunrise / day / sunset / night) from the sun at the chosen
  // city. Times come from assets/solar.json, which solar-update.sh keeps (boot + once a day, see there).

  applySolarValues: function (redraw) {
    var s = this.settings, picker = this.$.solarWindow, on = !!s.solarMode;
    this.$.solarMode.set('checked', on);
    this.$.solarOptions.set('showing', on);
    this.$.nightBox.set('showing', !on);   // the two modes exclude each other
    this.$.solarMode.set('content', st('solarMode'));   // the toggle had no label: an invisible row
    this.$.solarModeInfo.set('content', st('solarModeInfo'));
    this.$.solarCityLabel.set('content', st('solarCity'));
    this.$.cityInput.set('placeholder', st('solarNoCity'));
    this.$.solarWindowLabel.set('content', st('solarWindow'));
    if (redraw === true && picker.hasNode()) {
      try { if (picker.resized) { picker.resized(); } picker.render(); } catch (e) { /* ignore */ }
    }
    picker.set('value', this.solarWindowValue());
    this.$.cityValue.set('content', s.solarCity ? this.cityLabel(s.solarCity) : st('solarNoCity'));
    this.updateSolarInfo();
  },

  solarWindowValue: function () {
    var v = parseInt(this.settings.solarWindow, 10);
    return v >= 15 && v <= 180 ? v : SOLAR_WINDOW;
  },

  cityLabel: function (c) {
    return [c.name, c.region && c.region !== c.name ? c.region : '', c.country].filter(function (x) { return !!x; }).join(', ');
  },

  solarToggle: function (sender) {
    var on = !!sender.active, s = this.settings;
    if (this.initializing || on === !!s.solarMode) { return; }
    if (on && !s.solarCity) {
      // solar mode needs a city: keep it off, ask for the city first; it is switched on when one is picked
      this.$.solarMode.set('checked', false);
      this.solarWantCity = true;
      this.openCityDialog();
      return;
    }
    s.solarMode = on;
    if (on) {
      s.nightMode = false;
      s.solarWindow = this.solarWindowValue();
    }
    this.$.solarOptions.set('showing', on);
    this.$.nightBox.set('showing', !on);
    this.$.nightMode.set('checked', !!s.nightMode);
    this.$.nightOptions.set('showing', !!s.nightMode);
    if (on) { this.startJob('nightRedraw', 'redrawNightPickers', 100); }
    this.updateSolarInfo();
    if (on && s.solarCity) { this.runSolarUpdate(); } else { this.markSettingsDirty(); }
  },

  solarWindowChanged: function (sender) {
    var v = sender.get('value');
    if (this.initializing || this.settings.solarWindow === v) { return; }
    this.settings.solarWindow = v;
    this.updateSolarInfo();
    this.markSettingsDirty();
  },

  // Saves the settings and has solar-update.sh write assets/solar.json for the screensaver (needs the Homebrew Channel
  // service). The panel does not wait for it: it gets the times itself (see solarOnlineTimes).
  runSolarUpdate: function () {
    this.stopJob('saveSettings');
    this.settingsDirty = false;
    this.solarOnline = null;
    this.solarFailed = false;
    this.$.solarInfo.set('content', st('solarFetching'));
    this.$.solarRun.send({command: SettingsStore.saveCommand(this.settings) + '; sh ' + SettingsStore.assetsDir + '/solar-update.sh force'});
    this.updateSolarInfo();
  },

  // the answer (or error) of the service says nothing about what the panel shows
  onSolarRun: function () {
    return true;
  },

  // "Helsinki, Finland: sunrise 07:54, sunset 16:11, now night" and how many videos each part of the day has
  // "Tagged videos: Sunrise 3 · Day 10 · Sunset 4 · Night 6": the videos that are on in the playlist, by their timeOfDay tag.
  // Called again whenever the playlist changes (updateCount).
  updateSolarCounts: function () {
    var s = this.settings, self = this, counts = {sunrise: 0, day: 0, sunset: 0, night: 0};
    if (this.isChild || !this.$.solarCounts || !s || !s.solarMode || !s.solarCity || !this.assets) { return; }
    this.assets.forEach(function (a) {
      if (!self.disabled[a.id] && counts[a.timeOfDay] !== undefined && playableWith(a, s)) { counts[a.timeOfDay]++; }
    });
    this.$.solarCounts.set('content', st('solarTagged') + ' ' + st('solarSunrise') + ' ' + counts.sunrise + ' \u00b7 ' +
      st('solarDay') + ' ' + counts.day + ' \u00b7 ' + st('solarSunset') + ' ' + counts.sunset + ' \u00b7 ' +
      st('solarNight') + ' ' + counts.night);
  },

  updateSolarInfo: function () {
    var s = this.settings, c = s.solarCity, self = this, lat, lon, win;
    if (!this.$.solarInfo || !s.solarMode) { return; }
    // no city: the row itself already says "Type the name of a city to choose it", do not repeat it below
    if (!c) { this.$.solarInfo.set('content', ''); this.$.solarCounts.set('content', ''); return; }
    lat = Number(c.lat); lon = Number(c.lon); win = this.solarWindowValue();
    this.updateSolarCounts();
    this.loadJSON('assets/solar.json', this.basePath + '/assets/solar.json', function (d) {
      var ok = d && Math.abs(Number(d.lat) - lat) < 0.001 && Math.abs(Number(d.lon) - lon) < 0.001 && d.sunrise && d.sunset && d.sunrise.length;
      if (ok) {
        self.showSolarTimes(c, lat, lon, win, {sunrises: d.sunrise.map(function (x) { return x * 1000; }),
          sunsets: d.sunset.map(function (x) { return x * 1000; }), stored: true});
      } else {
        self.solarOnlineTimes(c, lat, lon, win);
      }
    }, function () { self.solarOnlineTimes(c, lat, lon, win); });
  },

  // sunrise / sunset instants of the city from Open-Meteo (free, no key; the same service as the city search), so the
  // panel shows real times without the Homebrew Channel service. Kept for an hour; on failure the times are calculated.
  solarOnlineTimes: function (c, lat, lon, win) {
    var self = this, o = this.solarOnline, xhr, now = Date.now();
    if (o && o.lat === lat && o.lon === lon && now - o.at < 3600000) {
      if (o.ev) { this.showSolarTimes(c, lat, lon, win, o.ev); return; }
      if (now - o.at < 60000) { this.solarFailed = true; this.showSolarTimes(c, lat, lon, win, null); return; }   // failed a moment ago
    }
    if (this.solarXhr) { this.solarXhr.abort(); this.solarXhr = null; }
    this.$.solarInfo.set('content', st('solarFetching'));
    xhr = this.solarXhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.open-meteo.com/v1/forecast?latitude=' + encodeURIComponent(lat) + '&longitude=' + encodeURIComponent(lon) +
      '&daily=sunrise,sunset&timeformat=unixtime&timezone=GMT&past_days=1&forecast_days=3');
    xhr.timeout = 10000;
    function done(ev) {
      if (self.destroyed || xhr !== self.solarXhr) { return; }
      self.solarXhr = null;
      self.solarOnline = {lat: lat, lon: lon, at: Date.now(), ev: ev};
      self.solarFailed = !ev;
      self.showSolarTimes(c, lat, lon, win, ev);
    }
    xhr.onload = function () {
      var d, ev = null;
      try { d = JSON.parse(xhr.responseText).daily; } catch (e) { d = null; }
      if (d && d.sunrise && d.sunset) {
        ev = {
          sunrises: d.sunrise.filter(function (x) { return x; }).map(function (x) { return x * 1000; }),
          sunsets: d.sunset.filter(function (x) { return x; }).map(function (x) { return x * 1000; }),
          stored: true
        };
        if (!ev.sunrises.length || !ev.sunsets.length) { ev = null; }   // polar day / night: let the calculation decide
      }
      done(ev);
    };
    xhr.onerror = xhr.ontimeout = function () { done(null); };
    xhr.send();
  },

  showSolarTimes: function (c, lat, lon, win, ev) {
    var now = Date.now(), today = new Date(now).toDateString(), rise, set, phase, text, stored = !!(ev && ev.stored);
    function hhmm(ms) { var d = new Date(ms), p = function (n) { return (n < 10 ? '0' : '') + n; }; return p(d.getHours()) + ':' + p(d.getMinutes()); }
    function cap(x) { return x.charAt(0).toUpperCase() + x.slice(1); }
    function ofToday(list) { return list.filter(function (t) { return new Date(t).toDateString() === today; })[0]; }
    if (this.destroyed || !this.$.solarInfo) { return; }
    if (!ev) { ev = Solar.solarEvents(lat, lon, now, 1); }
    rise = ofToday(ev.sunrises); set = ofToday(ev.sunsets);
    phase = stored && ev.sunrises.length && ev.sunsets.length ? Solar.solarPhaseFromEvents(now, ev.sunrises, ev.sunsets, win) : Solar.solarTimeOfDay(lat, lon, now, win);
    // the city itself is shown in the row above: not repeated here
    text = cap((rise ? st('solarSunrise') + ' ' + hhmm(rise) : '') + (rise && set ? ', ' : '') +
      (set ? st('solarSunset') + ' ' + hhmm(set) : '') + (!rise && !set ? st('solarPolar') : '')) +
      '. ' + cap(st('solarNow')) + ' ' + st('solar' + phase.charAt(0).toUpperCase() + phase.slice(1)).toLowerCase() + '.';
    if (this.solarFailed) { text += ' ' + st('solarOffline'); }
    else if (!stored) { text += ' ' + st('solarCalculated'); }
    this.$.solarInfo.set('content', text);
  },

  // ---- city search ----

  // typing: suggestions from Open-Meteo's geocoding (free, no key) after a short pause
  cityTyped: function () {
    this.cityPending = true;
    this.startJob('cityLookup', 'cityLookup', 350);
  },

  cityLookup: function () {
    this.cityPending = false;
    var q = String(this.$.cityInput.get('value') || '').trim(), self = this, xhr,
      lang = String(this.settings.uiLang || this.settings.localeLang || 'en').split('-')[0].toLowerCase();
    if (this.cityXhr) { this.cityXhr.abort(); this.cityXhr = null; }
    if (q.length < 2) { this.showCities([], q); return; }
    xhr = this.cityXhr = new XMLHttpRequest();
    xhr.open('GET', 'https://geocoding-api.open-meteo.com/v1/search?count=5&format=json&language=' + encodeURIComponent(lang) + '&name=' + encodeURIComponent(q));
    xhr.timeout = 10000;
    xhr.onload = function () {
      var d;
      if (self.destroyed || xhr !== self.cityXhr) { return; }
      try { d = JSON.parse(xhr.responseText); } catch (e) { d = null; }
      self.showCities(d ? (d.results || []) : null, q);
    };
    xhr.onerror = xhr.ontimeout = function () { if (!self.destroyed && xhr === self.cityXhr) { self.showCities(null, q); } };
    xhr.send();
  },

  // list = null: no answer
  showCities: function (list, q) {
    var box = this.$.cityResults, cities = [], sig, cur, idx, kids, target;
    if (list) {
      list.forEach(function (r) {
        var city = {name: String(r.name || '').replace(/[{}"\\]/g, ''), region: String(r.admin1 || '').replace(/[{}"\\]/g, ''),
          country: String(r.country || '').replace(/[{}"\\]/g, ''), lat: Number(Number(r.latitude).toFixed(4)),
          lon: Number(Number(r.longitude).toFixed(4)), tz: r.timezone || ''};
        if (!isFinite(city.lat) || !isFinite(city.lon) || !city.name) { return; }
        cities.push(city);
      });
    }
    // The same answer again (a late request, or a repeated search): leave the rows alone. Rebuilding them drops the d-pad
    // focus the user has already moved onto a suggestion (the first request is slow, its answer comes 1-2 s later).
    sig = list === null ? '!offline' : (cities.length ? cities.map(function (c) { return c.name + '|' + c.lat + '|' + c.lon; }).join(';') :
      ((q && q.length >= 2) ? '!none' : '!empty'));
    if (sig === this.cityShownSig && box.getClientControls().length) { return; }
    this.cityShownSig = sig;
    // remember which row has the focus, to put it back on the same place after the rebuild
    cur = Spotlight.getCurrent && Spotlight.getCurrent();
    kids = box.getClientControls();
    idx = cur ? kids.indexOf(cur) : -1;
    box.destroyClientControls();
    if (list === null) {
      box.createComponent({kind: BodyText, content: st('solarCityOffline'), style: 'margin: 6px 12px; opacity: 0.8;'}, {owner: this});
    } else if (!cities.length && q && q.length >= 2) {
      box.createComponent({kind: BodyText, content: st('solarCityNone'), style: 'margin: 6px 12px; opacity: 0.8;'}, {owner: this});
    } else {
      cities.forEach(function (city) {
        box.createComponent({kind: Item, content: this.cityLabel(city), city: city, ontap: 'pickCity'}, {owner: this});
      }, this);
    }
    box.render();
    if (idx >= 0 && this.$.cityPopup.showing && !(Spotlight.getPointerMode && Spotlight.getPointerMode())) {
      kids = box.getClientControls().filter(function (c) { return c.city; });
      target = kids.length ? kids[Math.min(idx, kids.length - 1)] : this.$.cityDecorator;
      Spotlight.spot(target);
    }
  },

  pickCity: function (sender) {
    var c = sender.city, enable = !!this.solarWantCity;
    if (!c) { return true; }
    this.solarWantCity = false;
    this.settings.solarCity = c;
    this.$.cityValue.set('content', this.cityLabel(c));
    this.$.cityResults.destroyClientControls();
    this.solarFailed = false;
    this.$.cityPopup.hide();
    if (enable) {
      this.$.solarMode.set('checked', true);   // solarToggle now finds a city and turns the mode on
      if (!this.settings.solarMode) { this.solarToggle({active: true}); }
    } else {
      this.runSolarUpdate();
    }
    return true;
  },

  // ---- the city popup ----
  // The input lives in a popup (as in the Homebrew Channel's settings), not in the scrolled list: the list row is
  // reachable with the d-pad like any other, and the popup is not covered by the on-screen keyboard.

  openCityDialog: function () {
    this.$.cityTitle.set('content', st('solarCity'));
    this.$.cityClose.set('content', st('reportClose'));
    this.kbVisible = false; this.cityAwait = false; this.cityPending = false; this.cityKbWanted = false; this.cityShownSig = null;
    this.$.cityInput.set('value', '');   // a search box: the chosen city is shown in the row
    this.$.cityResults.destroyClientControls();
    this.$.cityPopup.show();
    this.startJob('cityFocus', 'focusCity', 350);   // fallback if the popup's onShow does not come
    return true;
  },

  cityPopupShown: function () {
    this.startJob('cityFocus', 'focusCity', 60);
  },

  // The input gets the focus when the card is shown: the d-pad highlight on its decorator and the real input focus
  // (caret + on-screen keyboard). Moonstone freezes Spotlight while the input has focus; Up / Down or OK (dismissOnEnter)
  // leave it, so the suggestions and Close can be reached with the d-pad.
  focusCity: function () {
    var node;
    if (this.destroyed || !this.$.cityPopup.showing) { return; }
    this.cityKbWanted = true;   // the popup was just opened: the keyboard comes this once
    Spotlight.spot(this.$.cityDecorator);
    node = this.$.cityInput.hasNode();
    // same as in focusCityInput: webOS may report "hidden" while it is still opening the keyboard for this focus
    this.cityKbGrace = Date.now() + 1500;
    this.stopJob('cityKbHidden');
    if (node) { try { node.focus(); } catch (e) { /* the d-pad highlight is enough */ } }
  },

  // While the virtual keyboard is up, webOS TV keeps the remote's arrow keys for itself (LG: "if the input has focus, the
  // virtual keyboard will process the input"; key events do not reach the app), so the d-pad cannot leave the input then.
  // When the keyboard goes away (its Enter / Back), the d-pad is given back here: Spotlight is unfrozen and the focus
  // goes to the first suggestion, or stays on the input if there is none. The keyboard's voice button hides it for a moment
  // and shows it again, and the input must not lose its focus then, so the "hidden" is only believed after a pause.
  keyboardChanged: function (e) {
    var visible = !!(e && e.detail && e.detail.visibility);
    if (this.destroyed || !this.$.cityPopup || !this.$.cityPopup.showing) { return; }
    this.kbVisible = visible;
    if (visible) { this.stopJob('cityKbHidden'); this.cityAwait = false; return; }
    // webOS can report "hidden" right while it is opening the keyboard for a focus we just gave (the arrow key that
    // brought us here is still being released); believing it would close the keyboard again after ~0.7 s
    if (Date.now() < (this.cityKbGrace || 0)) { return; }
    this.startJob('cityKbHidden', 'cityKeyboardHidden', 700);
  },

  cityKeyboardHidden: function () {
    var node, cur, moved;
    if (this.destroyed || !this.$.cityPopup.showing) { return; }
    this.cityKbWanted = false;
    node = this.$.cityInput.hasNode();
    cur = Spotlight.getCurrent && Spotlight.getCurrent();
    moved = !!(cur && cur !== this.$.cityDecorator && cur !== this.$.cityInput && cur.isDescendantOf && cur.isDescendantOf(this.$.cityPopup));
    if (node && document.activeElement === node) { node.blur(); }
    if (Spotlight.isFrozen && Spotlight.isFrozen()) { Spotlight.unfreeze(); }
    // the user is already on a suggestion / Close: blurring the input must not take the highlight away from it
    if (moved) { Spotlight.spot(cur); return; }
    // Magic Remote pointer: the user clicks, nothing should be highlighted for the d-pad
    if (Spotlight.getPointerMode && Spotlight.getPointerMode()) { return; }
    // Enter came before the 350 ms typing pause ended: search now, so the suggestions are there when the user presses Down
    if (this.cityPending) { this.stopJob('cityLookup'); this.cityLookup(); }
    // back to the whole input element (highlighted); OK / click on it goes into the field again, Down to the suggestions
    Spotlight.spot(this.$.cityDecorator);
  },

  firstCityResult: function () {
    return this.$.cityResults.getClientControls().filter(function (c) { return c.city && c.showing !== false; })[0] || null;
  },

  // Down from the input (physical keyboard, or the virtual keyboard already hidden): to the first suggestion, else Close.
  // Moonstone freezes Spotlight while the input has focus; make sure it is not, whatever the input's focus state is.
  cityDown: function () {
    var target = this.firstCityResult() || this.$.cityClose, node = this.$.cityInput.hasNode(), ok;
    this.stopJob('cityKbHidden');          // the d-pad works, so the keyboard is gone: nothing more to do about it later
    this.cityKbWanted = false;
    // the input may still hold the DOM focus (keyboard closed with Back): blurring it later, after the highlight has moved
    // to the suggestion, is what made the highlight vanish
    if (node && document.activeElement === node) { try { node.blur(); } catch (e) { /* ignore */ } }
    if (Spotlight.isFrozen && Spotlight.isFrozen()) { Spotlight.unfreeze(); }
    this.cityHighlight(false);
    ok = !!Spotlight.spot(target);
    this.cityDownTarget = target;
    this.startJob('cityDownCheck', 'cityDownCheck', 120);   // the blur above can drop the highlight: put it back
    return ok;
  },

  cityDownCheck: function () {
    var t = this.cityDownTarget, cur;
    this.cityDownTarget = null;
    if (this.destroyed || !t || t.destroyed || !this.$.cityPopup.showing) { return; }
    cur = Spotlight.getCurrent && Spotlight.getCurrent();
    if (cur !== t && !(Spotlight.getPointerMode && Spotlight.getPointerMode())) { Spotlight.spot(t); }
  },

  // webOS TV has no API to show the keyboard: it comes up only when the <input> element itself gets the DOM focus
  // (LG docs: to relaunch the virtual keyboard, select an input field). Spotlight highlighting the
  // decorator is not enough, so the focus is given to the input explicitly. If it still holds the focus (keyboard closed
  // by the TV, e.g. its 2 minute timeout), it is blurred first, otherwise focus() does nothing and no keyboard appears.
  focusCityInput: function () {
    var node;
    if (this.destroyed || !this.$.cityPopup.showing) { return; }
    node = this.$.cityInput.hasNode();
    if (!node) { return; }
    this.cityKbGrace = Date.now() + 1500;
    this.cityKbWanted = true;   // OK on the input: the keyboard is asked for
    this.stopJob('cityKbHidden');
    try {
      if (document.activeElement === node) { node.blur(); }
      node.focus();
    } catch (e) { /* the d-pad highlight is enough */ }
  },

  // The standard flow (LG: "to relaunch the virtual keyboard, select an input field with a remote controller"):
  // Up / Down only highlight the input, OK on it gives the input the DOM focus, which is what shows the keyboard.
  cityInputSelect: function () {
    var node = this.$.cityInput.hasNode(), pointer = !!(Spotlight.getPointerMode && Spotlight.getPointerMode());
    this.cityKbWanted = true;   // asked for on purpose: cityDecoratorFocused must not take the focus away again
    // A click with the Magic Remote on the field itself: the browser has already focused it and webOS is opening the
    // keyboard. Blurring and focusing it again (below) is for OK on the d-pad only, and would close that keyboard / caret.
    if (pointer && node && document.activeElement === node) { return false; }
    this.startJob('cityInputFocus', 'focusCityInput', 250);
    return false;
  },

  // The d-pad came back to the input (Up from the suggestions / Close, or the keyboard was dismissed). Only highlight it:
  // if the input got the DOM focus on its own (which brings the keyboard up each time), take it away again. The keyboard
  // is for OK on the input (cityInputSelect) and for the moment the popup opens; the Magic Remote pointer is left alone.
  // the whole input box is the d-pad target: show it highlighted (accent colour, like the other focused rows)
  cityHighlight: function (on) {
    var d = this.$.cityDecorator;
    if (!d || d.destroyed) { return; }
    d.applyStyle('background', on ? Theme.ACCENT : null);
    d.applyStyle('border-color', on ? Theme.ACCENT : null);
    d.applyStyle('box-shadow', on ? '0 0 0 4px ' + Theme.ACCENT : null);
    d.applyStyle('color', on ? '#fff' : null);
    // Moonstone colours the input text and its placeholder grey: force white (and a white caret) while highlighted
    if (!document.getElementById('city-hl-style')) {
      var css = document.createElement('style');
      css.id = 'city-hl-style';
      css.textContent = '.city-hl input, .city-hl .moon-input { color: #fff !important; -webkit-text-fill-color: #fff !important; caret-color: #fff; opacity: 1 !important; }' +
        '.city-hl input::-webkit-input-placeholder { color: #fff !important; -webkit-text-fill-color: #fff !important; opacity: 1 !important; }' +
        '.city-hl input::placeholder { color: #fff !important; opacity: 1 !important; }';
      document.head.appendChild(css);
    }
    d.addRemoveClass('city-hl', !!on);
  },

  cityDecoratorBlurred: function () {
    var node = this.$.cityInput.hasNode();
    // still highlighted while the keyboard is up (the input has the DOM focus)
    if (!(node && document.activeElement === node)) { this.cityHighlight(false); }
    return false;
  },

  cityDecoratorFocused: function () {
    this.cityHighlight(true);
    if (this.cityKbWanted || (Spotlight.getPointerMode && Spotlight.getPointerMode())) { return false; }
    this.startJob('cityNoKb', 'cityDropInputFocus', 30);
    return false;
  },

  cityDropInputFocus: function () {
    var node;
    if (this.destroyed || this.cityKbWanted || !this.$.cityPopup.showing) { return; }
    node = this.$.cityInput.hasNode();
    if (node && document.activeElement === node) { try { node.blur(); } catch (e) { /* ignore */ } }
    if (Spotlight.isFrozen && Spotlight.isFrozen()) { Spotlight.unfreeze(); }
  },

  closeCity: function () {
    this.$.cityPopup.hide();
    return true;
  },

  cityPopupHidden: function () {
    this.cityHighlight(false);
    this.cityShownSig = null;
    this.solarWantCity = false;
    this.cityKbWanted = false;
    this.stopJob('cityNoKb');
    this.kbVisible = false; this.cityAwait = false; this.cityPending = false;
    this.stopJob('cityLookup');
    this.stopJob('cityKbHidden');
    this.stopJob('cityInputFocus');
    if (this.cityXhr) { this.cityXhr.abort(); this.cityXhr = null; }
    if (Spotlight.isFrozen && Spotlight.isFrozen()) { Spotlight.unfreeze(); }   // the input may have been focused
    this.$.cityResults.destroyClientControls();
    // give the focus back to the row that opened the popup
    this.startJob('cityBack', 'spotCityItem', 100);
  },

  spotCityItem: function () {
    if (!this.destroyed && !(Spotlight.getPointerMode && Spotlight.getPointerMode())) { Spotlight.spot(this.$.solarOptions.showing ? this.$.cityItem : this.$.solarMode); }
  },

  markSettingsDirty: function () {
    this.settingsDirty = true;
    this.startJob('saveSettings', 'saveSettings', 500);
  },

  saveSettings: function () {
    this.settingsDirty = false;
    this.$.save.send({command: SettingsStore.saveCommand(this.settings)});
  }
});

module.exports = VideoSelectPanel;
