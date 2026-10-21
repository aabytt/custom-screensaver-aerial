/*
 * Aerial screensaver.
 *
 * Usage:
 *   mount --bind ./screensaver-main.qml /usr/palm/applications/com.webos.app.screensaver/qml/main.qml
 *
 * Test launch (no way to trigger on "No signal" screen)
 *   luna-send -n 1 'luna://com.webos.service.tvpower/power/turnOnScreenSaver' '{}'
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

    // ---- Window ----------------------------------------------------------
    width: 1920
    height: 1080
    windowType: "_WEBOS_WINDOW_TYPE_SCREENSAVER"
    color: "black"
    appId: "com.webos.app.screensaver"
    visible: true

    // ---- Data (filled from JSON files, see init()) -----------------------
    property var settings      // settings.json
    property var playList      // videos.json
    property var poi           // locales/<lang>.json
    property bool ready: false // true once settings, playList and poi are loaded

    // ---- Playback state --------------------------------------------------
    property int randomIndex   // index of the current asset in playList.assets
    property int poiIndex: 0
    property int stalledCounter: 0
    property string sourceAlt  // debug note when a fallback source is used

    // ---- Cached date/time formatters (created lazily, see updateOSD()) ---
    property var timeFormatter
    property var dateFormatter

    // ---- Constants -------------------------------------------------------
    readonly property string basePath: "file:///media/developer/apps/usr/palm/applications/org.aabytt.webos.custom-screensaver-aerial/assets/"
    readonly property int viewedAfterMs: 2000       // video counts as "viewed" after this position
    readonly property int fadeInMs: 3000
    readonly property int fadeOutMs: 5000
    readonly property int fadeOutLeadSec: 5         // start fade-out this many seconds before the end
    readonly property int statusStallLimit: 25      // ticks (1 s each) in Loading/Stalled before skipping
    readonly property int stoppedStallLimit: 15     // ticks in "stopped" state before skipping
    // Labels as in the original code. NOTE: verify 4 vs 5 against the QtMultimedia
    // enum on the device (Qt declares Stalled before Buffering).
    readonly property var mediaStatusNames: [
        "UnknownStatus", "NoMedia", "Loading", "Loaded", "Buffering",
        "Stalled", "Buffered", "EndOfMedia", "InvalidMedia"
    ]
    readonly property var playbackStateNames: ["stopped", "playing", "paused"]
    // Used when settings.playLowerQuality is on and the asset has no source of the chosen type
    readonly property var lowerQualityFallbacks: ({
        "url-4K-HDR": ["url-4K-SDR"],
        "url-1080-HDR": ["url-1080-SDR", "url-1080-H264"]
    })

    Component.onCompleted: {
        notificationsService.set("disable")
        init() // playback starts from loadResources() when all data is loaded
    }

    I.ILib {
        id: ilib
    }

    FontLoader {
        id: segoeUILight
        source: basePath + "SegoeUI-Light.ttf"
    }

    Service {
        id: notificationsService
        appId: globalVars.appId
        function set(param) {
            call("luna://com.webos.notification/", param)
        }
    }

    Timer {
        id: refreshOSD
        interval: 1000
        running: window.ready
        repeat: true
        onTriggered: {
            checkError()
            checkStatus()
            updateOSD()
        }
    }

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
            punchThroughArea.visible = false
            playRandomVideo()
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
                    duration: window.fadeInMs
                    running: false
                }
                OpacityAnimator {
                    id: fadeOutVideo
                    target: opacityBox
                    from: 0
                    to: 1
                    duration: window.fadeOutMs
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

        OpacityAnimator {
            id: fadeInOsd
            target: osd
            from: 0
            to: 1
            duration: window.fadeInMs
            running: false
        }
        OpacityAnimator {
            id: fadeOutOsd
            target: osd
            from: 1
            to: 0
            duration: window.fadeOutMs
            running: false
        }

        Text {
            id: titleOSD
            opacity: window.ready ? settings.osdOpacity / 100 : 0
            text: window.ready ? poi.strings[playList.assets[randomIndex].localizedNameKey] : ""
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
            text: window.ready ? poi.strings[playList.assets[randomIndex].pointsOfInterest[poiIndex]] : ""
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
        visible: window.ready && !!settings.debug
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
    }

    // ---- Loading ---------------------------------------------------------

    // Loading is sequential: settings -> videos -> locale -> first video.
    function init() {
        loadJSON(basePath + "settings.json", function (data) {
            settings = data
            loadResources()
        })
    }

    function loadResources() {
        loadJSON(basePath + "videos.json", function (videos) {
            playList = videos
            loadJSON(basePath + "locales/" + settings.localeLang + ".json", function (locale) {
                poi = locale
                ready = true
                playRandomVideo()
            })
        })
    }

    function loadJSON(url, onLoaded) {
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

    // ---- Playback --------------------------------------------------------

    // Returns { url, note } for the asset according to the settings,
    // or null if the asset has nothing playable.
    function resolveSource(asset) {
        var type = settings.sourceType
        if (asset[type])
            return { url: asset[type], note: "" }
        if (!settings.playLowerQuality)
            return null

        var fallbacks = lowerQualityFallbacks[type] || []
        for (var i = 0; i < fallbacks.length; i++) {
            if (asset[fallbacks[i]])
                return { url: asset[fallbacks[i]], note: " - n/a, trying " + fallbacks[i] }
        }
        return null
    }

    // All not yet viewed assets that have a playable source.
    function findCandidates() {
        var result = []
        var assets = playList.assets
        for (var i = 0; i < assets.length; i++) {
            if (assets[i].viewed)
                continue
            var source = resolveSource(assets[i])
            if (source)
                result.push({ index: i, url: source.url, note: source.note })
        }
        return result
    }

    function resetViewed() {
        var assets = playList.assets
        for (var i = 0; i < assets.length; i++)
            assets[i].viewed = false
    }

    function playRandomVideo() {
        stalledCounter = 0

        var candidates = findCandidates()
        if (candidates.length === 0) {
            // everything has been shown already: start a new round
            resetViewed()
            candidates = findCandidates()
        }
        if (candidates.length === 0) {
            console.error("No playable video for source type", settings.sourceType)
            return
        }

        var pick = candidates[Math.floor(Math.random() * candidates.length)]
        randomIndex = pick.index
        sourceAlt = pick.note
        videoOutput.source = pick.url
        notificationsService.set("disable")
        videoOutput.play()
    }

    function registerStall(limit) {
        stalledCounter++
        if (stalledCounter > limit) {
            punchThroughArea.visible = false
            playRandomVideo()
        }
    }

    // ---- Periodic checks (called by refreshOSD every second) -------------

    function checkError() {
        if (videoOutput.error !== 0) {
            notificationsService.set("enable")
            punchThroughArea.visible = false
            playRandomVideo()
        }
    }

    function checkStatus() {
        var position = videoOutput.position

        if (position > viewedAfterMs) {
            notificationsService.set("enable")
            playList.assets[randomIndex].viewed = true
        }
        if (Math.floor(position / 1000) === Math.floor(videoOutput.duration / 1000) - fadeOutLeadSec) {
            fadeOutVideo.running = true
            fadeOutOsd.running = true
        }
        if (videoOutput.status === MediaPlayer.EndOfMedia)
            playRandomVideo()

        // 2 = Loading, 5 = Stalled (numbering kept from the original code)
        if (videoOutput.status === 2 || videoOutput.status === 5)
            registerStall(statusStallLimit)
        if (videoOutput.playbackState === 0)
            registerStall(stoppedStallLimit)

        updateDebugText()
    }

    function updateDebugText() {
        debug.text = "Video " + randomIndex + " of " + playList.assets.length +
            "\n Source Type: " + settings.sourceType + sourceAlt +
            "\n Try Other Source: " + settings.playLowerQuality +
            "\n Locale: " + settings.localeLang +
            "\n OSD opacity: " + settings.osdOpacity + "%" +
            "\n Timecode: " + Math.floor(videoOutput.position / 1000) + " / " + Math.floor(videoOutput.duration / 1000) +
            "\n Media Status: " + mediaStatusNames[videoOutput.status] +
            "\n Stalled Timeout: " + (statusStallLimit - stalledCounter) +
            "\n Error: " + videoOutput.error + " " + videoOutput.errorString +
            "\n Playback State: " + playbackStateNames[videoOutput.playbackState] +
            "\n Buffer Progress : " + (videoOutput.bufferProgress * 33.334).toFixed(0) + "%"
    }

    function updateOSD() {
        if (!timeFormatter) {
            var DateFmt = ilib.require("DateFmt.js")
            timeFormatter = new DateFmt({
                locale: settings.localeLang,
                timezone: "local",
                type: "time",
                length: "full"
            })
            dateFormatter = new DateFmt({
                locale: settings.localeLang,
                timezone: "local",
                type: "date",
                date: "dmw",
                length: "full"
            })
        }

        var now = new Date()
        timeOSD.text = timeFormatter.format(now)
        if (poi.date) {
            dateOSD.text = poi.date.daysOfWeek[now.getDay()] + ", " +
                now.getDate() + " " + poi.date.months[now.getMonth()]
        } else {
            dateOSD.text = dateFormatter.format(now)
        }

        var second = Math.floor(videoOutput.position / 1000)
        if (playList.assets[randomIndex].pointsOfInterest[second])
            poiIndex = second
    }
}
