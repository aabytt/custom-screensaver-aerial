var
  kind = require('enyo/kind'),
  Panel = require('moonstone/Panel'),
  FittableRows = require('layout/FittableRows'),
  FittableColumns = require('layout/FittableColumns'),
  BodyText = require('moonstone/BodyText'),
  Marquee = require('moonstone/Marquee'),
  ExpandablePicker = require('moonstone/ExpandablePicker'),
  Button = require('moonstone/Button'),
  SimpleIntegerPicker = require('moonstone/SimpleIntegerPicker'),
  LunaService = require('enyo-webos/LunaService'),
  Divider = require('moonstone/Divider'),
  Scroller = require('moonstone/Scroller'),
  Item = require('moonstone/Item'),
  ToggleItem = require('moonstone/ToggleItem'),
  Group = require('enyo/Group');


var basePath = "/media/developer/apps/usr/palm/applications/org.webosbrew.custom-screensaver-aerial";
var applyPath = basePath + "/assets/apply.sh";
var linkPath = "/var/lib/webosbrew/init.d/50-custom-screensaver-aerial";
var settingsPath = basePath + "/assets/settings.json";
var settings = {};

module.exports = kind({
  name: 'MainPanel',
  kind: Panel,
  title: 'webOS Aerial Screensaver',
  headerType: 'medium',
  components: [
    {kind: FittableColumns, fit: true, components: [
      {kind: Scroller, fit: true, components: [
        {classes: 'moon-hspacing',  style: 'margin-left: 10%', controlClasses: 'moon-12h', components: [
          {components: [
            // {kind: Divider, content: 'Toggle Items'},
            {kind: ToggleItem, name: "autostart", content: 'Autostart', disabled: true, onchange: "autostartToggle"},
            {kind: Item, components: [
              {kind: Marquee.Text, content: 'Apply temporarily'},
              {kind: BodyText, style: 'margin: 10px 0', content: 'This will only enable custom screensaver until a reboot'},
            ], ontap: "temporaryApply"},
            {kind: ExpandablePicker, name: "source", content: 'Source video type', selectedIndex: settings.sourceTypeIndex,  onChange: 'selectSource', components: [
			  {content: 'FullHD (H265)', value: 'url-1080-SDR'},
			  {content: 'FullHD (H264)', value: 'url-1080-H264'},
			  {content: 'FullHD Dolby Vision (HEVC)', value: 'url-1080-HDR'},
			  {content: '4k (HEVC)', value: 'url-4K-SDR'},
			  {content: '4k Dolby Vision (HEVC)', value: 'url-4K-HDR'},
			  {content: '4k 240FPS (HEVC) - unlikely working in webOS', value: 'url-4K-SDR-240FPS'}
			  
            ]},
            {kind: ExpandablePicker, name: "language", content: 'On-screen display text language', selectedIndex: settings.localeLangIndex , onChange: 'selectLang',
			components: [
				{value:'ar-AE', content:'العربية'},
				{value:'be-BY', content:'Беларуская'},
				{value:'ca-ES', content:'Català'},
				{value:'cs-CZ', content:'Čeština'},
				{value:'da-DK', content:'Dansk'},
				{value:'de-DE', content:'Deutsch'},
				{value:'el-GR', content:'ελληνικά'},
				{value:'en-AU', content:'English (Australia)'},
				{value:'en-GB', content:'English (United Kingdom)'},
				{value:'en-US', content:'English (United States)'},
				{value:'es-ES', content:'Español'},
				{value:'es-419', content:'Español (Latinoamérica)'},
				{value:'fi-FI', content:'Suomi'},
				{value:'fr-CA', content:'Français (Canada)'},
				{value:'fr-FR', content:'Français'},
				{value:'he-IL', content:'עברית'},
				{value:'hi-IN', content:'हिन्दी'},
				{value:'hr-HR', content:'Hrvatski'},
				{value:'hu-HU', content:'Magyar'},
				{value:'id-ID', content:'Bahasa Indonesia'},
				{value:'it-IT', content:'Italiano'},
				{value:'ja-JP', content:'日本語'},
				{value:'ko-KR', content:'한국어'},
				{value:'ms-MY', content:'Bahasa Melayu'},
				{value:'nl-NL', content:'Nederlands'},
				{value:'nb-NO', content:'Norge'},
				{value:'pl-PL', content:'Polski'},
				{value:'pt-BR', content:'Português (Brasil)'},
				{value:'pt-PT', content:'Português (Portugal)'},
				{value:'ro-RO', content:'Română'},
				{value:'ru-RU', content:'Русский'},
				{value:'sk-SK', content:'Slovenčina'},
				{value:'sv-SE', content:'Svenska'},
				{value:'th-TH', content:'ไทย'},
				{value:'tr-TR', content:'Türkçe'},
				{value:'uk-UA', content:'Українська'},
				{value:'vi-VN', content:'Tiếng Việt'},
				{value:'zh-CN', content:'中文 (中国大陆)'},
				{value:'zh-HK', content:'中文（香港）'},
				{value:'zh-TW', content:'中文 (台灣)'}
            ]
            },
            {kind: Item, components: [ 
				{kind: Marquee.Text, content: 'Text opacity, %'},
				{kind: SimpleIntegerPicker, name: 'opacityPicker', value: settings.osdOpacity, min: 0, max: 100, step: 5, unit: '', onChange: 'setOpacity' }
            ]},
            {kind: ToggleItem, name: "debug", content: 'Show debug info', checked: settings.debug, onchange: 'debugToggle'},
            {kind: ToggleItem, name: "playLowerQuality", content: 'Play SDR source if HDR not available', checked: settings.playLowerQuality, onchange: 'playLowerQualityToggle'},		  
            {kind: Button, style: 'margin: 10px 0', content: 'Test run', ontap: "testRun"},			  
          ]},
        ]},
      ]},
    ]},
    {components: [
      {kind: Divider, content: 'Result'},
      {kind: BodyText, name: 'result', content: 'Nothing selected...'}
    ]},
    {kind: LunaService, name: 'statusCheck', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec', onResponse: 'onStatusCheck', onError: 'onStatusCheck'},
    {kind: LunaService, name: 'exec', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec', onResponse: 'onExec', onError: 'onExec'},
    {kind: LunaService, name: 'init', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec', onResponse: 'onInit', onError: 'onInit'},	  
  ],

  bindings: [],

  create: function () {
    this.inherited(arguments);
    this.$.statusCheck.send({
      command: 'readlink ' + linkPath,
    });
    this.$.init.send({
      command: 'cat ' + settingsPath,
    });	  
  },
	
  onInit: function (sender, evt) {
    console.info(sender, evt);
    settings = JSON.parse(evt.stdoutString);
    this.$.language.set('selectedIndex', settings.localeLangIndex);
    this.$.source.set('selectedIndex', settings.sourceTypeIndex);
    this.$.opacityPicker.set('value', settings.osdOpacity);
    this.$.debug.set('checked', settings.debug);
    this.$.playLowerQuality.set('checked', settings.playLowerQuality);	  
  },
	
  testRun: function (command) {
    this.exec("luna-send -n 1 'luna://com.webos.service.tvpower/power/turnOnScreenSaver' '{}'");
  },

  temporaryApply: function (command) {
    this.exec(applyPath); 
  },

  exec: function (command) {
    console.info(command);
    this.$.result.set('content', 'Processing...');
    this.$.exec.send({
      command: command,
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
    this.$.autostart.set('checked', evt.stdoutString.trim() == applyPath);
  },
  
  selectSource: function (sender) {
	if(settings.sourceTypeIndex != this.$.source.get('selectedIndex')){	  
		settings.sourceType = this.$.source.get('selected').value;
		settings.sourceTypeIndex = this.$.source.get('selectedIndex');	  
		this.settingsSave();
	}
  },

  selectLang: function (sender) {
    if(settings.localeLangIndex != this.$.language.get('selectedIndex')){
	settings.localeLang = this.$.language.get('selected').value;
	settings.localeLangIndex = this.$.language.get('selectedIndex');
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
  
  debugToggle: function (sender) {
    if (sender.active) {
      settings.debug = true;
      this.settingsSave();
    } else {
      settings.debug = false;
      this.settingsSave();
    }
  }, 
	
  playLowerQualityToggle: function (sender) {
    if (sender.active) {
      settings.playLowerQualityToggle = true;
      this.settingsSave();
    } else {
      settings.playLowerQualityToggle = false;
      this.settingsSave();
    }
  }, 	
  
  setOpacity: function (sender) {
	if(settings.osdOpacity != this.$.opacityPicker.value){
		settings.osdOpacity = this.$.opacityPicker.value;
		this.settingsSave();
	}
  }, 
  
  settingsSave: function (sender) {
    this.exec("echo '" + JSON.stringify(settings)+"' > "+ settingsPath);
  },
});
