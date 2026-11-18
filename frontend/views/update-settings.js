// The only volatile setting is updateNotice; updateNoticeEnabled is a user preference.
var key = 'updateNotice';
var own = Object.prototype.hasOwnProperty;
function preferences(settings) {
    var copy = Object.create(null);
    Object.keys(settings || {}).forEach(function (k) {
        if (k !== key) { copy[k] = settings[k]; }
    });
    return copy;
}
function carryNotice(settings, live) {
    if (live && own.call(live, key)) { settings[key] = live[key]; }
    return settings;
}
function merge(live, persistent) {
    var result = preferences(live), saved = preferences(persistent);
    Object.keys(saved).forEach(function (k) { result[k] = saved[k]; });
    return carryNotice(result, live);
}
function parse(text) {
    var obj = JSON.parse(text);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) { throw new Error('expected a JSON object'); }
    return obj;
}
module.exports = {key: key, preferences: preferences, carryNotice: carryNotice, merge: merge, parse: parse};
