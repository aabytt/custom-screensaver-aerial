var
  kind = require('enyo/kind'),
  Panel = require('moonstone/Panel'),
  Scroller = require('moonstone/Scroller'),
  Item = require('moonstone/Item'),
  Spotlight = require('spotlight'),
  I18n = require('./I18n.js'),
  DisplayPanel = require('./DisplayPanel.js');

// Grid: the languages are split into COLS columns (filled top to bottom, left to right, so the
// alphabetical order reads naturally) to fit all of them on one screen without scrolling.
// If it does not fit your TV: fewer COLS = wider items but taller list, more COLS = the opposite.
var COLS = 4;

// Interface language list. The main panel has no room (and no scroller) for 40+ languages,
// so the picker lives here. Tapping a language applies it at once; Back returns to the main panel.
module.exports = kind({
  name: 'LanguagePanel',
  kind: Panel,
  title: '',
  headerType: 'small',
  // passed in by MainPanel
  current: '',     // value of the language in use
  onChange: null,  // callback(value): MainPanel switches and saves the language

  components: [
    {kind: Scroller, fit: true, components: [
      {name: 'list', style: 'margin-left: 4%; width: 92%;'}
    ]}
  ],

  create: function () {
    this.title = I18n.t('uiLanguage');
    this.inherited(arguments);
    var langs = DisplayPanel.LANGUAGES, perCol = Math.ceil(langs.length / COLS), cols = [], i;
    for (i = 0; i < COLS; i++) {
      cols.push({
        style: 'display: inline-block; vertical-align: top; width: ' + (100 / COLS) + '%;',
        components: langs.slice(i * perCol, (i + 1) * perCol).map(function (l) {
          return {kind: Item, lang: l.value, label: l.content, content: l.content, ontap: 'pick',
            style: 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;'};
        })
      });
    }
    this.$.list.createComponents(cols, {owner: this});
    this.mark();
    if (this.$.list.generated) { this.$.list.render(); }
  },

  rendered: function () {
    this.inherited(arguments);
    // start on the language in use, not at the top of a long list
    this.startJob('focusCurrent', 'focusCurrent', 400);
  },

  destroy: function () {
    this.stopJob('focusCurrent');
    this.stopJob('fadeTitle');
    this.inherited(arguments);
  },

  focusCurrent: function () {
    var cur = this.currentItem();
    if (cur) {
      try { Spotlight.spot(cur); } catch (e) { /* focus is a convenience only */ }
    }
  },

  // all language items of all columns
  allItems: function () {
    var out = [];
    this.$.list.getClientControls().forEach(function (col) { out = out.concat(col.getClientControls()); });
    return out;
  },

  currentItem: function () {
    var self = this;
    return this.allItems().filter(function (c) { return c.lang === self.current; })[0];
  },

  // a check mark behind the language in use
  mark: function () {
    var self = this;
    this.allItems().forEach(function (c) {
      c.set('content', c.label + (c.lang === self.current ? '  \u2713' : ''));
    });
  },

  pick: function (sender) {
    this.current = sender.lang;
    if (this.onChange) { this.onChange(sender.lang); }
    this.fadeTitle();   // the panel itself is now in the new language
    this.mark();
    return true;
  },

  // the title is swapped under a short fade-out / fade-in
  fadeTitle: function () {
    var h = this.$.header;
    if (!h || !h.hasNode()) { this.set('title', I18n.t('uiLanguage')); return; }
    h.applyStyle('transition', 'opacity 150ms ease-out');
    h.applyStyle('opacity', 0);
    this.startJob('fadeTitle', function () {
      this.set('title', I18n.t('uiLanguage'));
      if (this.$.header) {
        this.$.header.applyStyle('transition', 'opacity 350ms ease-in');
        this.$.header.applyStyle('opacity', 1);
      }
    }, 160);
  }
});
