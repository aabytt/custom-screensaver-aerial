# webOS 25 and 26 (10.x / 11.x)

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

## Upgrading from Aerial 3.0.2

Aerial 3.0.2 ran the screensaver on webOS 26 as `videoads`, with the LG Channels setting
`isVideoScreenSaverEnabled` switched on and a watcher (`aerial-videoads-flag`) keeping it on. The
first apply of a newer version runs its restore hook
(`/var/lib/webosbrew/init.d/49-aerial-videoads-restore`), which stops that watcher and puts the
setting and the `videoads` block back.
