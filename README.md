<div align="center">
<img src="assets/icon130.png" alt="Aerial webOS logo" width="200">
<br><h1>Aerial webOS screensaver (fork of <a href="https://github.com/webosbrew/custom-screensaver">custom-screensaver</a>)</h1>
   
<a href="https://github.com/aabytt/custom-screensaver-aerial/releases/latest"><img src="https://img.shields.io/github/v/release/aabytt/custom-screensaver-aerial?style=flat-square" alt="Latest release"/></a>
<a href="https://github.com/aabytt/custom-screensaver-aerial/releases"><img src="https://img.shields.io/github/downloads/aabytt/custom-screensaver-aerial/total?style=flat-square" alt="Downloads"/></a>


</div>


* [330+ aerial videos](https://aabytt.github.io/aerial-preview/) from different sources.
* 40+ locales for OSD
* Source type selection (FullHD/4k SDR or Dolby Vision)
* Requires root and Homebrew channel
* Compatible with webOS 5 (2020), webOS 6 (2021), webOS 22 (2022), webOS 23 (2023), webOS 25 (10.x), webOS 26 (11.x)

Disclaimer
---------------
- App replaces original webOS screensaver. Use at your own risk. 

webOS 25 (10.x)
---------------
The stock screensaver is a Flutter app on these TVs and QML apps can't be launched, so
`apply.sh` uses a web version of the screensaver instead (`assets/web-screensaver.html`). It
uses the same settings, videos and locales. Notes:

- Applying makes the app manager reread the screensaver (`blockSystemApp` + `releaseBlockSystemApp`).
  Only where it doesn't take that does it restart the app manager, which closes running apps.
- Set text opacity to 0 to hide the on-screen text, e.g. to avoid burn-in on OLED TVs.
- If another app has a paused video, the screensaver shows a clock that moves every minute
  instead of video, so that app keeps its video decoder and playback can resume.

webOS 26 (11.x)
---------------
webOS 26 ends the regular screensaver (`com.webos.app.screensaver`) as soon as it starts a video,
but it lets LG's own video screensaver, `com.webos.app.videoads`, play video. The TV uses that one
when the LG Channels setting `isVideoScreenSaverEnabled` is on. So on webOS 26, `apply.sh`:

- mounts a copy of the web screensaver, with the `videoads` app id, over `com.webos.app.videoads`
  (the regular screensaver stays LG's),
- takes `videoads` off LG's blocked system app list if a debloat tool put it there,
- switches `isVideoScreenSaverEnabled` on.

The setting and the block list survive a reboot but the mount doesn't, which would leave LG's own
video screensaver running. So `apply.sh` first saves their earlier values to
`/var/lib/webosbrew/aerial-videoads/state` and installs a boot hook,
`/var/lib/webosbrew/init.d/49-aerial-videoads-restore`. At boot, unless Autostart is on, it puts
both back and removes itself; it also does this after Aerial is uninstalled. To undo it without a
reboot, run `sh /var/lib/webosbrew/init.d/49-aerial-videoads-restore now`.

LG's `dmost` service recalculates `isVideoScreenSaverEnabled` at every foreground app change and
switches it off unless LG's own conditions for its video screensaver hold (LG's server allows it,
LG Channels is enabled, the TV is online, `screenSaverAd` is on, among others), which on most TVs
they never all do. So while the screensaver is applied, `assets/videoads-flag.sh` runs as the
systemd unit `aerial-videoads-flag`, checks the setting every 5 seconds and switches it back on;
the restore hook stops it first. `systemctl status aerial-videoads-flag` shows it.

Features
--------

* Autostart registration
* Temporary apply
* Launch screensaver immediately for testing

Installation
------------
This should be downloadable in Homebrew Channel. Otherwise, there's an `ipk` in
GitHub releases to the right. You are on your own here.

Donate
------------
Looking for more sources or cool new features? Your support would mean the world!
* [YooMoney](https://yoomoney.ru/to/4100115685800097)

Screenshots
------------
   ![Main](https://github.com/aabytt/custom-screensaver-aerial/assets/84480313/77daf2da-b528-41ba-8377-fff70e6e1fd3)
   ![Screenshot](https://github.com/aabytt/custom-screensaver-aerial/assets/84480313/166f43e7-a3cf-4035-975a-931f282f5655)
   ![Settings](https://github.com/aabytt/custom-screensaver-aerial/assets/84480313/1b7f281b-efdc-4eed-b0f2-b06f4bd5929a)
