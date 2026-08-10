function parseIpv4(source) {
  const parts = source.split('.');
  if (parts.length !== 4) throw new TypeError('IPv4 addresses must contain four decimal octets');
  const bytes = parts.map((part) => {
    if (!/^(?:0|[1-9]\d{0,2})$/u.test(part)) throw new TypeError(`Invalid IPv4 octet: ${part || '(empty)'}`);
    const value = Number(part);
    if (value > 255) throw new RangeError(`IPv4 octet is outside 0..255: ${part}`);
    return value;
  });
  return Uint8Array.from(bytes);
}

function ipv4TailToHextets(source) {
  const lastColon = source.lastIndexOf(':');
  const tail = source.slice(lastColon + 1);
  const bytes = parseIpv4(tail);
  const replacement = `${((bytes[0] << 8) | bytes[1]).toString(16)}:${((bytes[2] << 8) | bytes[3]).toString(16)}`;
  return `${source.slice(0, lastColon + 1)}${replacement}`;
}

function parseHextets(section) {
  if (!section) return [];
  const groups = section.split(':');
  if (groups.some((group) => !/^[0-9A-Fa-f]{1,4}$/u.test(group))) throw new TypeError('IPv6 hextets must contain one to four hexadecimal digits');
  return groups.map((group) => Number.parseInt(group, 16));
}

function parseIpv6(input) {
  let source = input;
  if (source.includes('%')) throw new TypeError('IPv6 zone identifiers are not supported in CIDR values');
  if (source.includes('.')) source = ipv4TailToHextets(source);
  const sections = source.split('::');
  if (sections.length > 2) throw new TypeError('IPv6 addresses can contain at most one :: compression marker');
  let groups;
  if (sections.length === 2) {
    const left = parseHextets(sections[0]);
    const right = parseHextets(sections[1]);
    const missing = 8 - left.length - right.length;
    if (missing < 1) throw new TypeError('IPv6 :: must compress at least one zero hextet');
    groups = [...left, ...Array(missing).fill(0), ...right];
  } else {
    groups = parseHextets(source);
    if (groups.length !== 8) throw new TypeError('IPv6 addresses without :: must contain eight hextets');
  }
  const bytes = new Uint8Array(16);
  groups.forEach((group, index) => { bytes[index * 2] = group >>> 8; bytes[index * 2 + 1] = group & 0xff; });
  return bytes;
}

