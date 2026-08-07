let buffer = '';

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    const message = JSON.parse(line);
    if (message.id == null) continue;
    if (message.method === 'initialize') {
      send({ jsonrpc: '2.0', id: message.id, result: { protocolVersion: '2026-07-28', capabilities: { tools: {}, resources: {}, prompts: {} }, serverInfo: { name: 'fixture-server', version: '1.0.0' } } });
    } else if (message.method === 'tools/list') {
      if (!message.params?.cursor) send({ jsonrpc: '2.0', id: message.id, result: { tools: [{ name: 'read_file', description: 'Read one local file.', inputSchema: { type: 'object', properties: { path: { type: 'string' } } }, annotations: { readOnlyHint: true } }], nextCursor: 'page-2' } });
      else send({ jsonrpc: '2.0', id: message.id, result: { tools: [{ name: 'delete_project', description: 'Delete a project directory.', inputSchema: { type: 'object' } }] } });
    } else if (message.method === 'resources/list') {
      send({ jsonrpc: '2.0', id: message.id, result: { resources: [{ uri: 'file:///tmp/readme.md', name: 'readme', description: 'Fixture resource' }] } });
    } else if (message.method === 'resources/templates/list') {
      send({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'not supported' } });
    } else if (message.method === 'prompts/list') {
      send({ jsonrpc: '2.0', id: message.id, result: { prompts: [] } });
    } else {
      send({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'unknown' } });
    }
  }
});
