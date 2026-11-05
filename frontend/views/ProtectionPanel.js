var
  kind = require('enyo/kind'),
  Panel = require('moonstone/Panel'),
  Scroller = require('moonstone/Scroller'),
  Item = require('moonstone/Item'),
  BodyText = require('moonstone/BodyText'),
  Divider = require('moonstone/Divider'),
  Marquee = require('moonstone/Marquee'),
  ToggleItem = require('moonstone/ToggleItem'),
  SimpleIntegerPicker = require('moonstone/SimpleIntegerPicker'),
  LunaService = require('enyo-webos/LunaService'),
  SettingsStore = require('./SettingsStore.js'),
  I18n = require('./I18n.js'),
  Theme = require('./Theme.js');

// "Panel protection": burn-in protection. Everything is stored in settings.protection (an object, like settings.osd);
// a value that is not there yet falls back to DEFAULTS. The screensaver (QML / web) will read the same keys.
var DEFAULTS = {
  brightnessOn: false, brightness: 30,                       // custom brightness while the screensaver runs, restored on exit
  dimOn: false, dimAfter: 10, dimDuration: 5, dimTo: 20,     // gradual dimming (minutes, minutes, % of the brightness)
  offOn: false, offAfter: 60,                                // panel turn-off timer (minutes)
  standbyOn: false, standbyAfter: 120,                       // standby timer (minutes)
  cornersOn: false, cornersEvery: 60,                        // OSD moves between the chosen corners (seconds)
  cornerTl: true, cornerTr: true, cornerBl: true, cornerBr: true,
  driftOn: false, driftPx: 8, driftPeriod: 5,                // smooth drift around the set position (pixels, minutes)
  fadeOn: false, fadeAfter: 30, fadeInPoi: true,             // auto fade out (seconds), fade in when the description changes
  fadeTextOn: true, fadeTextBack: 0,                         // name + description: fades, shown again on a timer (minutes, 0 = never)
  fadeClockOn: true, fadeClockBack: 5                        // clock + date: the same
};

// Texts: looked up in I18n under their key first (prot + the setting name); the English text is used until the key exists.
var STR = {
  protSecBrightness: 'Brightness', protSecTimers: 'Timers', protSecText: 'On-screen text',
  protTextNote: 'All three can be on together. They override the text position and opacity settings from the On-screen display panel.',
  protIntro: 'Options that protect the screen from burn-in.',
  protBrightnessOn: 'Custom screen brightness', protBrightness: 'Brightness, %',
  protBrightnessNote: 'The previous brightness is restored when the screensaver stops.',
  protDimOn: 'Gradual dimming', protDimAfter: 'Start dimming after, min', protDimDuration: 'Dim over, min', protDimTo: 'Dim down to, %',
  protOffOn: 'Panel turn-off timer', protOffAfter: 'Turn the panel off after, min',
  protStandbyOn: 'Standby timer', protStandbyAfter: 'Go to standby after, min',
  protCornersOn: 'Move the text between corners', protCornersEvery: 'Move every, sec', protCornersWhich: 'Corners to use (at least two)',
  protDriftOn: 'Smooth text drift', protDriftPx: 'Drift range, px', protDriftPeriod: 'Drift cycle, min',
  protFadeOn: 'Auto fade out the text', protFadeAfter: 'Fade out after, sec', protFadeInPoi: 'Fade in when the description changes',
  protFadeTextOn: 'Fade out the name and description', protFadeTextBack: 'Show the name and description again after, min (0 = never)',
  protFadeClockOn: 'Fade out the clock and date', protFadeClockBack: 'Show the clock and date again after, min (0 = never)',
  protShBrightness: 'Brightness', protShDim: 'Dimming', protShOff: 'Panel off', protShStandby: 'Standby',
  protShMove: 'OSD move', protShDrift: 'OSD drift', protShFade: 'OSD fade out',
  protUnitMin: 'min', protUnitSec: 'sec'
};
// corners reuse the position names of the OSD panel
var CORNERS = [['cornerTl', 'osdPosTl', 'Top left'], ['cornerTr', 'osdPosTr', 'Top right'],
  ['cornerBl', 'osdPosBl', 'Bottom left'], ['cornerBr', 'osdPosBr', 'Bottom right']];

