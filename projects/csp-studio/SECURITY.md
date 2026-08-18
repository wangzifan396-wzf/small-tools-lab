# Security

Policies and simulated URLs stay in the browser. The page has no runtime dependencies, network requests, analytics, or external assets and enforces a strict CSP itself. Imported strings are rendered only as text. Never deploy a generated nonce placeholder verbatim; generate a cryptographically random value for every HTTP response.
