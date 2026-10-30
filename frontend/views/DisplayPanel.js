var
  kind = require('enyo/kind'),
  Panel = require('moonstone/Panel'),
  Scroller = require('moonstone/Scroller'),
  Item = require('moonstone/Item'),
  BodyText = require('moonstone/BodyText'),
  Divider = require('moonstone/Divider'),
  Marquee = require('moonstone/Marquee'),
  ExpandablePicker = require('moonstone/ExpandablePicker'),
  SimpleIntegerPicker = require('moonstone/SimpleIntegerPicker'),
  SimplePicker = require('moonstone/SimplePicker'),
  ToggleItem = require('moonstone/ToggleItem'),
  FittableColumns = require('layout/FittableColumns'),
  LunaService = require('enyo-webos/LunaService'),
  SettingsStore = require('./SettingsStore.js'),
  I18n = require('./I18n.js');

// Language list lives here so MainPanel can reuse it for the summary line
var LANGUAGES = [
  {value: 'ar-AE', content: 'العربية'},
  {value: 'be-BY', content: 'Беларуская'},
  {value: 'ca-ES', content: 'Català'},
  {value: 'cs-CZ', content: 'Čeština'},
  {value: 'da-DK', content: 'Dansk'},
  {value: 'de-DE', content: 'Deutsch'},
  {value: 'el-GR', content: 'ελληνικά'},
  {value: 'en-AU', content: 'English (Australia)'},
  {value: 'en-GB', content: 'English (United Kingdom)'},
  {value: 'en-US', content: 'English (United States)'},
  {value: 'es-ES', content: 'Español'},
  {value: 'es-419', content: 'Español (Latinoamérica)'},
  {value: 'fi-FI', content: 'Suomi'},
  {value: 'fr-CA', content: 'Français (Canada)'},
  {value: 'fr-FR', content: 'Français'},
  {value: 'he-IL', content: 'עברית'},
  {value: 'hi-IN', content: 'हिन्दी'},
  {value: 'hr-HR', content: 'Hrvatski'},
  {value: 'hu-HU', content: 'Magyar'},
  {value: 'id-ID', content: 'Bahasa Indonesia'},
  {value: 'it-IT', content: 'Italiano'},
  {value: 'ja-JP', content: '日本語'},
  {value: 'ko-KR', content: '한국어'},
  {value: 'mk-MK', content: 'Македонски'},
  {value: 'ms-MY', content: 'Bahasa Melayu'},
  {value: 'nl-NL', content: 'Nederlands'},
  {value: 'nb-NO', content: 'Norge'},
  {value: 'pl-PL', content: 'Polski'},
  {value: 'pt-BR', content: 'Português (Brasil)'},
  {value: 'pt-PT', content: 'Português (Portugal)'},
  {value: 'ro-RO', content: 'Română'},
  {value: 'ru-RU', content: 'Русский'},
  {value: 'sk-SK', content: 'Slovenčina'},
  {value: 'sl-SI', content: 'Slovenski'},
  {value: 'sv-SE', content: 'Svenska'},
  {value: 'th-TH', content: 'ไทย'},
  {value: 'tr-TR', content: 'Türkçe'},
  {value: 'uk-UA', content: 'Українська'},
  {value: 'vi-VN', content: 'Tiếng Việt'},
  {value: 'zh-CN', content: '中文 (中国大陆)'},
  {value: 'zh-HK', content: '中文（香港）'},
  {value: 'zh-TW', content: '中文 (台灣)'}
];

