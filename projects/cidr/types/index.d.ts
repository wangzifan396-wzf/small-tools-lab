export interface ParsedAddress { version: 4 | 6; bytes: Uint8Array; normalized: string; value: bigint }
export interface ParsedCidr { input: string; version: 4 | 6; address: ParsedAddress; prefix: number; bits: 32 | 128; mask: bigint; network: bigint; last: bigint }
export interface CidrInfo { version: 4 | 6; prefix: number; address: string; cidr: string; network: string; netmask: string; wildcard: string | null; broadcast: string | null; firstHost: string; lastHost: string; lastAddress: string; totalAddresses: bigint; usableAddresses: bigint }
export function parseAddress(input: string): ParsedAddress;
export function formatAddress(value: Pick<ParsedAddress, 'version' | 'bytes'>): string;
export function isValidAddress(value: unknown): value is string;
export function parseCidr(input: string): ParsedCidr;
export function calculateCidr(input: string | ParsedCidr): CidrInfo;
export function contains(container: string, candidate: string): boolean;
export function overlaps(left: string, right: string): boolean;
export function splitCidr(input: string, newPrefix: number): string[];
export { calculateCidr as calc, parseCidr as parse, isValidAddress as isValidIp };
