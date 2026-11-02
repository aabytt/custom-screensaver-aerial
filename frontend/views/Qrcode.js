// Minimal QR code encoder: byte mode, versions 1-40, error correction levels L/M/Q/H, no dependencies
// (the TV may be offline, so no remote QR service). ES5 only, to run on old webOS browsers.
// The algorithm follows the QR Code Model 2 specification (ISO/IEC 18004).

var ECC_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],   // L
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],   // M
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],   // Q
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]    // H
];
var NUM_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
];
var LEVELS = {L: 0, M: 1, Q: 2, H: 3};
var FORMAT_BITS = [1, 0, 3, 2];   // L, M, Q, H as stored in the format information

function rawModules(ver) {
  var result = (16 * ver + 128) * ver + 64, n;
  if (ver >= 2) {
    n = Math.floor(ver / 7) + 2;
    result -= (25 * n - 10) * n - 55;
    if (ver >= 7) { result -= 36; }
  }
  return result;
}

function dataCodewords(ver, ecl) {
  return Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ecl][ver] * NUM_BLOCKS[ecl][ver];
}

// ---- Reed-Solomon over GF(256), polynomial 0x11D ----
function gfMul(x, y) {
  var z = 0, i;
  for (i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11D);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree) {
  var result = [], i, j, root = 1;
  for (i = 0; i < degree - 1; i++) { result.push(0); }
  result.push(1);
  for (i = 0; i < degree; i++) {
    for (j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < result.length) { result[j] ^= result[j + 1]; }
    }
    root = gfMul(root, 2);
  }
  return result;
}

function rsRemainder(data, divisor) {
  var result = [], i, k, factor;
  for (i = 0; i < divisor.length; i++) { result.push(0); }
  for (k = 0; k < data.length; k++) {
    factor = data[k] ^ result.shift();
    result.push(0);
    for (i = 0; i < divisor.length; i++) { result[i] ^= gfMul(divisor[i], factor); }
  }
  return result;
}

// ---- data ----
function utf8Bytes(text) {
  var s = unescape(encodeURIComponent(text)), out = [], i;
  for (i = 0; i < s.length; i++) { out.push(s.charCodeAt(i)); }
  return out;
}

function appendBits(bits, value, count) {
  var i;
  for (i = count - 1; i >= 0; i--) { bits.push((value >>> i) & 1); }
}

function buildData(bytes, ver, ecl) {
  var bits = [], cap = dataCodewords(ver, ecl) * 8, data = [], i, pad = 0xEC;
  appendBits(bits, 4, 4);                                   // byte mode
  appendBits(bits, bytes.length, ver < 10 ? 8 : 16);        // character count
  for (i = 0; i < bytes.length; i++) { appendBits(bits, bytes[i], 8); }
  appendBits(bits, 0, Math.min(4, cap - bits.length));      // terminator
  appendBits(bits, 0, (8 - bits.length % 8) % 8);
  while (bits.length < cap) {
    appendBits(bits, pad, 8);
    pad ^= 0xEC ^ 0x11;
  }
  for (i = 0; i < bits.length; i += 8) {
    data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  }
  return data;
}

// error correction codewords per block, interleaved
function addEccAndInterleave(data, ver, ecl) {
  var numBlocks = NUM_BLOCKS[ecl][ver], eccLen = ECC_PER_BLOCK[ecl][ver],
    raw = Math.floor(rawModules(ver) / 8),
    numShort = numBlocks - raw % numBlocks, shortLen = Math.floor(raw / numBlocks),
    blocks = [], div = rsDivisor(eccLen), result = [], i, k = 0, datLen, dat, ecc;
  for (i = 0; i < numBlocks; i++) {
    datLen = shortLen - eccLen + (i < numShort ? 0 : 1);
    dat = data.slice(k, k + datLen);
    k += datLen;
    ecc = rsRemainder(dat, div);
    if (i < numShort) { dat.push(0); }   // placeholder, skipped below
    blocks.push(dat.concat(ecc));
  }
  for (i = 0; i < blocks[0].length; i++) {
    for (k = 0; k < blocks.length; k++) {
      if (i !== shortLen - eccLen || k >= numShort) { result.push(blocks[k][i]); }
    }
  }
  return result;
}

// ---- matrix ----
function Matrix(ver, ecl) {
  var size = ver * 4 + 17, y, x;
  this.ver = ver;
  this.ecl = ecl;
  this.size = size;
  this.m = [];    // dark modules
  this.fn = [];   // function patterns (not data, not masked)
  for (y = 0; y < size; y++) {
    this.m.push([]);
    this.fn.push([]);
    for (x = 0; x < size; x++) { this.m[y].push(false); this.fn[y].push(false); }
  }
}