// Fallback sample place for the preview ("Tokyo, Japan" in each language), used until / unless the
// real names from assets/videos.json and assets/locales/<lang>.json could be read
var PREVIEW_PLACE = {
  'ar-AE': 'طوكيو، اليابان', 'be-BY': 'Токіо, Японія', 'ca-ES': 'Tòquio, Japó', 'cs-CZ': 'Tokio, Japonsko',
  'da-DK': 'Tokyo, Japan', 'de-DE': 'Tokio, Japan', 'el-GR': 'Τόκιο, Ιαπωνία', 'en-AU': 'Tokyo, Japan',
  'en-GB': 'Tokyo, Japan', 'en-US': 'Tokyo, Japan', 'es-ES': 'Tokio, Japón', 'es-419': 'Tokio, Japón',
  'fi-FI': 'Tokio, Japani', 'fr-CA': 'Tokyo, Japon', 'fr-FR': 'Tokyo, Japon', 'he-IL': 'טוקיו, יפן',
  'hi-IN': 'टोक्यो, जापान', 'hr-HR': 'Tokio, Japan', 'hu-HU': 'Tokió, Japán', 'id-ID': 'Tokyo, Jepang',
  'it-IT': 'Tokyo, Giappone', 'ja-JP': '東京, 日本', 'ko-KR': '도쿄, 일본', 'mk-MK': 'Токио, Јапонија',
  'ms-MY': 'Tokyo, Jepun', 'nl-NL': 'Tokio, Japan', 'nb-NO': 'Tokyo, Japan', 'pl-PL': 'Tokio, Japonia',
  'pt-BR': 'Tóquio, Japão', 'pt-PT': 'Tóquio, Japão', 'ro-RO': 'Tokyo, Japonia', 'ru-RU': 'Токио, Япония',
  'sk-SK': 'Tokio, Japonsko', 'sl-SI': 'Tokio, Japonska', 'sv-SE': 'Tokyo, Japan', 'th-TH': 'โตเกียว, ญี่ปุ่น',
  'tr-TR': 'Tokyo, Japonya', 'uk-UA': 'Токіо, Японія', 'vi-VN': 'Tokyo, Nhật Bản', 'zh-CN': '东京, 日本',
  'zh-HK': '東京, 日本', 'zh-TW': '東京, 日本'
};

// ---- OSD constructor -------------------------------------------------------------------------
// The preview is a 1920x1080 stage scaled down, with the same numbers as the screensaver
// (screensaver-main.qml): the OSD rectangle has 65 px margins, the sizes / offsets below are the
// classic ones, so what is seen here is what the TV shows.
var OSD_W = 1790, OSD_H = 950;
var STAGE_SCALE = 0.4375;   // 1920 * 0.4375 = 840 px wide preview
var PREVIEW_W = 840, PREVIEW_H = 472.5;

// The preview background is this picture; if the file is missing the gradient of the frame shows instead.
// The texts are those of this video.
var BACKDROP = 'assets/tn/cities.webp';
var SAMPLE_VIDEO = 'video_i3_nyc_brooklyn_bed-stuy_20250919_086';

// Fonts of the OSD (all free: SIL OFL / Apache). The files are in assets/fonts/ (Segoe UI Light is the
// classic one in assets/). `spacing` is the letter spacing in px. The ids are what is stored in settings.osd.font.
var FONTS = [
  {id: 'segoe', label: 'Segoe UI Light', file: 'assets/SegoeUI-Light.ttf', spacing: -1},
  {id: 'roboto', label: 'Roboto Light', file: 'assets/fonts/Roboto-Light.ttf', spacing: 0},
  {id: 'opensans', label: 'Open Sans Light', file: 'assets/fonts/OpenSans-Light.ttf', spacing: 0},
  {id: 'montserrat', label: 'Montserrat Light', file: 'assets/fonts/Montserrat-Light.ttf', spacing: 0},
  {id: 'oswald', label: 'Oswald Light', file: 'assets/fonts/Oswald-Light.ttf', spacing: 0},
  {id: 'comfortaa', label: 'Comfortaa Light', file: 'assets/fonts/Comfortaa-Light.ttf', spacing: 0},
  {id: 'lora', label: 'Lora', file: 'assets/fonts/Lora-Regular.ttf', spacing: 0},
  {id: 'satisfy', label: 'Satisfy', file: 'assets/fonts/Satisfy-Regular.ttf', spacing: 0} 
];
var FONT_BY_ID = {};
FONTS.forEach(function (f) { FONT_BY_ID[f.id] = f; });

// defaults of settings.osd: must stay equal to the defaults in screensaver-main.qml
var DEFAULTS = {
  title: true, poi: true, clock: true, date: true,
  placeAnchor: 'bl', placeScale: 100, clockAnchor: 'br', clockScale: 100,
  seconds: true, clock24: true, font: 'segoe'
};

