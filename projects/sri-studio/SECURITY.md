# Security

HTML, URLs, integrity strings, and pasted resource content stay in browser memory. The interface renders findings with `textContent` and has no external scripts, uploads, telemetry, or network requests. Do not export a report containing proprietary resource contents; generated reports include URLs and hashes, not the pasted bytes.
