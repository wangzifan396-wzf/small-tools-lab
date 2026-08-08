export interface SemVer { major: string; minor: string; patch: string; prerelease: string[]; build: string[] }
export interface SortOptions { descending?: boolean }
export function parseVersion(value: string): SemVer;
export function isValidVersion(value: unknown): value is string;
export function formatVersion(version: string | SemVer): string;
export function compareVersions(left: string | SemVer, right: string | SemVer): -1 | 0 | 1;
export function sortVersions<T extends string | SemVer>(versions: T[], options?: SortOptions): T[];
export function satisfies(version: string | SemVer, range: string): boolean;
