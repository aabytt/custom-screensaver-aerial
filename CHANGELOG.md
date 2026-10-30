# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Playlist screen: thumbnail grid to select/deselect which videos are in the playlist
  (stored as `disabledVideos` ids in settings.json, honoured by both screensavers).
- webOS 25 (10.x) support: on TVs with the Flutter-based stock screensaver, `apply.sh` mounts a
  web version of the screensaver that uses the same settings, videos and locales.
- webOS 25 (10.x): if another app has a paused video, the web screensaver no longer takes its
  video decoder, and shows a moving clock instead of video.

- webOS 26 (11.x) support: `apply.sh` runs the web screensaver as `com.webos.app.videoads`, LG's
  video screensaver, with the `isVideoScreenSaverEnabled` setting on, since webOS 26 ends the
  regular screensaver as soon as it plays video (#50). A boot hook puts the setting and the
  `videoads` block back unless Autostart is on, including after Aerial is uninstalled. While it's
  applied, a watcher keeps the setting on, as LG's `dmost` service switches it off at every app
  change.

### Changed
- webOS 25/26 (10.x/11.x): `apply.sh` makes SAM reread the screensaver's manifest with
  `blockSystemApp` + `releaseBlockSystemApp` (as Glasshouse and Luma do) instead of restarting
  `sam.service`, so applying no longer closes every running app. webOS 26 needs
  `forceBlockSystemApp` on the block, which is sent where SAM's schema asks for it (#50).
- webOS 25/26 (10.x/11.x): SAM is never restarted. Where the block is refused or SAM doesn't
  reread in time, a failed dev install of a file that isn't an ipk makes it reread the screensaver
  instead; if that fails too, the stock screensaver is kept.
- webOS 26 (11.x): the web screensaver puts itself in manual screensaver mode, which keeps webOS 26
  from ending it when it plays video. It runs as the regular screensaver again, so it should also
  work on TVs without `videoads` (#63). The `videoads` route, the `isVideoScreenSaverEnabled` part
  of the watcher and the restore hook are gone; the first apply runs 3.0.2's restore hook to put
  LG's setting and the `videoads` block back. The notification watcher (`aerial-notify`) now runs
  on webOS 25 and 26.
- webOS 25/26 (10.x/11.x): where LG's video screensaver `videoads` exists and isn't blocked, the
  web screensaver is mounted over it too, as TVs launch it instead of the regular screensaver
  when LG's conditions for its video screensaver hold (#53). LG's settings are left alone.
- The paused-video clock skips Live TV running in the background (#62) and switches to video once
  the decoder is free (#64).
- webOS 25/26 (10.x/11.x): applying again remounts the screensaver when the mounted folder is no
  longer the installed `assets/` (an install that replaced the app folder), instead of leaving the
  old page running until a reboot.
