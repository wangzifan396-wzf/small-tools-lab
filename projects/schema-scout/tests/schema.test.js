"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Scout = require("../src/schema.js");

const records = [
  { id: 1, name: "Ada", active: true, profile: { team: "Core" }, tags: ["api", "docs"] },
  { id: 2, name: "Lin", active: false, profile: { team: "Web" }, tags: [], score: 4.5 },
  { id: 3, name: null, active: true, profile: null, tags: ["ui"] }
];

test("reports paths, types, coverage, depth, and nulls", () => {
  const report = Scout.analyze(records);
  assert.equal(report.records, 3);
  assert.ok(report.maxDepth >= 2);
  assert.equal(report.nulls, 2);
  const score = report.fields.find((field) => field.path === "score");
  assert.equal(score.coverage, 1 / 3);
  assert.deepEqual(report.fields.find((field) => field.path === "name").types, ["null", "string"]);
  assert.ok(report.fields.some((field) => field.path === "tags[]"));
});

test("infers required and optional JSON Schema properties", () => {
  const schema = Scout.toJsonSchema(records, "People");
  assert.equal(schema.title, "People");
  assert.equal(schema.type, "array");
  assert.equal(schema.items.type, "object");
  assert.ok(schema.items.required.includes("id"));
  assert.ok(!schema.items.required.includes("score"));
  assert.equal(schema.items.properties.id.type, "integer");
  assert.ok(schema.items.properties.name.anyOf.some((item) => item.type === "null"));
});

test("generates nested TypeScript with optional fields and unions", () => {
  const output = Scout.toTypeScript(records, "People dataset");
  assert.match(output, /export interface PeopleDatasetItem/);
  assert.match(output, /score\?: number;/);
  assert.match(output, /name: null \| string|string \| null/);
  assert.match(output, /export type PeopleDataset = Array<PeopleDatasetItem>;/);
});

test("produces a quoted path catalog", () => {
  const csv = Scout.toCatalogCsv(Scout.analyze(records));
  assert.match(csv, /^"path","types","coverage","examples"/);
  assert.match(csv, /"profile\.team"/);
});

test("normalizes interface names", () => {
  assert.equal(Scout.pascalCase("order-items_v2"), "OrderItemsV2");
  assert.equal(Scout.pascalCase("2026 report"), "Value2026Report");
});
