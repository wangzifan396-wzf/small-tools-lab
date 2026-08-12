"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const O = require("../src/core.js");

function fixture() {
  return {
    openapi: "3.1.1",
    info: { title: "Pet API", version: "1.2.0" },
    servers: [{ url: "https://{region}.example.com/v1", variables: { region: { default: "eu" } } }],
    security: [{ bearerAuth: [] }],
    paths: {
      "/pets/{petId}": {
        parameters: [
          { name: "petId", in: "path", required: true, schema: { type: "string", example: "pet 1" } },
          { name: "locale", in: "query", schema: { type: "string", default: "zh-CN" } },
        ],
        get: {
          operationId: "getPet",
          summary: "Get a pet",
          parameters: [
            { name: "locale", in: "query", schema: { type: "string", example: "en" } },
            { name: "fields", in: "query", schema: { type: "array", example: ["id", "name"] } },
            { name: "X-Trace", in: "header", example: "trace-1", schema: { type: "string" } },
          ],
          responses: { "200": { description: "OK" } },
        },
        post: {
          operationId: "updatePet",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/PetInput" } } },
          },
          responses: { "200": { description: "Updated" } },
        },
      },
    },
    components: {
      schemas: {
        PetInput: {
          type: "object",
          properties: {
            name: { type: "string", example: "Milo" },
            age: { type: "integer", minimum: 1 },
            active: { type: "boolean" },
          },
        },
        "slash/name": { type: "string", example: "decoded" },
      },
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
    },
  };
}

test("parses JSON text and rejects empty, malformed, and non-object roots", () => {
  assert.equal(O.parseDocument(JSON.stringify(fixture())).info.title, "Pet API");
  assert.equal(O.parseDocument(fixture()).openapi, "3.1.1");
  assert.throws(() => O.parseDocument(""), /empty/);
  assert.throws(() => O.parseDocument("{bad}"), /Invalid JSON/);
  assert.throws(() => O.parseDocument("[]"), /root must be an object/);
});

test("resolves local JSON Pointer references including escaped path parts", () => {
  const doc = fixture();
  assert.equal(O.resolveRef(doc, "#/components/schemas/PetInput").properties.name.example, "Milo");
  assert.equal(O.resolveRef(doc, "#/components/schemas/slash~1name").example, "decoded");
  assert.throws(() => O.resolveRef(doc, "#/components/schemas/Missing"), /Unresolved/);
  assert.throws(() => O.resolveRef(doc, "https://example.com/schema.json"), /External/);
});

test("detects circular reference object chains", () => {
  const doc = { a: { $ref: "#/b" }, b: { $ref: "#/a" } };
  assert.throws(() => O.resolveRef(doc, "#/a"), /Circular/);
});

test("validates a representative OpenAPI 3.1 document", () => {
  assert.deepEqual(O.validateDocument(fixture()), []);
});

test("reports required top-level fields and unsupported versions", () => {
  const issues = O.validateDocument({ openapi: "2.0", paths: {} });
  assert.deepEqual(issues.map((item) => item.code), ["version", "info"]);
});

test("reports path template, response, operationId, and duplicate parameter problems", () => {
  const doc = fixture();
  doc.paths["/pets/{petId}"].get.responses = {};
  doc.paths["/pets/{petId}"].get.parameters.push({ name: "locale", in: "query", schema: { type: "string" } });
  doc.paths["/other/{id}"] = { get: { operationId: "getPet", responses: { "200": { description: "OK" } } } };
  const codes = O.validateDocument(doc).map((item) => item.code);
  assert.ok(codes.includes("responses-empty"));
  assert.ok(codes.includes("parameter-duplicate"));
  assert.ok(codes.includes("operation-id"));
  assert.ok(codes.includes("path-parameter"));
});

test("reports external refs as warnings and broken local refs as errors", () => {
  const doc = fixture();
  doc.components.schemas.External = { $ref: "https://example.com/external.json" };
  doc.components.schemas.Broken = { $ref: "#/components/schemas/Nope" };
  const refs = O.validateDocument(doc).filter((item) => item.code === "ref");
  assert.equal(refs.some((item) => item.severity === "warning" && /External/.test(item.message)), true);
  assert.equal(refs.some((item) => item.severity === "error" && /Unresolved/.test(item.message)), true);
});

