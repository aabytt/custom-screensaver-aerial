var UpdateSettings = require('./update-settings.js');

// Where the settings live.
//  - appPath:     copy inside the app directory (read directly by the screensaver / apply.sh)
//  - persistPath: copy outside of the app directory; survives reinstall and update of the app
var basePath = '/media/developer/apps/usr/palm/applications/org.aabytt.webos.custom-screensaver-aerial';
var persistDir = '/var/lib/webosbrew/custom-screensaver-aerial';

var SettingsStore = {
  basePath: basePath,
  appPath: basePath + '/assets/settings.json',
  persistDir: persistDir,
  persistPath: persistDir + '/settings.json',
  // assets/ of the installed app: scripts and data files the screensaver and the boot hooks use
  assetsDir: basePath + '/assets',
  // custom OSD fonts: the copy the screensaver reads, and the one that survives a reinstall
  fontsAppDir: basePath + '/assets/fonts/custom',
  fontsPersistDir: persistDir + '/fonts',

  merge: UpdateSettings.merge,

  // Prefer reading and merging on the TV at the point of the write. If Node is
  // unavailable, only use the browser's JSON merge if the raw snapshot still matches.
  saveCommand: function (settings, snapshot) {
    var prefs = UpdateSettings.preferences(settings);
    var quote = function (s) { return "'" + s.replace(/'/g, "'\\''") + "'"; };
    var store = SettingsStore, merged, fallback;
    var plain = JSON.stringify(prefs);
    if (snapshot !== null && snapshot !== undefined) {
      try { merged = UpdateSettings.carryNotice(UpdateSettings.preferences(prefs), UpdateSettings.parse(snapshot)); }
      catch (e) { merged = prefs; }
      fallback = "if [ -f " + store.appPath + " ] && printf %s " + quote(snapshot) +
        " | cmp -s - " + store.appPath + "; then printf '%s\n' " + quote(JSON.stringify(merged)) +
        " > " + store.appPath + "; else echo 'Live settings changed; save again' >&2; false; fi";
    } else {
      fallback = "echo 'Live settings could not be read; save again' >&2; false";
    }
    return '( . ' + store.assetsDir + '/aerial-node.sh; if find_aerial_node; then ' +
      '"$NODE" ' + store.assetsDir + '/update-check.js save ' + store.appPath + ' ' + store.persistPath + ' ' + quote(plain) +
      "; else mkdir -p " + store.persistDir + "; printf '%s\n' " + quote(plain) + " > " + store.persistPath +
      '; ' + fallback + '; fi )';
  },

  save: function (settings, send) {
    var prefs = JSON.parse(JSON.stringify(UpdateSettings.preferences(settings)));
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'assets/settings.json?save=' + Date.now());
    xhr.timeout = 3000;
    xhr.onload = function () {
      send(SettingsStore.saveCommand(prefs, xhr.status === 200 || xhr.status === 0 ? xhr.responseText : null));
    };
    xhr.onerror = xhr.ontimeout = function () { send(SettingsStore.saveCommand(prefs, null)); };
    xhr.send();
  }
};

module.exports = SettingsStore;
