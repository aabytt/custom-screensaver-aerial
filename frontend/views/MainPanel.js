var
  kind = require('enyo/kind'),
  Panel = require('moonstone/Panel'),
  FittableColumns = require('layout/FittableColumns'),
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
  SettingsStore = require('./SettingsStore.js');
var basePath = SettingsStore.basePath;
var applyPath = basePath + "/assets/apply.sh";
var linkPath = "/var/lib/webosbrew/init.d/50-custom-screensaver-aerial";
var settingsPath = SettingsStore.appPath;
// One object for the whole lifetime of the app: sub-panels keep a reference to it,
// so applySettings() fills it in place instead of replacing it.
var settings = {};
var releasesApi = 'https://api.github.com/repos/aabytt/custom-screensaver-aerial/releases/latest';
var hbChannelId = 'org.webosbrew.hbchannel';

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
    {kind: FittableColumns, fit: true, components: [
      {kind: Scroller, fit: true, components: [
        {classes: 'moon-hspacing', style: 'margin-left: 10%', controlClasses: 'moon-12h', components: [
          {components: [
            {kind: BodyText, name: 'versionInfo', style: 'margin: 10px 0 20px', content: ''},
            {kind: ToggleItem, name: 'autostart', content: 'Autostart', disabled: true, onchange: 'autostartToggle'},
            {kind: Item, components: [
              {kind: Marquee.Text, content: 'Apply until reboot'},
              {kind: BodyText, style: 'margin: 10px 0', content: 'Turns on the custom screensaver for this session only'}
            ], ontap: 'temporaryApply'},
            {kind: ExpandablePicker, name: 'source', content: 'Video format', onChange: 'selectSource', components: [
              {content: 'FullHD (H265)', value: 'url-1080-SDR'},
              {content: 'FullHD (H264)', value: 'url-1080-H264'},
              {content: 'FullHD Dolby Vision (HEVC)', value: 'url-1080-HDR'},
              {content: '4k (HEVC)', value: 'url-4K-SDR'},
              {content: '4k Dolby Vision (HEVC)', value: 'url-4K-HDR'},
              {content: '4k 240FPS (HEVC) - unlikely working in webOS', value: 'url-4K-SDR-240FPS'}
            ]},
            {kind: Item, components: [
              {kind: Marquee.Text, content: 'Playlist'},
              {kind: BodyText, style: 'margin: 10px 0', name: 'videoSelectInfo', content: 'Pick which videos are played'}
            ], ontap: 'openVideoSelect'},
            {kind: ToggleItem, name: 'playLowerQuality', content: 'Fall back to SDR if no Dolby Vision', onchange: 'playLowerQualityToggle'},
            {kind: Item, components: [
              {kind: Marquee.Text, content: 'On-screen display'},
              {kind: BodyText, style: 'margin: 10px 0', name: 'displayInfo', content: 'Language, text opacity, debug info'}
            ], ontap: 'openDisplay'},
            {style: 'margin: 20px 0', components: [
              {kind: Button, style: 'margin: 0 20px 0 0', content: 'Test run', ontap: 'testRun'},
              {kind: Button, name: 'updateButton', showing: false, style: 'margin: 0', content: 'Update', ontap: 'openHbChannel'}
            ]}
          ]}
        ]}
      ]}
    ]},
    {components: [
      {kind: Divider, content: 'Result'},
      {kind: BodyText, name: 'result', content: 'Nothing selected...'}
    ]},
    {kind: LunaService, name: 'statusCheck', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec', onResponse: 'onStatusCheck', onError: 'onStatusCheck'},
    {kind: LunaService, name: 'exec', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec', onResponse: 'onExec', onError: 'onExec'},
    {kind: LunaService, name: 'init', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec', onResponse: 'onInit', onError: 'onInit'},
    {kind: LunaService, name: 'restore', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec'}
  ],

  bindings: [],

  create: function () {
    this.inherited(arguments);
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
      this.$.result.set('content', 'Could not read settings (neither the saved copy nor the packaged settings.json)');
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
      this.$.restore.send({command: SettingsStore.saveCommand(settings)});
    }
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
        self.$.versionInfo.set('content', 'Version ' + self.version);
        self.checkUpdate();
      }
    };
    xhr.send();
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
        latest = String(latest).replace(/^v/i, '');
        // highlighted: marker, green, bold
        self.$.versionInfo.set('content', '\u25b2 Version ' + self.version + ' \u00b7 update available: ' + latest);
        self.$.versionInfo.applyStyle('color', '#4cd964');
        self.$.versionInfo.applyStyle('font-weight', 'bold');
        self.$.updateButton.set('showing', true);
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
    this.updateDisplayInfo();
  },

  // summary line under "On-screen display"
  updateDisplayInfo: function () {
    var lang = DisplayPanel.LANGUAGES.filter(function (l) { return l.value === settings.localeLang; })[0],
      parts = [];
    if (lang) { parts.push(lang.content); }
    if (settings.osdOpacity !== undefined) { parts.push('opacity ' + settings.osdOpacity + '%'); }
    parts.push(settings.debug ? 'debug on' : 'debug off');
    this.$.displayInfo.set('content', parts.join(' \u00b7 '));
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
        this.$.result.set('content', 'Saved settings are not valid JSON: ' + e.message);
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
    this.$.result.set('content', 'Processing...');
    this.$.exec.send({
      command: command
    });
  },

  onExec: function (sender, evt) {
    console.info(evt);
    if (evt.returnValue) {
      this.$.result.set('content', 'Success!<br />' + evt.stdoutString + evt.stderrString);
    } else {
      this.$.result.set('content', 'Failed: ' + evt.errorText + ' ' + evt.stdoutString + evt.stderrString);
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
      this.$.result.set('content', 'Settings not loaded yet (settings.json could not be read), cannot open video list');
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
      this.$.result.set('content', 'Failed to open video list: ' + e.message);
    }
  },

  openDisplay: function () {
    if (!settings.sourceType) {
      this.$.result.set('content', 'Settings not loaded yet (settings.json could not be read), cannot open display options');
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
      this.$.result.set('content', 'Failed to open display options: ' + e.message);
    }
  },

  settingsSave: function () {
    this.exec(SettingsStore.saveCommand(settings));   // app copy + persistent copy
  }
});
