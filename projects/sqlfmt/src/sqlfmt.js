/*
 * sqlfmt — zero-dependency SQL formatter / minifier.
 * Uppercases keywords, breaks major clauses onto their own lines, and indents
 * AND/OR continuation lines. String literals and comments are preserved.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SqlFmt = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // Clauses that start a new line at base indent.
  var MAJOR = [
    'DELETE FROM', 'DELETE', 'INSERT INTO', 'INTO', 'VALUES', 'UPDATE', 'SET',
    'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT',
    'OFFSET', 'UNION ALL', 'UNION', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN',
    'FULL JOIN', 'CROSS JOIN', 'ON', 'RETURNING', 'CREATE TABLE',
    'ALTER TABLE', 'DROP TABLE', 'TRUNCATE TABLE'
  ];
  var KEYWORDS = [
    'SELECT', 'DISTINCT', 'ALL', 'FROM', 'AS', 'WHERE', 'AND', 'OR', 'NOT', 'IN',
    'IS', 'NULL', 'LIKE', 'ILIKE', 'BETWEEN', 'EXISTS', 'GROUP BY', 'ORDER BY',
    'ASC', 'DESC', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'INSERT INTO', 'INTO',
    'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'ALTER', 'ADD',
    'DROP', 'COLUMN', 'INDEX', 'VIEW', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL',
    'CROSS', 'OUTER', 'ON', 'USING', 'RETURNING', 'CASE', 'WHEN', 'THEN', 'ELSE',
    'END', 'CAST', 'WITH', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'DEFAULT',
    'UNIQUE', 'CHECK', 'CONSTRAINT', 'INTERVAL', 'BY', 'TRUE', 'FALSE'
  ];

  function protect(sql) {
    var store = [];
    sql = sql.replace(/\/\*[\s\S]*?\*\//g, function (m) { store.push(m); return '\u0000' + (store.length - 1) + '\u0000'; });
    sql = sql.replace(/--[^\n]*/g, function (m) { store.push(m); return '\u0000' + (store.length - 1) + '\u0000'; });
    sql = sql.replace(/'(?:[^'\\]|\\.)*'/g, function (m) { store.push(m); return '\u0000' + (store.length - 1) + '\u0000'; });
    sql = sql.replace(/"(?:[^"\\]|\\.)*"/g, function (m) { store.push(m); return '\u0000' + (store.length - 1) + '\u0000'; });
    sql = sql.replace(/`(?:[^`\\]|\\.)*`/g, function (m) { store.push(m); return '\u0000' + (store.length - 1) + '\u0000'; });
    return { sql: sql, store: store };
  }

  function restore(sql, store) {
    return sql.replace(/\u0000(\d+)\u0000/g, function (_, i) { return store[Number(i)]; });
  }

  function upperKeywords(sql) {
    KEYWORDS.forEach(function (kw) {
      var re = new RegExp('\\b' + kw.replace(/ /g, '\\s+') + '\\b', 'gi');
      sql = sql.replace(re, kw);
    });
    return sql;
  }

  function format(sql) {
    if (!sql || !sql.trim()) return '';
    var p = protect(sql);
    var s = p.sql.replace(/\s+/g, ' ').trim();
    s = upperKeywords(s);
    MAJOR.forEach(function (kw) {
      var re = new RegExp('\\s+\\b' + kw.replace(/ /g, '\\s+') + '\\b', 'g');
      s = s.replace(re, '\n' + kw);
    });
    // Bare JOIN (not part of a typed join like LEFT/RIGHT/INNER JOIN) also breaks.
    s = s.replace(/(?<!\b(?:INNER|LEFT|RIGHT|FULL|CROSS)\s+)JOIN\b/g, '\nJOIN');
    s = s.replace(/\s+(AND|OR)\b/g, '\n  $1');
    var lines = s.split('\n');
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      if (/^(AND|OR)\b/.test(line)) out.push('  ' + line);
      else out.push(line);
    }
    return restore(out.join('\n'), p.store);
  }

  function minify(sql) {
    if (!sql || !sql.trim()) return '';
    var p = protect(sql);
    var s = p.sql.replace(/\s+/g, ' ').trim();
    s = s.replace(/\s*([,;])\s*/g, '$1');
    s = s.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
    s = s.replace(/\s*=\s*/g, '=');
    return restore(s, p.store);
  }

  return { format: format, minify: minify };
});
