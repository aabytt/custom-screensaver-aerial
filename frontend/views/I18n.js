// Interface translations. All texts live in assets/i18n.json:
//   {"en-US": {"key": "text", ...}, "de-DE": {...}, "en-GB": "en-US", ...}
// A string instead of an object is an alias: en-GB uses the texts of en-US.
// Lookup order for a key: selected locale -> other locales of the same language -> en-US -> the key itself.
// Placeholders in a text look like {name} and are filled from the params object of t().
var DEFAULT_LANG = 'en-US';
var I18N_URL = 'assets/i18n.json';

var data = null,        // the parsed file ({} if it could not be loaded)
  lang = DEFAULT_LANG,
  chain = [],           // dictionaries to look in, best first
  waiting = null;       // callbacks of a load that is in progress

// the dictionary of a locale, following aliases
function entry(tag) {
  var e = data && data[tag], hops = 0;
  while (typeof e === 'string' && hops++ < 5) { e = data[e]; }
  return (e && typeof e === 'object') ? e : null;
}

function buildChain() {
  var list = [], base = String(lang).split('-')[0].toLowerCase();
  function add(e) { if (e && list.indexOf(e) < 0) { list.push(e); } }
  add(entry(lang));
  Object.keys(data || {}).forEach(function (k) {
    if (k.split('-')[0].toLowerCase() === base) { add(entry(k)); }
  });
  add(entry(DEFAULT_LANG));
  chain = list;
}

var I18n = {
  DEFAULT_LANG: DEFAULT_LANG,

  // Loads the file once (the app's own files are readable without the luna service); callback runs
  // when it is ready. If the file is missing or broken the callback still runs and texts show as keys.
  load: function (callback) {
    var xhr;
    function done(parsed) {
      var list = waiting;
      data = parsed || {};
      waiting = null;
      buildChain();
      list.forEach(function (cb) { cb(); });
    }
    if (data) { callback(); return; }
    if (waiting) { waiting.push(callback); return; }
    waiting = [callback];
    xhr = new XMLHttpRequest();
    xhr.open('GET', I18N_URL);
    xhr.onload = function () {
      var parsed = null;
      if (xhr.status === 200 || (xhr.status === 0 && xhr.responseText)) {
        try {
          parsed = JSON.parse(xhr.responseText);
        } catch (e) {
          console.error('Broken ' + I18N_URL, e);
        }
      }
      done(parsed);
    };
    xhr.onerror = function () {
      console.error('Could not load ' + I18N_URL);
      done(null);
    };
    xhr.send();
  },

  ready: function () {
    return !!data;
  },

  setLang: function (tag) {
    lang = tag || DEFAULT_LANG;
    buildChain();
  },

  getLang: function () {
    return lang;
  },

  t: function (key, params) {
    var text, i;
    for (i = 0; i < chain.length; i++) {
      if (chain[i][key] !== undefined) { text = chain[i][key]; break; }
    }
    if (text === undefined) { return key; }
    if (params) {
      text = text.replace(/\{(\w+)\}/g, function (m, name) {
        return params[name] !== undefined ? params[name] : m;
      });
    }
    return text;
  },

  // Sets the content of every control owned by `owner` that has an `i18n: 'key'` property, e.g.
  //   {kind: Button, i18n: 'testRun', ontap: 'testRun'}
  // Call it again after the language changed.
  apply: function (owner) {
    var controls = owner.$;
    Object.keys(controls).forEach(function (name) {
      var c = controls[name];
      if (c && c.i18n) { c.set('content', I18n.t(c.i18n)); }
    });
  }
};

module.exports = I18n;
