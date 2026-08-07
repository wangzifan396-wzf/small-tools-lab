/*
 * curlcon — zero-dependency converter from a curl command to JS fetch and
 * Python requests. Parses the common flags (-X, -H, -d, -u, -b, -k, -F).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CurlCon = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var ARG_FLAGS = {
    '-x': 1, '--request': 1, '--url': 1, '-h': 1, '--header': 1,
    '-d': 1, '--data': 1, '--data-raw': 1, '--data-binary': 1, '--data-urlencode': 1,
    '-u': 1, '--user': 1, '-b': 1, '--cookie': 1, '-o': 1, '--output': 1,
    '-A': 1, '--user-agent': 1, '-c': 1, '--cookie-jar': 1, '-f': 1, '--form': 1,
    '--connect-timeout': 1, '--max-time': 1, '-T': 1, '--proxy': 1
  };
  var NOARG_FLAGS = {
    '-k': 'insecure', '--insecure': 'insecure', '-s': 'silent', '--silent': 'silent',
    '-S': 'showError', '--show-error': 'showError', '-L': 'follow', '--location': 'follow',
    '-i': 'include', '--include': 'include', '-v': 'verbose', '--verbose': 'verbose',
    '--compressed': 'compressed', '--fail': 'fail'
  };

  function parse(curl) {
    var cmd = (curl || '').replace(/^curl\s+/i, '').trim();
    var tokens = [];
    var re = /"([^"]*)"|'([^']*)'|(\S+)/g, m;
    while ((m = re.exec(cmd))) tokens.push(m[1] !== undefined ? m[1] : (m[2] !== undefined ? m[2] : m[3]));

    var req = {
      method: 'GET', url: '', headers: {}, data: null, user: null,
      cookie: null, insecure: false, form: null
    };
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      var low = t.toLowerCase();
      if (ARG_FLAGS[low]) {
        var val = tokens[++i];
        if (low === '-x' || low === '--request') req.method = val.toUpperCase();
        else if (low === '--url') req.url = val;
        else if (low === '-h' || low === '--header') {
          var idx = val.indexOf(':');
          if (idx > -1) req.headers[val.slice(0, idx).trim()] = val.slice(idx + 1).trim();
        } else if (low === '-d' || low.indexOf('--data') === 0 || low === '--data-urlencode') req.data = val;
        else if (low === '-u' || low === '--user') req.user = val;
        else if (low === '-b' || low === '--cookie') req.cookie = val;
        else if (low === '-f' || low === '--form') req.form = val;
      } else if (NOARG_FLAGS[low]) {
        req[NOARG_FLAGS[low]] = true;
      } else if (!req.url && (t[0] !== '-' || /^https?:\/\//i.test(t))) {
        req.url = t;
      }
    }
    return req;
  }

  function isJson(str) {
    try { JSON.parse(str); return true; } catch { return false; }
  }

  function toJs(req) {
    var lines = [];
    lines.push('const url = ' + JSON.stringify(req.url) + ';');
    lines.push('const options = {');
    lines.push('  method: ' + JSON.stringify(req.method) + ',');
    if (Object.keys(req.headers).length || req.cookie || req.user) {
      lines.push('  headers: {');
      if (req.cookie) lines.push("    'Cookie': " + JSON.stringify(req.cookie) + ',');
      if (req.user) lines.push("    'Authorization': 'Basic ' + btoa(" + JSON.stringify(req.user) + '),');
      for (var k in req.headers) {
        if (k.toLowerCase() === 'cookie' || (req.user && k.toLowerCase() === 'authorization')) continue;
        lines.push('    ' + JSON.stringify(k) + ': ' + JSON.stringify(req.headers[k]) + ',');
      }
      lines.push('  },');
    }
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.data != null) {
      if (isJson(req.data)) {
        if (!req.headers['Content-Type'] && !req.headers['content-type'])
          lines.push("  headers: Object.assign({ 'Content-Type': 'application/json' }, ),");
        lines.push('  body: JSON.stringify(' + req.data + '),');
      } else {
        lines.push('  body: ' + JSON.stringify(req.data) + ',');
      }
    }
    if (req.insecure) lines.push('  // server rejected self-signed cert: set NODE_TLS_REJECT_UNAUTHORIZED=0 or use https agent');
    lines.push('};');
    lines.push('');
    lines.push('const res = await fetch(url, options);');
    lines.push("const data = await res.json(); // or res.text()");
    lines.push('console.log(data);');
    return lines.join('\n');
  }

  function toPython(req) {
    var lines = [];
    lines.push('import requests');
    lines.push('');
    lines.push('url = ' + JSON.stringify(req.url));
    if (Object.keys(req.headers).length || req.cookie) {
      lines.push('headers = {');
      if (req.cookie) lines.push("    'Cookie': " + JSON.stringify(req.cookie) + ',');
      for (var k in req.headers) {
        if (k.toLowerCase() === 'cookie') continue;
        lines.push('    ' + JSON.stringify(k) + ': ' + JSON.stringify(req.headers[k]) + ',');
      }
      lines.push('}');
    } else {
      lines.push('headers = {}');
    }
    var auth = req.user ? '\nauth = ' + JSON.stringify(req.user.split(':')) : '';
    lines.push('');
    lines.push('resp = requests.request(');
    lines.push('    ' + JSON.stringify(req.method) + ',');
    lines.push('    url,');
    lines.push('    headers=headers,');
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.data != null) {
      if (isJson(req.data)) lines.push('    json=' + req.data + ',');
      else lines.push('    data=' + JSON.stringify(req.data) + ',');
    }
    if (req.user) lines.push('    auth=tuple(' + JSON.stringify(req.user.split(':')) + '),');
    if (req.insecure) lines.push('    verify=False,');
    lines.push(')');
    lines.push('print(resp.status_code)');
    lines.push('print(resp.text)');
    return lines.join('\n');
  }

  function convert(curl) {
    var req = parse(curl);
    return { js: toJs(req), python: toPython(req), request: req };
  }

  return { parse: parse, convert: convert, toJs: toJs, toPython: toPython };
});
