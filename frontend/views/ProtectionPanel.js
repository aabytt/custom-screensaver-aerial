var
  kind = require('enyo/kind'),
  Panel = require('moonstone/Panel'),
  Scroller = require('moonstone/Scroller'),
  BodyText = require('moonstone/BodyText'),
  I18n = require('./I18n.js');

// "Panel protection" settings (burn-in protection). Opened from MainPanel with the shared `settings` object.
function tr(key, fallback) {
  var s = I18n.t(key);
  return (typeof s === 'string' && s && s.indexOf(key) < 0) ? s : fallback;
}

module.exports = kind({
  name: 'ProtectionPanel',
  kind: Panel,
  title: '',   // set in create() (translated)
  headerType: 'small',
  settings: null,
  settingsPath: '',
  components: [
    {kind: Scroller, fit: true, style: 'height: 100%;', components: [
      {style: 'margin-left: 7%; width: 88%;', components: [
        {kind: BodyText, name: 'intro', style: 'margin: 10px 0 20px'}
        // the settings go here
      ]}
    ]}
  ],
  create: function () {
    this.title = tr('protection', 'Panel protection');
    this.inherited(arguments);
    this.settings = this.settings || {};
    this.$.intro.set('content', tr('protectionIntro', 'Options that protect the screen from burn-in.'));
  }
});