function T(key, fallback) {
  var s;
  try { s = I18n.t(key); } catch (e) { s = null; }
  return (s && typeof s === 'string' && s !== key) ? s : fallback;
}
function tt(key) { return T(key, STR[key]); }
function lk(name) { return 'prot' + name.charAt(0).toUpperCase() + name.slice(1); }   // 'dimAfter' -> 'protDimAfter'

function get(settings, key) {
  var p = settings && settings.protection;
  return (p && typeof p === 'object' && p[key] !== undefined) ? p[key] : DEFAULTS[key];
}

// ---- component builders ------------------------------------------------------------------------
function toggle(key) {
  return {kind: ToggleItem, name: key, protKey: key, onchange: 'toggled'};
}
function picker(key, min, max, step) {
  return {kind: Item, name: key + 'Item', components: [
    {kind: Marquee.Text, name: key + 'Label'},
    {kind: SimpleIntegerPicker, name: key, protKey: key, min: min, max: max, step: step, unit: '', onChange: 'picked'}
  ]};
}
// settings of a switch: shown only while it is on, indented behind a thin line
function group(key, components) {
  return {name: key + 'Box', showing: false,
    style: 'margin: 0 0 8px 26px; padding-left: 20px; border-left: 2px solid ' + Theme.RULE + ';', components: components};
}
var SECTION_STYLE = 'margin-top: 20px; ' + Theme.HEAD_CASE;
// BodyText sits a few pixels left of the Divider heading text; this shifts the section notes to the heading's left edge
// (tune this one number if it is still off on the TV)
var HEAD_INDENT = 'padding-left: 12px;';
var NOTE_STYLE = 'margin: 4px 0 8px; font-size: ' + Theme.DESC_FONT + '; line-height: 1.35; color: ' + Theme.MUTED + ';';

// The three ways to protect the on-screen text (corners, drift, fade out) do not exclude each other: any combination works.
var TEXT_MODES = ['cornersOn', 'driftOn', 'fadeOn'];

var NUMBERS = ['brightness', 'dimAfter', 'dimDuration', 'dimTo', 'offAfter', 'standbyAfter', 'cornersEvery',
  'driftPx', 'driftPeriod', 'fadeAfter', 'fadeTextBack', 'fadeClockBack'];
var SWITCHES = ['brightnessOn', 'dimOn', 'offOn', 'standbyOn', 'cornersOn', 'driftOn', 'fadeOn'];

