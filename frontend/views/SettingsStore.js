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

  // Shell command that writes both copies. The writes are independent: if one location
  // is not writable, the other copy is still saved.
  saveCommand: function (settings) {
    // apostrophes would break the shell command
    var json = JSON.stringify(settings).replace(/'/g, "'\\''");
    return "J='" + json + "'; " +
      'mkdir -p ' + persistDir + '; ' +
      'printf \'%s\\n\' "$J" > ' + SettingsStore.persistPath + '; ' +
      'printf \'%s\\n\' "$J" > ' + SettingsStore.appPath;
  }
};

module.exports = SettingsStore;