Matrix.prototype.set = function (x, y, dark) {
  this.m[y][x] = dark;
  this.fn[y][x] = true;
};

Matrix.prototype.drawFinder = function (cx, cy) {
  var dx, dy, dist, x, y;
  for (dy = -4; dy <= 4; dy++) {
    for (dx = -4; dx <= 4; dx++) {
      dist = Math.max(Math.abs(dx), Math.abs(dy));
      x = cx + dx;
      y = cy + dy;
      if (x >= 0 && x < this.size && y >= 0 && y < this.size) { this.set(x, y, dist !== 2 && dist !== 4); }
    }
  }
};

Matrix.prototype.drawAlignment = function (cx, cy) {
  var dx, dy;
  for (dy = -2; dy <= 2; dy++) {
    for (dx = -2; dx <= 2; dx++) { this.set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }
  }
};

Matrix.prototype.alignPositions = function () {
  var ver = this.ver, n, step, result, pos;
  if (ver === 1) { return []; }
  n = Math.floor(ver / 7) + 2;
  step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  result = [6];
  for (pos = this.size - 7; result.length < n; pos -= step) { result.splice(1, 0, pos); }
  return result;
};

Matrix.prototype.drawFunctionPatterns = function () {
  var size = this.size, i, j, pos, n;
  for (i = 0; i < size; i++) {
    this.set(6, i, i % 2 === 0);
    this.set(i, 6, i % 2 === 0);
  }
  this.drawFinder(3, 3);
  this.drawFinder(size - 4, 3);
  this.drawFinder(3, size - 4);
  pos = this.alignPositions();
  n = pos.length;
  for (i = 0; i < n; i++) {
    for (j = 0; j < n; j++) {
      if (!((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0))) {
        this.drawAlignment(pos[i], pos[j]);
      }
    }
  }
  this.drawFormat(0);   // reserves the format area; rewritten once the mask is known
  this.drawVersion();
};

Matrix.prototype.drawFormat = function (mask) {
  var data = FORMAT_BITS[this.ecl] << 3 | mask, rem = data, i, bits, size = this.size;
  function bit(n) { return ((bits >>> n) & 1) !== 0; }
  for (i = 0; i < 10; i++) { rem = (rem << 1) ^ ((rem >>> 9) * 0x537); }
  bits = (data << 10 | rem) ^ 0x5412;
  for (i = 0; i <= 5; i++) { this.set(8, i, bit(i)); }
  this.set(8, 7, bit(6));
  this.set(8, 8, bit(7));
  this.set(7, 8, bit(8));
  for (i = 9; i < 15; i++) { this.set(14 - i, 8, bit(i)); }
  for (i = 0; i < 8; i++) { this.set(size - 1 - i, 8, bit(i)); }
  for (i = 8; i < 15; i++) { this.set(8, size - 15 + i, bit(i)); }
  this.set(8, size - 8, true);   // always dark
};

Matrix.prototype.drawVersion = function () {
  var rem = this.ver, i, bits, a, b, dark;
  if (this.ver < 7) { return; }
  for (i = 0; i < 12; i++) { rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25); }
  bits = this.ver << 12 | rem;
  for (i = 0; i < 18; i++) {
    dark = ((bits >>> i) & 1) !== 0;
    a = this.size - 11 + i % 3;
    b = Math.floor(i / 3);
    this.set(a, b, dark);
    this.set(b, a, dark);
  }
};

Matrix.prototype.drawCodewords = function (data) {
  var size = this.size, i = 0, right, vert, j, x, y, upward;
  for (right = size - 1; right >= 1; right -= 2) {
    if (right === 6) { right = 5; }
    for (vert = 0; vert < size; vert++) {
      for (j = 0; j < 2; j++) {
        x = right - j;
        upward = ((right + 1) & 2) === 0;
        y = upward ? size - 1 - vert : vert;
        if (!this.fn[y][x] && i < data.length * 8) {
          this.m[y][x] = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
          i++;
        }
      }
    }
  }
};

function maskHit(mask, x, y) {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return x * y % 2 + x * y % 3 === 0;
    case 6: return (x * y % 2 + x * y % 3) % 2 === 0;
    default: return ((x + y) % 2 + x * y % 3) % 2 === 0;
  }
}

