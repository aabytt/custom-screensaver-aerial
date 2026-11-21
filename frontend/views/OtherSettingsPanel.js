var
  kind = require('enyo/kind'),
  Panel = require('moonstone/Panel'),
  Scroller = require('moonstone/Scroller'),
  Item = require('moonstone/Item'),
  BodyText = require('moonstone/BodyText'),
  Marquee = require('moonstone/Marquee'),
  ToggleItem = require('moonstone/ToggleItem'),
  SimpleIntegerPicker = require('moonstone/SimpleIntegerPicker'),
  LunaService = require('enyo-webos/LunaService'),
  SettingsStore = require('./SettingsStore.js'),
  Popup = require('moonstone/Popup'),
  Button = require('moonstone/Button'),
  I18n = require('./I18n.js'),
  QrCode = require('./QrCode.js'),
  Theme = require('./Theme.js');

var LINKS = {
  project: 'https://github.com/aabytt/custom-screensaver-aerial',
  discord: 'https://discord.com/invite/xWqRVEm',
  webosbrew: 'https://repo.webosbrew.org/',
  telegram: 'https://t.me/aerial_webos',
  donate: 'https://github.com/aabytt/custom-screensaver-aerial#donate'
};

var ACCENT = Theme.ACCENT;

// Screensaver delay (settings.screensaverDelay, minutes): only offered where screensaver-delay.sh says the TV's
// timer can be changed (webOS 3.x has it fixed at 60 min and no menu for it)
var DELAY_MAX = 240;   // same limit as screensaver-delay.sh
var DELAY_SH = 'sh ' + SettingsStore.assetsDir + '/screensaver-delay.sh';
var ICON_SIZE = 46;
var ICON_GAP = 22;
var ICON_ITEM = 'display: flex; align-items: center;';

// Line icons (24x24), take the text color like the icons of MainPanel
var ICONS = {
  donate: '<path d="M20.5 8.8c0 4.3-8.5 10-8.5 10s-8.5-5.7-8.5-10A4.2 4.2 0 0 1 12 6.3a4.2 4.2 0 0 1 8.5 2.5z"/>'
};

