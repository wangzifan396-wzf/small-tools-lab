"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { analyzeRepository, parseCompose, parseDocker, parseDocs, parseEnv, parseKubernetes, parsePackage, parsePortMapping, parseSource } = require("../src/analyzer.js");

function fixture(files) { const root = fs.mkdtempSync(path.join(os.tmpdir(), "port-matrix-")); for (const [name, content] of Object.entries(files)) { const destination = path.join(root, name); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, content); } return root; }

test("parses Compose short, long, and container-only mappings", () => { assert.deepEqual(parsePortMapping("127.0.0.1:8080:3000/udp"), { host: 8080, container: 3000, protocol: "udp" }); assert.deepEqual(parsePortMapping({ published: 9000, target: 4000, protocol: "tcp" }), { host: 9000, container: 4000, protocol: "tcp" }); assert.deepEqual(parsePortMapping(5000), { container: 5000 }); });
test("parses environment and Docker declarations", () => { assert.equal(parseEnv(".env", "APP_PORT=3000\n", ".")[0].port, 3000); assert.equal(parseDocker("Dockerfile", "EXPOSE 8080/tcp 5353/udp\n", ".").length, 2); });
test("parses package scripts and common source defaults", () => { assert.equal(parsePackage("package.json", '{"scripts":{"dev":"vite --port 5173"}}', ".")[0].port, 5173); assert.equal(parseSource("server.js", "const p = process.env.PORT || 3000; app.listen(3000);", ".").length, 2); assert.equal(parseSource("serve.js", "const requestedPort = Number(process.argv[2]) || 4173;", ".")[0].port, 4173); assert.equal(parseSource("cli.py", "parser.add_argument('--port', type=int, default=8765)", ".")[0].port, 8765); assert.equal(parseSource("builder.js", "const importerLimit = value || 2000;", ".").length, 0); });
test("parses documented localhost URLs", () => { assert.deepEqual(parseDocs("README.md", "Open http://localhost:4321 now", ".").map((item) => item.port), [4321]); });
test("parses Compose services and build context", () => { const parsed = parseCompose("compose.yml", "services:\n  api:\n    build: ./api\n    ports: ['8080:3000']\n", "."); assert.equal(parsed.evidence.length, 2); assert.equal(parsed.builds[0].context, "api"); });
test("parses Kubernetes workload and Service ports", () => { const yaml = "apiVersion: apps/v1\nkind: Deployment\nmetadata: {name: api}\nspec: {template: {spec: {containers: [{name: api, ports: [{containerPort: 3000}]}]}}}\n---\napiVersion: v1\nkind: Service\nmetadata: {name: api}\nspec: {ports: [{port: 80, targetPort: 3000}]}\n"; const parsed = parseKubernetes("k8s.yml", yaml, "."); assert.equal(parsed.errors.length, 0); assert.deepEqual(parsed.evidence.map((item) => item.role), ["container", "service", "target"]); });
test("finds invalid ports, collisions, Docker drift, Kubernetes drift, env conflict, and docs drift", () => { const root = path.resolve(__dirname, "../examples/drift-stack"); const report = analyzeRepository(root); const rules = new Set(report.findings.map((item) => item.rule)); ["PM001", "PM002", "PM003", "PM004", "PM005", "PM006"].forEach((rule) => assert.equal(rules.has(rule), true, rule)); });
test("gives a consistent local service a perfect score", () => { const root = fixture({ "package.json": "{}", ".env.example": "PORT=3000\n", "server.js": "const port = process.env.PORT || 3000; app.listen(3000);", "README.md": "Use http://localhost:3000" }); const report = analyzeRepository(root); assert.equal(report.summary.score, 100); assert.equal(report.findings.length, 0); });
test("deduplicates overlapping source evidence on the same line", () => { const root = fixture({ "package.json": "{}", "server.js": "const port = process.env.PORT || 3000;" }); const report = analyzeRepository(root); assert.equal(report.declarations.length, 1); assert.equal(report.declarations[0].variable, "PORT"); });
test("reports malformed structured configuration", () => { const root = fixture({ "compose.yml": "services: [broken" }); const report = analyzeRepository(root); assert.equal(report.findings[0].rule, "PM008"); });
test("validates configuration arrays", () => { assert.throws(() => analyzeRepository(fixture({}), { ignore: "bad" }), /must be arrays/); });
