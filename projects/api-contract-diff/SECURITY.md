# Security

API documents stay in browser memory and are rendered through `textContent`. The static page has no runtime dependencies, external requests, analytics, or uploads. Treat exported reports as potentially sensitive because they reproduce endpoint names and schema metadata.