function iconMarkup(name) {
  if (name === 'github' || name === 'discord' || name === 'webosbrew' || name === 'telegram') {
    return '<img src="assets/icons/' + name + '.svg" width="100%" height="100%" alt="" />';
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="#fff">' +
    ICONS[name] + '</svg>';
}

function tr(key, fallback) {
  var text = I18n.t(key);
  return (typeof text === 'string' && text && text !== key) ? text : fallback;
}

// Same card frame as the popups of MainPanel
function popupStyle(width) {
  return 'width: ' + width + 'px; max-width: 94%; padding: 22px 44px 20px; background: ' + Theme.MODAL_BG +
    '; color: ' + Theme.TEXT + '; border: ' + Theme.MODAL_BORDER_PX + 'px solid ' + Theme.MODAL_BORDER +
    '; border-radius: ' + Theme.MODAL_RADIUS + 'px;';
}

// header: title + rule + short accent line (as in the report card)
function headerRule(components) {
  return {style: 'position: relative; padding-bottom: 16px; border-bottom: 2px solid ' + Theme.RULE + ';', components: components.concat([
    {style: 'position: absolute; left: 0; bottom: -2px; width: 120px; height: 2px; background: ' + ACCENT + ';'}
  ])};
}

var FOOTER = 'display: flex; align-items: center; margin: 18px 0 0; padding-top: 18px; border-top: 2px solid ' + Theme.RULE + ';';

// link item: icon + title + muted second line (same layout as the items of MainPanel)
function linkItem(name, icon) {
  return {kind: Item, name: name, style: ICON_ITEM, ontap: 'openLink', components: [
    {allowHtml: true, style: 'flex: none; width: ' + ICON_SIZE + 'px; height: ' + ICON_SIZE + 'px; margin-right: ' + ICON_GAP + 'px; line-height: 0;', content: iconMarkup(icon)},
    {style: 'flex: 1 1 auto; min-width: 0;', components: [
      {kind: Marquee.Text, name: name + 'Title'},
      {kind: BodyText, name: name + 'Sub', style: 'margin: 0; font-size: ' + Theme.DESC_FONT + ';'}
    ]}
  ]};
}

module.exports = kind({
  name: 'OtherSettingsPanel',
  kind: Panel,
  title: '',
  headerType: 'small',
  settings: null,
  version: '',
  onChange: null,

  components: [
    {kind: Scroller, fit: true, components: [
      {style: 'margin-left: 7%; width: 78%;', components: [
        {kind: Item, name: 'delay', showing: false, components: [
          {kind: Marquee.Text, name: 'delayLabel'},
          {kind: SimpleIntegerPicker, name: 'delayPicker', min: 1, max: DELAY_MAX, step: 1, unit: '', onChange: 'delayChanged'}
        ]},
        {kind: BodyText, name: 'delayHint', showing: false, style: 'margin: 0 0 22px; padding-left: 12px; text-align: left; font-size: ' + Theme.DESC_FONT + '; color: ' + Theme.MUTED + ';'},
        {kind: ToggleItem, name: 'noticeToggle', style: 'text-align: left;', onchange: 'noticeChanged'},
        {kind: BodyText, name: 'noticeHint', style: 'margin: 0 0 22px; padding-left: 12px; text-align: left; font-size: ' + Theme.DESC_FONT + '; color: ' + Theme.MUTED + ';'},
        {kind: Item, name: 'aboutItem', style: 'text-align: left;', ontap: 'openAbout', components: [
          {name: 'aboutLabel'},
          {kind: BodyText, name: 'aboutHint', style: 'margin: 0; text-align: left; font-size: ' + Theme.DESC_FONT + '; color: ' + Theme.MUTED + ';'}
        ]}
      ]}
    ]},

    // About card: header with the logo, description card, links, footer with Close
    {kind: Popup, name: 'aboutPopup', centered: true, floating: true, modal: true, autoDismiss: true,
      style: popupStyle(1000), components: [
        headerRule([
          {style: 'display: flex; align-items: center;', components: [
            {allowHtml: true, name: 'aboutLogo', style: 'flex: none; width: 96px; height: 96px; margin-right: 28px; line-height: 0;', content: ''},
            {style: 'flex: 1 1 auto; min-width: 0;', components: [
              {name: 'aboutTitle', style: 'font-size: 36px; font-weight: bold; color: #fff;'},
              {name: 'aboutVersion', style: 'margin-top: 4px; font-size: 24px; color: ' + Theme.MUTED + ';'}
            ]}
          ]}
        ]),
        {kind: BodyText, name: 'aboutText', style: 'margin: 18px 0 14px; padding: 16px 22px; background: ' + Theme.CARD + '; border-radius: 12px; font-size: 26px; line-height: 1.4; color: #b4b4b9;'},
        linkItem('projectLink', 'github'),
        linkItem('discordLink', 'discord'),
        linkItem('brewLink', 'webosbrew'),
        linkItem('telegramLink', 'telegram'),
        linkItem('donateLink', 'donate'),
        {style: FOOTER, components: [
          {name: 'aboutFooter', style: 'flex: 1 1 auto; min-width: 0; margin-right: 24px; font-size: 22px; color: ' + Theme.MUTED + ';'},
          {kind: Button, name: 'aboutClose', small: true, style: 'flex: none; margin: 0;', ontap: 'closeAbout'}
        ]}
      ]},

    {kind: LunaService, name: 'delaySupport', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec', onResponse: 'gotDelaySupport', onError: 'gotDelaySupport'},

    // QR card: header, code with caption, footer with Close (as the report card)
    {kind: Popup, name: 'qrPopup', centered: true, floating: true, modal: true, autoDismiss: true,
      onHide: 'qrHidden', style: popupStyle(720), components: [
        headerRule([{name: 'qrTitle', style: 'font-size: 36px; font-weight: bold; color: #fff;'}]),
        {name: 'qrBody', style: 'margin: 18px 0 0; text-align: center;', components: [
          {name: 'qr', allowHtml: true, style: 'display: inline-block; width: 300px; line-height: 0; border-radius: 14px; overflow: hidden;', content: ''},
          {kind: BodyText, name: 'qrError', showing: false, style: 'color: #ffb3b3;'},
          {name: 'qrHint', style: 'margin: 14px 0 0; font-size: 24px; line-height: 1.35; color: ' + Theme.MUTED + ';'},
          {name: 'qrUrl', style: 'margin: 4px 0 0; font-size: 24px; line-height: 1.35; color: #fff; word-break: break-all;'}
        ]},
        {style: FOOTER, components: [
          {kind: Button, name: 'qrClose', small: true, style: 'margin: 0 0 0 auto;', ontap: 'closeQr'}
        ]}
      ]}
  ],

  create: function () {
    this.inherited(arguments);
    this.settings = this.settings || {};
    this.set('title', tr('otherSettings', 'Other settings'));
    this.$.noticeToggle.set('content', tr('updateNoticeToggle', 'Show update notices in the screensaver'));
    this.$.noticeToggle.set('checked', this.settings.updateNoticeEnabled !== false);
    this.$.noticeHint.set('content', tr('updateNoticeInfo', 'Shows one update message when the screensaver starts.'));
    this.$.delayLabel.set('content', tr('screensaverDelay', 'Start the screensaver after, min'));
    this.$.delaySupport.send({command: DELAY_SH + ' support'});
    this.$.aboutLabel.set('content', tr('aboutTitle', 'About Aerial'));
    this.$.aboutHint.set('content', tr('aboutHint', 'Project information, community, and support.'));

    // logo on a rounded tile
    this.$.aboutLogo.set('content',
      '<div style="width:96px;height:96px;border-radius:24px;overflow:hidden;background:linear-gradient(145deg,#ff4d94 0%,#cf0652 100%);">' +
      '<img src="assets/icon130.png" width="96" height="96" alt="Aerial" style="display:block;" /></div>');
    this.$.aboutTitle.set('content', tr('aboutName', 'webOS Aerial Screensaver'));
    this.$.aboutVersion.set('content', tr('aboutVersion', 'Version {version} · MIT License').replace('{version}', this.version || ''));
    this.$.aboutText.set('content', tr('aboutText', 'Enjoying Aerial? Star the project, join the OpenLGTV community, or support development.'));

    this.setupLink(this.$.projectLink, 'GitHub', 'aabytt/custom-screensaver-aerial', LINKS.project);
    this.setupLink(this.$.discordLink, tr('aboutDiscord', 'OpenLGTV Discord'), tr('aboutDiscordSub', 'Community and help'), LINKS.discord);
    this.setupLink(this.$.brewLink, tr('aboutBrew', 'Homebrew Repository'), 'repo.webosbrew.org', LINKS.webosbrew);
    this.setupLink(this.$.telegramLink, tr('aboutTelegram', 'Telegram discussions'), '@aerial_webos', LINKS.telegram);
    this.setupLink(this.$.donateLink, tr('aboutDonate', 'Support'), tr('aboutDonateSub', 'Support development'), LINKS.donate);

    this.$.aboutFooter.set('content', tr('aboutFooter', 'Select a link to get a QR code for your phone'));
    this.$.aboutClose.set('content', tr('close', 'Close'));
  },

  setupLink: function (item, title, sub, url) {
    item.qrTitle = title;
    item.url = url;
    this.$[item.name + 'Title'].set('content', title);
    this.$[item.name + 'Sub'].set('content', sub);
  },

  // The answer is the TV's own delay in minutes, nothing where it can't be changed (the item stays hidden)
  gotDelaySupport: function (sender, evt) {
    var out = (evt && evt.returnValue && evt.stdoutString) ? String(evt.stdoutString).trim() : '';
    if (this.destroyed || !/^\d+$/.test(out)) { return; }
    this.delayStock = parseInt(out, 10);
    this.$.delayHint.set('content', this.delayStock ?
      tr('screensaverDelayInfo', 'The TV\'s own setting is {min} min.').replace('{min}', this.delayStock) : '');
    this.$.delay.set('showing', true);
    this.$.delayHint.set('showing', !!this.delayStock);
    // a picker given its value while hidden shows its first one: shown first, then set and laid out (as ProtectionPanel)
    this.delayReady = false;   // setting the value fires onChange
    this.$.delayPicker.set('value', Math.min(this.settings.screensaverDelay || this.delayStock || 60, DELAY_MAX));
    this.startJob('delayLayout', function () {
      var p = this.$.delayPicker;
      if (p.reflow) { p.reflow(); }
      this.$.delay.resized();
      this.delayReady = true;
    }, 300);
  },

  // every change restarts nopd (MainPanel applies it with the save), so only the last one of a quick series counts
  delayChanged: function () {
    if (!this.delayReady) { return; }
    this.delayPending = true;
    this.startJob('delayApply', 'delayApply', 1500);
  },

  delayApply: function () {
    var v = this.$.delayPicker.get('value'), m = v === this.delayStock ? 0 : v;   // the TV's own value: no patched copy needed
    this.delayPending = false;
    if (m === (this.settings.screensaverDelay || 0)) { return; }
    this.settings.screensaverDelay = m;
    if (this.onChange) { this.onChange('screensaverDelay', m); }
  },

  destroy: function () {
    if (this.delayPending) { this.stopJob('delayApply'); this.delayApply(); }   // closed within the wait
    this.inherited(arguments);
  },

  noticeChanged: function (sender) {
    var enabled = !!sender.active;
    this.settings.updateNoticeEnabled = enabled;
    if (this.onChange) { this.onChange('updateNoticeEnabled', enabled); }
  },

  openAbout: function () {
    this.$.aboutPopup.show();
  },

  closeAbout: function () {
    this.$.aboutPopup.hide();
  },

  openLink: function (sender) {
    var qr;
    try {
      qr = QrCode.svg(sender.url, 'M', 300);
      this.$.qrError.set('showing', false);
      this.$.qr.set('showing', true);
    } catch (e) {
      console.error(e);
      this.$.qr.set('content', '');
      this.$.qr.set('showing', false);
      this.$.qrError.set('content', tr('qrError', 'Could not generate the QR code. You can enter the URL shown below.'));
      this.$.qrError.set('showing', true);
    }
    this.$.qrTitle.set('content', sender.qrTitle);
    this.$.qrHint.set('content', tr('qrHint', 'Scan with your phone camera'));
    this.$.qrUrl.set('content', sender.url);
    this.$.qrClose.set('content', tr('close', 'Close'));
    if (qr) { this.$.qr.set('content', qr.markup); }
    this.$.aboutPopup.hide();
    this.$.qrPopup.show();
  },

  closeQr: function () {
    this.$.qrPopup.hide();
  },

  qrHidden: function () {
    if (!this.destroyed) { this.$.aboutPopup.show(); }
  }
});