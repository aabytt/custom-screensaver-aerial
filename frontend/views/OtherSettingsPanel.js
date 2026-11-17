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
  donate: 'https://yoomoney.ru/to/4100115685800097'
};

function tr(key, fallback) {
  var text = I18n.t(key);
  return (typeof text === 'string' && text && text !== key) ? text : fallback;
}

function qrPopupStyle() {
  return 'width: 620px; max-width: 92%; padding: 28px 36px; text-align: center; background: ' +
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
      {style: 'margin-left: 7%; width: 86%;', components: [
        {kind: ToggleItem, name: 'noticeToggle', onchange: 'noticeChanged'},
        {kind: BodyText, name: 'noticeHint', style: 'margin: 0 0 22px 56px; font-size: 22px; color: ' + Theme.MUTED + ';'},
        {kind: Item, name: 'aboutItem', ontap: 'openAbout'},
        {kind: BodyText, name: 'aboutHint', style: 'margin: 0 0 22px 56px; font-size: 22px; color: ' + Theme.MUTED + ';'}
      ]}
    ]},
    {kind: Popup, name: 'aboutPopup', centered: true, floating: true, modal: true, autoDismiss: true,
      style: qrPopupStyle(), components: [
        {allowHtml: true, name: 'aboutLogo', style: 'margin: 0 auto 14px; width: 90px; height: 90px;', content: ''},
        {name: 'aboutTitle', style: 'font-size: 34px; font-weight: bold; color: #fff;'},
        {name: 'aboutVersion', style: 'margin: 8px 0 16px; font-size: 22px; color: ' + Theme.MUTED + ';'},
        {kind: BodyText, name: 'aboutText', style: 'margin: 0 0 18px; font-size: 24px; line-height: 1.4;'},
        {kind: Item, name: 'projectLink', ontap: 'openLink'},
        {kind: Item, name: 'discordLink', ontap: 'openLink'},
        {kind: Item, name: 'donateLink', ontap: 'openLink'}
      ]},
    {kind: Popup, name: 'qrPopup', centered: true, floating: true, modal: true, autoDismiss: true,
      style: qrPopupStyle(), components: [
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
    this.$.projectLink.set('content', tr('aboutGitHub', 'GitHub · scan to view or star the project'));
    this.$.projectLink.url = LINKS.project;
    this.$.discordLink.set('content', tr('aboutDiscord', 'OpenLGTV Discord'));
    this.$.discordLink.url = LINKS.discord;
    this.$.donateLink.set('content', tr('aboutDonate', 'Donate with YooMoney'));
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
    this.$.qrTitle.set('content', sender.get('content'));
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
