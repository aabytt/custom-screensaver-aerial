var
  kind = require('enyo/kind'),
  Panel = require('moonstone/Panel'),
  Scroller = require('moonstone/Scroller'),
  Item = require('moonstone/Item'),
  BodyText = require('moonstone/BodyText'),
  Marquee = require('moonstone/Marquee'),
  ExpandablePicker = require('moonstone/ExpandablePicker'),
  SimpleIntegerPicker = require('moonstone/SimpleIntegerPicker'),
  ToggleItem = require('moonstone/ToggleItem'),
  LunaService = require('enyo-webos/LunaService'),
  SettingsStore = require('./SettingsStore.js');

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

var DisplayPanel = kind({
  name: 'DisplayPanel',
  kind: Panel,
  title: 'On-screen display',
  headerType: 'small',
  // passed in by MainPanel
  settings: null,
  settingsPath: '',
  onChange: null,   // optional callback: MainPanel refreshes its summary line

  components: [
    {kind: Scroller, fit: true, components: [
      {style: 'margin-left: 10%; width: 60%', components: [
        {kind: BodyText, style: 'margin: 10px 0 20px', content: 'Adjust how the text on top of the screensaver looks. Changes are saved automatically.'},
        {kind: ExpandablePicker, name: 'language', content: 'Text language', onChange: 'selectLang',
          components: LANGUAGES},
        {kind: Item, components: [
          {kind: Marquee.Text, content: 'Text opacity, %'},
          {kind: SimpleIntegerPicker, name: 'opacityPicker', min: 0, max: 100, step: 5, unit: '', onChange: 'setOpacity'}
        ]},
        {kind: ToggleItem, name: 'debug', content: 'Show debug info', onchange: 'debugToggle'}
      ]}
    ]},
    {kind: LunaService, name: 'save', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec'}
  ],

  create: function () {
    this.inherited(arguments);
    this.dirty = false;
    this.settings = this.settings || {};
    if (this.settings.localeLangIndex !== undefined) {
      this.$.language.set('selectedIndex', this.settings.localeLangIndex);
    }
    if (this.settings.osdOpacity !== undefined) {
      this.$.opacityPicker.set('value', this.settings.osdOpacity);
    }
    this.$.debug.set('checked', !!this.settings.debug);
  },

  destroy: function () {
    // flush a pending save so nothing is lost when going back
    if (this.dirty) {
      this.stopJob('save');
      this.save();
    }
    this.inherited(arguments);
  },

  selectLang: function () {
    var index = this.$.language.get('selectedIndex'), sel = this.$.language.get('selected');
    if (sel && this.settings.localeLangIndex != index) {
      this.settings.localeLang = sel.value;
      this.settings.localeLangIndex = index;
      this.markDirty();
    }
  },

  setOpacity: function () {
    var v = this.$.opacityPicker.get('value');
    if (this.settings.osdOpacity != v) {
      this.settings.osdOpacity = v;
      this.markDirty();
    }
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
  }
});

DisplayPanel.LANGUAGES = LANGUAGES;
module.exports = DisplayPanel;
