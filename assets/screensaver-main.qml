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
    // Panel protection "move the text between corners" replaces both anchors of the On-screen display panel
    property string placeAnchorEff : protTextMode === "corners" ? protPlaceAnchor : placeAnchor
    property string clockAnchorEff : decoderHeld ? ["br", "tr", "tl", "bl"][appliedCorner] : (protTextMode === "corners" ? protClockAnchor : clockAnchor)
    property string placeCol : placeAnchorEff.charAt(1)
    property string clockCol : clockAnchorEff.charAt(1)
    property real placeY : blockY(placeAnchorEff, placeBlockH())
    property real clockY : blockY(clockAnchorEff, clockBlockH())
    // Panel protection (settings.protection, written by the app's "Panel protection" panel).
    // Defaults must stay equal to DEFAULTS in ProtectionPanel.js. Brightness is the picture "backlight" (0-100).
    property int protElapsed : 0        // seconds since the screensaver started
    property int protOrig : -1          // the user's backlight, from the watcher (-1 = unknown: brightness is left alone)
    property int protBase : -1          // level the dimming starts from (custom brightness, or protOrig)
    property int protLast : -1          // level last sent
    property bool panelOff : false      // the panel was turned off by the timer: no video until the screensaver ends
    property bool standbyDone : false
    // Protection of the on-screen text: one of "corners" / "drift" / "fade" (they exclude each other, the panel
    // keeps it so), "" = none. It takes priority over the position / opacity of the On-screen display panel.
    property string protTextMode : ""
    property var protCornerList : []    // chosen corners, clockwise
    property int protCornerIdx : 0
    property string protPlaceAnchor : "bl"
    property string protClockAnchor : "br"
    property real protFade : 1          // 0..1, multiplies the opacity of all the text
    property int driftX : 0
    property int driftY : 0
    property int protFadeAge : 0        // seconds the text has been shown since the last (re)appearance
    property bool protFaded : false
    onPoiIndexChanged : protPoiChanged()
    property bool protNoWatcher : false  // no recent watcher / no brightness from it: brightness is left alone
    // luna method (under com.webos.service.tvpower/power/) that puts the TV in standby; empty = not known yet, nothing is called
    property string standbyMethod : "powerOff"
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
    Component.onDestruction : {
        notificationsService.set('enable')
        protRestore()
    }
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
            protOnPlaying()
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
        anchors.leftMargin : 65 + driftX
        anchors.rightMargin : 65 - driftX
        anchors.topMargin : 65 + driftY
        anchors.bottomMargin : 65 - driftY
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
            opacity : osdAlpha * protFade
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
            opacity : osdAlpha * protFade
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
            opacity : osdAlpha * clockFade * protFade
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
            opacity : osdAlpha * clockFade * protFade
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
    // Clock-only mode notice: bottom center, shown for 5 s (0.5 s fade in + 4 s hold + 0.5 s fade out)
    Text {
        id : clockOnlyMsg
        visible : opacity > 0
        opacity : 0
        anchors.horizontalCenter : parent.horizontalCenter
        anchors.bottom : parent.bottom
        anchors.bottomMargin : 40
        text : "Clock-only mode: media is paused in another app"
        font.family : name.font.family
        font.pixelSize : 32
        color : "white"
        style : Text.Raised
        styleColor : "black"
    }
    SequentialAnimation {
        id : clockOnlyMsgAnim
        NumberAnimation { target : clockOnlyMsg; property : "opacity"; to : 0.7; duration : 500 }
        PauseAnimation { duration : 4000 }
        NumberAnimation { target : clockOnlyMsg; property : "opacity"; to : 0; duration : 500 }
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
        protStart()
        loadJSONData(basePath + 'videos.json', 'playList')
        loadJSONData(basePath + 'locales/' + settings.localeLang + '.json', 'poi', playRandomVideo)
    }
    function allowedIndices() {
        // playlist = all videos except those disabled in settings (empty selection = all);
        // during the night hours the night playlist, if any of its videos can play. Only videos
        // with a source playRandomVideo() plays: one without would never be marked viewed, so
        // playRandomVideo() would call itself without end once the others have been shown
        var out = nightIndices()
        if (out.length === 0) {
            var disabled = settings.disabledVideos || []
            for (var i = 0; i < playList.assets.length; i++) {
                if (disabled.indexOf(playList.assets[i].id) === -1 && playable(playList.assets[i])) out.push(i)
            }
        }
        if (out.length === 0) {
            for (var j = 0; j < playList.assets.length; j++) {
                if (playable(playList.assets[j])) out.push(j)
            }
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
    // Night mode (same as web-screensaver.html): from nightStart up to nightEnd (TV time, may be
    // past midnight) the videos come from the night playlist, nightVideos
    function nightHours(date) {
        var start = parseInt(settings.nightStart, 10), end = parseInt(settings.nightEnd, 10), h = date.getHours()
        if (isNaN(start) || isNaN(end) || start === end) return false
        return start < end ? h >= start && h < end : h >= start || h < end
    }
    // Whether a video has a source playRandomVideo() would play
    function playable(asset) {
        if (asset[settings.sourceType]) return true
        if (!settings.playLowerQuality) return false
        if (settings.sourceType == "url-4K-HDR") return !!asset["url-4K-SDR"]
        if (settings.sourceType == "url-1080-HDR") return !!(asset["url-1080-SDR"] || asset["url-1080-H264"])
        return false
    }
    // Indices of the night videos that can play, or [] outside the night hours / without night mode
    function nightIndices() {
        var list = settings.nightVideos
        var out = []
        if (!settings.nightMode || !Array.isArray(list) || !list.length || !nightHours(new Date()))
            return out
        for (var i = 0; i < playList.assets.length; i++) {
            var asset = playList.assets[i]
            if (list.indexOf(asset.id) !== -1 && playable(asset)) out.push(i)
        }
        return out
    }
    function playRandomVideo() {
        // Wait for the decoder check; clock-only mode never starts a video
        if (!decoderDecided || decoderHeld || panelOff || !playList || !poi)
            return
        stalledCounter = 0
        var allowed = allowedIndices()
        // no video at all has the chosen source
        if (allowed.length === 0)
            return
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
        "\n Protection: " + protDebug() +
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
            clockOnlyMsgAnim.start()
        } else
            playRandomVideo()
    }
    // ---- Panel protection ----
    Service {
        id : backlightSet
        appId : window.appId
        service : "com.webos.settingsservice"
        method : "setSystemSettings"
        onCallFailure : console.log("protection: setSystemSettings failed")
    }
    Service {
        id : screenOffService
        appId : window.appId
        service : "com.webos.service.tvpower"
        method : "power/turnOffScreen"
    }
    Service {
        id : standbyService
        appId : window.appId
        service : "com.webos.service.tvpower"
        method : "power/" + standbyMethod
    }
    SequentialAnimation {
        id : protCornerHop
        NumberAnimation { target : window; property : "protFade"; to : 0; duration : 1500 }
        ScriptAction { script : protApplyCorner() }
        NumberAnimation { target : window; property : "protFade"; to : 1; duration : 1500 }
    }
    NumberAnimation {
        id : protFadeAnim
        target : window
        property : "protFade"
    }
    Timer {
        id : protTimer
        interval : 1000
        repeat : true
        onTriggered : protTick()
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
    function protGet(key, def) {
        var p = settings.protection
        return (p && typeof p === "object" && p[key] !== undefined) ? p[key] : def
    }
    function protNum(key, def) {
        var v = Number(protGet(key, def))
        return isNaN(v) ? def : v
    }
    // The brightness is changed only from the user's value that the watcher keeps in watcher.json (and puts
    // back if the screensaver is cut off): without a recent watcher, or without that value, it is left alone.
    function protStart() {
        protTextStart()
        if (!(protGet("brightnessOn", false) || protGet("dimOn", false) || protGet("offOn", false) || protGet("standbyOn", false)
              || protTextMode !== ""))
            return
        protTimer.start()
        if (!(protGet("brightnessOn", false) || protGet("dimOn", false)))
            return
        var xhr = new XMLHttpRequest()
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== XMLHttpRequest.DONE)
                return
            try {
                var w = JSON.parse(xhr.responseText)
                if (xhr.status === 200 && Math.abs(Date.now() / 1000 - w.time) < 30 && typeof w.orig === "number") {
                    protNoWatcher = false
                    protOnOrig(w.orig)
                    return
                }
            } catch (e) {}
            protNoWatcher = true
        }
        xhr.open("GET", basePath + "watcher.json")
        xhr.send()
    }
    function protOnOrig(orig) {
        if (protOrig >= 0)
            return
        protOrig = orig
        protLast = protOrig
        if (protGet("brightnessOn", false)) {
            protBase = Math.max(0, Math.min(100, Math.round(protNum("brightness", 30))))
            setBacklight(protBase)
        } else
            protBase = protOrig
    }
    function setBacklight(v) {
        v = Math.max(0, Math.min(100, Math.round(v)))
        if (protOrig < 0 || v === protLast)
            return
        protLast = v
        backlightSet.callService({category : "picture", settings : {backlight : v}, notifySelf : false})
    }
    function protRestore() {
        if (protOrig >= 0)
            setBacklight(protOrig)
    }
    function protTick() {
        protElapsed++
        protTextTick()
        var min = protElapsed / 60
        // gradual dimming: from protBase down to dimTo % of it, over dimDuration minutes after dimAfter
        if (!panelOff && protBase >= 0 && protGet("dimOn", false)) {
            var after = protNum("dimAfter", 10), dur = Math.max(protNum("dimDuration", 5), 0.1)
            if (min >= after) {
                var f = Math.min((min - after) / dur, 1)
                setBacklight(protBase + (protBase * protNum("dimTo", 20) / 100 - protBase) * f)
            }
        }
        if (!panelOff && protGet("offOn", false) && min >= protNum("offAfter", 60))
            protPanelOff()
        if (!standbyDone && protGet("standbyOn", false) && min >= protNum("standbyAfter", 120))
            protStandby()
    }
    // The brightness is restored first: the panel is dark anyway, and it stays right even if the screensaver is cut off
    function protPanelOff() {
        panelOff = true
        protRestore()
        videoOutput.stop()
        screenOffService.callService({})
    }
    function protStandby() {
        standbyDone = true
        protRestore()
        if (standbyMethod === "") {
            console.log("protection: standby command is not set")
            return
        }
        standbyService.callService({reason : "remoteKey"})   // same as: luna-send -n 1 luna://com.webos.service.tvpower/power/powerOff '{"reason":"remoteKey"}'
    }
    // ---- protection of the text ----
    // the chosen corners, clockwise
    function protCorners() {
        var order = [["cornerTl", "tl"], ["cornerTr", "tr"], ["cornerBr", "br"], ["cornerBl", "bl"]], out = []
        for (var i = 0; i < order.length; i++) {
            if (protGet(order[i][0], true))
                out.push(order[i][1])
        }
        return out
    }
    // the title block sits in the corner, the clock block in the one opposite horizontally (like bl + br)
    function protApplyCorner() {
        protPlaceAnchor = protCornerList[protCornerIdx]
        protClockAnchor = protPlaceAnchor.charAt(0) + (protPlaceAnchor.charAt(1) === "l" ? "r" : "l")
    }
    function protTextStart() {
        protTextMode = ""
        if (protGet("cornersOn", false)) {
            protCornerList = protCorners()
            if (protCornerList.length >= 2) {
                protTextMode = "corners"
                var i = protCornerList.indexOf(placeAnchor)
                protCornerIdx = i >= 0 ? i : 0
                protApplyCorner()
            }
        } else if (protGet("driftOn", false))
            protTextMode = "drift"
        else if (protGet("fadeOn", false))
            protTextMode = "fade"
    }
    function protFadeTo(v, ms) {
        protFadeAnim.stop()
        protFadeAnim.to = v
        protFadeAnim.duration = ms
        protFadeAnim.start()
    }
    // every second. In clock-only mode the clock has its own corner hopping: only the drift applies there
    function protTextTick() {
        if (protTextMode === "drift") {
            var amp = protNum("driftPx", 8), ph = 2 * Math.PI * protElapsed / (Math.max(1, protNum("driftPeriod", 5)) * 60)
            // Lissajous curve 3:2 from the centre, closed once per driftPeriod (same in the app's preview)
            driftX = Math.round(amp * Math.sin(3 * ph))
            driftY = Math.round(amp * Math.sin(2 * ph))
        } else if (protTextMode === "corners" && !decoderHeld) {
            if (protElapsed % Math.max(1, protNum("cornersEvery", 60)) === 0) {
                protCornerIdx = (protCornerIdx + 1) % protCornerList.length
                protCornerHop.restart()
            }
        } else if (protTextMode === "fade" && !decoderHeld && !protFaded) {
            protFadeAge++
            if (protFadeAge >= Math.max(1, protNum("fadeAfter", 30))) {
                protFaded = true
                protFadeTo(0, 2500)
            }
        }
    }
    // the description changed: the text is fresh, so the countdown starts again (and it appears, if it was faded out)
    function protPoiChanged() {
        if (protTextMode !== "fade")
            return
        protFadeAge = 0
        if (protFaded && protGet("fadeInPoi", true)) {
            protFaded = false
            protFadeTo(1, 1500)
        }
    }
    // a new video: the text is back whatever the settings
    function protOnPlaying() {
        if (protTextMode !== "fade")
            return
        protFadeAge = 0
        if (protFaded) {
            protFaded = false
            protFadeTo(1, 1500)
        }
    }
    function protDebug() {
        return "backlight " + protLast + " (was " + protOrig + (protOrig < 0 && protNoWatcher ? ", no watcher" : "") + "), " + Math.floor(protElapsed / 60) + " min" +
            (panelOff ? ", panel off" : "") + (standbyDone ? ", standby sent" : "") + (protTextMode !== "" ? ", text: " + protTextMode : "")
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
