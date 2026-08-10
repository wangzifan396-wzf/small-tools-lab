import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSql, minifySql, tokenizeSql } from '../src/index.js';

test('tokenizes SQL-standard doubled quotes without treating contents as syntax', () => {
  const tokens = tokenizeSql("select 'it''s -- data', \"select\"\"name\" from t");
  assert.equal(tokens.filter((token) => token.type === 'string')[0].raw, "'it''s -- data'");
  assert.equal(tokens.filter((token) => token.type === 'quoted-identifier')[0].raw, '"select""name"');
  const prefixed = String.raw`select E'line\n', N'text', X'AB', U&"d\0061t"`;
  assert.deepEqual(tokenizeSql(prefixed).filter((token) => token.type === 'string').map((token) => token.raw), [String.raw`E'line\n'`, "N'text'", "X'AB'"]);
  assert.equal(tokenizeSql(prefixed).find((token) => token.type === 'quoted-identifier').raw, String.raw`U&"d\0061t"`);
  assert.equal(minifySql(prefixed), String.raw`select E'line\n',N'text',X'AB',U&"d\0061t"`);
});

test('supports PostgreSQL dollar strings and placeholders', () => {
  const tokens = tokenizeSql('select $tag$begin; -- data\nend$tag$, $1, :name, @value, ?');
  assert.equal(tokens.filter((token) => token.type === 'string').length, 1);
  assert.deepEqual(tokens.filter((token) => token.type === 'placeholder').map((token) => token.raw), ['$1', ':name', '@value', '?']);
});

test('supports nested block comments and MySQL line comments', () => {
  const tokens = tokenizeSql('select /* outer /* inner */ done */ 1 # note');
  assert.equal(tokens.filter((token) => token.type === 'block-comment').length, 1);
  assert.equal(tokens.filter((token) => token.type === 'line-comment').length, 1);
});

test('reports unterminated lexical constructs with line and column', () => {
  for (const sql of ["select 'oops", 'select /* oops', 'select $x$oops', 'select [oops']) {
    assert.throws(() => tokenizeSql(sql), /line 1, column/u);
  }
});

test('formats major clauses, lists, conditions, and keyword case', () => {
  const output = formatSql('select id,name from users where age>=18 and active=true order by name desc');
  assert.equal(output, 'SELECT id,\n  name\nFROM users\nWHERE age >= 18\n  AND active = TRUE\nORDER BY name DESC');
});

test('formats joins and multiword phrases deterministically', () => {
  const output = formatSql('select u.id,o.total from users u left outer join orders o on u.id=o.user_id where o.total>10');
  assert.match(output, /LEFT OUTER JOIN orders o/u);
  assert.match(output, /\nON u\.id = o\.user_id/u);
});

test('preserves strings, quoted identifiers, comments, and Unicode words byte-for-byte', () => {
  const input = "select 用户名, 'select from' as \"where\" from 用户 -- keep FROM\nwhere 城市='北京'";
  const output = formatSql(input);
  assert.match(output, /'select from'/u);
  assert.match(output, /"where"/u);
  assert.match(output, /-- keep FROM/u);
  assert.match(output, /用户名/u);
});

test('formats CASE branches on readable lines', () => {
  const output = formatSql("select case when score>=90 then 'A' else 'B' end as grade from results");
  assert.match(output, /CASE\n  WHEN score >= 90 THEN 'A'\n  ELSE 'B'\nEND/u);
});

test('formats nested queries and validates parentheses', () => {
  const output = formatSql('select id from users where id in (select user_id from orders where total>0)');
  assert.match(output, /IN \(\n  SELECT user_id/u);
  assert.throws(() => formatSql('select (1'), /Unclosed parenthesis/);
  assert.throws(() => formatSql('select 1)'), /Unexpected closing/);
});

test('is idempotent and preserves the significant token stream', () => {
  const input = 'select a,b from t where x=1 or y in (2,3);';
  const once = formatSql(input);
  assert.equal(formatSql(once), once);
  assert.equal(minifySql(once).toLowerCase(), minifySql(input).toLowerCase());
});

test('minifies whitespace without changing literals or optimizer comments', () => {
  const input = "SELECT  /*+ INDEX(t idx) */  a , 'x  y' FROM t WHERE x = 1 ;";
  const output = minifySql(input);
  assert.match(output, /\/\*\+ INDEX\(t idx\) \*\//u);
  assert.match(output, /'x  y'/u);
  assert.doesNotMatch(output, /SELECT  /u);
});

test('minify optionally removes comments while protecting token boundaries', () => {
  assert.equal(minifySql('select a /* note */ from t -- tail', { removeComments: true }), 'select a from t');
  assert.equal(minifySql('select 1- -1'), 'select 1- -1');
});

test('supports lower and preserved keyword case with configurable indentation', () => {
  assert.match(formatSql('SELECT a,b FROM t', { keywordCase: 'lower', indent: 4 }), /^select a,\n {4}b\nfrom/u);
  assert.match(formatSql('SeLeCt a FrOm t', { keywordCase: 'preserve', indent: '\t' }), /^SeLeCt/u);
  assert.throws(() => formatSql('select 1', { indent: 20 }), /indent/);
});

test('recognizes JSON and cast operators without corrupting them', () => {
  const output = minifySql("select payload->>'name', value::text from events where id<>0");
  assert.equal(output, "select payload->>'name',value::text from events where id<>0");
});

test('handles empty input and validates API arguments', () => {
  assert.equal(formatSql('   '), '');
  assert.equal(minifySql(''), '');
  assert.throws(() => tokenizeSql(null), /must be a string/);
  assert.throws(() => minifySql('select 1', { removeComments: 'yes' }), /boolean/);
});
