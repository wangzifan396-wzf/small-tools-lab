#!/usr/bin/env node
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 4173);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) { console.error('port must be an integer between 1 and 65535'); process.exit(2); }
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
const headers = (type) => ({ 'content-type': type, 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'content-security-policy': "default-src 'self'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'self' data:" });
const server = http.createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { allow: 'GET, HEAD' }).end('method not allowed'); return; }
  try {
    const url = new URL(request.url, `http://localhost:${PORT}`);
    const pathname = decodeURIComponent(url.pathname || '/');
    const target = resolve(ROOT, `.${pathname === '/' ? '/index.html' : pathname}`);
    const child = relative(ROOT, target);
    if (child.startsWith('..') || isAbsolute(child)) { response.writeHead(403, headers('text/plain; charset=utf-8')).end('forbidden'); return; }
    const info = await stat(target);
    const file = info.isDirectory() ? join(target, 'index.html') : target;
    const body = await readFile(file);
    response.writeHead(200, headers(TYPES[extname(file).toLowerCase()] || 'application/octet-stream'));
    response.end(request.method === 'GET' ? body : undefined);
  } catch (error) {
    const status = error instanceof URIError ? 400 : error?.code === 'ENOENT' ? 404 : 500;
    response.writeHead(status, headers('text/plain; charset=utf-8')).end(status === 400 ? 'bad request' : status === 404 ? 'not found' : 'server error');
  }
});
server.listen(PORT, () => console.log(`yaml-json playground -> http://localhost:${PORT}/`));
