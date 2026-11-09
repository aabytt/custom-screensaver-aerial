var
  kind = require('enyo/kind'),
  Control = require('enyo/Control'),
  Panel = require('moonstone/Panel'),
  Scroller = require('moonstone/Scroller'),
  Item = require('moonstone/Item'),
  BodyText = require('moonstone/BodyText'),
  Divider = require('./Heading.js'),
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
  protSecBrightness: 'Brightness', protSecTimers: 'Timers', protSecText: 'On-screen text', protSecCurve: 'Brightness over time',
  protCurveNote: 'Without custom brightness the curve starts from the brightness set on the TV, shown as 100%.',
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

// ---- brightness curve ---------------------------------------------------------------------------
// Panel brightness over the time of the screensaver: the custom brightness (or "as set on the TV" = 100%), the gradual
// dimming, and the moments the panel turns off and the TV goes to standby (the brightness drops to zero at the earlier one). Drawn as an inline SVG
// that scales to the width of the panel; all numbers below are SVG units, not pixels.
var CURVE_KEYS = ['brightnessOn', 'brightness', 'dimOn', 'dimAfter', 'dimDuration', 'dimTo',
  'offOn', 'offAfter', 'standbyOn', 'standbyAfter'];
var CURVE = {w: 800, h: 200, left: 44, right: 14, top: 12, bottom: 34, font: 12};   // font 12 = about the size of a note text on the TV
var CURVE_STEPS = [5, 10, 15, 30, 60, 120, 240];    // time axis tick step (minutes); the smallest one giving 6 ticks or fewer
var CURVE_COLOR = Theme.ACCENT || '#cf0652';

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// SVG text of the curve for the given settings, or null if no protection that changes the brightness is on
function curveSvg(settings) {
  var v = function (key) { return get(settings, key); },
    c = CURVE, x0 = c.left, pw = c.w - c.left - c.right, y0 = c.top, ph = c.h - c.top - c.bottom, y1 = y0 + ph,
    base = v('brightnessOn') ? v('brightness') : 100,
    dimOn = !!v('dimOn'), dimStart = v('dimAfter'), dimEnd = dimStart + v('dimDuration'),
    low = base * v('dimTo') / 100,
    events = [],                             // panel turn-off and standby, earliest first: both are marked on the chart
    end = null,                              // the brightness drops to zero here: the earlier of the two
    key, raw, step, horizon, times, pts, out = [], t, i, last, ly, offAt, sbAt, seg, dashFrom = null, greyFrom = null;

  if (v('offOn')) { events.push({at: v('offAfter'), key: 'protShOff', order: 0}); }
  if (v('standbyOn')) { events.push({at: v('standbyAfter'), key: 'protShStandby', order: 1}); }
  events.sort(function (a, b) { return a.at - b.at || a.order - b.order; });
  if (events.length) { end = events[0].at; }
  if (!v('brightnessOn') && !dimOn && end === null) { return null; }

  function level(min) {
    if (!dimOn || min <= dimStart) { return base; }
    if (min >= dimEnd) { return low; }
    return base + (low - base) * (min - dimStart) / (dimEnd - dimStart);
  }
  function X(min) { return x0 + min / horizon * pw; }
  function Y(pct) { return y1 - pct / 100 * ph; }
  function pt(p) { return X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); }
  function text(x, y, anchor, str) {
    return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="' + anchor + '" fill="' + Theme.MUTED + '">' + esc(str) + '</text>';
  }

  // time range: at least 30 minutes, a bit more than the last event, rounded to whole ticks
  key = Math.max(dimOn ? dimEnd : 0, events.length ? events[events.length - 1].at : 0);
  raw = Math.max(30, key * 1.15);
  step = CURVE_STEPS[CURVE_STEPS.length - 1];
  for (i = 0; i < CURVE_STEPS.length; i++) {
    if (raw / CURVE_STEPS[i] <= 6) { step = CURVE_STEPS[i]; break; }
  }
  horizon = Math.ceil(raw / step) * step;

  // the points of the line: start, the corners of the dimming ramp, the end, and the drop to zero after it
  times = [0, horizon];
  if (dimOn) { times.push(dimStart, dimEnd); }
  if (end !== null) { times.push(end); }
  times = times.filter(function (m, idx) { return (end === null || m <= end) && times.indexOf(m) === idx; });
  times.sort(function (a, b) { return a - b; });
  pts = times.map(function (m) { return [m, level(m)]; });
  if (end !== null) { pts.push([end, 0]); }   // the drop; what follows it is drawn separately, in grey
  last = pts[pts.length - 1];

  out.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + c.w + ' ' + c.h + '" width="100%" font-size="' + c.font +
    '" style="display: block; overflow: visible; font-family: inherit;">');
  // grid and the brightness axis
  [0, 50, 100].forEach(function (p) {
    out.push('<line x1="' + x0 + '" y1="' + Y(p).toFixed(1) + '" x2="' + (x0 + pw) + '" y2="' + Y(p).toFixed(1) +
      '" stroke="' + Theme.RULE + '" stroke-width="1"/>');
    out.push(text(x0 - 6, Y(p) + 4, 'end', p + '%'));
  });
  // the time axis
  for (t = 0; t <= horizon; t += step) {
    out.push('<line x1="' + X(t).toFixed(1) + '" y1="' + y1 + '" x2="' + X(t).toFixed(1) + '" y2="' + (y1 + 4) +
      '" stroke="' + Theme.RULE + '" stroke-width="1"/>');
    out.push(text(X(t), y1 + 18, 'middle', t));
  }
  out.push(text(c.w - c.right, y1 + 32, 'end', tt('protUnitMin')));
  // the area under the line and the line itself
  out.push('<polygon points="' + pts.map(pt).join(' ') + ' ' + X(last[0]).toFixed(1) + ',' + y1 + ' ' + X(0).toFixed(1) + ',' + y1 +
    '" fill="' + CURVE_COLOR + '" fill-opacity="0.18"/>');
  out.push('<polyline points="' + pts.map(pt).join(' ') + '" fill="none" stroke="' + CURVE_COLOR +
    '" stroke-width="2.5" stroke-linejoin="round"/>');
  // after the drop: with the panel off but the TV still on (turn-off timer first) the line goes on dashed in the colour,
  // from the moment the TV is off (standby) it is grey
  if (end !== null) {
    offAt = v('offOn') ? v('offAfter') : null;
    sbAt = v('standbyOn') ? v('standbyAfter') : null;
    if (sbAt !== null && (offAt === null || sbAt <= offAt)) { greyFrom = sbAt; }
    else { dashFrom = offAt; greyFrom = sbAt; }
    seg = function (from, to, color, dash) {
      out.push('<line x1="' + X(from).toFixed(1) + '" y1="' + Y(0).toFixed(1) + '" x2="' + X(to).toFixed(1) + '" y2="' + Y(0).toFixed(1) +
        '" stroke="' + color + '" stroke-width="2.5"' + (dash ? ' stroke-dasharray="7 5"' : '') + '/>');
    };
    if (dashFrom !== null) { seg(dashFrom, greyFrom !== null ? greyFrom : horizon, CURVE_COLOR, true); }
    if (greyFrom !== null) { seg(greyFrom, horizon, Theme.MUTED, false); }
  }
  // values: the starting brightness (if it is not on the axis already) and where the dimming ends
  if (base !== 100) { out.push(text(x0 + 6, Y(base) - 6, 'start', base + '%')); }
  if (dimOn && low !== base && (end === null || dimEnd <= end)) {
    ly = Y(low) + 16;
    if (ly > y1 - 2) { ly = Y(low) - 6; }   // no room below the line, put it above
    out.push(text(X(dimEnd) + 6, ly, 'start', Math.round(low) + '%'));
  }
  // the turn-off and standby moments: a dashed line each, the labels in separate rows so they never overlap each other.
  // The first label goes on the side with more room; the later ones to the right of their line if it fits.
  events.forEach(function (e, idx) {
    var x = X(e.at), left = idx === 0 ? x - x0 >= 170 : x0 + pw - x < 90;
    if (idx === 0 || e.at !== events[idx - 1].at) {
      out.push('<line x1="' + x.toFixed(1) + '" y1="' + y0 + '" x2="' + x.toFixed(1) + '" y2="' + y1 +
        '" stroke="' + Theme.MUTED + '" stroke-width="1.5" stroke-dasharray="5 4"/>');
    }
    out.push(text(left ? x - 6 : x + 6, y0 + 14 + idx * 16, left ? 'end' : 'start', tt(e.key) + ' ' + withUnit(e.at, 'protUnitMin')));
  });
  out.push('</svg>');
  return out.join('');
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
var SECTION_STYLE = 'margin-top: 20px;';
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

        {kind: Divider, name: 'dvBrightness', style: 'margin-top: 0;'},
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

        // the brightness curve: shown only while some protection changes the brightness
        {name: 'curveBox', showing: false, components: [
          {kind: Divider, name: 'dvCurve', style: SECTION_STYLE},
          {kind: Control, name: 'curve', allowHtml: true, style: 'margin: 8px 0 0 12px;'},
          {kind: BodyText, name: 'curveNote', style: NOTE_STYLE + ' ' + HEAD_INDENT}
        ]},

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
    this.$.dvCurve.set('content', tt('protSecCurve'));
    this.$.curveNote.set('content', tt('protCurveNote'));
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
    this.fixTimers();
    this.updateCurve();
  },

  // redraw the brightness curve (cheap: one small SVG); hide it while nothing changes the brightness
  updateCurve: function () {
    var svg = curveSvg(this.settings);
    this.$.curveBox.set('showing', !!svg);
    if (svg) {
      this.$.curve.set('content', svg);
      this.$.curveNote.set('showing', !this.value('brightnessOn'));
    }
  },

  // pickers created inside a hidden group were measured at zero size: lay them out again once they are visible
  relayout: function () {
    NUMBERS.forEach(function (key) {
      var p = this.$[key];
      if (p && p.reflow) { p.reflow(); }
      if (this.$[key + 'Item']) { this.$[key + 'Item'].resized(); }
    }, this);
  },

  // The TV cannot go to standby before the panel is turned off: with both timers on, standby is never earlier than the
  // panel turn-off. Whichever of the two was changed, the standby time is the one that gives way (it moves up to the
  // turn-off time). Also fixes a file saved before this rule existed.
  fixTimers: function () {
    var off = this.value('offAfter');
    if (!this.value('offOn') || !this.value('standbyOn') || this.value('standbyAfter') >= off) { return; }
    this.setValue('standbyAfter', off);
    this.$.standbyAfter.set('value', off);
  },

  // ---- handlers ----
  setValue: function (key, value) {
    if (!this.settings.protection || typeof this.settings.protection !== 'object') { this.settings.protection = {}; }
    this.settings.protection[key] = value;
    if (CURVE_KEYS.indexOf(key) >= 0) { this.updateCurve(); }
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
    if (key === 'offOn' || key === 'standbyOn') { this.fixTimers(); }
    if (box) {
      box.set('showing', on);
      if (on) { this.startJob('relayout', 'relayout', 0); }
    }
  },

  picked: function (sender) {
    var v = sender.get('value');
    if (this.initializing || this.value(sender.protKey) === v) { return; }
    this.setValue(sender.protKey, v);
    if (sender.protKey === 'offAfter' || sender.protKey === 'standbyAfter') { this.fixTimers(); }
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
ProtectionPanel.curveSvg = curveSvg;
ProtectionPanel.TEXT_MODES = TEXT_MODES;

module.exports = ProtectionPanel;
