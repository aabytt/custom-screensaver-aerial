// NOAA sunrise/sunset approximation; returns UTC event times, or null during polar day/night.
function solarEventUtc(day, latitude, longitude, sunrise) {
    var dayOfYear = Math.floor((day - Date.UTC(day.getUTCFullYear(), 0, 0)) / 86400000);
    var longitudeHour = longitude / 15;
    var approximate = dayOfYear + ((sunrise ? 6 : 18) - longitudeHour) / 24;
    var meanAnomaly = 0.9856 * approximate - 3.289;
    var trueLongitude = meanAnomaly + 1.916 * Math.sin(meanAnomaly * Math.PI / 180) +
        0.020 * Math.sin(2 * meanAnomaly * Math.PI / 180) + 282.634;
    trueLongitude = (trueLongitude % 360 + 360) % 360;
    var rightAscension = Math.atan(0.91764 * Math.tan(trueLongitude * Math.PI / 180)) * 180 / Math.PI;
    rightAscension = (rightAscension % 360 + 360) % 360;
    rightAscension += Math.floor(trueLongitude / 90) * 90 - Math.floor(rightAscension / 90) * 90;
    rightAscension /= 15;
    var sinDeclination = 0.39782 * Math.sin(trueLongitude * Math.PI / 180);
    var cosDeclination = Math.cos(Math.asin(sinDeclination));
    var cosHourAngle = (Math.cos(90.833 * Math.PI / 180) -
        sinDeclination * Math.sin(latitude * Math.PI / 180)) /
        (cosDeclination * Math.cos(latitude * Math.PI / 180));
    if (cosHourAngle > 1 || cosHourAngle < -1) return null;
    var hourAngle = sunrise ? 360 - Math.acos(cosHourAngle) * 180 / Math.PI :
        Math.acos(cosHourAngle) * 180 / Math.PI;
    var localMeanTime = hourAngle / 15 + rightAscension - 0.06571 * approximate - 6.622;
    var utcHour = localMeanTime - longitudeHour;
    return Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()) + utcHour * 3600000;
}

function solarTimeOfDay(latitude, longitude, now, windowMinutes) {
    latitude = Number(latitude);
    longitude = Number(longitude);
    now = now instanceof Date ? now.getTime() : Number(now);
    windowMinutes = Number(windowMinutes);
    if (!isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !isFinite(longitude) || longitude < -180 || longitude > 180 || !isFinite(now)) return null;
    if (!isFinite(windowMinutes) || windowMinutes < 0) windowMinutes = 60;

    var date = new Date(now);
    var utcMidnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    var sunriseEvents = [], sunsetEvents = [];
    for (var offset = -1; offset <= 1; offset++) {
        var day = new Date(utcMidnight + offset * 86400000);
        var sunrise = solarEventUtc(day, latitude, longitude, true);
        var sunset = solarEventUtc(day, latitude, longitude, false);
        if (sunrise !== null) sunriseEvents.push(sunrise);
        if (sunset !== null) sunsetEvents.push(sunset);
    }
    if (!sunriseEvents.length || !sunsetEvents.length) return polarPhase(latitude, now);
    return solarPhaseFromEvents(now, sunriseEvents, sunsetEvents, windowMinutes);
}

// Polar day / night: the sun doesn't cross the horizon, so there are no events. It is up when the
// declination has the sign of the latitude.
function polarPhase(latitude, now) {
    var day = new Date(now), start = Date.UTC(day.getUTCFullYear(), 0, 0),
        n = Math.floor((now - start) / 86400000),
        declination = -23.44 * Math.cos(2 * Math.PI * (n + 10) / 365);
    return declination * latitude > 0 ? "day" : "night";
}

// "sunrise" / "sunset" within windowMinutes of an event, otherwise "day" (between a sunrise and the
// next sunset) or "night". sunrises / sunsets: UTC epoch ms lists, e.g. stored by solar-update.sh.
function solarPhaseFromEvents(now, sunriseEvents, sunsetEvents, windowMinutes) {
    windowMinutes = Number(windowMinutes);
    if (!isFinite(windowMinutes) || windowMinutes < 0) windowMinutes = 60;
    var windowMs = windowMinutes * 60000, riseDistance = Infinity, setDistance = Infinity;
    for (var i = 0; i < sunriseEvents.length; i++) {
        riseDistance = Math.min(riseDistance, Math.abs(now - sunriseEvents[i]));
    }
    for (var j = 0; j < sunsetEvents.length; j++) {
        setDistance = Math.min(setDistance, Math.abs(now - sunsetEvents[j]));
    }
    if (riseDistance <= windowMs || setDistance <= windowMs) {
        return riseDistance <= windowMs && riseDistance <= setDistance ? "sunrise" : "sunset";
    }

    var latestRise = -Infinity, nextSet = Infinity;
    for (var r = 0; r < sunriseEvents.length; r++) {
        if (sunriseEvents[r] <= now) latestRise = Math.max(latestRise, sunriseEvents[r]);
    }
    for (var s = 0; s < sunsetEvents.length; s++) {
        if (sunsetEvents[s] >= now) nextSet = Math.min(nextSet, sunsetEvents[s]);
    }
    return nextSet > latestRise && nextSet - latestRise <= 28 * 3600000 &&
        now > latestRise && now < nextSet ? "day" : "night";
}

// Sunrise and sunset (UTC epoch ms) of the UTC day of `now` and its neighbours, for display.
function solarEvents(latitude, longitude, now, spanDays) {
    var d = new Date(now), mid = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
        rises = [], sets = [];
    for (var o = -spanDays; o <= spanDays; o++) {
        var day = new Date(mid + o * 86400000), a = solarEventUtc(day, latitude, longitude, true),
            b = solarEventUtc(day, latitude, longitude, false);
        if (a !== null) rises.push(a);
        if (b !== null) sets.push(b);
    }
    return {sunrises: rises, sunsets: sets};
}

// Works as a plain <script> (globals above) and as a CommonJS module.
if (typeof module !== "undefined" && module.exports) {
    module.exports = {solarTimeOfDay: solarTimeOfDay, solarPhaseFromEvents: solarPhaseFromEvents,
        solarEvents: solarEvents};
}