// anchor: first letter t/b = top/bottom, second l/c/r = left/center/right
var POSITIONS = [
  ['tl', 'osdPosTl', 'Top left'], ['tc', 'osdPosTc', 'Top center'], ['tr', 'osdPosTr', 'Top right'],
  ['bl', 'osdPosBl', 'Bottom left'], ['bc', 'osdPosBc', 'Bottom center'], ['br', 'osdPosBr', 'Bottom right']
];
var ANCHORS = {};
POSITIONS.forEach(function (p) { ANCHORS[p[0]] = true; });

// opacity pickers -> [settings key, source kind]; with the switch off only the first one is used for all sources
var OPACITY_KEYS = {opacityPicker: ['osdOpacity', 'sdr'], opacityDvPicker: ['osdOpacityDv', 'dv']};

var POS_KEYS = {posPlace: 'placeAnchor', posClock: 'clockAnchor'};
var SIZE_KEYS = {sizePlace: 'placeScale', sizeClock: 'clockScale'};
var TOGGLES = {
  tgTitle: ['title', 'osdTitle'], tgPoi: ['poi', 'osdPoi'], tgClock: ['clock', 'osdClock'], tgDate: ['date', 'osdDate'],
  tgSeconds: ['seconds', 'osdSeconds'], tgClock24: ['clock24', 'osdClock24']
};

// Texts of the new controls. They are looked up in I18n under these keys first (so they can be
// translated there); until a key exists the English text is used.
var STR = {
  textOpacity: 'Text opacity, %', osdOpacitySplit: 'Separate opacity for Dolby Vision / HDR and SDR',
  osdOpacityDv: 'Text opacity, % (Dolby Vision / HDR)', osdOpacitySdr: 'Text opacity, % (SDR)',
  osdShow: 'Show', osdTitle: 'Title', osdPoi: 'Description', osdClock: 'Clock', osdDate: 'Date',
  osdPlaceBlock: 'Title and description', osdClockBlock: 'Clock and date',
  osdPosition: 'Position', osdSize: 'Size', osdFont: 'Font',
  osdSeconds: 'Show seconds', osdClock24: '24-hour format'
};

function T(key, fallback) {
  var s;
  try { s = I18n.t(key); } catch (e) { s = null; }
  return (s && typeof s === 'string' && s !== key) ? s : fallback;
}
function tt(key) { return T(key, STR[key]); }

// y of a block of height h in the given anchor (same rule as blockY() in the QML)
function blockY(anchor, h) {
  if (anchor.charAt(0) === 't') { return 0; }
  return OSD_H * 0.9 + 106 - h;
}

function getJSON(url, ok, fail) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url);
  xhr.onload = function () {
    var data;
    try { data = JSON.parse(xhr.responseText); } catch (e) { if (fail) { fail(); } return; }
    ok(data);
  };
  xhr.onerror = function () { if (fail) { fail(); } };
  xhr.send();
}

function toList(x) {
  if (Array.isArray(x)) { return x; }
  if (x && typeof x === 'object') { return Object.keys(x).map(function (k) { return x[k]; }); }
  return [];
}

// fonts of the OSD, injected once
function ensureStyles() {
  var st, css;
  if (document.getElementById('osd-preview-style')) { return; }
  css = FONTS.map(function (f) {
    return "@font-face { font-family: 'OsdFont-" + f.id + "'; src: url('" + f.file + "'); }";
  }).join('\n');
  st = document.createElement('style');
  st.id = 'osd-preview-style';
  st.textContent = css;
  document.head.appendChild(st);
}

var TEXT_STYLE = 'position: absolute; white-space: nowrap; color: #fff; line-height: 1.33; ' +
  'text-shadow: 0 1px 0 #000;';

// vertical gap above each section divider (Show / Title and description / Clock and date)
var SECTION_STYLE = 'margin-top: 20px;';

