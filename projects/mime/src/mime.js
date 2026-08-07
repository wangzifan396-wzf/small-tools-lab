// mime.js — zero-dependency MIME type lookup (extension <-> type).
// UMD so it works in the browser (<script src>) and under `require` in tests.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MimeTool = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // extension (no dot) -> MIME type
  var TYPES = {
    html: 'text/html', htm: 'text/html', xhtml: 'application/xhtml+xml',
    css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', cjs: 'text/javascript',
    json: 'application/json', map: 'application/json', webmanifest: 'application/manifest+json',
    xml: 'application/xml', rss: 'application/rss+xml', atom: 'application/atom+xml',
    txt: 'text/plain', text: 'text/plain', md: 'text/markdown', markdown: 'text/markdown',
    csv: 'text/csv', tsv: 'text/tab-separated-values', ics: 'text/calendar',
    yaml: 'application/yaml', yml: 'application/yaml', toml: 'application/toml',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', bmp: 'image/bmp',
    ico: 'image/x-icon', tif: 'image/tiff', tiff: 'image/tiff', heic: 'image/heic',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg',
    flac: 'audio/flac', aac: 'audio/aac', m4a: 'audio/mp4', weba: 'audio/webm',
    mp4: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mov: 'video/quicktime',
    mkv: 'video/x-matroska', avi: 'video/x-msvideo', mpg: 'video/mpeg', mpeg: 'video/mpeg',
    woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', eot: 'application/vnd.ms-fontobject',
    pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    zip: 'application/zip', gz: 'application/gzip', tar: 'application/x-tar',
    rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed', bz2: 'application/x-bzip2', xz: 'application/x-xz',
    bin: 'application/octet-stream', exe: 'application/octet-stream', dll: 'application/octet-stream',
    wasm: 'application/wasm', jsonld: 'application/ld+json', geojson: 'application/geo+json',
    sh: 'application/x-sh', py: 'text/x-python', rb: 'text/x-ruby', php: 'application/x-httpd-php',
    go: 'text/x-go', rs: 'text/x-rust', java: 'text/x-java', c: 'text/x-c', h: 'text/x-c',
    cpp: 'text/x-c++', cc: 'text/x-c++', hpp: 'text/x-c++', ts: 'text/typescript', tsx: 'text/typescript', jsx: 'text/jsx',
    sql: 'application/sql', db: 'application/x-sqlite3', sqlite: 'application/x-sqlite3',
    epub: 'application/epub+zip', mobi: 'application/x-mobipocket-ebook',
    gifv: 'video/webm', apng: 'image/apng', cur: 'image/x-icon'
  };

  var TEXT_LIKE = ['text/', 'application/json', 'application/xml', 'application/javascript',
    'application/yaml', 'application/toml', 'application/ld+json', 'application/geo+json',
    'application/sql', '+xml', '+json'];

  function buildReverse() {
    var rev = {};
    for (var ext in TYPES) {
      if (!Object.prototype.hasOwnProperty.call(TYPES, ext)) continue;
      var t = TYPES[ext];
      (rev[t] = rev[t] || []).push(ext);
    }
    return rev;
  }
  var REVERSE = buildReverse();

  function normExt(input) {
    if (!input) return '';
    var s = String(input).trim().toLowerCase();
    if (s.indexOf('.') >= 0) {
      // could be a filename or a dotted extension; take the last segment
      var parts = s.split('.');
      s = parts[parts.length - 1];
    }
    return s;
  }

  // filename or extension -> MIME type ('' if unknown)
  function lookup(input) {
    var ext = normExt(input);
    if (!ext) return '';
    return TYPES[ext] || '';
  }

  // MIME type -> array of common extensions (without dot)
  function extensions(type) {
    if (!type) return [];
    return (REVERSE[String(type).trim().toLowerCase()] || []).slice();
  }

  function charset(type) {
    if (!type) return '';
    var t = String(type).toLowerCase();
    for (var i = 0; i < TEXT_LIKE.length; i++) {
      if (t.indexOf(TEXT_LIKE[i]) === 0 || t.indexOf(TEXT_LIKE[i]) >= 0) return 'UTF-8';
    }
    return '';
  }

  return {
    lookup: lookup,
    extensions: extensions,
    charset: charset,
    TYPES: TYPES
  };
});
