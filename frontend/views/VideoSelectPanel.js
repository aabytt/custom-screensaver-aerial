var
  kind = require('enyo/kind'),
  Panel = require('moonstone/Panel'),
  Scroller = require('moonstone/Scroller'),
  Item = require('moonstone/Item'),
  Button = require('moonstone/Button'),
  BodyText = require('moonstone/BodyText'),
  Marquee = require('moonstone/Marquee'),
  ExpandablePicker = require('moonstone/ExpandablePicker'),
  Popup = require('moonstone/Popup'),
  Control = require('enyo/Control'),
  Spotlight = require('spotlight'),
  LunaService = require('enyo-webos/LunaService'),
  SettingsStore = require('./SettingsStore.js'),
  I18n = require('./I18n.js');

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

var TILE_STYLE = 'display:inline-block; vertical-align:top; position:relative; width:300px; margin:8px; padding:6px;';
var CAT_TILE_STYLE = 'display:inline-block; vertical-align:top; position:relative; width:470px; margin:10px; padding:6px;';
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

// how long OK / click has to be held to start a preview
var LONG_PRESS_MS = 600;

// give up on a preview source after this long without playback and try the next one
var PREVIEW_TIMEOUT_MS = 15000;

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
    {name: 'badge', content: '\u2713', style: 'position:absolute; top:12px; right:12px; width:36px; height:36px; line-height:36px; text-align:center; border-radius:18px; font-size:24px; background:#cf0652; color:#fff;'},
    {kind: Marquee.Text, name: 'label', style: 'margin-top:6px; font-size:22px;'}
  ],
  create: function () {
    this.inherited(arguments);
    if (this.src) {
      this.$.img.setAttribute('src', this.src);
    }
    this.$.label.set('content', this.label || '');
    this.selectedChanged();
  },
  selectedChanged: function () {
    this.$.badge.set('showing', !!this.selected);
    this.$.img.applyStyle('opacity', this.selected ? 1 : 0.3);
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
    {kind: Marquee.Text, name: 'label', style: 'margin-top:8px; font-size:28px;'},
    {name: 'info', style: 'font-size:22px; opacity:0.7;'}
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
    onHeaderFocused: ''
  },
  handlers: {
    ontap: 'toggleAll',
    onSpotlightDown: 'spotDown',
    onSpotlightUp: 'spotUp'
  },
  components: [
    {name: 'label', tag: 'span', style: 'font-size:28px;'},
    {name: 'info', tag: 'span', style: 'font-size:22px; opacity:0.7; margin-left:24px;'}
  ],
  create: function () {
    this.inherited(arguments);
    this.$.label.set('content', this.label || '');
    this.$.info.set('content', this.info || '');
  },
  setInfo: function (text) {
    this.$.info.set('content', text);
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
      next = list[list.indexOf(this) + 1];
    return !!(next && next.assetId !== undefined && Spotlight.spot(next));
  },
  spotUp: function () {
    var list = this.container.getClientControls(),
      i = list.indexOf(this) - 1,
      lastNode = list[i] && list[i].assetId !== undefined && list[i].hasNode(),
      left = i;
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
    this.applyStyle('transform', 'scale(1.12)');
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
  // set on the second-level panel
  categoryId: '',
  isChild: false,
  shared: null,
  handlers: {
    onToggled: 'tileToggled',
    onOpenCategory: 'openCategory',
    onToggleGroup: 'toggleGroup',
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
        {name: 'grid'}
      ]}
    ]},
    // centered preview window; Back closes it (instead of leaving the panel)
    {kind: PreviewPopup, name: 'preview', modal: true, spotlightModal: true, autoDismiss: true, animate: false,
      onHide: 'previewHidden', onkeydown: 'previewKey', onkeyup: 'previewKey', onPlayVariant: 'playVariant',
      style: 'left:0; top:0; right:auto; bottom:auto; width:1280px; height:822px; margin:0; padding:12px; box-sizing:border-box; '
        + 'transform:none !important; -webkit-transform:none !important; transition:none !important; -webkit-transition:none !important;',
      components: [
        {kind: Control, name: 'pvBox', spotlight: 'container', style: 'outline:none; position:relative;', components: [
          {name: 'pv', tag: 'video', attributes: {autoplay: 'autoplay', loop: 'loop', muted: 'muted'}, style: 'display:block; width:100%; height:706px; background:#000;'},
          {name: 'previewBadges', style: 'position:absolute; top:14px; left:0; right:0; text-align:center; z-index:2; pointer-events:none;'},
          {name: 'poi', showing: false, style: 'position:absolute; left:0; right:0; top:560px; text-align:center; z-index:2; pointer-events:none;'},
          {name: 'previewHelp', showing: false, i18n: 'previewHelp', style: 'position:absolute; left:0; right:0; top:654px; text-align:center; font-size:22px; color:#fff; opacity:0.8; text-shadow:0 0 6px #000; pointer-events:none;'},
          {kind: BodyText, name: 'previewTitle', style: 'margin:0; padding:0; height:46px; line-height:46px; font-size:30px; text-align:center; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;'},
          {kind: BodyText, name: 'previewInfo', style: 'margin:0; padding:0; height:46px; line-height:46px; font-size:26px; text-align:center; opacity:0.8; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;'}
        ]}
      ]},
    {kind: LunaService, name: 'cat', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec', onResponse: 'onCat', onError: 'onCat'},
    {kind: LunaService, name: 'save', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec'}
  ],

  create: function () {
    if (!this.isChild) { this.title = I18n.t('playlist'); }
    this.inherited(arguments);
    I18n.apply(this);   // texts of the controls with an `i18n` key
    // Moonstone Popup resets inline `bottom` when animate is off; the preview positions itself with top/left
    this.$.preview.applyStyle('bottom', 'auto');
    this.dirty = false;
    this.settings = this.settings || {};

    if (this.shared) {
      // second level: data already loaded by the first level
      this.assets = this.shared.assets;
      this.categories = this.shared.categories;
      this.strings = this.shared.strings;
      this.disabled = this.shared.disabled;
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
    this.assets = data.assets || [];
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
    var total = 0, on = 0;
    this.assets.forEach(function (a) {
      if (!id || has(a.categories, id)) {
        total++;
        if (!this.disabled[a.id]) { on++; }
      }
    }, this);
    return {on: on, total: total};
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
    return s.on + ' / ' + s.total;
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
    var on = 0;
    ids.forEach(function (id) { if (!this.disabled[id]) { on++; } }, this);
    return on + ' / ' + ids.length;
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
        this.$.grid.createComponent({
          kind: SectionHeader,
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
          label: this.nameOf(a),
          selected: !this.disabled[a.id]
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
      y = (node.getBoundingClientRect().top - g.c.top) - top;
    scroller.scrollTo(b.left, Math.max(0, Math.min(y, b.maxTop)));
  },

  // the group of a focused header / tile: its header, tiles and the number of tile rows
  groupOf: function (item) {
    var list = this.$.grid.getClientControls(), h = list.indexOf(item), end, tiles, tops = {};
    while (h >= 0 && !list[h].groupIds) { h--; }
    if (h < 0 || !list[h].hasNode()) { return null; }   // flat list: no headers
    end = h + 1;
    while (end < list.length && !list[end].groupIds) { end++; }
    tiles = list.slice(h + 1, end).filter(function (t) { return t.hasNode(); });
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
    this.pvPoi = this.poiList(asset);
    this.pvPoiText = null;
    this.showPoi('');
    this.$.previewTitle.set('content', this.nameOf(asset));
    this.buildBadges();     // before show(): the popup must already be spottable when it opens
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
    var list = this.pvPoi || [], text = '', i;
    for (i = 0; i < list.length && list[i].t <= time; i++) { text = list[i].text; }
    if (text !== this.pvPoiText) {
      this.pvPoiText = text;
      this.showPoi(text);
    }
  },

  showPoi: function (text) {
    var poi = this.$.poi;
    poi.destroyClientControls();
    if (text) {
      poi.createComponent({tag: 'span', content: text, style: 'display:inline-block; max-width:80%; padding:8px 24px; border-radius:8px; font-size:30px; color:#fff; background:rgba(0,0,0,0.65); text-shadow:0 0 6px #000;'}).render();
    }
    poi.set('showing', !!text);
  },

  // fit the window to the real screen: centered, 16:9, never outside the visible area
  layoutPreview: function () {
    var layer = Control.floatingLayer && Control.floatingLayer.hasNode(),
      vw = (layer && layer.clientWidth) || window.innerWidth || document.documentElement.clientWidth || 1920,
      vh = (layer && layer.clientHeight) || window.innerHeight || document.documentElement.clientHeight || 1080,
      g = previewGeometry(vw, vh), popup = this.$.preview;
    popup.applyStyle('left', g.left + 'px');
    popup.applyStyle('top', g.top + 'px');
    popup.applyStyle('width', g.width + 'px');
    popup.applyStyle('height', g.height + 'px');
    this.$.pv.applyStyle('height', g.videoH + 'px');
    this.$.previewHelp.applyStyle('top', Math.max(0, g.videoH - 50) + 'px');
    this.$.poi.applyStyle('top', Math.max(0, g.videoH - 130) + 'px');
  },

  // native <video> events (Enyo does not forward them): error -> next source, playing -> stop the timer
  bindPreviewNode: function () {
    var self = this, node = this.$.pv.hasNode();
    if (!node || this.pvBoundNode === node) { return; }
    this.pvBoundNode = node;
    node.addEventListener('error', function () { self.previewFailed(); });
    node.addEventListener('timeupdate', function () { self.updatePoi(node.currentTime); });
    node.addEventListener('playing', function () {
      self.clearPreviewTimer();
      if (self.pvList && !self.pvPlaying) {
        self.pvPlaying = true;
        self.pvOk[self.pvIndex] = true;
        self.refreshBadges();
      }
    });
  },

  // play the current candidate and show which variant it is (4K HDR, 1080p H.264, ...)
  playCandidate: function () {
    var self = this, list = this.pvList, item = list && list[this.pvIndex],
      node = this.$.pv.hasNode(), p;
    if (!item) { return; }
    this.clearPreviewTimer();
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
      this.refreshBadges();
    } else if (this.pvIndex + 1 < this.pvList.length) {
      this.pvIndex++;
      this.playCandidate();
    } else {
      this.$.previewInfo.set('content', I18n.t('previewUnavailable', {n: this.pvList.length}));
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
    this.$.previewHelp.set('showing', !!this.pvList && this.pvList.length > 1);
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
        this.$.preview.hide();
      }
      if (evt.preventDefault) { evt.preventDefault(); }
      return true;
    }
  },

  previewHidden: function () {
    this.stopPreview();
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
    var all = this.categoryStats(''), text;
    if (this.mode === 'videos' && this.categoryId) {
      var cat = this.categoryStats(this.categoryId);
      text = I18n.t('countCategory', {on: cat.on, total: cat.total, allOn: all.on, allTotal: all.total});
    } else {
      text = I18n.t(all.on === 0 ? 'countNone' : 'countAll', {on: all.on, total: all.total});
    }
    this.$.count.set('content', text);
  },

  markDirty: function () {
    this.dirty = true;
    this.updateCount();
    if (this.isChild && this.shared && this.shared.onChange) {
      this.shared.onChange();
    }
    this.startJob('save', 'save', 800);
  },

  save: function () {
    this.dirty = false;
    this.settings.disabledVideos = Object.keys(this.disabled);
    this.$.save.send({command: SettingsStore.saveCommand(this.settings)});   // app copy + persistent copy
  }
});

module.exports = VideoSelectPanel;
