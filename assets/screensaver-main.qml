/*
 * Aerial screensaver.
 *
 * Usage:
 *   mount --bind ./screensaver-main.qml /usr/palm/applications/com.webos.app.screensaver/qml/main.qml
 *
 * Test launch (no way to trigger on "No signal" screen)
 *   luna-send -n 1 'luna://com.webos.service.tvpower/power/turnOnScreenSaver' '{}'
 *
 * File layout (single file on purpose: the app is deployed with `mount --bind`)
 *
 *   config    constants and tunables
 *   store     loads settings.json / videos.json / locale and holds them
 *   playlist  decides which asset plays next
 *   player    starts playback
 *   watchdog  once a second: detects errors, stalls, end of media, fade-out
 *   osd       title, point of interest, clock, date (+ debug panel)
 *   video     Video element with punch-through and fade animations
 */
import QtQuick 2.4
import QtMultimedia 5.6
import Eos.Window 0.1
import Eos.Items 0.1
import WebOS.Global 1.0
import QtQuick.Window 2.2
import WebOSServices 1.0
import iLib 1.0 as I

WebOSWindow {
    id: window

    width: 1920
    height: 1080
    windowType: "_WEBOS_WINDOW_TYPE_SCREENSAVER"
    color: "black"
    appId: "com.webos.app.screensaver"
    visible: true

    // ---- Playback state --------------------------------------------------
    property int randomIndex       // index of the current asset in playList.assets
    property int poiIndex: 0       // current point of interest of the asset
    property int stalledCounter: 0 // seconds spent in a "not playing" state
    property string sourceAlt      // debug note when a fallback source is used

    readonly property var currentAsset: store.ready ? store.playList.assets[randomIndex] : null

    Component.onCompleted: {
        notificationsService.set("disable")
        store.load(player.playNext)
    }

    // ======================================================================
    //  Modules
    // ======================================================================

    QtObject {
        id: config

        readonly property string basePath: "file:///media/developer/apps/usr/palm/applications/org.aabytt.webos.custom-screensaver-aerial/assets/"

        readonly property int fadeInMs: 3000
        readonly property int fadeOutMs: 5000
        readonly property int fadeOutLeadSec: 5      // start fading this many seconds before the end
        readonly property int viewedAfterMs: 2000    // a video counts as viewed after this position
        readonly property int stallLimitSec: 25      // Loading / Stalled for this long -> skip
        readonly property int stoppedLimitSec: 15    // stopped for this long -> skip

        // MediaPlayer statuses that count as "stalled" (numbering kept from the original code)
        readonly property var stallStatuses: [2, 5]

        // Used when settings.playLowerQuality is on and an asset lacks the chosen source type
        readonly property var lowerQualityFallbacks: ({
            "url-4K-HDR": ["url-4K-SDR"],
            "url-1080-HDR": ["url-1080-SDR", "url-1080-H264"]
        })
    }

    // Loads and holds the data files. Loading is sequential:
    // settings -> videos -> locale, so everything is ready before the first video.
    QtObject {
        id: store

        property var settings      // settings.json
        property var playList      // videos.json
        property var poi           // locales/<lang>.json
        property bool ready: false

        function load(onReady) {
            fetchJSON("settings.json", function (loadedSettings) {
                store.settings = loadedSettings
                fetchJSON("videos.json", function (loadedVideos) {
                    store.playList = loadedVideos
                    fetchJSON("locales/" + store.settings.localeLang + ".json", function (loadedLocale) {
                        store.poi = loadedLocale
                        store.ready = true
                        onReady()
                    })
                })
            })
        }

        function fetchJSON(file, onLoaded) {
            var url = config.basePath + file
            var xhr = new XMLHttpRequest()
            xhr.onreadystatechange = function () {
                if (xhr.readyState !== XMLHttpRequest.DONE)
                    return
                if (xhr.status === 200) {
                    onLoaded(JSON.parse(xhr.responseText))
                } else {
                    console.error("Error loading JSON data:", url, xhr.statusText)
                    titleOSD.text = xhr.statusText
                }
            }
            xhr.open("GET", url)
            xhr.send()
        }
    }

    // Chooses the next asset. Pure selection logic, no side effects on playback.
    QtObject {
        id: playlist

        // Returns { url, note } for the asset according to the settings,
        // or null if the asset has nothing playable.
        function resolveSource(asset) {
            var type = store.settings.sourceType
            if (asset[type])
                return { url: asset[type], note: "" }
            if (!store.settings.playLowerQuality)
                return null

            var fallbacks = config.lowerQualityFallbacks[type] || []
            for (var i = 0; i < fallbacks.length; i++) {
                if (asset[fallbacks[i]])
                    return { url: asset[fallbacks[i]], note: " - n/a, trying " + fallbacks[i] }
            }
            return null
        }

        // All assets that were not viewed yet and have a playable source.
        function candidates() {
            var result = []
            var assets = store.playList.assets
            for (var i = 0; i < assets.length; i++) {
                if (assets[i].viewed)
                    continue
                var source = resolveSource(assets[i])
                if (source)
                    result.push({ index: i, url: source.url, note: source.note })
            }
            return result
        }

        function markViewed(index) {
            store.playList.assets[index].viewed = true
        }

        function resetViewed() {
            var assets = store.playList.assets
            for (var i = 0; i < assets.length; i++)
                assets[i].viewed = false
        }

        // Returns { index, url, note } or null if nothing is playable at all.
        function pickRandom() {
            var list = candidates()
            if (list.length === 0) {
                // everything has been shown already: start a new round
                resetViewed()
                list = candidates()
            }
            if (list.length === 0)
                return null
            return list[Math.floor(Math.random() * list.length)]
        }
    }

    QtObject {
        id: player

        function playNext() {
            window.stalledCounter = 0

            var pick = playlist.pickRandom()
            if (!pick) {
                console.error("No playable video for source type", store.settings.sourceType)
                return
            }

            window.randomIndex = pick.index
            window.sourceAlt = pick.note
            videoOutput.source = pick.url
            notificationsService.set("disable")
            videoOutput.play()
        }

        // Abandon the current video and start another one.
        function skip() {
            punchThroughArea.visible = false
            playNext()
        }
    }

    // Runs every second and keeps playback going.
    QtObject {
        id: watchdog

        function tick() {
            checkError()
            checkProgress()
            checkStalls()
        }

        function checkError() {
            if (videoOutput.error !== 0) {
                notificationsService.set("enable")
                player.skip()
            }
        }

        function checkProgress() {
            var position = videoOutput.position

            if (position > config.viewedAfterMs) {
                notificationsService.set("enable")
                playlist.markViewed(window.randomIndex)
            }

            var secondsLeft = Math.floor(videoOutput.duration / 1000) - Math.floor(position / 1000)
            if (secondsLeft === config.fadeOutLeadSec) {
                fadeOutVideo.running = true
                fadeOutOsd.running = true
            }

            if (videoOutput.status === MediaPlayer.EndOfMedia)
                player.playNext()
        }

        function checkStalls() {
            if (config.stallStatuses.indexOf(videoOutput.status) !== -1)
                countStall(config.stallLimitSec)
            if (videoOutput.playbackState === 0)
                countStall(config.stoppedLimitSec)
        }

        function countStall(limitSec) {
            window.stalledCounter++
            if (window.stalledCounter > limitSec)
                player.skip()
        }
    }

    // ======================================================================
    //  Non-visual helpers
    // ======================================================================

    I.ILib {
        id: ilib
    }

    FontLoader {
        id: segoeUILight
        source: config.basePath + "SegoeUI-Light.ttf"
    }

    Service {
        id: notificationsService
        appId: globalVars.appId
        function set(param) {
            call("luna://com.webos.notification/", param)
        }
    }

    Timer {
        id: refreshTimer
        interval: 1000
        running: store.ready
        repeat: true
        onTriggered: {
            watchdog.tick()
            debug.refresh()
            osd.refresh()
        }
    }

    // ======================================================================
    //  Visuals
    // ======================================================================

    Video {
        id: videoOutput
        fillMode: VideoOutput.PreserveAspectCrop
        width: parent.width
        height: parent.height - 1 // non fullscreen to avoid screensaver automatic disabling
        source: ""
        visible: true
        autoPlay: true

        onStopped: {
            punchThroughArea.visible = false
            osd.visible = false
            fadeOutVideo.running = false
        }
        onPaused: {
            player.skip()
            osd.visible = false
            fadeOutVideo.running = false
        }
        onPlaying: {
            punchThroughArea.visible = true
            fadeInVideo.running = true
            fadeInOsd.running = true
            osd.visible = true
        }

        PunchThrough {
            id: punchThroughArea
            visible: false
            x: 0
            y: 0
            z: -1
            width: parent.width
            height: parent.height

            Rectangle {
                id: opacityBox
                width: 1920
                height: 1080
                z: 1
                color: "black"

                OpacityAnimator {
                    id: fadeInVideo
                    target: opacityBox
                    from: 1
                    to: 0
                    duration: config.fadeInMs
                    running: false
                }
                OpacityAnimator {
                    id: fadeOutVideo
                    target: opacityBox
                    from: 0
                    to: 1
                    duration: config.fadeOutMs
                    running: false
                }
            }
        }
    }

    Rectangle {
        id: osd
        opacity: 0
        visible: true
        color: "transparent"
        anchors.fill: parent
        anchors.margins: 65

        // iLib formatters, created on first use
        property var timeFormatter
        property var dateFormatter

        function refresh() {
            ensureFormatters()
            var now = new Date()
            timeOSD.text = timeFormatter.format(now)
            dateOSD.text = formatDate(now)
            updatePointOfInterest()
        }

        function ensureFormatters() {
            if (timeFormatter)
                return
            var DateFmt = ilib.require("DateFmt.js")
            timeFormatter = new DateFmt({
                locale: store.settings.localeLang,
                timezone: "local",
                type: "time",
                length: "full"
            })
            dateFormatter = new DateFmt({
                locale: store.settings.localeLang,
                timezone: "local",
                type: "date",
                date: "dmw",
                length: "full"
            })
        }

        // Prefers the locale file's own day/month names, falls back to iLib.
        function formatDate(now) {
            var date = store.poi.date
            if (date)
                return date.daysOfWeek[now.getDay()] + ", " + now.getDate() + " " + date.months[now.getMonth()]
            return dateFormatter.format(now)
        }

        function updatePointOfInterest() {
            var second = Math.floor(videoOutput.position / 1000)
            if (window.currentAsset.pointsOfInterest[second])
                window.poiIndex = second
        }

        OpacityAnimator {
            id: fadeInOsd
            target: osd
            from: 0
            to: 1
            duration: config.fadeInMs
            running: false
        }
        OpacityAnimator {
            id: fadeOutOsd
            target: osd
            from: 1
            to: 0
            duration: config.fadeOutMs
            running: false
        }

        Text {
            id: titleOSD
            opacity: store.ready ? store.settings.osdOpacity / 100 : 0
            text: window.currentAsset ? store.poi.strings[window.currentAsset.localizedNameKey] : ""
            font.family: segoeUILight.name
            font.letterSpacing: -1
            fontSizeMode: Text.Fit
            font.pixelSize: 56
            y: parent.height * 0.9
            color: "white"
            style: Text.Raised
            styleColor: "black"
        }
        Text {
            id: poiOSD
            opacity: titleOSD.opacity
            text: window.currentAsset ? store.poi.strings[window.currentAsset.pointsOfInterest[window.poiIndex]] : ""
            font.family: titleOSD.font.family
            font.letterSpacing: titleOSD.font.letterSpacing
            fontSizeMode: titleOSD.fontSizeMode
            font.pixelSize: titleOSD.font.pixelSize - 16
            y: titleOSD.y + titleOSD.font.pixelSize + 10
            color: titleOSD.color
            style: titleOSD.style
            styleColor: titleOSD.styleColor
        }
        Text {
            id: timeOSD
            horizontalAlignment: Text.AlignRight
            anchors.right: parent.right
            opacity: titleOSD.opacity
            font.family: titleOSD.font.family
            font.letterSpacing: titleOSD.font.letterSpacing
            font.pixelSize: titleOSD.font.pixelSize + 23
            y: dateOSD.y - titleOSD.font.pixelSize - 40
            color: titleOSD.color
            style: titleOSD.style
            styleColor: titleOSD.styleColor
            fontSizeMode: titleOSD.fontSizeMode
        }
        Text {
            id: dateOSD
            horizontalAlignment: Text.AlignRight
            anchors.right: parent.right
            opacity: titleOSD.opacity
            font.family: titleOSD.font.family
            font.letterSpacing: titleOSD.font.letterSpacing
            font.pixelSize: titleOSD.font.pixelSize - 16
            y: titleOSD.y + titleOSD.font.pixelSize + 5
            color: titleOSD.color
            style: titleOSD.style
            styleColor: titleOSD.styleColor
            fontSizeMode: titleOSD.fontSizeMode
        }
    }

    Text {
        id: debug
        visible: store.ready && !!store.settings.debug
        horizontalAlignment: Text.AlignRight
        anchors.right: parent.right
        anchors.margins: 25
        opacity: 0.7
        font.family: titleOSD.font.family
        font.pixelSize: titleOSD.font.pixelSize - 30
        color: titleOSD.color
        style: titleOSD.style
        styleColor: titleOSD.styleColor
        fontSizeMode: titleOSD.fontSizeMode

        // Labels as in the original code. NOTE: verify 4 vs 5 against the QtMultimedia
        // enum on the device (Qt declares Stalled before Buffering).
        readonly property var mediaStatusNames: [
            "UnknownStatus", "NoMedia", "Loading", "Loaded", "Buffering",
            "Stalled", "Buffered", "EndOfMedia", "InvalidMedia"
        ]
        readonly property var playbackStateNames: ["stopped", "playing", "paused"]

        function refresh() {
            if (!visible)
                return
            var settings = store.settings
            text = "Video " + window.randomIndex + " of " + store.playList.assets.length +
                "\n Source Type: " + settings.sourceType + window.sourceAlt +
                "\n Try Other Source: " + settings.playLowerQuality +
                "\n Locale: " + settings.localeLang +
                "\n OSD opacity: " + settings.osdOpacity + "%" +
                "\n Timecode: " + Math.floor(videoOutput.position / 1000) + " / " + Math.floor(videoOutput.duration / 1000) +
                "\n Media Status: " + mediaStatusNames[videoOutput.status] +
                "\n Stalled Timeout: " + (config.stallLimitSec - window.stalledCounter) +
                "\n Error: " + videoOutput.error + " " + videoOutput.errorString +
                "\n Playback State: " + playbackStateNames[videoOutput.playbackState] +
                "\n Buffer Progress : " + (videoOutput.bufferProgress * 33.334).toFixed(0) + "%"
        }
    }
}
