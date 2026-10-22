var
  kind = require('enyo/kind'),
  Panel = require('moonstone/Panel'),
  Scroller = require('moonstone/Scroller'),
  Item = require('moonstone/Item'),
  Button = require('moonstone/Button'),
  BodyText = require('moonstone/BodyText'),
  Marquee = require('moonstone/Marquee'),
  ExpandablePicker = require('moonstone/ExpandablePicker'),
  LunaService = require('enyo-webos/LunaService');

/**
 * One thumbnail tile. Tap / OK on the remote toggles it.
 * Selected = video is in the playlist.
 */
var VideoTile = kind({
  name: 'aerial.VideoTile',
  kind: Item,
  style: 'display:inline-block; vertical-align:top; position:relative; width:300px; margin:8px; padding:6px;',
  published: {
    selected: true
  },
  events: {
    onToggled: ''
  },
  handlers: {
    ontap: 'toggle'
  },
  components: [
    {name: 'img', tag: 'img', style: 'display:block; width:100%; height:170px; object-fit:cover; background:#2d353d;'},
    {name: 'badge', content: '\u2713', style: 'position:absolute; top:12px; right:12px; width:36px; height:36px; line-height:36px; text-align:center; border-radius:18px; font-size:24px; background:#cf0652; color:#fff;'},
    {kind: Marquee.Text, name: 'label', style: 'margin-top:6px; font-size:22px;'}
  ],
  create: function () {
    this.inherited(arguments);
    if (this.src) {
      this.$.img.setAttribute('src', this.src);
    }
    this.$.label.set('content', this.label || '');
    this.selectedChanged();
  },
  selectedChanged: function () {
    this.$.badge.set('showing', !!this.selected);
    this.$.img.applyStyle('opacity', this.selected ? 1 : 0.3);
  },
  toggle: function () {
    this.set('selected', !this.selected);
    this.doToggled({id: this.assetId, selected: this.selected});
    return true;
  }
});

module.exports = kind({
  name: 'aerial.VideoSelectPanel',
  kind: Panel,
  title: 'Choose videos',
  headerType: 'small',
  // passed in by MainPanel
  settings: null,
  settingsPath: '',
  handlers: {
    onToggled: 'tileToggled'
  },
  components: [
    {kind: Scroller, name: 'scroller', fit: true, components: [
      {style: 'margin: 0 20px', components: [
        {kind: BodyText, name: 'count', content: 'Loading...'},
        {kind: ExpandablePicker, name: 'filter', content: 'Source', selectedIndex: 0, onChange: 'filterChanged', components: [
          {content: 'All sources', value: ''},
          {content: 'Apple Aerials', value: 'Apple Aerials'},
          {content: 'Amazon Fire OS', value: 'Amazon Fire OS'},
          {content: 'Jetson Creative', value: 'Jetson Creative'},
          {content: 'Robin Fourcade', value: 'Robin Fourcade'}
        ]},
        {style: 'margin: 10px 0', components: [
          {kind: Button, content: 'Select all', ontap: 'selectAll'},
          {kind: Button, content: 'Deselect all', ontap: 'deselectAll'}
        ]},
        {name: 'grid'}
      ]}
    ]},
    {kind: LunaService, name: 'cat', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec', onResponse: 'onCat', onError: 'onCat'},
    {kind: LunaService, name: 'save', service: 'luna://org.webosbrew.hbchannel.service', method: 'exec'}
  ],

  create: function () {
    this.inherited(arguments);
    this.assets = [];
    this.strings = {};
    this.disabled = {};
    this.dirty = false;
    this.settings = this.settings || {};
    (this.settings.disabledVideos || []).forEach(function (id) {
      this.disabled[id] = true;
    }, this);
    this.loadJSON('assets/videos.json', this.basePath + '/assets/videos.json', this.onVideos);
  },

  destroy: function () {
    // flush a pending save so nothing is lost when going back
    if (this.dirty) {
      this.stopJob('save');
      this.save();
    }
    this.stopJob('batch');
    this.inherited(arguments);
  },

  // XHR first (app files are local), luna `cat` as fallback
  loadJSON: function (url, lunaPath, callback) {
    var self = this, xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.onload = function () {
      if (xhr.status === 200 || (xhr.status === 0 && xhr.responseText)) {
        try {
          callback.call(self, JSON.parse(xhr.responseText));
          return;
        } catch (e) { /* fall through */ }
      }
      self.lunaLoad(lunaPath, callback);
    };
    xhr.onerror = function () { self.lunaLoad(lunaPath, callback); };
    xhr.send();
  },

  lunaLoad: function (path, callback) {
    this.catCallback = callback;
    this.$.cat.send({command: 'cat ' + path});
  },

  onCat: function (sender, evt) {
    var cb = this.catCallback;
    this.catCallback = null;
    if (!cb) { return; }
    try {
      cb.call(this, JSON.parse(evt.stdoutString));
    } catch (e) {
      this.$.count.set('content', 'Failed to load video list');
    }
  },

  onVideos: function (data) {
    this.assets = data.assets || [];
    var lang = this.settings.localeLang || 'en-GB';
    this.loadJSON('assets/locales/' + lang + '.json', this.basePath + '/assets/locales/' + lang + '.json', this.onLocale);
  },

  onLocale: function (data) {
    this.strings = (data && data.strings) || {};
    this.renderTiles();
  },

  currentSource: function () {
    var sel = this.$.filter.get('selected');
    return sel ? sel.value : '';
  },

  visibleAssets: function () {
    var src = this.currentSource();
    return this.assets.filter(function (a) { return !src || a.source === src; });
  },

  renderTiles: function () {
    this.stopJob('batch');
    this.$.grid.destroyClientControls();
    this.pending = this.visibleAssets().slice();
    this.updateCount();
    this.renderBatch();
  },

  renderBatch: function () {
    var batch = this.pending.splice(0, 12), i, a;
    for (i = 0; i < batch.length; i++) {
      a = batch[i];
      this.$.grid.createComponent({
        kind: VideoTile,
        assetId: a.id,
        src: a.previewImage,
        label: this.strings[a.localizedNameKey] || a.localizedNameKey,
        selected: !this.disabled[a.id]
      }).render();
    }
    if (this.pending.length) {
      this.startJob('batch', 'renderBatch', 40);
    }
  },

  filterChanged: function () {
    this.renderTiles();
  },

  tileToggled: function (sender, evt) {
    if (evt.selected) {
      delete this.disabled[evt.id];
    } else {
      this.disabled[evt.id] = true;
    }
    this.markDirty();
    return true;
  },

  setVisible: function (selected) {
    this.visibleAssets().forEach(function (a) {
      if (selected) { delete this.disabled[a.id]; } else { this.disabled[a.id] = true; }
    }, this);
    this.markDirty();
    this.renderTiles();
  },

  selectAll: function () { this.setVisible(true); },
  deselectAll: function () { this.setVisible(false); },

  updateCount: function () {
    var total = this.assets.length, off = 0, i;
    for (i = 0; i < total; i++) {
      if (this.disabled[this.assets[i].id]) { off++; }
    }
    var on = total - off;
    this.$.count.set('content', on + ' of ' + total + ' videos in playlist' +
      (on === 0 ? ' (nothing selected: all videos will be played)' : ''));
  },

  markDirty: function () {
    this.dirty = true;
    this.updateCount();
    this.startJob('save', 'save', 800);
  },

  save: function () {
    this.dirty = false;
    this.settings.disabledVideos = Object.keys(this.disabled);
    this.$.save.send({
      command: "echo '" + JSON.stringify(this.settings) + "' > " + this.settingsPath
    });
  }
});
