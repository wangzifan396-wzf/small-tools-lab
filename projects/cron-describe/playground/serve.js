#!/usr/bin/env node
/**
 * Tiny static file server for the quanty playground.
 *
 * No dependencies. Serves the playground directory and the library source so
 * the browser can `import` quanty as native ESM.
 *
 *   node playground/serve.js [port]
 *
 * @module playground/serve
 */

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 4173);

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error('port must be an integer between 1 and 65535');
  process.exit(2);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/' || pathname === '/index.html') pathname = '/index.html';

    const target = resolve(ROOT, `.${pathname}`);
    const targetRelative = relative(ROOT, target);
    if (targetRelative.startsWith('..') || isAbsolute(targetRelative)) {
      res.writeHead(403).end('forbidden');
      return;
    }

    let info;
    try {
      info = await stat(target);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
      return;
    }
    const file = info.isDirectory() ? join(target, 'index.html') : target;
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain' }).end(String(err));
  }
});

server.listen(PORT, () => {
  console.log(`cron-describe playground -> http://localhost:${PORT}/`);
  console.log('press Ctrl+C to stop');
});
