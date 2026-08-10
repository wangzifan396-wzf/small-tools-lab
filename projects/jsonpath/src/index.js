// JSONPath Explorer: a small, safe JSONPath subset with no eval.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.JsonPathTool = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var hasOwn = Function.call.bind(Object.prototype.hasOwnProperty);

  function isObject(value) {
    return value !== null && typeof value === "object";
  }

  function readIdentifier(path, start) {
    var match = /^[A-Za-z_$][A-Za-z0-9_$-]*/.exec(path.slice(start));
    if (!match) throw new Error("Expected a property name at position " + start);
    return { value: match[0], next: start + match[0].length };
  }

  function readQuoted(path, start) {
    var quote = path[start];
    var value = "";
    var i = start + 1;
    while (i < path.length) {
      var ch = path[i++];
      if (ch === quote) return { value: value, next: i };
      if (ch === "\\") {
        if (i >= path.length) break;
        var escaped = path[i++];
        var map = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" };
        value += map[escaped] !== undefined ? map[escaped] : escaped;
      } else {
        value += ch;
      }
    }
    throw new Error("Unterminated quoted property");
  }

  function parsePath(path) {
    if (typeof path !== "string" || path.length === 0 || path[0] !== "$") {
      throw new Error("JSONPath must start with $");
    }
    var steps = [];
    var i = 1;
    while (i < path.length) {
      if (path[i] === ".") {
        var recursive = path[i + 1] === ".";
        i += recursive ? 2 : 1;
        if (path[i] === "*") {
          steps.push({ type: recursive ? "recursive-wildcard" : "wildcard" });
          i++;
        } else {
          var dotKey = readIdentifier(path, i);
          steps.push({ type: recursive ? "recursive-child" : "child", key: dotKey.value });
          i = dotKey.next;
        }
        continue;
      }
      if (path[i] === "[") {
        i++;
        while (i < path.length && /\s/.test(path[i])) i++;
        if (path[i] === "*" && path[i + 1] === "]") {
          steps.push({ type: "wildcard" });
          i += 2;
          continue;
        }
        if (path[i] === "'" || path[i] === '"') {
          var quoted = readQuoted(path, i);
          i = quoted.next;
          while (i < path.length && /\s/.test(path[i])) i++;
          if (path[i] !== "]") throw new Error("Expected ] at position " + i);
          steps.push({ type: "child", key: quoted.value });
          i++;
          continue;
        }
        var indexMatch = /^\d+/.exec(path.slice(i));
        if (!indexMatch) throw new Error("Expected an index, key, or * at position " + i);
        i += indexMatch[0].length;
        while (i < path.length && /\s/.test(path[i])) i++;
        if (path[i] !== "]") throw new Error("Expected ] at position " + i);
        steps.push({ type: "index", index: Number(indexMatch[0]) });
        i++;
        continue;
      }
      throw new Error("Unexpected character at position " + i + ": " + path[i]);
    }
    return steps;
  }

  function childPath(path, key, arrayIndex) {
    if (arrayIndex) return path + "[" + key + "]";
    if (/^[A-Za-z_$][A-Za-z0-9_$-]*$/.test(key)) return path + "." + key;
    return path + "[" + JSON.stringify(key) + "]";
  }

  function entries(value) {
    if (Array.isArray(value)) return value.map(function (item, index) {
      return { key: String(index), value: item, arrayIndex: true };
    });
    if (!isObject(value)) return [];
    return Object.keys(value).map(function (key) {
      return { key: key, value: value[key], arrayIndex: false };
    });
  }

  function matchesStep(entry, step) {
    if (step.type === "wildcard" || step.type === "recursive-wildcard") return true;
    return step.key === entry.key;
  }

  function evaluate(data, path) {
    var steps = parsePath(path);
    var matches = [{ path: "$", value: data }];
    steps.forEach(function (step) {
      var next = [];
      matches.forEach(function (match) {
        if (step.type === "child") {
          if (isObject(match.value) && hasOwn(match.value, step.key)) {
            next.push({ path: childPath(match.path, step.key, false), value: match.value[step.key] });
          }
          return;
        }
        if (step.type === "index") {
          if (Array.isArray(match.value) && step.index < match.value.length) {
            next.push({ path: childPath(match.path, step.index, true), value: match.value[step.index] });
          }
          return;
        }
        if (step.type === "recursive-child" || step.type === "recursive-wildcard") {
          var ancestors = new WeakSet();
          var visit = function (value, basePath) {
            if (!isObject(value) || ancestors.has(value)) return;
            ancestors.add(value);
            entries(value).forEach(function (entry) {
              var entryPath = childPath(basePath, entry.key, entry.arrayIndex);
              if (matchesStep(entry, step)) next.push({ path: entryPath, value: entry.value });
              if (isObject(entry.value)) visit(entry.value, entryPath);
            });
            ancestors.delete(value);
          };
          visit(match.value, match.path);
          return;
        }
        entries(match.value).forEach(function (entry) {
          next.push({ path: childPath(match.path, entry.key, entry.arrayIndex), value: entry.value });
        });
      });
      matches = next;
    });
    return matches;
  }

  function query(input, path) {
    var data = typeof input === "string" ? JSON.parse(input) : input;
    return evaluate(data, path);
  }

  return { parsePath: parsePath, evaluate: evaluate, query: query };
});