var ProtectionPanel = kind({
  name: 'ProtectionPanel',
  kind: Panel,
  title: '',   // set in create() (translated)
  headerType: 'small',
  // passed in by MainPanel
  settings: null,
  settingsPath: '',
  onChange: null,   // optional callback: MainPanel refreshes its summary line
  // the controls fire change events while they are being created / filled in
  initializing: true,

  components: [
    {kind: Scroller, fit: true, style: 'height: 100%;', components: [
      {style: 'margin-left: 7%; width: 88%;', components: [
        {kind: BodyText, name: 'intro', style: 'margin: 10px 0 20px; ' + HEAD_INDENT},

        {kind: Divider, name: 'dvBrightness', style: 'margin-top: 0; ' + Theme.HEAD_CASE},
        toggle('brightnessOn'),
        group('brightnessOn', [
          picker('brightness', 0, 100, 5),
          {kind: BodyText, name: 'brightnessNote', style: NOTE_STYLE}
        ]),

        {kind: Divider, name: 'dvTimers', style: SECTION_STYLE},
        toggle('dimOn'),
        group('dimOn', [picker('dimAfter', 1, 120, 1), picker('dimDuration', 1, 60, 1), picker('dimTo', 0, 90, 5)]),
        toggle('offOn'),
        group('offOn', [picker('offAfter', 5, 480, 5)]),
        toggle('standbyOn'),
        group('standbyOn', [picker('standbyAfter', 5, 720, 5)]),

        {kind: Divider, name: 'dvText', style: SECTION_STYLE},
        {kind: BodyText, name: 'textNote', style: NOTE_STYLE + ' ' + HEAD_INDENT},
        toggle('cornersOn'),
        group('cornersOn', [
          picker('cornersEvery', 15, 300, 5),
          {kind: BodyText, name: 'cornersWhichLabel', style: NOTE_STYLE},
          toggle('cornerTl'), toggle('cornerTr'), toggle('cornerBl'), toggle('cornerBr')
        ]),
        toggle('driftOn'),
        group('driftOn', [picker('driftPx', 1, 20, 1), picker('driftPeriod', 1, 10, 1)]),
        toggle('fadeOn'),
        group('fadeOn', [
          picker('fadeAfter', 5, 300, 5),
          toggle('fadeTextOn'), picker('fadeTextBack', 0, 60, 1), toggle('fadeInPoi'),
          toggle('fadeClockOn'), picker('fadeClockBack', 0, 60, 1)
        ])
      ]}
    ]},
    {kind: LunaService, name: 'save', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec'}
  ],

  create: function () {
    this.title = T('protection', 'Panel protection');
    this.inherited(arguments);
    this.settings = this.settings || {};
    this.dirty = false;
    this.quiet();
    this.buildControls();
    this.startJob('relayout', 'relayout', 100);
  },

  destroy: function () {
    // flush a pending save so nothing is lost when going back
    if (this.dirty) {
      this.stopJob('save');
      this.save();
    }
    this.inherited(arguments);
  },

  // the controls fire their change events also when their initial values are set from the code
  quiet: function () {
    this.initializing = true;
    this.startJob('quiet', function () { this.initializing = false; }, 300);
  },

  value: function (key) { return get(this.settings, key); },

  buildControls: function () {
    var self = this;
    this.$.intro.set('content', T('protectionIntro', STR.protIntro));
    this.$.dvBrightness.set('content', tt('protSecBrightness'));
    this.$.dvTimers.set('content', tt('protSecTimers'));
    this.$.dvText.set('content', tt('protSecText'));
    this.$.brightnessNote.set('content', tt('protBrightnessNote'));
    this.$.textNote.set('content', tt('protTextNote'));
    this.$.cornersWhichLabel.set('content', tt('protCornersWhich'));
    SWITCHES.concat(['fadeInPoi', 'fadeTextOn', 'fadeClockOn']).forEach(function (key) {
      self.$[key].set('content', tt(lk(key)));
      self.$[key].set('checked', !!self.value(key));
    });
    CORNERS.forEach(function (c) {
      self.$[c[0]].set('content', T(c[1], c[2]));
      self.$[c[0]].set('checked', !!self.value(c[0]));
    });
    NUMBERS.forEach(function (key) {
      self.$[key + 'Label'].set('content', tt(lk(key)));
      self.$[key].set('value', self.value(key));
    });
    SWITCHES.forEach(function (key) { self.$[key + 'Box'].set('showing', !!self.value(key)); });
  },

  // pickers created inside a hidden group were measured at zero size: lay them out again once they are visible
  relayout: function () {
    NUMBERS.forEach(function (key) {
      var p = this.$[key];
      if (p && p.reflow) { p.reflow(); }
      if (this.$[key + 'Item']) { this.$[key + 'Item'].resized(); }
    }, this);
  },

  // ---- handlers ----
  setValue: function (key, value) {
    if (!this.settings.protection || typeof this.settings.protection !== 'object') { this.settings.protection = {}; }
    this.settings.protection[key] = value;
    this.markDirty();
  },

  toggled: function (sender) {
    var key = sender.protKey, on = !!sender.active, box = this.$[key + 'Box'], left;
    if (this.initializing || this.value(key) === on) { return; }
    // moving between corners needs at least two of them: the switch jumps back (the stored value is still true, so the
    // change event of that jump is ignored by the check above, no extra "deaf" time is needed)
    if (/^corner[A-Z]/.test(key) && !on) {
      left = CORNERS.filter(function (c) { return c[0] !== key && this.value(c[0]); }, this).length;
      if (left < 2) {
        sender.set('checked', true);
        return;
      }
    }
    this.setValue(key, on);
    if (box) {
      box.set('showing', on);
      if (on) { this.startJob('relayout', 'relayout', 0); }
    }
  },

  picked: function (sender) {
    var v = sender.get('value');
    if (this.initializing || this.value(sender.protKey) === v) { return; }
    this.setValue(sender.protKey, v);
  },

  markDirty: function () {
    this.dirty = true;
    if (this.onChange) { this.onChange(); }
    this.startJob('save', 'save', 500);
  },

  save: function () {
    this.dirty = false;
    this.$.save.send({command: SettingsStore.saveCommand(this.settings)});   // app copy + persistent copy
  }
});

// number + unit ("30 min"); no space before a CJK unit ("30分")
function withUnit(value, unitKey) {
  var unit = tt(unitKey);
  return value + (/^[\u3000-\u9fff\uac00-\ud7af]/.test(unit) ? '' : ' ') + unit;
}

// One line for the main panel: which protections are on, "Brightness 30% · Dimming 10 min ↓20% · Panel off 60 min",
// or null if none is. The brightness always carries its percentage.
//  detailed = true:  the value of every protection (delay, target, period)
//  detailed = false: names only (brightness still with its %); MainPanel falls back to it when the detailed line
//                    does not fit on one line.
ProtectionPanel.summary = function (settings, detailed) {
  var parts = [], osd = [], v = function (key) { return get(settings, key); };
  function osdName(key) { var n = tt(key); return n.replace(/^OSD\s*:?\s*/, '') || n; }
  function add(name, detail) { parts.push(detailed && detail ? name + ' ' + detail : name); }
  if (v('brightnessOn')) { parts.push(tt('protShBrightness') + ' ' + v('brightness') + '%'); }
  if (v('dimOn')) { add(tt('protShDim'), withUnit(v('dimAfter'), 'protUnitMin') + ' \u2193' + v('dimTo') + '%'); }
  if (v('offOn')) { add(tt('protShOff'), withUnit(v('offAfter'), 'protUnitMin')); }
  if (v('standbyOn')) { add(tt('protShStandby'), withUnit(v('standbyAfter'), 'protUnitMin')); }
  // the three OSD protections share one "OSD:" prefix: "OSD: move 60 sec, drift 8 px, fade out 30 sec"
  // (every translated name starts with "OSD", with or without a colon: "OSD move", "OSD: перемещение", "OSD : déplacement")
  if (v('cornersOn')) { osd.push(osdName('protShMove') + (detailed ? ' ' + withUnit(v('cornersEvery'), 'protUnitSec') : '')); }
  if (v('driftOn')) { osd.push(osdName('protShDrift') + (detailed ? ' ' + v('driftPx') + ' px' : '')); }
  // fade out with both groups (name + description, clock + date) switched off fades nothing
  if (v('fadeOn') && (v('fadeTextOn') || v('fadeClockOn'))) { osd.push(osdName('protShFade') + (detailed ? ' ' + withUnit(v('fadeAfter'), 'protUnitSec') : '')); }
  if (osd.length) { parts.push('OSD: ' + osd.join(', ')); }
  return parts.length ? parts.join(' \u00b7 ') : null;
};
ProtectionPanel.DEFAULTS = DEFAULTS;
ProtectionPanel.TEXT_MODES = TEXT_MODES;

module.exports = ProtectionPanel;