Matrix.prototype.applyMask = function (mask) {
  var x, y;
  for (y = 0; y < this.size; y++) {
    for (x = 0; x < this.size; x++) {
      if (!this.fn[y][x] && maskHit(mask, x, y)) { this.m[y][x] = !this.m[y][x]; }
    }
  }
};

// penalty of the four standard rules; the mask with the lowest one is used
Matrix.prototype.penalty = function () {
  var size = this.size, m = this.m, p = 0, x, y, k, run, dark = 0, line, pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  function matches(arr, at, pat) {
    var i;
    for (i = 0; i < pat.length; i++) { if ((arr[at + i] ? 1 : 0) !== pat[i]) { return false; } }
    return true;
  }
  for (y = 0; y < size; y++) {
    for (x = 0; x < size; x++) { if (m[y][x]) { dark++; } }
  }
  for (k = 0; k < 2; k++) {   // rows, then columns
    for (y = 0; y < size; y++) {
      line = [];
      for (x = 0; x < size; x++) { line.push(k === 0 ? m[y][x] : m[x][y]); }
      run = 1;
      for (x = 1; x <= size; x++) {
        if (x < size && line[x] === line[x - 1]) {
          run++;
        } else {
          if (run >= 5) { p += 3 + run - 5; }
          run = 1;
        }
      }
      for (x = 0; x + 11 <= size; x++) {
        if (matches(line, x, pat1) || matches(line, x, pat2)) { p += 40; }
      }
    }
  }
  for (y = 0; y < size - 1; y++) {
    for (x = 0; x < size - 1; x++) {
      if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) { p += 3; }
    }
  }
  p += (Math.ceil(Math.abs(dark * 20 - size * size * 10) / (size * size)) - 1) * 10;
  return p;
};

// text -> {size, modules: [row][col] of booleans}. ecl: 'L' | 'M' | 'Q' | 'H' (a minimum: it is raised
// while the code stays in the same version). Throws if the text does not fit.
function encode(text, ecl) {
  var level = LEVELS[ecl || 'M'], bytes = utf8Bytes(text), ver, need, lv, data, mx, best, bestMask, mask, pen;
  for (ver = 1; ver <= 40; ver++) {
    need = 4 + (ver < 10 ? 8 : 16) + bytes.length * 8;
    if (need <= dataCodewords(ver, level) * 8) { break; }
  }
  if (ver > 40) { throw new Error('QR: text too long'); }
  for (lv = level + 1; lv <= 3; lv++) {
    if (need <= dataCodewords(ver, lv) * 8) { level = lv; }
  }
  data = addEccAndInterleave(buildData(bytes, ver, level), ver, level);
  mx = new Matrix(ver, level);
  mx.drawFunctionPatterns();
  mx.drawCodewords(data);
  best = Infinity;
  for (mask = 0; mask < 8; mask++) {
    mx.applyMask(mask);
    mx.drawFormat(mask);
    pen = mx.penalty();
    if (pen < best) { best = pen; bestMask = mask; }
    mx.applyMask(mask);   // undo (xor)
  }
  mx.applyMask(bestMask);
  mx.drawFormat(bestMask);
  return {size: mx.size, modules: mx.m, version: ver, level: level, mask: bestMask};
}

// SVG markup of the code with a 4-module white quiet zone; the module size is a whole number of pixels
// (crisp edges), as large as fits into maxPx. Returns {markup, px}.
function svg(text, ecl, maxPx) {
  var q = encode(text, ecl), quiet = 4, total = q.size + quiet * 2, scale = Math.max(1, Math.floor(maxPx / total)),
    px = total * scale, path = [], x, y, start;
  for (y = 0; y < q.size; y++) {
    start = -1;
    for (x = 0; x <= q.size; x++) {
      if (x < q.size && q.modules[y][x]) {
        if (start < 0) { start = x; }
      } else if (start >= 0) {
        path.push('M' + (start + quiet) + ' ' + (y + quiet) + 'h' + (x - start) + 'v1h-' + (x - start) + 'z');
        start = -1;
      }
    }
  }
  return {
    px: px,
    markup: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total + '" width="' + px + '" height="' + px +
      '" shape-rendering="crispEdges"><rect width="' + total + '" height="' + total + '" fill="#fff"/>' +
      '<path d="' + path.join('') + '" fill="#000"/></svg>'
  };
}

// number of bytes that fit into a version at a level (for tests / sizing)
function capacity(ver, ecl) {
  return Math.floor((dataCodewords(ver, LEVELS[ecl]) * 8 - 4 - (ver < 10 ? 8 : 16)) / 8);
}

module.exports = {encode: encode, svg: svg, capacity: capacity};
