# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- webOS 25 (10.x) support: on TVs with the Flutter-based stock screensaver, `apply.sh` mounts a
  web version of the screensaver that uses the same settings, videos and locales.
- webOS 25 (10.x): if another app has a paused video, the web screensaver no longer takes its
  video decoder, and shows a moving clock instead of video.
