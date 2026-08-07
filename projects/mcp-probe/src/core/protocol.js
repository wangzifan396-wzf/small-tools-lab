export const LATEST_PROTOCOL_VERSION = '2026-07-28';

export function encodeMessage(message) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) throw new TypeError('JSON-RPC message must be an object');
  return `${JSON.stringify(message)}\n`;
}

export function decodeJsonLines(buffer, chunk, options = {}) {
  const maxBytes = options.maxBytes || 5 * 1024 * 1024;
  const combined = `${buffer || ''}${Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk || '')}`;
  if (Buffer.byteLength(combined) > maxBytes) throw new RangeError(`MCP response buffer exceeds ${maxBytes} bytes`);
  const lines = combined.split('\n');
  const remainder = lines.pop();
  const messages = [];
  const errors = [];
  for (const raw of lines) {
    const line = raw.replace(/\r$/u, '').trim();
    if (!line) continue;
    try {
      const message = JSON.parse(line);
      if (!message || typeof message !== 'object' || Array.isArray(message)) throw new TypeError('message must be an object');
      messages.push(message);
    } catch (error) {
      errors.push({ message: error instanceof SyntaxError ? 'Invalid JSON-RPC line' : error.message });
    }
  }
  return { buffer: remainder, messages, errors };
}

export class RpcError extends Error {
  constructor(code, message) {
    super(`MCP error ${code}: ${String(message || 'Unknown error').slice(0, 300)}`);
    this.name = 'RpcError';
    this.code = code;
  }
}
