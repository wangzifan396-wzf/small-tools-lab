(function attachSchemaScout(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SchemaScout = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createSchemaScout() {
  "use strict";

  function valueType(value) {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    if (Number.isInteger(value)) return "integer";
    return typeof value === "number" ? "number" : typeof value;
  }

  function formatExample(value) {
    let output;
    if (typeof value === "string") output = JSON.stringify(value);
    else if (Array.isArray(value)) output = `[${value.length} items]`;
    else if (value && typeof value === "object") output = `{${Object.keys(value).length} fields}`;
    else output = String(value);
    return output.length > 62 ? `${output.slice(0, 59)}...` : output;
  }

  function analyze(data) {
    const records = Array.isArray(data) ? data : [data];
    const paths = new Map();
    let maxDepth = 0;
    let nulls = 0;
    let nodes = 0;

    function visit(value, path, depth, seen) {
      nodes += 1;
      maxDepth = Math.max(maxDepth, depth);
      if (value === null) nulls += 1;
      if (path) {
        if (!paths.has(path)) paths.set(path, { path, types: new Set(), present: 0, examples: [] });
        const field = paths.get(path);
        field.types.add(valueType(value));
        if (!seen.has(path)) {
          field.present += 1;
          seen.add(path);
        }
        const example = formatExample(value);
        if (field.examples.length < 3 && !field.examples.includes(example)) field.examples.push(example);
      }
      if (depth >= 32) return;
      if (Array.isArray(value)) {
        for (const item of value) visit(item, path ? `${path}[]` : "[]", depth + 1, seen);
      } else if (value && typeof value === "object") {
        for (const [key, child] of Object.entries(value)) {
          visit(child, path ? `${path}.${key}` : key, depth + 1, seen);
        }
      }
    }

    records.forEach((record) => visit(record, "", 0, new Set()));
    return {
      records: records.length,
      fields: Array.from(paths.values()).map((field) => ({
        path: field.path,
        types: Array.from(field.types).sort(),
        present: field.present,
        coverage: records.length ? field.present / records.length : 0,
        examples: field.examples
      })),
      maxDepth,
      nulls,
      nodes
    };
  }

  function mergePrimitiveTypes(values) {
    const types = new Set(values.map(valueType));
    if (types.has("number") && types.has("integer")) types.delete("integer");
    return Array.from(types);
  }

  function schemaFromValues(values) {
    if (!values.length) return {};
    const types = mergePrimitiveTypes(values);
    if (types.length > 1) {
      const schemas = [];
      for (const type of types) {
        const matching = values.filter((value) => valueType(value) === type || (type === "number" && valueType(value) === "integer"));
        schemas.push(schemaFromValues(matching));
      }
      return { anyOf: schemas };
    }

    const type = types[0];
    if (type === "object") {
      const objects = values.filter((value) => value && typeof value === "object" && !Array.isArray(value));
      const keys = Array.from(new Set(objects.flatMap((value) => Object.keys(value)))).sort();
      const properties = {};
      const required = [];
      for (const key of keys) {
        const present = objects.filter((value) => Object.hasOwn(value, key));
        properties[key] = schemaFromValues(present.map((value) => value[key]));
        if (present.length === objects.length) required.push(key);
      }
      const schema = { type: "object", properties };
      if (required.length) schema.required = required;
      return schema;
    }
    if (type === "array") {
      const items = values.flatMap((value) => value);
      return { type: "array", items: schemaFromValues(items) };
    }
    return { type };
  }

  function toJsonSchema(data, title) {
    return {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: title || "Dataset",
      ...schemaFromValues([data])
    };
  }

  function pascalCase(value) {
    const output = String(value || "Value")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join("");
    return output && /^\d/.test(output) ? `Value${output}` : output || "Value";
  }

  function toTypeScript(data, rootName) {
    const definitions = new Map();
    const root = pascalCase(rootName || "Dataset");

    function typeForValues(values, name) {
      if (!values.length) return "unknown";
      const types = mergePrimitiveTypes(values);
      if (types.length > 1) {
        return types.map((type) => typeForValues(values.filter((value) => valueType(value) === type), name)).join(" | ");
      }
      const type = types[0];
      if (type === "null") return "null";
      if (type === "integer" || type === "number") return "number";
      if (type === "boolean" || type === "string") return type;
      if (type === "array") {
        const items = values.flatMap((value) => value);
        const itemType = typeForValues(items, name.endsWith("Item") ? name : `${name}Item`);
        return `Array<${itemType}>`;
      }
      if (type === "object") {
        const objects = values.filter((value) => value && typeof value === "object" && !Array.isArray(value));
        const interfaceName = pascalCase(name);
        const keys = Array.from(new Set(objects.flatMap((value) => Object.keys(value)))).sort();
        const lines = keys.map((key) => {
          const present = objects.filter((value) => Object.hasOwn(value, key));
          const optional = present.length === objects.length ? "" : "?";
          const safeKey = /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
          const childName = `${interfaceName}${pascalCase(key)}`;
          return `  ${safeKey}${optional}: ${typeForValues(present.map((value) => value[key]), childName)};`;
        });
        definitions.set(interfaceName, `export interface ${interfaceName} {\n${lines.join("\n")}\n}`);
        return interfaceName;
      }
      return "unknown";
    }

    const rootType = typeForValues([data], root);
    const blocks = Array.from(definitions.values()).reverse();
    if (rootType !== root || Array.isArray(data)) blocks.push(`export type ${root} = ${rootType};`);
    return blocks.join("\n\n");
  }

  function toCatalogCsv(report) {
    const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [["path", "types", "coverage", "examples"]];
    for (const field of report.fields) {
      rows.push([field.path, field.types.join(" | "), `${(field.coverage * 100).toFixed(1)}%`, field.examples.join(" | ")]);
    }
    return rows.map((row) => row.map(quote).join(",")).join("\n");
  }

  return { analyze, pascalCase, schemaFromValues, toCatalogCsv, toJsonSchema, toTypeScript, valueType };
});
