var
  kind = require('enyo/kind'),
  Panel = require('moonstone/Panel'),
  Scroller = require('moonstone/Scroller'),
  Item = require('moonstone/Item'),
  BodyText = require('moonstone/BodyText'),
  ToggleItem = require('moonstone/ToggleItem'),
  Popup = require('moonstone/Popup'),
  Button = require('moonstone/Button'),
  I18n = require('./I18n.js'),
  QrCode = require('./QrCode.js'),
  Theme = require('./Theme.js');

var LINKS = {
  project: 'https://github.com/aabytt/custom-screensaver-aerial',
  discord: 'https://discord.com/invite/xWqRVEm',
  donate: 'https://github.com/aabytt/custom-screensaver-aerial#donate'
};

var ICON_SIZE = 30;
var ICON_GAP = 14;
var ICONS = {
  github: '<path d="M12 2.8a9.2 9.2 0 0 0-2.9 17.9c.5.1.7-.2.7-.5v-1.7c-2.9.6-3.5-1.2-3.5-1.2-.5-1.2-1.2-1.5-1.2-1.5-1-.7.1-.7.1-.7 1.1.1 1.7 1.1 1.7 1.1 1 .1.8 2.1 3.4 1.5.1-.7.4-1.2.7-1.5-2.3-.3-4.7-1.2-4.7-5.1 0-1.1.4-2 1.1-2.7-.1-.3-.5-1.3.1-2.7 0 0 .9-.3 2.9 1.1a10 10 0 0 1 5.2 0c2-1.4 2.9-1.1 2.9-1.1.6 1.4.2 2.4.1 2.7.7.7 1.1 1.6 1.1 2.7 0 3.9-2.4 4.8-4.7 5.1.4.3.7.9.7 1.8v2.2c0 .3.2.6.7.5A9.2 9.2 0 0 0 12 2.8z"/>',
  discord: '<path d="M7.1 6.2a15 15 0 0 1 3-.9l.4.8a13 13 0 0 1 3 0l.4-.8a15 15 0 0 1 3 .9c1.9 2.8 2.4 5.6 2.1 8.4a14 14 0 0 1-4.6 2.3l-1-1.6c.6-.2 1.2-.5 1.7-.9-1.7.8-3.5.8-5.2 0 .5.4 1.1.7 1.7.9l-1 1.6A14 14 0 0 1 6 14.6c-.3-2.8.2-5.6 2.1-8.4z"/><circle cx="9.5" cy="11.5" r="1"/><circle cx="14.5" cy="11.5" r="1"/>',
  donate: '<path d="M20.5 8.8c0 4.3-8.5 10-8.5 10s-8.5-5.7-8.5-10A4.2 4.2 0 0 1 12 6.3a4.2 4.2 0 0 1 8.5 2.5z"/>'
};

function iconMarkup(name) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="none" ' +
    'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + ICONS[name] + '</svg>';
}

