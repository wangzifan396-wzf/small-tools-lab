import { parseYaml } from "../../yaml-json/src/core/yaml.js";

const Core = window.OpenApiLab;
const SAMPLE = `openapi: 3.1.1
info:
  title: Bookstore API
  version: 1.0.0
  description: A compact OpenAPI Lab example
servers:
  - url: https://api.example.com/v1
security:
  - bearerAuth: []
paths:
  /books:
    get:
      operationId: listBooks
      summary: List books
      tags: [Books]
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
        - name: tags
          in: query
          schema:
            type: array
            example: [fiction, featured]
      responses:
        "200":
          description: A list of books
    post:
      operationId: createBook
      summary: Create a book
      tags: [Books]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/BookInput"
      responses:
        "201":
          description: Created
  "/books/{bookId}":
    get:
      operationId: getBook
      summary: Get one book
      tags: [Books]
      parameters:
        - name: bookId
          in: path
          required: true
          schema:
            type: string
            example: book-42
      responses:
        "200":
          description: One book
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
  schemas:
    BookInput:
      type: object
      required: [title]
      properties:
        title:
          type: string
          example: The Local API
        pages:
          type: integer
          minimum: 1
        published:
          type: boolean
`;

const state = { report: null, selectedId: null, language: "curl", method: "all", query: "" };
const $ = (id) => document.getElementById(id);
const elements = {
  source: $("source"), file: $("file"), drop: $("drop-zone"), analyze: $("analyze"), sample: $("sample"),
  sourceStatus: $("source-status"), title: $("api-title"), version: $("api-version"), spec: $("spec-version"),
  operationCount: $("operation-count"), errorCount: $("error-count"), warningCount: $("warning-count"),
  issues: $("issues"), issueEmpty: $("issue-empty"), search: $("search"), methods: $("methods"),
  operations: $("operations"), operationEmpty: $("operation-empty"), detail: $("detail"), code: $("code"),
  warnings: $("code-warnings"), copy: $("copy"), tabs: $("language-tabs"), theme: $("theme-toggle"),
};

function parseInput(source) {
  try { return { document: Core.parseDocument(source), format: "JSON" }; }
  catch (jsonError) {
    try { return { document: Core.parseDocument(parseYaml(source)), format: "YAML" }; }
    catch (yamlError) { throw new SyntaxError("JSON: " + jsonError.message + "\nYAML: " + yamlError.message); }
  }
}

function analyze() {
  try {
    const parsed = parseInput(elements.source.value);
    state.report = Core.analyze(parsed.document);
    state.selectedId = state.report.operations[0]?.id || null;
    elements.sourceStatus.className = "source-status ok";
    elements.sourceStatus.textContent = parsed.format + " parsed · " + new TextEncoder().encode(elements.source.value).length + " bytes";
    render();
  } catch (error) {
    state.report = null; state.selectedId = null;
    elements.sourceStatus.className = "source-status error";
    elements.sourceStatus.textContent = error.message;
    renderEmpty();
  }
}

function renderEmpty() {
  elements.title.textContent = "No document"; elements.version.textContent = "-"; elements.spec.textContent = "-";
  elements.operationCount.textContent = "0"; elements.errorCount.textContent = "0"; elements.warningCount.textContent = "0";
  elements.issues.replaceChildren(); elements.issueEmpty.hidden = false; elements.operations.replaceChildren(); elements.operationEmpty.hidden = false;
  elements.detail.innerHTML = '<div class="blank-state"><strong>Select an operation</strong><span>Analyze an OpenAPI document to inspect its endpoints.</span></div>';
  elements.code.textContent = "# Generated request code appears here"; elements.warnings.textContent = "";
}

function render() {
  const { summary } = state.report;
  elements.title.textContent = summary.title; elements.version.textContent = summary.version || "-"; elements.spec.textContent = summary.openapi || "-";
  elements.operationCount.textContent = summary.operationCount; elements.errorCount.textContent = summary.errorCount; elements.warningCount.textContent = summary.warningCount;
  renderIssues(); renderOperations(); renderDetail();
}

function renderIssues() {
  elements.issues.replaceChildren();
  state.report.issues.forEach((item) => {
    const row = document.createElement("li"); row.className = "issue " + item.severity;
    const badge = document.createElement("span"); badge.textContent = item.severity;
    const body = document.createElement("div");
    const message = document.createElement("strong"); message.textContent = item.message;
    const path = document.createElement("code"); path.textContent = item.path;
    body.append(message, path); row.append(badge, body); elements.issues.append(row);
  });
  elements.issueEmpty.hidden = state.report.issues.length !== 0;
}

function filteredOperations() {
  return state.report.operations.filter((operation) => {
    const methodMatch = state.method === "all" || operation.method === state.method;
    const haystack = [operation.method, operation.path, operation.summary, operation.id, ...operation.tags].join(" ").toLowerCase();
    return methodMatch && (!state.query || haystack.includes(state.query));
  });
}

function renderOperations() {
  elements.operations.replaceChildren();
  const visible = filteredOperations();
  visible.forEach((operation) => {
    const button = document.createElement("button"); button.type = "button"; button.className = "operation";
    if (operation.id === state.selectedId) button.classList.add("selected");
    const method = document.createElement("span"); method.className = "method " + operation.method.toLowerCase(); method.textContent = operation.method;
    const body = document.createElement("span"); body.className = "operation-copy";
    const path = document.createElement("strong"); path.textContent = operation.path;
    const summary = document.createElement("small"); summary.textContent = operation.summary;
    body.append(path, summary); button.append(method, body);
    button.addEventListener("click", () => { state.selectedId = operation.id; renderOperations(); renderDetail(); });
    elements.operations.append(button);
  });
  elements.operationEmpty.hidden = visible.length !== 0;
}

