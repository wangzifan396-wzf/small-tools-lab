const test = require('node:test');
const assert = require('node:assert');
const { format, minify } = require('../src/sqlfmt.js');

test('uppercases keywords and breaks clauses', () => {
  const out = format("select id,name from users where age>18 and active=1 order by name desc");
  assert.ok(out.startsWith('SELECT id,name'));
  assert.ok(out.includes('\nFROM users'));
  assert.ok(out.includes('\nWHERE age>18'));
  assert.ok(out.includes('\n  AND active=1'));
  assert.ok(out.includes('\nORDER BY name DESC'));
});

test('handles joins', () => {
  const out = format("select u.id from users u left join orders o on u.id=o.uid where o.total>10 and o.paid=1");
  assert.ok(out.includes('LEFT JOIN orders o'));
  assert.ok(out.includes('\nON u.id=o.uid'));
  assert.ok(out.includes('\n  AND o.paid=1'));
});

test('protects string literals from uppercasing', () => {
  const out = format("select name from t where city='select city'");
  assert.ok(out.includes("city='select city'"), 'string literal must be untouched');
  assert.ok(out.startsWith('SELECT'));
});

test('minify collapses whitespace', () => {
  const out = minify("SELECT  id ,  name\n  FROM  users ;");
  assert.strictEqual(out, 'SELECT id,name FROM users;');
});

test('empty input', () => {
  assert.strictEqual(format(''), '');
  assert.strictEqual(minify('   '), '');
});
