<div align="center">
<img src="assets/icon130.png" alt="Aerial webOS logo" width="200">
<br><h1>Aerial webOS screensaver (fork of <a href="https://github.com/webosbrew/custom-screensaver">custom-screensaver</a>)</h1>
   
<a href="https://github.com/aabytt/custom-screensaver-aerial/releases/latest"><img src="https://img.shields.io/github/v/release/aabytt/custom-screensaver-aerial?style=flat-square" alt="Latest release"/></a>
<a href="https://github.com/aabytt/custom-screensaver-aerial/releases"><img src="https://img.shields.io/github/downloads/aabytt/custom-screensaver-aerial/total?style=flat-square" alt="Downloads"/></a>


</div>


* [330+ videos](https://aabytt.github.io/aerial-preview/) from different sources (Apple Aerials, Amazon FireOS, Jetson Creative, Robin Fourcade)
* 40+ locales for OSD
* Source type selection (FullHD/4k SDR or Dolby Vision)
* Requires root and Homebrew channel
* Compatible with webOS 5 (2020), webOS 6 (2021), webOS 22 (7.x), webOS 23 (8.x), webOS 25 (10.x), webOS 26 (11.x)

Disclaimer
---------------
- App replaces original webOS screensaver. Use at your own risk. 

webOS 25 and 26 (10.x/11.x)
---------------------------
The stock screensaver is a Flutter app on these TVs and QML apps can't be launched, so
`apply.sh` uses a web version of the screensaver instead (`assets/web-screensaver.html`). It
uses the same settings, videos and locales. Notes:

- Applying makes the app manager reread the screensaver (`blockSystemApp` + `releaseBlockSystemApp`,
  or else a failed dev install of a file that isn't an ipk). The app manager is never restarted, so
  running apps stay open. If neither works, the stock screensaver is kept and applying reports it.
- The TV ends the screensaver when it sees full-screen video, within a second on webOS 26. Apps in
  "manual" screensaver mode are exempt, so the screensaver puts itself in that mode
  (`com.webos.service.screenmanager/setScreenSaverMode`) every time it starts. The mode is only
  kept in memory, so nothing has to be undone.
- Where the TV has LG's own video screensaver (`com.webos.app.videoads`), a copy of the web
  screensaver is mounted over it too: LG's TVs launch that one instead of the regular screensaver
  when LG's conditions for its video screensaver ads hold. LG's settings and blocked app list are
  left alone, and a `videoads` that a debloat tool blocked is skipped.
- Set text opacity to 0 to hide the on-screen text, e.g. to avoid burn-in on OLED TVs.
- If another app has a paused video, the screensaver shows a clock that moves every minute
  instead of video, so that app keeps its video decoder and playback can resume. It switches to
  video once that app has released the decoder.
- Any system notification ends the screensaver, and the TV shows one ("Dolby Vision") when an HDR
  video starts. So, like the QML screensaver, it switches notifications off while each video
  starts and back on after 2 seconds; one arriving meanwhile is dropped. A switch-off outlives
  the screensaver (even a Quick Start power-off), so `assets/videoads-flag.sh` runs as the systemd
  unit `aerial-notify` and switches notifications back on every 5 seconds while the screensaver
  isn't running (which would also undo a switch-off by any other app). The screensaver only
  switches them off while that watcher is running, so after updating Aerial press Apply once.

Aerial 3.0.2 ran the screensaver on webOS 26 as `videoads`, with the LG Channels setting
`isVideoScreenSaverEnabled` switched on and a watcher (`aerial-videoads-flag`) keeping it on. The
first apply of a newer version runs its restore hook
(`/var/lib/webosbrew/init.d/49-aerial-videoads-restore`), which stops that watcher and puts the
setting and the `videoads` block back.

Features
--------

* Autostart registration
* Temporary apply
* Launch screensaver immediately for testing
* Playlist editor

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
   ![Settings](https://github.com/user-attachments/assets/b530640c-56ef-42a5-98eb-f2f8f4dc11aa)
   ![Playlist editor](https://github.com/user-attachments/assets/e87586c6-4e00-47c6-8285-925c8e4fa646)

