# Security

OCI Image Inspector treats every archive and embedded JSON document as untrusted.

- Analysis stays in the browser; there are no uploads, registry requests, analytics, external assets, or runtime dependencies.
- A strict Content Security Policy uses `connect-src 'none'`.
- Layer payloads are never extracted, executed, mounted, decompressed, or copied into JavaScript memory.
- Tar paths with absolute roots, Windows drives, or parent traversal are excluded from metadata lookup.
- OCI descriptor digests are converted to blob paths only after strict algorithm/hex validation.
- Entry counts, tar metadata size, individual JSON metadata size, index nesting and JavaScript-safe offsets are bounded.
- Imported strings are rendered as text rather than HTML.
- Secret-like environment values and history assignments are redacted from the normalized export.

The tool is not a malware scanner or sandbox. Do not extract or run an untrusted image merely because its metadata appears normal. Report vulnerabilities through the repository's private security reporting channel.