test("lists operations and applies operation-level parameter overrides", () => {
  const operations = O.listOperations(fixture());
  assert.deepEqual(operations.map((item) => item.id), ["getPet", "updatePet"]);
  const get = operations[0];
  assert.equal(get.server, "https://eu.example.com/v1");
  assert.equal(get.parameters.find((item) => item.name === "locale").schema.example, "en");
  assert.deepEqual(get.responses, ["200"]);
});

test("extracts JSON request bodies and resolves schema examples", () => {
  const doc = fixture();
  const post = O.listOperations(doc)[1];
  assert.equal(post.requestBody.mediaType, "application/json");
  assert.deepEqual(JSON.parse(JSON.stringify(O.sampleFromSchema(doc, post.requestBody.media.schema))), { name: "Milo", age: 1, active: false });
});

test("generates deterministic samples for composition, arrays, enums, and formats", () => {
  const doc = fixture();
  assert.deepEqual(JSON.parse(JSON.stringify(O.sampleFromSchema(doc, { allOf: [{ type: "object", properties: { a: { enum: ["x"] } } }, { type: "object", properties: { b: { type: "array", items: { format: "email" } } } }] }))), { a: "x", b: ["user@example.com"] });
  assert.equal(O.sampleFromSchema(doc, { anyOf: [{ type: "integer", minimum: 5 }, { type: "string" }] }), 5);
  assert.equal(O.sampleFromSchema(doc, { format: "uuid" }), "00000000-0000-4000-8000-000000000000");
});

test("breaks recursive schema samples without overflowing", () => {
  const doc = fixture();
  doc.components.schemas.Node = { type: "object", properties: { name: { type: "string" }, child: { $ref: "#/components/schemas/Node" } } };
  assert.deepEqual(JSON.parse(JSON.stringify(O.sampleFromSchema(doc, { $ref: "#/components/schemas/Node" }))), { name: "string", child: null });
});

test("builds an encoded URL, exploded query, headers, and bearer placeholder", () => {
  const doc = fixture();
  const request = O.buildRequest(doc, O.listOperations(doc)[0]);
  assert.equal(request.method, "GET");
  assert.equal(request.url, "https://eu.example.com/v1/pets/pet%201?locale=en&fields=id&fields=name");
  assert.equal(request.headers["X-Trace"], "trace-1");
  assert.equal(request.headers.Authorization, "Bearer YOUR_ACCESS_TOKEN");
});

test("builds a JSON request body from a referenced schema", () => {
  const doc = fixture();
  const request = O.buildRequest(doc, O.listOperations(doc)[1]);
  assert.equal(request.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(request.body), { name: "Milo", age: 1, active: false });
});

test("serializes deepObject query values and apiKey authentication", () => {
  const doc = fixture();
  doc.security = [{ apiKey: [] }];
  doc.components.securitySchemes = { apiKey: { type: "apiKey", in: "query", name: "key" } };
  doc.paths["/pets/{petId}"].get.parameters = [{ name: "filter", in: "query", style: "deepObject", schema: { type: "object", example: { status: "ok", limit: 2 } } }];
  const request = O.buildRequest(doc, O.listOperations(doc)[0]);
  assert.ok(request.url.includes("filter%5Bstatus%5D=ok"));
  assert.ok(request.url.includes("filter%5Blimit%5D=2"));
  assert.ok(request.url.includes("key=YOUR_API_KEY"));
});

test("adds cookie authentication with a browser warning", () => {
  const doc = fixture();
  doc.security = [{ cookieKey: [] }];
  doc.components.securitySchemes = { cookieKey: { type: "apiKey", in: "cookie", name: "session" } };
  const request = O.buildRequest(doc, O.listOperations(doc)[0]);
  assert.equal(request.headers.Cookie, "session=YOUR_API_KEY");
  assert.ok(request.warnings.some((warning) => /Cookie/.test(warning)));
  assert.doesNotMatch(O.generateCode(doc, O.listOperations(doc)[0], "fetch").code, /Cookie/);
  assert.match(O.generateCode(doc, O.listOperations(doc)[0], "curl").code, /Cookie/);
});