function selectedOperation() {
  return state.report?.operations.find((operation) => operation.id === state.selectedId) || null;
}

function createField(label, value) {
  const item = document.createElement("div"); item.className = "field";
  const key = document.createElement("span"); key.textContent = label;
  const output = document.createElement("strong"); output.textContent = value;
  item.append(key, output); return item;
}

function renderDetail() {
  const operation = selectedOperation();
  if (!operation) { renderEmptyDetail(); return; }
  elements.detail.replaceChildren();
  const heading = document.createElement("div"); heading.className = "detail-heading";
  const title = document.createElement("div");
  const eyebrow = document.createElement("span"); eyebrow.className = "eyebrow"; eyebrow.textContent = operation.id;
  const h2 = document.createElement("h2"); h2.textContent = operation.summary;
  const path = document.createElement("code"); path.textContent = operation.method + " " + operation.path;
  title.append(eyebrow, h2, path); heading.append(title); elements.detail.append(heading);
  if (operation.description && operation.description !== operation.summary) { const p = document.createElement("p"); p.className = "description"; p.textContent = operation.description; elements.detail.append(p); }
  const facts = document.createElement("div"); facts.className = "facts";
  facts.append(createField("Server", operation.server), createField("Responses", operation.responses.join(", ") || "None"), createField("Tags", operation.tags.join(", ") || "Untagged"));
  elements.detail.append(facts);
  const section = document.createElement("section"); section.className = "parameter-section";
  const label = document.createElement("h3"); label.textContent = "Parameters"; section.append(label);
  if (!operation.parameters.length) { const empty = document.createElement("p"); empty.className = "muted"; empty.textContent = "No parameters"; section.append(empty); }
  operation.parameters.forEach((parameter) => {
    const row = document.createElement("div"); row.className = "parameter";
    const identity = document.createElement("div");
    const name = document.createElement("strong"); name.textContent = parameter.name;
    const location = document.createElement("span"); location.textContent = parameter.in + (parameter.required ? " · required" : "");
    identity.append(name, location);
    const type = document.createElement("code"); type.textContent = parameter.schema?.type || "any";
    row.append(identity, type); section.append(row);
  });
  elements.detail.append(section);
  if (operation.requestBody) {
    const bodySection = document.createElement("section"); bodySection.className = "body-section";
    const h3 = document.createElement("h3"); h3.textContent = "Request body";
    const media = document.createElement("code"); media.textContent = operation.requestBody.error || operation.requestBody.mediaType;
    const required = document.createElement("span"); required.textContent = operation.requestBody.required ? "required" : "optional";
    bodySection.append(h3, media, required); elements.detail.append(bodySection);
  }
  renderCode();
}

function renderEmptyDetail() {
  elements.detail.innerHTML = '<div class="blank-state"><strong>No operation selected</strong><span>Choose an endpoint from the list.</span></div>';
  elements.code.textContent = "# Generated request code appears here"; elements.warnings.textContent = "";
}

function renderCode() {
  const operation = selectedOperation(); if (!operation) return;
  try {
    const generated = Core.generateCode(state.report.document, operation, state.language);
    elements.code.textContent = generated.code;
    elements.warnings.textContent = generated.warnings.join(" · ");
  } catch (error) { elements.code.textContent = "Generation failed: " + error.message; elements.warnings.textContent = ""; }
}

function readFile(file) {
  if (!file || file.size > 5 * 1024 * 1024) { elements.sourceStatus.className = "source-status error"; elements.sourceStatus.textContent = "Choose a JSON/YAML file up to 5 MB"; return; }
  const reader = new FileReader(); reader.onload = () => { elements.source.value = String(reader.result); analyze(); }; reader.onerror = () => { elements.sourceStatus.textContent = "Could not read file"; }; reader.readAsText(file);
}

elements.analyze.addEventListener("click", analyze);
elements.sample.addEventListener("click", () => { elements.source.value = SAMPLE; analyze(); });
elements.file.addEventListener("change", () => readFile(elements.file.files[0]));
elements.drop.addEventListener("dragover", (event) => { event.preventDefault(); elements.drop.classList.add("dragging"); });
elements.drop.addEventListener("dragleave", () => elements.drop.classList.remove("dragging"));
elements.drop.addEventListener("drop", (event) => { event.preventDefault(); elements.drop.classList.remove("dragging"); readFile(event.dataTransfer.files[0]); });
elements.search.addEventListener("input", () => { state.query = elements.search.value.trim().toLowerCase(); renderOperations(); });
elements.methods.addEventListener("click", (event) => { const button = event.target.closest("button[data-method]"); if (!button) return; state.method = button.dataset.method; elements.methods.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item === button))); renderOperations(); });
elements.tabs.addEventListener("click", (event) => { const button = event.target.closest("button[data-language]"); if (!button) return; state.language = button.dataset.language; elements.tabs.querySelectorAll("button").forEach((item) => item.setAttribute("aria-selected", String(item === button))); renderCode(); });
elements.copy.addEventListener("click", async () => { try { await navigator.clipboard.writeText(elements.code.textContent); elements.copy.textContent = "Copied"; setTimeout(() => { elements.copy.textContent = "Copy"; }, 900); } catch { elements.copy.textContent = "Copy failed"; } });
elements.theme.addEventListener("click", () => { const current = document.documentElement.dataset.theme || "light"; document.documentElement.dataset.theme = current === "light" ? "dark" : "light"; });

elements.source.value = SAMPLE;
analyze();
