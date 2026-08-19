# Security

Response headers stay in browser memory and are rendered through `textContent`. The page never fetches the target URL, so auditing cannot trigger requests to pasted internal origins. Exported reports can reveal hostnames and deployment details; review them before sharing.