test("serializes spaceDelimited and pipeDelimited query arrays", () => {
  const doc = fixture();
  doc.paths["/pets/{petId}"].get.parameters = [
    { name: "space", in: "query", style: "spaceDelimited", schema: { type: "array", example: ["a", "b"] } },
    { name: "pipe", in: "query", style: "pipeDelimited", schema: { type: "array", example: ["x", "y"] } },
  ];
  const request = O.buildRequest(doc, O.listOperations(doc)[0]);
  assert.ok(request.url.includes("space=a%20b"));
  assert.ok(request.url.includes("pipe=x%7Cy"));
});

test("generates curl, Fetch, and Python request snippets", () => {
  const doc = fixture();
  const operation = O.listOperations(doc)[1];
  const curl = O.generateCode(doc, operation, "curl").code;
  const fetchCode = O.generateCode(doc, operation, "fetch").code;
  const python = O.generateCode(doc, operation, "python").code;
  assert.match(curl, /^curl -X POST/);
  assert.match(curl, /--data-raw/);
  assert.doesNotThrow(() => new vm.Script("async function request() {\n" + fetchCode + "\n}"));
  assert.match(fetchCode, /response\.status === 204/);
  assert.match(python, /requests\.request/);
  assert.match(python, /response\.raise_for_status/);
  assert.throws(() => O.generateCode(doc, operation, "ruby"), /Unsupported language/);
});

test("generates multipart code without a manually broken boundary header", () => {
  const doc = fixture();
  doc.paths["/upload"] = {
    post: {
      operationId: "upload",
      requestBody: { content: { "multipart/form-data": { schema: { type: "object", properties: { caption: { example: "cover" }, file: { type: "string", format: "binary" } } } } } },
      responses: { "204": { description: "Uploaded" } },
    },
  };
  const operation = O.listOperations(doc).find((item) => item.id === "upload");
  const request = O.buildRequest(doc, operation);
  assert.equal(request.bodyKind, "multipart");
  assert.equal(request.headers["Content-Type"], undefined);
  assert.match(O.generateCode(doc, operation, "curl").code, /-F 'caption=cover'/);
  assert.match(O.generateCode(doc, operation, "fetch").code, /new FormData/);
  assert.match(O.generateCode(doc, operation, "python").code, /files=/);
});

test("serializes urlencoded bodies and warns for custom media types", () => {
  const doc = fixture();
  doc.paths["/form"] = { post: { operationId: "form", requestBody: { content: { "application/x-www-form-urlencoded": { schema: { type: "object", properties: { name: { example: "Ada Lovelace" } } } } } }, responses: { "200": { description: "OK" } } } };
  doc.paths["/custom"] = { post: { operationId: "custom", requestBody: { content: { "application/custom": { schema: { type: "string", example: "raw" } } } }, responses: { "200": { description: "OK" } } } };
  const operations = O.listOperations(doc);
  const form = O.buildRequest(doc, operations.find((item) => item.id === "form"));
  assert.equal(form.body, "name=Ada%20Lovelace");
  assert.equal(form.bodyKind, "urlencoded");
  const custom = O.buildRequest(doc, operations.find((item) => item.id === "custom"));
  assert.ok(custom.warnings.some((warning) => /manual serialization/.test(warning)));
});

test("analyze returns one bounded report", () => {
  const report = O.analyze(JSON.stringify(fixture()));
  assert.deepEqual(report.summary, {
    title: "Pet API",
    version: "1.2.0",
    openapi: "3.1.1",
    operationCount: 2,
    errorCount: 0,
    warningCount: 0,
  });
  assert.equal(report.operations.length, 2);
});

test("integrates with the repository safe YAML parser for templated OpenAPI paths", async () => {
  const { parseYaml } = await import("../../yaml-json/src/core/yaml.js");
  const yaml = `openapi: 3.1.1
info:
  title: YAML API
  version: 1.0.0
paths:
  "/items/{itemId}":
    get:
      parameters:
        - name: itemId
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: OK
`;
  const report = O.analyze(parseYaml(yaml));
  assert.equal(report.summary.errorCount, 0);
  assert.equal(report.operations[0].path, "/items/{itemId}");
});
