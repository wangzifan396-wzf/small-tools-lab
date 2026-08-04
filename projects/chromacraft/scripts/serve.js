"use strict";

const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");

const root = path.resolve(__dirname, "..");
const requestedPort = Number(process.argv.find((value) => /^\d+$/.test(value))) || 4173;
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

const server = http.createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch (_error) {
    response.writeHead(400).end("Bad request");
    return;
  }

  const target = path.resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
  if (target !== root && !target.startsWith(root + path.sep)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  fs.readFile(target, (error, content) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(error.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": mimeTypes[path.extname(target).toLowerCase()] || "application/octet-stream"
    });
    response.end(content);
  });
});

server.listen(requestedPort, "127.0.0.1", () => {
  console.log(`ChromaCraft running at http://127.0.0.1:${requestedPort}`);
});
