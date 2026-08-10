# CIDR Toolkit

A strict, zero-dependency IPv4 and IPv6 CIDR library for parsing, subnet calculation, containment, overlap detection, and bounded subnet splitting.

[Open the browser tool](https://wangzifan396-wzf.github.io/small-tools-lab/projects/cidr/) · [Security notes](SECURITY.md)

## Highlights

- Strict IPv4 decimal parsing, including rejection of ambiguous leading-zero octets
- Compressed IPv6, embedded IPv4 tails, and RFC 5952-style canonical output
- Exact 128-bit network arithmetic and address counts with `BigInt`
- Correct IPv4 `/31` point-to-point and `/32` host-route behavior
- IPv6-aware containment and overlap checks
- Deterministic subnet splitting capped at 65,536 results per call

## Library API

```js
import { calculateCidr, contains, overlaps, parseAddress, splitCidr } from './src/index.js';

calculateCidr('2001:db8:abcd:12::1/64');
contains('10.0.0.0/8', '10.20.30.40');
overlaps('192.168.1.0/24', '192.168.1.128/25');
splitCidr('192.168.0.0/24', 26);
parseAddress('::ffff:192.0.2.1');
```

TypeScript declarations and the compatibility aliases `calc`, `parse`, and `isValidIp` are included. IPv6 zone identifiers are intentionally rejected because they are interface-scoped rather than part of a portable CIDR.

## Develop

```bash
npm test
npm start -- 4173
```
