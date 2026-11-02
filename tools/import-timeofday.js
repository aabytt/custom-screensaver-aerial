#!/usr/bin/env node
// Copies the timeOfDay tag (sunrise / day / sunset / night) of each video from the source
// manifests into assets/videos.json. The ids are matched case-insensitively; videos that no
// manifest lists keep no tag. Only the "timeOfDay" lines change, the rest of the file is kept as
// it is.
//
//   node tools/import-timeofday.js <manifest.json> [<manifest.json> ...]
//
// A manifest is {"assets": [{"id", "timeOfDay"}, ...]} or a plain array of those, e.g. Apple's
// tvOS entries.json or the Fire OS screensaver list.
'use strict';
var fs = require('fs'), path = require('path');

var VALUES = ['sunrise', 'day', 'sunset', 'night'];
var file = path.join(__dirname, '..', 'assets', 'videos.json');

var tags = {};
process.argv.slice(2).forEach(function (name) {
    var data = JSON.parse(fs.readFileSync(name, 'utf8'));
    (Array.isArray(data) ? data : data.assets || []).forEach(function (a) {
        if (a && a.id && VALUES.indexOf(a.timeOfDay) >= 0) tags[String(a.id).toUpperCase()] = a.timeOfDay;
    });
});
if (!Object.keys(tags).length) {
    console.error('usage: node tools/import-timeofday.js <manifest.json> [...]');
    process.exit(1);
}

var raw = fs.readFileSync(file, 'utf8');
var crlf = raw.indexOf('\r\n') >= 0;   // e.g. a Windows checkout with core.autocrlf
var text = crlf ? raw.replace(/\r\n/g, '\n') : raw;
var count = {};
// drop the tags of an earlier import, then add one after each "id" line of an asset
text = text.replace(/\n *"timeOfDay": "[a-z]*",(?=\n)/g, '');
text = text.replace(/\n( *)"id": "([^"]*)",(?=\n)/g, function (line, indent, id) {
    var tod = tags[id.toUpperCase()];
    if (!tod) return line;
    count[tod] = (count[tod] || 0) + 1;
    return line + '\n' + indent + '"timeOfDay": "' + tod + '",';
});
if (!Object.keys(count).length) {
    console.error('no video of ' + file + ' matched an id of the manifests: nothing changed');
    process.exit(1);
}
JSON.parse(text);   // still valid
fs.writeFileSync(file, crlf ? text.replace(/\n/g, '\r\n') : text);
console.log('tagged', count);
