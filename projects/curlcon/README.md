# curlcon

A strict, zero-dependency curl command parser and converter for JavaScript Fetch and Python requests. It parses text only and never invokes a shell or executes the command.

[Open the browser tool](https://wangzifan396-wzf.github.io/small-tools-lab/projects/curlcon/) · [Security notes](SECURITY.md)

## Supported surface

- Shell-style single/double quotes, escaped spaces, empty arguments, and line continuations
- Methods, headers, duplicate headers, cookies, Basic auth, user agent, referer, and timeouts
- Raw, JSON, URL-encoded, query-string, and text-only multipart form data
- Redirect and insecure-TLS intent with target-specific warnings
- Short attached values such as `-XPOST` and combined switches such as `-sSL`

curlcon deliberately rejects pipelines, redirects, command substitution, local-file data/header/cookie/config flags, proxies, certificates, keys, and file uploads. Those operations cannot be represented faithfully without reading local state or changing routing.

## Library API

```js
import { convertCurl, parseCurl, toFetch, toPythonRequests, tokenizeCurl } from './src/index.js';

const parsed = parseCurl("curl -H 'Accept: application/json' https://api.example.com");
const { fetch, python, request } = convertCurl('curl -L https://example.com');
```

Generated source quotes all user-controlled values. Shell variables such as `$TOKEN` remain literal and produce a warning; this tool never reads the shell environment. TypeScript declarations are included.

## Develop

```bash
npm test
npm start -- 4173
```