var DisplayPanel = kind({
  name: 'DisplayPanel',
  kind: Panel,
  title: '',   // set in create() (translated)
  headerType: 'small',
  // passed in by MainPanel
  settings: null,
  onChange: null,   // optional callback: MainPanel refreshes its summary line
  // the controls fire change events while they are being created, before create() has set everything up
  initializing: true,
  previewReady: false,
  previewKind: 'sdr',   // which of the two opacities the preview shows (the one adjusted last)

  components: [
    {kind: FittableColumns, style: 'height: 100%;', components: [
      // controls
      {kind: Scroller, fit: true, style: 'height: 100%;', components: [
        {style: 'margin-left: 7%; width: 88%;', components: [
          {kind: BodyText, style: 'margin: 10px 0 20px', i18n: 'osdIntro'},
          {components: [
            {kind: ExpandablePicker, name: 'language', i18n: 'textLang', onChange: 'selectLang',
              components: LANGUAGES},
            {kind: ToggleItem, name: 'debug', i18n: 'debugInfo', onchange: 'debugToggle'},
            {kind: ToggleItem, name: 'tgOpacitySplit', onchange: 'splitToggle'},
            {kind: Item, name: 'opacityDvItem', showing: false, components: [
              {kind: Marquee.Text, name: 'opacityDvLabel'},
              {kind: SimpleIntegerPicker, name: 'opacityDvPicker', min: 0, max: 100, step: 5, unit: '', onChange: 'setOpacity'}
            ]},
            {kind: Item, components: [
              {kind: Marquee.Text, name: 'opacityLabel'},
              {kind: SimpleIntegerPicker, name: 'opacityPicker', min: 0, max: 100, step: 5, unit: '', onChange: 'setOpacity'}
            ]},
            {kind: Item, components: [
              {kind: Marquee.Text, name: 'fontLabel'},
              {kind: SimplePicker, name: 'fontPicker', onChange: 'fontChange'}
            ]}
          ]},

          {kind: Divider, name: 'dvShow', style: SECTION_STYLE},
          {components: [
            {kind: ToggleItem, name: 'tgTitle', osdKey: 'title', onchange: 'toggleOpt'},
            {kind: ToggleItem, name: 'tgPoi', osdKey: 'poi', onchange: 'toggleOpt'},
            {kind: ToggleItem, name: 'tgClock', osdKey: 'clock', onchange: 'toggleOpt'},
            {kind: ToggleItem, name: 'tgDate', osdKey: 'date', onchange: 'toggleOpt'}
          ]},

          {kind: Divider, name: 'dvPlace', style: SECTION_STYLE},
          {components: [
            {kind: Item, components: [
              {kind: Marquee.Text, name: 'posPlaceLabel'},
              {kind: SimplePicker, name: 'posPlace', onChange: 'posChange'}
            ]},
            {kind: Item, components: [
              {kind: Marquee.Text, name: 'sizePlaceLabel'},
              {kind: SimpleIntegerPicker, name: 'sizePlace', min: 50, max: 200, step: 10, unit: '%', onChange: 'sizeChange'}
            ]}
          ]},

          {kind: Divider, name: 'dvClock', style: SECTION_STYLE},
          {components: [
            {kind: Item, components: [
              {kind: Marquee.Text, name: 'posClockLabel'},
              {kind: SimplePicker, name: 'posClock', onChange: 'posChange'}
            ]},
            {kind: Item, components: [
              {kind: Marquee.Text, name: 'sizeClockLabel'},
              {kind: SimpleIntegerPicker, name: 'sizeClock', min: 50, max: 200, step: 10, unit: '%', onChange: 'sizeChange'}
            ]},
            {kind: ToggleItem, name: 'tgSeconds', osdKey: 'seconds', onchange: 'toggleOpt'},
            {kind: ToggleItem, name: 'tgClock24', osdKey: 'clock24', onchange: 'toggleOpt'}
          ]}
        ]}
      ]},

      // preview: a 1920x1080 stage scaled to 840x472
      {style: 'width: ' + PREVIEW_W + 'px; margin: 10px 30px 0 20px;', components: [
        {name: 'frame', style: 'position: relative; width: ' + PREVIEW_W + 'px; height: ' + PREVIEW_H + 'px; overflow: hidden; ' +
          'border-radius: 6px; background: linear-gradient(160deg, #1d3557 0%, #457b9d 55%, #e9a66b 100%);', components: [
          {name: 'stage', style: 'position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; ' +
            'background: url(' + BACKDROP + ') center / cover no-repeat; ' +
            '-webkit-transform: scale(' + STAGE_SCALE + '); transform: scale(' + STAGE_SCALE + '); ' +
            '-webkit-transform-origin: 0 0; transform-origin: 0 0;', components: [
            {name: 'osdBox', style: 'position: absolute; left: 65px; top: 65px; width: ' + OSD_W + 'px; height: ' + OSD_H + 'px;', components: [
              {name: 'pvTitle', style: TEXT_STYLE},
              {name: 'pvPoi', style: TEXT_STYLE},
              {name: 'pvTime', style: TEXT_STYLE},
              {name: 'pvDate', style: TEXT_STYLE}
            ]}
          ]}
        ]}
      ]}
    ]},
    {kind: LunaService, name: 'save', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec'}
  ],

  create: function () {
    var self = this;
    this.title = I18n.t('osd');
    this.inherited(arguments);
    I18n.apply(this);   // texts of the controls with an `i18n` key
    this.dirty = false;
    this.quiet();
    this.locales = {};      // loaded assets/locales/<lang>.json by language
    this.asset = null;      // the sample video
    this.sample = null;     // {title, poi, date} shown in the preview
    this.settings = this.settings || {};
    if (this.settings.localeLangIndex !== undefined) {
      this.$.language.set('selectedIndex', this.settings.localeLangIndex);
    }
    if (this.settings.osdOpacity !== undefined) {
      this.$.opacityPicker.set('value', this.settings.osdOpacity);
    }
    this.$.opacityDvPicker.set('value', this.opacityOf('dv'));
    this.$.tgOpacitySplit.set('checked', !!this.settings.osdOpacitySplit);
    this.$.debug.set('checked', !!this.settings.debug);
    this.buildControls();
    ensureStyles();
    this.sample = {title: PREVIEW_PLACE[this.previewLang()] || PREVIEW_PLACE['en-US'], poi: 'Shibuya Crossing'};
    this.previewReady = true;
    this.applySample();
    this.loadSamples();
    this.timer = setInterval(function () { self.tickPreview(); }, 1000);
  },

  destroy: function () {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    // flush a pending save so nothing is lost when going back
    if (this.dirty) {
      this.stopJob('save');
      this.save();
    }
    this.inherited(arguments);
  },

  // The controls fire their change events also when their initial values are set from the code:
  // those are ignored for a moment so they never count as a change made by the user.
  quiet: function () {
    this.initializing = true;
    this.startJob('quiet', function () { this.initializing = false; }, 300);
  },

  // ---- settings.osd ----
  osdGet: function (key) {
    var o = this.settings.osd, v = (o && typeof o === 'object' && o[key] !== undefined) ? o[key] : DEFAULTS[key];
    // values this panel does not offer (an older file: the middle row; an unknown font) fall back to the default
    if ((key === 'placeAnchor' || key === 'clockAnchor') && !ANCHORS[v]) { v = DEFAULTS[key]; }
    if (key === 'font' && !FONT_BY_ID[v]) { v = DEFAULTS.font; }
    return v;
  },

  osdSet: function (key, value) {
    if (!this.settings.osd || typeof this.settings.osd !== 'object') { this.settings.osd = {}; }
    this.settings.osd[key] = value;
    this.markDirty();
    this.renderPreview();
  },

  // texts and values of the OSD controls
  buildControls: function () {
    var self = this, fontIndex = 0;
    this.$.tgOpacitySplit.set('content', tt('osdOpacitySplit'));
    this.$.opacityDvLabel.set('content', tt('osdOpacityDv'));
    this.updateOpacityUi();
    this.$.dvShow.set('content', tt('osdShow'));
    this.$.dvPlace.set('content', tt('osdPlaceBlock'));
    this.$.dvClock.set('content', tt('osdClockBlock'));
    Object.keys(TOGGLES).forEach(function (name) {
      self.$[name].set('content', tt(TOGGLES[name][1]));
      self.$[name].set('checked', !!self.osdGet(TOGGLES[name][0]));
    });
    Object.keys(POS_KEYS).forEach(function (name) {
      var picker = self.$[name], cur = self.osdGet(POS_KEYS[name]), index = 0;
      self.$[name + 'Label'].set('content', tt('osdPosition'));
      picker.createComponents(POSITIONS.map(function (p, i) {
        if (p[0] === cur) { index = i; }
        return {content: T(p[1], p[2]), value: p[0]};
      }), {owner: self});
      picker.set('selectedIndex', index);
    });
    Object.keys(SIZE_KEYS).forEach(function (name) {
      self.$[name + 'Label'].set('content', tt('osdSize'));
      self.$[name].set('value', self.osdGet(SIZE_KEYS[name]));
    });
    this.$.fontLabel.set('content', tt('osdFont'));
    this.$.fontPicker.createComponents(FONTS.map(function (f, i) {
      if (f.id === self.osdGet('font')) { fontIndex = i; }
      return {content: f.label, value: f.id};
    }), {owner: this});
    this.$.fontPicker.set('selectedIndex', fontIndex);
  },

  // ---- handlers ----
  selectLang: function () {
    var index = this.$.language.get('selectedIndex'), sel = this.$.language.get('selected');
    if (!this.previewReady) { return; }
    if (sel && this.settings.localeLangIndex != index) {
      this.settings.localeLang = sel.value;
      this.settings.localeLangIndex = index;
      this.markDirty();
      this.loadLocale();   // the preview texts follow the language
    }
  },

  setOpacity: function (sender) {
    var o = OPACITY_KEYS[sender.name], v = sender.get('value');
    if (!this.previewReady || !o) { return; }
    this.previewKind = o[1];
    if (this.settings[o[0]] != v) {
      this.settings[o[0]] = v;
      this.markDirty();
    }
    this.renderPreview();
  },

  splitToggle: function (sender) {
    var on = !!sender.active;
    if (this.initializing || !!this.settings.osdOpacitySplit === on) { return; }
    this.settings.osdOpacitySplit = on;
    this.previewKind = on ? 'dv' : 'sdr';
    this.updateOpacityUi();
    this.markDirty();
    this.renderPreview();
  },

  // switch off: one opacity for everything (osdOpacity); on: a second one for Dolby Vision / HDR appears
  updateOpacityUi: function () {
    var on = !!this.settings.osdOpacitySplit;
    this.$.opacityDvItem.set('showing', on);
    this.$.opacityLabel.set('content', tt(on ? 'osdOpacitySdr' : 'textOpacity'));
    // The picker was created inside a hidden item, so its layout was measured at zero size.
    // Once it is visible it has to lay itself out again (leaving and re-entering the panel did this).
    if (on) { this.startJob('relayoutOpacity', 'relayoutOpacity', 0); }
  },

  relayoutOpacity: function () {
    var picker = this.$.opacityDvPicker;
    if (picker.reflow) { picker.reflow(); }
    this.$.opacityDvItem.resized();
    this.$.opacityDvItem.render();
  },

  // opacity in % for a kind of source ('dv' | 'sdr'); undefined values mean fully opaque, a missing DV value follows SDR
  opacityOf: function (kind) {
    var s = this.settings, sdr = s.osdOpacity !== undefined ? s.osdOpacity : 100;
    return (kind === 'dv' && s.osdOpacityDv !== undefined) ? s.osdOpacityDv : sdr;
  },

  toggleOpt: function (sender) {
    var on = !!sender.active;
    if (this.initializing) { return; }
    if (this.osdGet(sender.osdKey) !== on) { this.osdSet(sender.osdKey, on); }
  },

  posChange: function (sender, event) {
    var sel = (event && event.selected) || sender.get('selected'), key = POS_KEYS[sender.name];
    if (this.initializing) { return; }
    if (sel && key && this.osdGet(key) !== sel.value) { this.osdSet(key, sel.value); }
  },

  sizeChange: function (sender) {
    var v = sender.get('value'), key = SIZE_KEYS[sender.name];
    if (this.initializing) { return; }
    if (key && v !== undefined && this.osdGet(key) != v) { this.osdSet(key, v); }
  },

  fontChange: function (sender, event) {
    var sel = (event && event.selected) || sender.get('selected');
    if (this.initializing) { return; }
    if (sel && this.osdGet('font') !== sel.value) { this.osdSet('font', sel.value); }
  },

  debugToggle: function (sender) {
    this.settings.debug = !!sender.active;
    this.markDirty();
  },

  markDirty: function () {
    this.dirty = true;
    if (this.onChange) { this.onChange(); }
    this.startJob('save', 'save', 500);
  },

  save: function () {
    this.dirty = false;
    this.$.save.send({command: SettingsStore.saveCommand(this.settings)});   // app copy + persistent copy
  },

  // ---- preview ----
  // the language shown in the language picker
  previewLang: function () {
    var sel = this.$.language.get('selected');
    return (sel && sel.value) || this.settings.localeLang || 'en-US';
  },

  // assets/videos.json (the sample video), then the strings of the language
  loadSamples: function () {
    var self = this;
    getJSON('assets/videos.json', function (videos) {
      if (self.destroyed) { return; }
      self.findSample(videos);
      self.loadLocale();
    }, function () {
      if (!self.destroyed) { self.loadLocale(); }
    });
  },

  // the sample video (SAMPLE_VIDEO)
  findSample: function (videos) {
    this.asset = toList(videos && videos.assets).filter(function (a) {
      return a && JSON.stringify(a).indexOf(SAMPLE_VIDEO) >= 0;
    })[0] || null;
  },

  loadLocale: function () {
    var self = this, lang = this.previewLang();
    if (this.locales[lang]) { this.pickSample(); return; }
    getJSON('assets/locales/' + lang + '.json', function (data) {
      if (self.destroyed) { return; }
      self.locales[lang] = data;
      self.pickSample();
    }, function () {
      if (!self.destroyed) { self.pickSample(); }
    });
  },

  // title and description of the sample video in the chosen language
  pickSample: function () {
    var lang = this.previewLang(), loc = this.locales[lang], strings = loc && loc.strings,
      asset = this.asset, title = PREVIEW_PLACE[lang] || PREVIEW_PLACE['en-US'], poi = 'Shibuya Crossing', keys;
    if (asset && strings) {
      title = strings[asset.localizedNameKey] || title;
      keys = Object.keys(asset.pointsOfInterest || {}).sort(function (a, b) { return a - b; });
      if (keys.length) { poi = strings[asset.pointsOfInterest[keys[0]]] || poi; }
    }
    this.sample = {title: title, poi: poi, date: loc && loc.date};
    this.applySample();
  },

  applySample: function () {
    this.$.pvTitle.set('content', this.sample.title);
    this.$.pvPoi.set('content', this.sample.poi);
    this.tickPreview();
    this.renderPreview();
  },

  // clock and date, as the screensaver writes them (the date from the language's own strings when it has them)
  tickPreview: function () {
    if (!this.previewReady) { return; }
    var now = new Date(), lang = this.previewLang(), d = this.sample && this.sample.date,
      seconds = !!this.osdGet('seconds'), h24 = !!this.osdGet('clock24'), time, date, h;
    function two(n) { return (n < 10 ? '0' : '') + n; }
    try {
      time = now.toLocaleTimeString(lang, {hour: h24 ? '2-digit' : 'numeric', minute: '2-digit',
        second: seconds ? '2-digit' : undefined, hour12: !h24});
    } catch (e) {
      h = now.getHours();
      time = h24 ? two(h) : String(h % 12 || 12);
      time += ':' + two(now.getMinutes()) + (seconds ? ':' + two(now.getSeconds()) : '') + (h24 ? '' : (h < 12 ? ' AM' : ' PM'));
    }
    if (d && d.daysOfWeek && d.months) {
      date = d.daysOfWeek[now.getDay()] + ', ' + now.getDate() + ' ' + d.months[now.getMonth()];
    } else {
      try {
        date = now.toLocaleDateString(lang, {weekday: 'long', day: 'numeric', month: 'long'});
      } catch (e2) {
        date = now.toDateString();
      }
    }
    this.$.pvTime.set('content', time);
    this.$.pvDate.set('content', date);
  },

  // one line of the OSD in its place: same numbers as the QML
  putLine: function (ctrl, on, anchor, y, px) {
    var col = anchor.charAt(1);
    ctrl.set('showing', on);
    ctrl.applyStyle('font-size', px + 'px');
    ctrl.applyStyle('top', y + 'px');
    ctrl.applyStyle('left', col === 'l' ? '0' : (col === 'c' ? '50%' : null));
    ctrl.applyStyle('right', col === 'r' ? '0' : null);
    ctrl.applyStyle('-webkit-transform', col === 'c' ? 'translateX(-50%)' : null);
    ctrl.applyStyle('transform', col === 'c' ? 'translateX(-50%)' : null);
  },

  renderPreview: function () {
    if (!this.previewReady) { return; }
    var g = this.osdGet.bind(this),
      titleOn = !!g('title'), poiOn = !!g('poi'), clockOn = !!g('clock'), dateOn = !!g('date'),
      ps = g('placeScale') / 100, cs = g('clockScale') / 100,
      pa = g('placeAnchor'), ca = g('clockAnchor'),
      pH = (titleOn && poiOn ? 106 : (titleOn ? 56 : (poiOn ? 40 : 0))) * ps,
      cH = (clockOn && dateOn ? 136 : (clockOn ? 79 : (dateOn ? 40 : 0))) * cs,
      py = blockY(pa, pH), cy = blockY(ca, cH),
      opacity = this.opacityOf(this.settings.osdOpacitySplit ? this.previewKind : 'sdr') / 100,
      font = FONT_BY_ID[g('font')];
    this.putLine(this.$.pvTitle, titleOn, pa, py, 56 * ps);
    this.putLine(this.$.pvPoi, poiOn, pa, py + (titleOn ? 66 * ps : 0), 40 * ps);
    this.putLine(this.$.pvTime, clockOn, ca, cy, 79 * cs);
    this.putLine(this.$.pvDate, dateOn, ca, cy + (clockOn ? 96 * cs : 0), 40 * cs);
    ['pvTitle', 'pvPoi', 'pvTime', 'pvDate'].forEach(function (n) {
      this.$[n].applyStyle('opacity', opacity);
      this.$[n].applyStyle('font-family', "'OsdFont-" + font.id + "', 'Segoe UI', sans-serif");
      this.$[n].applyStyle('letter-spacing', font.spacing + 'px');
    }, this);
    this.tickPreview();   // seconds / 12-24 h
  }
});

// Index in LANGUAGES for a system locale tag ("fi-FI", "zh-Hans-CN", "en_NZ", "es-419", "no"), -1 if there is none.
// Exact language+region first; otherwise the same language, preferring the "main" variant.
DisplayPanel.matchLocale = function (tag) {
  var aliases = {no: 'nb', iw: 'he', 'in': 'id'},
    mainVariant = {en: 'en-US', es: 'es-ES', fr: 'fr-FR', pt: 'pt-BR', zh: 'zh-CN'},
    parts = String(tag || '').split(/[-_]/),
    lang = (parts[0] || '').toLowerCase(),
    region = '', same = [], i, want;
  lang = aliases[lang] || lang;
  if (!lang) { return -1; }
  for (i = parts.length - 1; i > 0; i--) {
    if (/^([A-Za-z]{2}|\d{3})$/.test(parts[i])) { region = parts[i].toUpperCase(); break; }
  }
  if (!region && lang === 'zh' && parts.indexOf('Hant') > 0) { region = 'TW'; }
  for (i = 0; i < LANGUAGES.length; i++) {
    if (LANGUAGES[i].value.split('-')[0].toLowerCase() === lang) { same.push(i); }
  }
  if (!same.length) { return -1; }
  want = (lang + '-' + region).toLowerCase();
  for (i = 0; i < same.length; i++) {
    if (region && LANGUAGES[same[i]].value.toLowerCase() === want) { return same[i]; }
  }
  for (i = 0; i < same.length; i++) {
    if (LANGUAGES[same[i]].value === (mainVariant[lang] || lang + '-' + lang.toUpperCase())) { return same[i]; }
  }
  return same[0];
};

DisplayPanel.LANGUAGES = LANGUAGES;
module.exports = DisplayPanel;
