# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.4] - 2026-11-03
### Added
- Night mode: a separate night playlist for set hours (e.g. 22 to 7, TV time), picked per video
  in the Playlist screen. It starts with the videos Apple and Amazon tag "night" and those with
  Night in their name. If none of them can play with the chosen video format, the normal
  playlist plays. Both screensavers (#72).
- `videos.json`: the `timeOfDay` tag (sunrise / day / sunset / night) of the Apple and Amazon
  videos, imported with `tools/import-timeofday.js`.

### Changed
- UI tuning and translations (#74).
- Compatibility feedback (#78).

## [3.0.3] - 2026-10-30
### Added
- OSD settings, automatic locale detection and UI locale (#69).
- OSD settings for the web screensaver (`web-screensaver.html`) (#70).

### Changed
- webOS 25/26 (10.x/11.x): `apply.sh` makes SAM reread the screensaver's manifest with
  `blockSystemApp` + `releaseBlockSystemApp` (as Glasshouse and Luma do) instead of restarting
  `sam.service`, so applying no longer closes every running app. webOS 26 needs
  `forceBlockSystemApp` on the block, which is sent where SAM's schema asks for it (#50).
- webOS 25/26 (10.x/11.x): SAM is never restarted. Where the block is refused or SAM doesn't
  reread in time, a failed dev install of a file that isn't an ipk makes it reread the screensaver
  instead; if that fails too, the stock screensaver is kept (#68).
- webOS 26 (11.x): the web screensaver puts itself in manual screensaver mode, which keeps webOS 26
  from ending it when it plays video. It runs as the regular screensaver again, so it should also
  work on TVs without `videoads` (#63, #68). The `videoads` route, the
  `isVideoScreenSaverEnabled` part of the watcher and the restore hook are gone; the first apply
  runs 3.0.2's restore hook to put LG's setting and the `videoads` block back. The notification
  watcher (`aerial-notify`) now runs on webOS 25 and 26.
- webOS 25/26 (10.x/11.x): where LG's video screensaver `videoads` exists and isn't blocked, the
  web screensaver is mounted over it too, as TVs launch it instead of the regular screensaver
  when LG's conditions for its video screensaver hold (#53). LG's settings are left alone.
- The paused-video clock skips Live TV running in the background (#62) and switches to video once
  the decoder is free (#64, #66).
- webOS 25/26 (10.x/11.x): applying again remounts the screensaver when the mounted folder is no
  longer the installed `assets/` (an install that replaced the app folder), instead of leaving the
  old page running until a reboot (#71).

### Fixed
- Web screensaver: notifications stay off while a video starts (#67).

## [3.0.2] - 2026-10-27
### Added
- New videos from macOS 27.
- Playlist screen: thumbnail grid to select/deselect which videos are in the playlist
  (stored as `disabledVideos` ids in settings.json, honoured by both screensavers).
- webOS 26 (11.x) support: `apply.sh` runs the web screensaver as `com.webos.app.videoads`, LG's
  video screensaver, with the `isVideoScreenSaverEnabled` setting on, since webOS 26 ends the
  regular screensaver as soon as it plays video (#50, #60). A boot hook puts the setting and the
  `videoads` block back unless Autostart is on, including after Aerial is uninstalled. While it's
  applied, a watcher keeps the setting on, as LG's `dmost` service switches it off at every app
  change.
- Decoder guard in the QML screensaver (#56).
- External settings copy and version tracker (#61).

### Changed
- webOS 25/26 (10.x/11.x): `apply.sh` makes SAM reread the screensaver's manifest with
  `blockSystemApp` + `releaseBlockSystemApp` (as Glasshouse and Luma do) instead of restarting
  `sam.service`, so applying no longer closes every running app. webOS 26 needs
  `forceBlockSystemApp` on the block, which is sent where SAM's schema asks for it. Restarting SAM
  is kept as a fallback where the block is refused or SAM doesn't reread in time (#50, #54).
- OSD settings moved to a sub-page, labels renamed, settings sync fixed (#59).

### Fixed
- Notifications fix for `screensaver-main.qml` (#57).

## [3.0.1] - 2026-10-21
### Added
- `mk-MK` locale (#45).

### Changed
- Translations update (#47).

## [3.0.0] - 2026-10-20
### Added
- webOS 25 (10.x) support: on TVs with the Flutter-based stock screensaver, `apply.sh` mounts a
  web version of the screensaver that uses the same settings, videos and locales (#42).
- webOS 25 (10.x): if another app has a paused video, the web screensaver no longer takes its
  video decoder, and shows a moving clock instead of video.

### Changed
- New `videos.json` (#43).

## [1.0.12] - 2026-04-22
### Added
- New videos 2025 (#38).

## [1.0.11] - 2025-03-03
### Added
- `sl` locale (#32).

### Changed
- Updated `sv-SE` locale (#31).

## [1.0.10] - 2024-10-04
### Changed
- New icon (#22).

## [1.0.9] - 2024-10-02
### Added
- New videos (#21).

## [1.0.8] - 2024-06-12
### Fixed
- Stopped status (#15).

## [1.0.7] - 2024-05-30
### Changed
- App id changed to the canonical one (#12).

## [1.0.6] - 2024-05-30
### Changed
- New app id.

### Fixed
- Icon.

## [1.0.4] - 2024-05-13
### Added
- Settings.

## [1.0.2] - 2024-04-28
### Added
- Fade in/out effect for videos.

### Fixed
- Some bugs.

## [1.0.1] - 2024-04-07
### Changed
- QML update.

## [1.0.0] - 2024-04-06
- Initial (pre-)release.

[3.0.4]: https://github.com/aabytt/custom-screensaver-aerial/compare/v3.0.3...v3.0.4
[3.0.3]: https://github.com/aabytt/custom-screensaver-aerial/compare/v3.0.2...v3.0.3
[3.0.2]: https://github.com/aabytt/custom-screensaver-aerial/compare/v3.0.1...v3.0.2
[3.0.1]: https://github.com/aabytt/custom-screensaver-aerial/compare/v3.0.0...v3.0.1
[3.0.0]: https://github.com/aabytt/custom-screensaver-aerial/compare/v1.0.12...v3.0.0
[1.0.12]: https://github.com/aabytt/custom-screensaver-aerial/compare/v1.0.11...v1.0.12
[1.0.11]: https://github.com/aabytt/custom-screensaver-aerial/compare/v1.0.10...v1.0.11
[1.0.10]: https://github.com/aabytt/custom-screensaver-aerial/compare/v1.0.9...v1.0.10
[1.0.9]: https://github.com/aabytt/custom-screensaver-aerial/compare/v1.0.8...v1.0.9
[1.0.8]: https://github.com/aabytt/custom-screensaver-aerial/compare/v1.0.7...v1.0.8
[1.0.7]: https://github.com/aabytt/custom-screensaver-aerial/compare/v1.0.6...v1.0.7
[1.0.6]: https://github.com/aabytt/custom-screensaver-aerial/compare/v1.0.4...v1.0.6
[1.0.4]: https://github.com/aabytt/custom-screensaver-aerial/compare/v1.0.2...v1.0.4
[1.0.2]: https://github.com/aabytt/custom-screensaver-aerial/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/aabytt/custom-screensaver-aerial/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/aabytt/custom-screensaver-aerial/releases/tag/v1.0.0
