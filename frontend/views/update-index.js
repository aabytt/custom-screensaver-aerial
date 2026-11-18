// Shared by the companion UI and the watcher. GitHub releases are only for release notes.
function parts(version) {
    var m = String(version || '').match(/\d+(\.\d+)+/);
    return m ? m[0].split('.').map(function (n) { return parseInt(n, 10); }) : [];
}

function validVersion(version) {
    return typeof version === 'string' && version.length <= 128 &&
        /^[vV]?[0-9]+(?:.[0-9]+)+(?:[-+][0-9A-Za-z.+-]+)?$/.test(version) &&
        parts(version).every(function (n) { return isFinite(n); });
}

module.exports = {
    validVersion: validVersion,
    url: 'https://repo.webosbrew.org/api/apps.json',
    version: function (index, id) {
        var packages = index && index.packages, i, entry, version;
        if (!Array.isArray(packages) || !id) { return; }
        for (i = 0; i < packages.length; i++) {
            entry = packages[i];
            if (entry && entry.id === id) {
                version = entry.manifest && entry.manifest.version;
                if (validVersion(version)) { return version; }
                return;
            }
        }
    },
    compare: function (a, b) {
        var x = parts(a), y = parts(b), i, d;
        for (i = 0; i < Math.max(x.length, y.length); i++) {
            d = (x[i] || 0) - (y[i] || 0);
            if (d) { return d; }
        }
        return 0;
    }
};
