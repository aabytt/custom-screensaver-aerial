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
  DisplayPanel = require('./DisplayPanel.js');
var basePath = "/media/developer/apps/usr/palm/applications/org.aabytt.webos.custom-screensaver-aerial";
var applyPath = basePath + "/assets/apply.sh";
var linkPath = "/var/lib/webosbrew/init.d/50-custom-screensaver-aerial";
var settingsPath = basePath + "/assets/settings.json";
// One object for the whole lifetime of the app: sub-panels keep a reference to it,
// so applySettings() fills it in place instead of replacing it.
var settings = {};
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
            {kind: Button, style: 'margin: 20px 0', content: 'Test run', ontap: 'testRun'}
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
    {kind: LunaService, name: 'init', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec', onResponse: 'onInit', onError: 'onInit'}
  ],

  bindings: [],

  create: function () {
    this.inherited(arguments);
    this.$.statusCheck.send({
      command: 'readlink ' + linkPath
    });
    this.loadSettingsLocal();   // direct read of the packaged file
    this.$.init.send({
      command: 'cat ' + settingsPath
    });
  },

  // Fallback: the app's own files are readable without the luna service
  loadSettingsLocal: function () {
    var self = this, xhr = new XMLHttpRequest();
    xhr.open('GET', 'assets/settings.json');
    xhr.onload = function () {
      if (settings.sourceType) { return; } // service read already won
      if (xhr.status === 200 || (xhr.status === 0 && xhr.responseText)) {
        try {
          self.applySettings(JSON.parse(xhr.responseText));
        } catch (e) {
          console.error(e);
        }
      }
    };
    xhr.send();
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

  onInit: function (sender, evt) {
    console.info(sender, evt);
    if (!evt || !evt.returnValue || !evt.stdoutString) {
      this.$.result.set('content', 'Could not read settings via service: ' +
        ((evt && (evt.errorText || evt.stderrString)) || 'no response'));
      return;
    }
    try {
      this.applySettings(JSON.parse(evt.stdoutString));
    } catch (e) {
      this.$.result.set('content', 'settings.json is not valid JSON: ' + e.message);
    }
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
    var json = JSON.stringify(settings).replace(/'/g, "'\\''");   // apostrophes would break the shell command
    this.exec("echo '" + json + "' > " + settingsPath);
  }
});
