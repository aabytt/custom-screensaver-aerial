var
  kind = require('enyo/kind'),
  Panel = require('moonstone/Panel'),
  FittableRows = require('layout/FittableRows'),
  BodyText = require('moonstone/BodyText'),
  Marquee = require('moonstone/Marquee'),
  ExpandablePicker = require('moonstone/ExpandablePicker'),
  Button = require('moonstone/Button'),
  LunaService = require('enyo-webos/LunaService'),
  Divider = require('moonstone/Divider'),
  Scroller = require('moonstone/Scroller'),
  Item = require('moonstone/Item'),
  ToggleItem = require('moonstone/ToggleItem'),
  VideoSelectPanel = require('./VideoSelectPanel.js'),
  DisplayPanel = require('./DisplayPanel.js'),
  LanguagePanel = require('./LanguagePanel.js'),
  SettingsStore = require('./SettingsStore.js'),
  I18n = require('./I18n.js');
var basePath = SettingsStore.basePath;
var applyPath = basePath + "/assets/apply.sh";
var linkPath = "/var/lib/webosbrew/init.d/50-custom-screensaver-aerial";
var settingsPath = SettingsStore.appPath;
// One object for the whole lifetime of the app: sub-panels keep a reference to it,
// so applySettings() fills it in place instead of replacing it.
var settings = {};
var releasesApi = 'https://api.github.com/repos/aabytt/custom-screensaver-aerial/releases/latest';
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
  uturn: '<path d="M7 20.5V10a5 5 0 0 1 10 0v9"/><path d="M13.5 15.5L17 19l3.5-3.5"/>'
};
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
var DESC_STYLE = 'margin: 0 0 0 ' + (ICON_SIZE + ICON_GAP) + 'px;';

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
        {name: 'content', style: 'margin-left: 7%; width: 60%;', components: [
          {components: [
            // one line (wraps if the screen is narrow): the language in use as an item that opens the
            // language list, then the version
            {style: 'display: flex; flex-wrap: wrap; align-items: center; margin: 0 0 8px;', components: [
              // icon and text are centered on the same axis (flex), not baseline-aligned
              {kind: Item, name: 'langLink', style: 'flex: none; margin-right: 40px; ' + ICON_ITEM, ontap: 'openLanguage', components: [
                iconComponent('globe'),
                {tag: 'span', name: 'langText', style: 'flex: none;'}
              ]},
              {kind: BodyText, name: 'versionInfo', style: 'margin: 0; flex: none;', content: ''}
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
            {style: 'margin: 28px 0 0', components: [
              {kind: Button, style: 'margin: 0 16px 0 0', i18n: 'testRun', ontap: 'testRun'},
              {kind: Button, name: 'updateButton', showing: false, style: 'margin: 0', i18n: 'update', ontap: 'openHbChannel'}
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
    {kind: LunaService, name: 'statusCheck', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec', onResponse: 'onStatusCheck', onError: 'onStatusCheck'},
    {kind: LunaService, name: 'exec', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec', onResponse: 'onExec', onError: 'onExec'},
    {kind: LunaService, name: 'init', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec', onResponse: 'onInit', onError: 'onInit'},
    {kind: LunaService, name: 'restore', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec'},
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
  },

  // (re)write every translated text; called when the language changes
  refreshStrings: function () {
    I18n.apply(this);
    this.$.autostart.set('content', iconLabel('power', I18n.t('autostart')));
    this.$.source.set('content', iconLabel('video', I18n.t('videoFormat')));
    this.$.playLowerQuality.set('content', iconLabel('uturn', I18n.t('fallbackSdr')));
    if (!this.resultShown) { this.$.result.set('content', I18n.t('nothing')); }
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
        self.version = JSON.parse(xhr.responseText).version;
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

  // "Version 1.2.3", or the highlighted "update available" line (marker, green, bold) if a newer release exists
  renderVersion: function () {
    var info = this.$.versionInfo;
    if (!this.version) { return; }
    if (this.latest) {
      info.set('content', I18n.t('updateAvailable', {version: this.version, latest: this.latest}));
      info.applyStyle('color', '#4cd964');
      info.applyStyle('font-weight', 'bold');
    } else {
      info.set('content', I18n.t('version', {version: this.version}));
    }
    this.refit();
  },

  // Compares with the latest GitHub release; the Update button appears only if it is newer.
  // Failures (no network, rate limit, timeout) are silent.
  checkUpdate: function () {
    var self = this, xhr = new XMLHttpRequest();
    xhr.open('GET', releasesApi);
    xhr.timeout = 10000;
    xhr.onload = function () {
      var latest;
      if (xhr.status !== 200) { return; }
      try {
        latest = JSON.parse(xhr.responseText).tag_name;
      } catch (e) {
        console.error(e);
        return;
      }
      if (latest && compareVersions(latest, self.version) > 0) {
        self.latest = String(latest).replace(/^v/i, '');
        self.renderVersion();
        self.$.updateButton.set('showing', true);
        self.refit();
      }
    };
    xhr.onerror = xhr.ontimeout = function () { console.info('Update check failed'); };
    xhr.send();
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
        onChange: this.bindSafely('updateDisplayInfo')
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
