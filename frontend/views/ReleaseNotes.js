// Release notes of the GitHub releases for the "update available" card: turns the Markdown of the
// release pages into the few HTML tags the card needs. The text is escaped first, so only the tags
// made here can end up in the page.
var ESC = {'&': '&amp;', '<': '&lt;', '>': '&gt;'};
function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return ESC[c]; }); }

var H_STYLE = 'font-weight:bold; color:#fff; margin:14px 0 4px;';
var CODE_STYLE = 'font-family:monospace; background:rgba(255,255,255,0.12); padding:0 6px; border-radius:4px;';

// bold, italic, code, links (text only: the TV can't open them), images and bare URLs removed
function inline(text) {
  var codes = [];
  text = esc(text)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/`([^`]+)`/g, function (m, c) { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; })
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+by\s+@[\w-]+\s+in\s+https?:\/\/\S+/g, '')   // "by @user in <pull request link>" of generated notes
    .replace(/https?:\/\/\S+/g, '')
    .replace(/:[a-z0-9_+-]+:/g, '')                           // emoji shortcodes
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, function (m, a, b) { return '<b style="color:#fff;">' + (a || b) + '</b>'; })
    .replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
    .replace(/\s{2,}/g, ' ').trim();
  return text.replace(/\u0000(\d+)\u0000/g, function (m, i) { return '<span data-nt="1" style="' + CODE_STYLE + '">' + esc(codes[i]) + '</span>'; });
}

// Markdown -> HTML (headings, bullet and numbered lists with nesting, paragraphs)
function mdToHtml(md) {
  var out = [], lines = String(md || '').replace(/\r/g, '').replace(/<!--[\s\S]*?-->/g, '').split('\n');
  lines.forEach(function (line) {
    var m, text, indent;
    if (!line.trim() || /^\s*([-*_])\1{2,}\s*$/.test(line)) { return; }
    if (/^\W*full changelog/i.test(line.trim())) { return; }   // a link to the diff, useless on a TV
    if ((m = /^\s{0,3}#{1,6}\s+(.*?)\s*#*$/.exec(line))) {
      text = inline(m[1]);
      if (text) { out.push('<div style="' + H_STYLE + '">' + text + '</div>'); }
      return;
    }
    if ((m = /^(\s*)(?:[-*+]|(\d+)[.)])\s+(?:\[[ xX]\]\s+)?(.*)$/.exec(line))) {
      text = inline(m[3]);
      if (!text) { return; }
      indent = 24 + Math.min(3, Math.floor(m[1].replace(/\t/g, '    ').length / 2)) * 28;
      out.push('<div style="padding-left:' + indent + 'px; text-indent:-' + (m[2] ? 28 : 22) + 'px; margin:3px 0;">' +
        (m[2] ? m[2] + '.&nbsp;' : '\u2022&nbsp;&nbsp;') + text + '</div>');
      return;
    }
    text = inline(line.replace(/^\s*>\s?/, ''));
    if (text) { out.push('<div style="margin:6px 0;">' + text + '</div>'); }
  });
  return out.join('');
}

function stripV(tag) { return String(tag || '').replace(/^v/i, ''); }

// releases: the GitHub API list. Keeps the published ones that are newer than `current` and no newer
// than `latest` (what the Homebrew Channel offers), newest first. compare(a, b) -> number.
function select(releases, current, latest, compare) {
  return (Array.isArray(releases) ? releases : []).filter(function (r) {
    var v = stripV(r && r.tag_name);
    return r && v && !r.draft && !r.prerelease && compare(v, current) > 0 && compare(v, latest) <= 0;
  }).sort(function (a, b) { return compare(stripV(b.tag_name), stripV(a.tag_name)); });
}

// HTML of the notes. Several releases (skipped versions): each under its version.
// withVersions: the version headings even for a single release (the full changelog)
function render(list, withVersions) {
  var many = withVersions || list.length > 1;
  return list.map(function (r) {
    var v = stripV(r.tag_name), title = String(r.name || '').trim(), body = mdToHtml(r.body);
    if (!body) { body = '<div style="margin:6px 0; opacity:0.7;">\u2014</div>'; }
    return (many ? '<div style="font-size:28px; font-weight:bold; color:#fff; margin:' + (r === list[0] ? '0' : '18px') + ' 0 4px;">' +
      esc(v) + (title && stripV(title) !== v && title.indexOf(v) < 0 ? ' \u00b7 ' + esc(title) : '') + '</div>' : '') + body;
  }).join('');
}

module.exports = {mdToHtml: mdToHtml, select: select, render: render};
