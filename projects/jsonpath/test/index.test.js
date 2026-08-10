"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const J = require("../src/index.js");

const DATA = {
  users: [
    { name: "Ada", profile: { city: "London", roles: ["admin", "author"] } },
    { name: "Lin", profile: { city: "Shanghai", roles: ["editor"] } },
  ],
  meta: { owner: { name: "Ops" } },
  "a.b": { value: 7 },
};

test("reads root, dotted properties, and array indexes", () => {
  assert.deepEqual(J.evaluate(DATA, "$")[0], { path: "$", value: DATA });
  assert.equal(J.evaluate(DATA, "$.users[0].name")[0].value, "Ada");
  assert.equal(J.evaluate(DATA, "$.users[1].profile.city")[0].path, "$.users[1].profile.city");
});

test("supports quoted property names and JSON string input", () => {
  assert.equal(J.query(JSON.stringify(DATA), "$['a.b'].value")[0].value, 7);
  assert.equal(J.query(DATA, '$["a.b"].value')[0].path, '$["a.b"].value');
});

test("supports object and array wildcards", () => {
  assert.deepEqual(J.evaluate(DATA, "$.users[*].name").map((m) => m.value), ["Ada", "Lin"]);
  assert.deepEqual(J.evaluate(DATA, "$.users[0].profile.roles[*]").map((m) => m.value), ["admin", "author"]);
  assert.equal(J.evaluate(DATA, "$.meta.*")[0].value.name, "Ops");
});

test("recursive descent finds matching keys at every depth", () => {
  assert.deepEqual(J.evaluate(DATA, "$..name").map((m) => m.value), ["Ada", "Lin", "Ops"]);
  assert.equal(J.evaluate(DATA, "$..*").some((m) => m.path === "$.users[0].profile.city"), true);
});

test("missing properties return no matches", () => {
  assert.deepEqual(J.evaluate(DATA, "$.users[9].name"), []);
  assert.deepEqual(J.evaluate(DATA, "$..missing"), []);
});

test("does not traverse inherited properties", () => {
  const value = Object.create({ hidden: 1 });
  value.visible = 2;
  assert.deepEqual(J.evaluate(value, "$.*").map((m) => m.value), [2]);
});

test("handles scalar roots and empty arrays", () => {
  assert.equal(J.evaluate(42, "$")[0].value, 42);
  assert.deepEqual(J.evaluate({ items: [] }, "$.items[*]"), []);
});

test("parses the supported step types", () => {
  assert.deepEqual(J.parsePath("$.users[*].name"), [
    { type: "child", key: "users" },
    { type: "wildcard" },
    { type: "child", key: "name" },
  ]);
  assert.deepEqual(J.parsePath("$..name"), [{ type: "recursive-child", key: "name" }]);
});

test("rejects malformed or unsafe expressions", () => {
  assert.throws(() => J.parsePath("users"), /start with \$/);
  assert.throws(() => J.parsePath("$.users["), /index|key|\*/);
  assert.throws(() => J.parsePath("$.users.."), /property name/);
  assert.throws(() => J.parsePath("$.users[foo]"), /index|key/);
});

test("query reports JSON parse errors instead of executing input", () => {
  assert.throws(() => J.query("{bad}", "$"), SyntaxError);
  assert.equal(J.evaluate({ constructor: { ok: true } }, "$.constructor.ok")[0].value, true);
});

test("recursive descent terminates on cyclic API input", () => {
  const cyclic = { name: "root" };
  cyclic.self = cyclic;
  assert.deepEqual(J.evaluate(cyclic, "$..name").map((match) => match.value), ["root"]);
  assert.equal(J.evaluate(cyclic, "$..*").length, 2);
});