function bytesToBigInt(bytes) {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

function bigIntToBytes(value, length) {
  const bytes = new Uint8Array(length);
  let remaining = value;
  for (let index = length - 1; index >= 0; index -= 1) { bytes[index] = Number(remaining & 0xffn); remaining >>= 8n; }
  return bytes;
}

function formatIpv4(bytes) { return [...bytes].join('.'); }

function formatIpv6(bytes) {
  const groups = Array.from({ length: 8 }, (_, index) => ((bytes[index * 2] << 8) | bytes[index * 2 + 1]).toString(16));
  let bestStart = -1;
  let bestLength = 0;
  for (let index = 0; index < groups.length;) {
    if (groups[index] !== '0') { index += 1; continue; }
    let end = index;
    while (end < groups.length && groups[end] === '0') end += 1;
    if (end - index > bestLength && end - index >= 2) { bestStart = index; bestLength = end - index; }
    index = end;
  }
  if (bestStart < 0) return groups.join(':');
  const left = groups.slice(0, bestStart).join(':');
  const right = groups.slice(bestStart + bestLength).join(':');
  return `${left}::${right}`;
}

export function formatAddress(value) {
  if (!value || ![4, 6].includes(value.version) || !(value.bytes instanceof Uint8Array)) throw new TypeError('Expected a parsed IP address');
  if (value.bytes.length !== (value.version === 4 ? 4 : 16)) throw new TypeError('IP byte length does not match its version');
  return value.version === 4 ? formatIpv4(value.bytes) : formatIpv6(value.bytes);
}

export function parseAddress(input) {
  if (typeof input !== 'string') throw new TypeError('IP address must be a string');
  const source = input.trim();
  if (!source || source !== input) throw new TypeError('IP address cannot be empty or surrounded by whitespace');
  const version = source.includes(':') ? 6 : 4;
  const bytes = version === 4 ? parseIpv4(source) : parseIpv6(source);
  const result = { version, bytes };
  return { ...result, normalized: formatAddress(result), value: bytesToBigInt(bytes) };
}

export function isValidAddress(value) {
  try { parseAddress(value); return true; }
  catch { return false; }
}

export function parseCidr(input) {
  if (typeof input !== 'string') throw new TypeError('CIDR must be a string');
  const slash = input.lastIndexOf('/');
  if (slash <= 0 || slash === input.length - 1) throw new TypeError('CIDR must use address/prefix syntax');
  const address = parseAddress(input.slice(0, slash));
  const prefixSource = input.slice(slash + 1);
  if (!/^(?:0|[1-9]\d{0,2})$/u.test(prefixSource)) throw new TypeError('CIDR prefix must be an unsigned decimal integer');
  const prefix = Number(prefixSource);
  const bits = address.version === 4 ? 32 : 128;
  if (prefix > bits) throw new RangeError(`IPv${address.version} prefixes must be between 0 and ${bits}`);
  const hostBits = bits - prefix;
  const all = (1n << BigInt(bits)) - 1n;
  const mask = prefix === 0 ? 0n : (all << BigInt(hostBits)) & all;
  const network = address.value & mask;
  const last = network | (all ^ mask);
  return { input, version: address.version, address, prefix, bits, mask, network, last };
}

function addressFromValue(value, version) {
  return formatAddress({ version, bytes: bigIntToBytes(value, version === 4 ? 4 : 16) });
}

export function calculateCidr(input) {
  const parsed = typeof input === 'string' ? parseCidr(input) : input;
  if (!parsed || ![4, 6].includes(parsed.version)) throw new TypeError('Expected a CIDR string or parsed CIDR');
  const totalAddresses = 1n << BigInt(parsed.bits - parsed.prefix);
  const ipv4Traditional = parsed.version === 4 && parsed.prefix <= 30;
  const first = ipv4Traditional ? parsed.network + 1n : parsed.network;
  const lastHost = ipv4Traditional ? parsed.last - 1n : parsed.last;
  const usableAddresses = ipv4Traditional ? totalAddresses - 2n : totalAddresses;
  const normalizedNetwork = addressFromValue(parsed.network, parsed.version);
  return {
    version: parsed.version,
    prefix: parsed.prefix,
    address: parsed.address.normalized,
    cidr: `${normalizedNetwork}/${parsed.prefix}`,
    network: normalizedNetwork,
    netmask: addressFromValue(parsed.mask, parsed.version),
    wildcard: parsed.version === 4 ? addressFromValue(((1n << 32n) - 1n) ^ parsed.mask, 4) : null,
    broadcast: parsed.version === 4 ? addressFromValue(parsed.last, 4) : null,
    firstHost: addressFromValue(first, parsed.version),
    lastHost: addressFromValue(lastHost, parsed.version),
    lastAddress: addressFromValue(parsed.last, parsed.version),
    totalAddresses,
    usableAddresses,
  };
}

export function contains(container, candidate) {
  const outer = parseCidr(container);
  if (typeof candidate !== 'string') throw new TypeError('Candidate address or CIDR must be a string');
  if (candidate.includes('/')) {
    const inner = parseCidr(candidate);
    return inner.version === outer.version && inner.prefix >= outer.prefix && inner.network >= outer.network && inner.last <= outer.last;
  }
  const address = parseAddress(candidate);
  return address.version === outer.version && address.value >= outer.network && address.value <= outer.last;
}

export function overlaps(left, right) {
  const a = parseCidr(left);
  const b = parseCidr(right);
  return a.version === b.version && a.network <= b.last && b.network <= a.last;
}

export function splitCidr(input, newPrefix) {
  const source = parseCidr(input);
  if (!Number.isInteger(newPrefix) || newPrefix < source.prefix || newPrefix > source.bits) {
    throw new RangeError(`New prefix must be an integer between ${source.prefix} and ${source.bits}`);
  }
  const difference = newPrefix - source.prefix;
  if (difference > 16) throw new RangeError('Refusing to create more than 65536 subnets at once');
  const count = 2 ** difference;
  const size = 1n << BigInt(source.bits - newPrefix);
  return Array.from({ length: count }, (_, index) => `${addressFromValue(source.network + BigInt(index) * size, source.version)}/${newPrefix}`);
}
