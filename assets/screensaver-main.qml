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
    id : window
    width : 1920
    height : 1080
    windowType : "_WEBOS_WINDOW_TYPE_SCREENSAVER"
    color : "black"
    appId : "com.webos.app.screensaver"
    visible : true
    property var poi
    property var poiIndex: 0
    property var settings
    property var playList
    property int randomIndex
    property int stalledCounter : 0
    property string sourceAlt
    // Decoder guard: true once the check has finished / true if another app holds a video decoder
    property bool decoderDecided : false
    property bool decoderHeld : false
    // Anti burn-in: in clock-only mode the clock fades out, reappears in the next corner and fades in
    property int clockCorner : 0   // 0 = bottom-right, 1 = top-right, 2 = top-left, 3 = bottom-left
    property int appliedCorner : 0 // the corner shown now (changes while the clock is faded out)
    property real clockFade : 1
    // On-screen display settings (settings.osd, written by the app's "On-screen display" panel).
    // Defaults must stay equal to DEFAULTS in DisplayPanel.js. Set by applyOsdSettings().
    property bool showTitle : true
    property bool showPoi : true
    property bool showClock : true
    property bool showDate : true
    property string placeAnchor : "bl"   // t/b = top/bottom, l/c/r = left/center/right
    property string clockAnchor : "br"
    property real placeScale : 100
    property real clockScale : 100
    property bool useSeconds : true
    property bool use24h : true
    property string fontFile : "SegoeUI-Light.ttf"
    property real fontSpacing : -1
    property real osdAlpha : 1
    // fonts: id -> file in assets/ and letter spacing in px (same list as FONTS in DisplayPanel.js)
    property var osdFonts : ({
        "segoe": {file: "SegoeUI-Light.ttf", spacing: -1},
        "roboto": {file: "fonts/Roboto-Light.ttf", spacing: 0},
        "opensans": {file: "fonts/OpenSans-Light.ttf", spacing: 0},
        "montserrat": {file: "fonts/Montserrat-Light.ttf", spacing: 0},
        "oswald": {file: "fonts/Oswald-Light.ttf", spacing: 0},
        "comfortaa": {file: "fonts/Comfortaa-Light.ttf", spacing: 0},
        "lora": {file: "fonts/Lora-Regular.ttf", spacing: 0},
        "satisfy": {file: "fonts/Satisfy-Regular.ttf", spacing: 0}
    })
    // derived layout: title/description block and clock/date block
    // (in clock-only mode the clock block hops between the corners instead of using clockAnchor)
    property bool clockOn : (decoderHeld && !showClock && !showDate) ? true : showClock
    property string clockAnchorEff : decoderHeld ? ["br", "tr", "tl", "bl"][appliedCorner] : clockAnchor
    property string placeCol : placeAnchor.charAt(1)
    property string clockCol : clockAnchorEff.charAt(1)
    property real placeY : blockY(placeAnchor, placeBlockH())
    property real clockY : blockY(clockAnchorEff, clockBlockH())
    property string basePath : "file:///media/developer/apps/usr/palm/applications/org.aabytt.webos.custom-screensaver-aerial/assets/"
    Component.onCompleted : {
        init()
        notificationsService.set('disable')
        // Do not start the video before we know no other app holds the decoder
        decoderCheck.callService({})
        decoderCheckTimeout.start()
    }
    // Notifications are disabled on start and re-enabled only after 2 s of video;
    // always re-enable on exit, otherwise Back loses the system "exit app?" popup (#52)
    Component.onDestruction : notificationsService.set('enable')
    I.ILib {
        id : ilib
    }
    FontLoader {
        id : segoeUILight
        source : basePath + fontFile
    }
    Timer {
        id : refreshOSD
        interval : 1000
        running : true
        repeat : true
        onTriggered : {
            checkError()
            checkStatus()
            updateOSD()
        }
    }
    Video {
        id : videoOutput
        fillMode : VideoOutput.PreserveAspectCrop
        width : parent.width
        height : parent.height - 1 // non fullscreen to avoid screensaver automatic disabling
        source : ""
        visible : true
        autoPlay : true
        onStopped : {
            punchThroughArea.visible = false
            osd.visible = false
            fadeOutVideo.running = false
        }
        onPaused : {
            punchThroughArea.visible = false
            playRandomVideo()
            osd.visible = false
            fadeOutVideo.running = false
        }
        onPlaying : {
            updateOsdAlpha()
            punchThroughArea.visible = true
            fadeInVideo.running = true
            fadeInOsd.running = true
            osd.visible = true
        }
        PunchThrough {
            id : punchThroughArea
            visible : false
            x : 0
            y : 0
            z : -1
            width : parent.width
            height : parent.height
            Rectangle {
                id : opacityBox
                width : 1920
                height : 1080
                z : 1
                color : "black"
                OpacityAnimator {
                    id : fadeInVideo
                    target : opacityBox
                    from : 1
                    to : 0
                    duration : 3000
                    running : false
                }
                OpacityAnimator {
                    id : fadeOutVideo
                    target : opacityBox
                    from : 0
                    to : 1
                    duration : 5000
                    running : false
                }
            }
        }
    }
    Rectangle {
        id : osd
        opacity : 0
        visible : true
        color : "transparent"
        anchors.fill : parent
        anchors.margins : 65
        OpacityAnimator {
            id : fadeInOsd
            target : osd
            from : 0
            to : 1
            duration : 3000
            running : false
        }
        OpacityAnimator {
            id : fadeOutOsd
            target : osd
            from : 1
            to : 0
            duration : 5000
            running : false
        }
        Text {
            id : name
            visible : showTitle && !decoderHeld
            opacity : osdAlpha
            text : poi.strings[playList.assets[randomIndex].localizedNameKey]
            font.family : segoeUILight.name
            font.letterSpacing : fontSpacing
            fontSizeMode : Text.Fit
            font.pixelSize : Math.round(56 * placeScale / 100)
            y : placeY
            anchors.left : placeCol === "l" ? parent.left : undefined
            anchors.right : placeCol === "r" ? parent.right : undefined
            anchors.horizontalCenter : placeCol === "c" ? parent.horizontalCenter : undefined
            color : "white"
            style : Text.Raised
            styleColor : "black"
        }
        Text {
            id : poiOSD
            visible : showPoi && !decoderHeld
            opacity : osdAlpha
            text : poi.strings[playList.assets[randomIndex].pointsOfInterest[poiIndex]]
            font.family : name.font.family
            font.letterSpacing : fontSpacing
            fontSizeMode : name.fontSizeMode
            font.pixelSize : Math.round(40 * placeScale / 100)
            y : placeY + (showTitle ? Math.round(66 * placeScale / 100) : 0)
            anchors.left : placeCol === "l" ? parent.left : undefined
            anchors.right : placeCol === "r" ? parent.right : undefined
            anchors.horizontalCenter : placeCol === "c" ? parent.horizontalCenter : undefined
            color : name.color
            style : name.style
            styleColor : name.styleColor
        }
        Text {
            id : timeOSD
            visible : clockOn
            opacity : osdAlpha * clockFade
            font.family : name.font.family
            font.letterSpacing : fontSpacing
            font.pixelSize : Math.round(79 * clockScale / 100)
            y : clockY
            anchors.left : clockCol === "l" ? parent.left : undefined
            anchors.right : clockCol === "r" ? parent.right : undefined
            anchors.horizontalCenter : clockCol === "c" ? parent.horizontalCenter : undefined
            color : name.color
            style : name.style
            styleColor : name.styleColor
            fontSizeMode : name.fontSizeMode
        }
        Text {
            id : dateOSD
            visible : showDate
            opacity : osdAlpha * clockFade
            font.family : name.font.family
            font.letterSpacing : fontSpacing
            font.pixelSize : Math.round(40 * clockScale / 100)
            y : clockY + (clockOn ? Math.round(96 * clockScale / 100) : 0)
            anchors.left : clockCol === "l" ? parent.left : undefined
            anchors.right : clockCol === "r" ? parent.right : undefined
            anchors.horizontalCenter : clockCol === "c" ? parent.horizontalCenter : undefined
            color : name.color
            style : name.style
            styleColor : name.styleColor
            fontSizeMode : name.fontSizeMode
        }
    }
    SequentialAnimation {
        id : clockHop
        NumberAnimation { target : window; property : "clockFade"; to : 0; duration : 1500 }
        ScriptAction { script : applyClockCorner() }
        NumberAnimation { target : window; property : "clockFade"; to : 1; duration : 1500 }
    }
    Timer {
        id : clockMover
        interval : 30000
        running : decoderHeld
        repeat : true
        onTriggered : {
            clockCorner = (clockCorner + 1) % 4
            clockHop.restart()
        }
    }
    Text {
        id : debug
        visible : settings.debug
        horizontalAlignment : Text.AlignRight
        anchors.right : parent.right
        anchors.margins : 25
        opacity : 0.7
        font.family : name.font.family
        font.pixelSize : 26
        color : name.color
        style : name.style
        styleColor : name.styleColor
        fontSizeMode : name.fontSizeMode
    }
    function applyClockCorner() {
        appliedCorner = clockCorner
    }
    // y of a block of height h in the given anchor (same rule as blockY() in DisplayPanel.js)
    function blockY(anchor, h) {
        if (anchor.charAt(0) === "t")
            return 0
        return osd.height * 0.9 + 106 - h
    }
    function placeBlockH() {
        return (showTitle && showPoi ? 106 : (showTitle ? 56 : (showPoi ? 40 : 0))) * placeScale / 100
    }
    function clockBlockH() {
        return (clockOn && showDate ? 136 : (clockOn ? 79 : (showDate ? 40 : 0))) * clockScale / 100
    }
    function osdGet(key, def) {
        var o = settings.osd
        return (o && typeof o === "object" && o[key] !== undefined) ? o[key] : def
    }
    function osdScale(key) {
        var v = Number(osdGet(key, 100))
        return (isNaN(v) || v < 10) ? 100 : Math.min(v, 300)
    }
    function osdAnchor(key, def) {
        var v = osdGet(key, def)
        return /^[tb][lcr]$/.test(v) ? v : def
    }
    // read settings.osd (missing keys / unknown values fall back to the defaults)
    function applyOsdSettings() {
        var f = osdFonts[osdGet("font", "segoe")] || osdFonts["segoe"]
        showTitle = !!osdGet("title", true)
        showPoi = !!osdGet("poi", true)
        showClock = !!osdGet("clock", true)
        showDate = !!osdGet("date", true)
        placeAnchor = osdAnchor("placeAnchor", "bl")
        clockAnchor = osdAnchor("clockAnchor", "br")
        placeScale = osdScale("placeScale")
        clockScale = osdScale("clockScale")
        useSeconds = !!osdGet("seconds", true)
        use24h = !!osdGet("clock24", true)
        fontFile = f.file
        fontSpacing = f.spacing
        updateOsdAlpha()
    }
    // true if the video now playing is an HDR / Dolby Vision source
    function hdrPlaying() {
        if (!playList || !playList.assets || !playList.assets[randomIndex])
            return false
        var asset = playList.assets[randomIndex]
        var src = String(videoOutput.source)
        for (var key in asset) {
            if (key.indexOf("url-") === 0 && asset[key] === src)
                return /HDR|DV/i.test(key)
        }
        return false
    }
    // text opacity: osdOpacity (SDR); with the "separate opacity" switch on, osdOpacityDv for HDR / Dolby Vision
    function updateOsdAlpha() {
        var v = settings.osdOpacity !== undefined ? settings.osdOpacity : 100
        if (settings.osdOpacitySplit && settings.osdOpacityDv !== undefined && hdrPlaying())
            v = settings.osdOpacityDv
        osdAlpha = v / 100
    }
    function init() {
        loadJSONData(basePath + 'settings.json', 'settings', loadResources)
    }
    function loadResources() {
        applyOsdSettings()
        loadJSONData(basePath + 'videos.json', 'playList')
        loadJSONData(basePath + 'locales/' + settings.localeLang + '.json', 'poi', playRandomVideo)
    }
    function allowedIndices() {
        // playlist = all videos except those disabled in settings (empty selection = all)
        var disabled = settings.disabledVideos || []
        var out = []
        for (var i = 0; i < playList.assets.length; i++) {
            if (disabled.indexOf(playList.assets[i].id) === -1) out.push(i)
        }
        if (out.length === 0) {
            for (var j = 0; j < playList.assets.length; j++) out.push(j)
        }
        // everything in the playlist has been shown: start over
        var allViewed = true
        for (var k = 0; k < out.length; k++) {
            if (!playList.assets[out[k]].viewed) { allViewed = false; break }
        }
        if (allViewed) {
            for (var m = 0; m < out.length; m++) playList.assets[out[m]].viewed = false
        }
        return out
    }
    function playRandomVideo() {
        // Wait for the decoder check; clock-only mode never starts a video
        if (!decoderDecided || decoderHeld || !playList || !poi)
            return
        stalledCounter = 0
        var allowed = allowedIndices()
        randomIndex = allowed[Math.floor(Math.random() * allowed.length)]
        if (!playList.assets[randomIndex].viewed) {
            if (playList.assets[randomIndex][settings.sourceType]) {
                sourceAlt = ""
                videoOutput.source = playList.assets[randomIndex][settings.sourceType]
                    notificationsService.set('disable')
                    videoOutput.play()
            } else if(settings.sourceType == "url-4K-HDR" && settings.playLowerQuality){
                sourceAlt = " - n/a, trying url-4K-SDR"
                videoOutput.source = playList.assets[randomIndex]["url-4K-SDR"]
                    videoOutput.play()
            } else if(settings.sourceType == "url-1080-HDR" && settings.playLowerQuality){
                if(playList.assets[randomIndex]["url-1080-SDR"]){
                    sourceAlt = " - n/a, trying url-1080-SDR"
                    videoOutput.source = playList.assets[randomIndex]["url-1080-SDR"]
                    videoOutput.play()
                } else if(playList.assets[randomIndex]["url-1080-H264"]){
                    sourceAlt = " - n/a, trying url-1080-H264"
                    videoOutput.source = playList.assets[randomIndex]["url-1080-H264"]
                    videoOutput.play()
                } else playRandomVideo() 
            } else playRandomVideo() 
        } else 
            playRandomVideo()
    }

    function checkError() {
        if (videoOutput.error !== 0) {
            notificationsService.set('enable')
            punchThroughArea.visible = false
            playRandomVideo()
        }
    }

    function checkStatus() {
        if (videoOutput.position > 2000) {
            notificationsService.set('enable')
            playList.assets[randomIndex].viewed = true
        }
        if (Math.floor(videoOutput.position / 1000) == Math.floor(videoOutput.duration / 1000) - 5) {
            fadeOutVideo.running = true
            fadeOutOsd.running = true
        }
        if (videoOutput.status == MediaPlayer.EndOfMedia) 
            playRandomVideo()
        if (videoOutput.status === 1) 
            var status = 'NoMedia'
        else if (videoOutput.status === 2) {
            var status = 'Loading'
            stalledCounter ++
            if (stalledCounter > 25) {
                punchThroughArea.visible = false
                playRandomVideo()
            }
        }
        else if (videoOutput.status === 3) 
            var status = 'Loaded'
        else if (videoOutput.status === 4) 
            var status = 'Buffering'
        else if (videoOutput.status === 5) {
            var status = 'Stalled'
            stalledCounter ++
            if (stalledCounter > 25) {
                punchThroughArea.visible = false
                playRandomVideo()
            }
        }
        else if (videoOutput.status === 6) 
            var status = 'Buffered'
         else if (videoOutput.status === 7) 
            var status = 'EndOfMedia'
         else if (videoOutput.status === 8) 
            var status = 'InvalidMedia'
         else if (videoOutput.status === 0) 
            var status = 'UnknownStatus'
        
        if (videoOutput.playbackState === 1) 
            var playbackState = 'playing'
         else if (videoOutput.playbackState === 2) 
            var playbackState = 'paused'
         else if (videoOutput.playbackState === 0){ 
            var playbackState = 'stopped'
            stalledCounter ++
            if (stalledCounter > 15) {
                punchThroughArea.visible = false
                playRandomVideo()
            }
        }

        debug.text = "Video " + randomIndex + " of " + playList.assets.length +
        "\n Source Type: " + settings.sourceType + sourceAlt +
        "\n Try Other Source: " + settings.playLowerQuality +
        "\n Locale: " + settings.localeLang +
        "\n OSD opacity: " + Math.round(osdAlpha * 100) + "%" +
        "\n Timecode: " + Math.floor(videoOutput.position / 1000) + " / " + Math.floor(videoOutput.duration / 1000) +
        "\n Media Status: " + status +
        "\n Stalled Timeout: " + (25 - stalledCounter) +
        "\n Error: " + videoOutput.error + " " + videoOutput.errorString +
        "\n Playback State: " + playbackState +
        "\n Buffer Progress : " + (
        videoOutput.bufferProgress * 33.334).toFixed(0) + "%"
    }
    function updateOSD() {
        var DateFmt = ilib.require("DateFmt.js")
        var now = new Date()
        var time = new DateFmt({
            locale: settings.localeLang,
            timezone: "local",
            type: "time",
            time: (use24h ? "" : "a") + "hm" + (useSeconds ? "s" : ""),
            clock: use24h ? "24" : "12",
            length: "full"
        })
        var day = new DateFmt({
            locale: settings.localeLang,
            timezone: "local",
            type: "date",
            date: "dmw",
            length: "full"
        })
        timeOSD.text = time.format(now)
        if (poi.date) 
            dateOSD.text = poi.date.daysOfWeek[now.getDay()
            ] + ", " + now.getDate() + " " + poi.date.months[now.getMonth()
            ]
         else 
            dateOSD.text = day.format(now)
        
        if (playList.assets[randomIndex].pointsOfInterest[Math.floor(videoOutput.position / 1000)]) 
            poiIndex = Math.floor(videoOutput.position / 1000)
        updateOsdAlpha()
    }

    // Decoder guard (app-independent, webOS 5-23).
    // If another app (e.g. a paused Jellyfin/Netflix/YouTube session) holds a video
    // decoder, starting our own video would break its playback after the screensaver
    // exits. In that case only the clock is shown.
    // Note: luna://com.webos.media/getActivePipelines answers with a bare JSON array,
    // which QML Service reports as onCallFailure with an empty response, so
    // com.webos.service.videooutput/getStatus (object response) is used instead.
    function decide(held) {
        if (decoderDecided)
            return
        decoderDecided = true
        decoderCheckTimeout.stop()
        decoderHeld = held
        if (held) {
            notificationsService.set('enable')
            osd.visible = true
            fadeInOsd.running = true
        } else
            playRandomVideo()
    }
    Service {
        id : decoderCheck
        appId : window.appId
        service : "com.webos.service.videooutput"
        method : "getStatus"
        onCallResponse : {
            var text = (typeof response === "string") ? response : JSON.stringify(response)
            decide(/"connectedSource" *: *"VDEC/.test(text))
        }
        // Unknown means the decoder may be held: never risk the other app's playback
        onCallFailure : decide(true)
        onError : decide(true)
    }
    Timer {
        id : decoderCheckTimeout
        interval : 3000
        onTriggered : decide(true)
    }
    Service {
        id : notificationsService
        appId : globalVars.appId
        function set(param) {
            call("luna://com.webos.notification/", param)
        }
    }
    function loadJSONData(url, targetVar, callback) {
        var xhr = new XMLHttpRequest()
        xhr.onreadystatechange = function () {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    var jsonData = JSON.parse(xhr.responseText)
                    eval(targetVar + " = jsonData")
                    callback()
                } else {
                    console.error("Error loading JSON data:", xhr.statusText)
                    name.text = xhr.statusText
                }
            }
        }
        xhr.open("GET", url)
        xhr.send()
    }
}
