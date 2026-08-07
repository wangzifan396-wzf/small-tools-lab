# Port Origin

Read-only, cross-platform runtime provenance for ports and processes. Port Origin answers three questions quickly: who owns this port, what command launched it, and which parent processes led to it?

## Usage

```sh
port-origin 3000
port-origin 5432 --format json
port-origin --pid 12345 --format markdown
port-origin 8080 --fail-if-free
```

From this repository:

```sh
node bin/port-origin.js 3000
```

## How it works

- Windows: reads `netstat -ano -p tcp` and `Win32_Process` through a fixed, non-interactive PowerShell command.
- Linux / macOS: reads `ps` plus `lsof`; Linux falls back to `ss` when `lsof` is unavailable.
- Builds a bounded parent-process chain, detects cycles, and labels common JavaScript, Python, JVM, and container runtimes.
- Masks secret-looking command flags, URL credentials, and sensitive query parameters before rendering.

The tool never kills a process, closes a port, changes a service, or contacts the network. Some operating systems hide command lines or owners without elevated privileges; missing metadata is reported as unknown.

## Library

```js
import { inspectPort, renderReport } from './src/index.js';

const report = await inspectPort(3000);
console.log(renderReport(report, 'json'));
```

Node.js 20+, zero runtime dependencies, MIT licensed. Run `npm test` for the parser and graph suite.
