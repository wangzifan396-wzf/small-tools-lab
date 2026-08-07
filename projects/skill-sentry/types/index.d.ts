export type Severity = 'high' | 'medium' | 'low';
export interface Finding { rule: string; severity: Severity; title: string; file: string; line: number; evidence: string; detail: string; remediation: string; skill?: string; root?: string }
export interface SkillResult { root: string; name: string; files: number; findings: Finding[] }
export interface ScanReport { schemaVersion: 1; scannedAt: string | null; skills: number; files: number; findings: Finding[]; summary: { high: number; medium: number; low: number; total: number }; score: number; grade: string }
export const RULES: Readonly<Record<string, { severity: Severity; title: string; remediation: string }>>;
export function parseFrontmatter(content: string): { data: Record<string, string>; body: string; valid: boolean };
export function extractLocalReferences(content: string): string[];
export function scanContent(file: string, content: string, options?: { ignoreRules?: string[] }): Finding[];
export function analyzeSkillSnapshot(root: string, files: Record<string, string>, options?: { ignoreRules?: string[] }): SkillResult;
export function analyzeSnapshots(skills: SkillResult[]): ScanReport;
export function discoverSkillRoots(inputPath: string, limit?: number): Promise<string[]>;
export function scanPath(inputPath: string, options?: { ignoreRules?: string[]; maxSkills?: number; maxFiles?: number; maxFileBytes?: number; scannedAt?: string }): Promise<ScanReport>;
export function renderReport(report: ScanReport, format?: 'pretty' | 'json' | 'markdown' | 'sarif'): string;