function iconLabel(name, text) {
  return '<span style="display:inline-block;flex:none;width:' + ICON_SIZE + 'px;height:' + ICON_SIZE +
    'px;margin-right:' + ICON_GAP + 'px;vertical-align:middle;line-height:0;">' + iconMarkup(name) + '</span>' +
    String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function tr(key, fallback) {
  var text = I18n.t(key);
  return (typeof text === 'string' && text && text !== key) ? text : fallback;
}

function popupStyle(width) {
  return 'width: ' + width + 'px; max-width: 94%; padding: 28px 36px; text-align: center; background: ' +
    Theme.MODAL_BG + '; color: ' + Theme.TEXT + '; border: ' + Theme.MODAL_BORDER_PX + 'px solid ' +
    Theme.MODAL_BORDER + '; border-radius: ' + Theme.MODAL_RADIUS + 'px;';
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
        {kind: ToggleItem, name: 'noticeToggle', onchange: 'noticeChanged'},
        {kind: BodyText, name: 'noticeHint', style: 'margin: 0 0 22px; font-size: ' + Theme.DESC_FONT + '; color: ' + Theme.MUTED + ';'},
        {kind: Item, name: 'aboutItem', ontap: 'openAbout'},
        {kind: BodyText, name: 'aboutHint', style: 'margin: 0 0 22px; font-size: ' + Theme.DESC_FONT + '; color: ' + Theme.MUTED + ';'}
      ]}
    ]},
    {kind: Popup, name: 'aboutPopup', centered: true, floating: true, modal: true, autoDismiss: true,
      style: popupStyle(1000), components: [
        {allowHtml: true, name: 'aboutLogo', style: 'margin: 0 auto 14px; width: 90px; height: 90px;', content: ''},
        {name: 'aboutTitle', style: 'font-size: 34px; font-weight: bold; color: #fff;'},
        {name: 'aboutVersion', style: 'margin: 8px 0 16px; font-size: 22px; color: ' + Theme.MUTED + ';'},
        {kind: BodyText, name: 'aboutText', style: 'margin: 0 0 18px; font-size: 24px; line-height: 1.4;'},
        {kind: Item, name: 'projectLink', allowHtml: true, style: 'text-align: left;', ontap: 'openLink'},
        {kind: Item, name: 'discordLink', allowHtml: true, style: 'text-align: left;', ontap: 'openLink'},
        {kind: Item, name: 'donateLink', allowHtml: true, style: 'text-align: left;', ontap: 'openLink'}
      ]},
    {kind: Popup, name: 'qrPopup', centered: true, floating: true, modal: true, autoDismiss: true,
      style: popupStyle(720), components: [
        {name: 'qrTitle', style: 'font-size: 32px; font-weight: bold; color: #fff;'},
        {name: 'qr', allowHtml: true, style: 'line-height: 0; width: 300px; margin: 18px auto;'},
        {kind: BodyText, name: 'qrError', showing: false, style: 'color: #ffb3b3;'},
        {name: 'qrUrl', style: 'font-size: 20px; color: ' + Theme.MUTED + '; word-break: break-all; margin: 0 0 10px;'},
        {kind: Button, name: 'qrClose', small: true, ontap: 'closeQr'}
      ]}
  ],

  create: function () {
    this.inherited(arguments);
    this.settings = this.settings || {};
    this.set('title', tr('otherSettings', 'Other settings'));
    this.$.noticeToggle.set('content', tr('updateNoticeToggle', 'Show update notices in the screensaver'));
    this.$.noticeToggle.set('checked', this.settings.updateNoticeEnabled !== false);
    this.$.noticeHint.set('content', tr('updateNoticeInfo', 'Shows one update message when the screensaver starts.'));
    this.$.aboutItem.set('content', tr('aboutTitle', 'About Aerial'));
    this.$.aboutHint.set('content', tr('aboutHint', 'Project information, community, and support.'));
    this.$.aboutLogo.set('content', '<img src="assets/icon130.png" width="90" height="90" alt="Aerial" />');
    this.$.aboutTitle.set('content', tr('aboutName', 'webOS Aerial Screensaver'));
    this.$.aboutVersion.set('content', tr('aboutVersion', 'Version {version} · MIT License').replace('{version}', this.version || ''));
    this.$.aboutText.set('content', tr('aboutText', 'Enjoying Aerial? Star the project, join the OpenLGTV community, or support development.'));
    this.$.projectLink.qrTitle = tr('aboutGitHub', 'GitHub · scan to view or star the project');
    this.$.projectLink.set('content', iconLabel('github', this.$.projectLink.qrTitle));
    this.$.projectLink.url = LINKS.project;
    this.$.discordLink.qrTitle = tr('aboutDiscord', 'OpenLGTV Discord');
    this.$.discordLink.set('content', iconLabel('discord', this.$.discordLink.qrTitle));
    this.$.discordLink.url = LINKS.discord;
    this.$.donateLink.qrTitle = tr('aboutDonate', 'Donate with YooMoney');
    this.$.donateLink.set('content', iconLabel('donate', this.$.donateLink.qrTitle));
    this.$.donateLink.url = LINKS.donate;
  },

  noticeChanged: function (sender) {
    var enabled = !!sender.active;
    this.settings.updateNoticeEnabled = enabled;
    if (this.onChange) { this.onChange('updateNoticeEnabled', enabled); }
  },

  openAbout: function () {
    this.$.aboutPopup.show();
  },

  openLink: function (sender) {
    var qr;
    try {
      qr = QrCode.svg(sender.url, 'M', 300);
      this.$.qrError.set('showing', false);
    } catch (e) {
      console.error(e);
      this.$.qr.set('content', '');
      this.$.qrError.set('content', tr('qrError', 'Could not generate the QR code. You can enter the URL shown below.'));
      this.$.qrError.set('showing', true);
    }
    this.$.qrTitle.set('content', sender.qrTitle);
    this.$.qrUrl.set('content', sender.url);
    this.$.qrClose.set('content', tr('close', 'Close'));
    if (qr) { this.$.qr.set('content', qr.markup); }
    this.$.aboutPopup.hide();
    this.$.qrPopup.show();
  },

  closeQr: function () {
    this.$.qrPopup.hide();
  }
});
