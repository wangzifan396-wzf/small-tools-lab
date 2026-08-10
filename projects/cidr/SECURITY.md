# Security

CIDR Toolkit runs locally and has no network or telemetry code. IPv4 parsing rejects ambiguous leading-zero octets, IPv6 parsing rejects malformed compression and zone identifiers, and all 128-bit arithmetic uses `BigInt`.

Subnet splitting is capped at 65,536 outputs per call to prevent accidental memory exhaustion. Calculated membership is informational and does not replace firewall, routing, or cloud-provider policy evaluation. Report vulnerabilities through the repository [security policy](../../SECURITY.md).
