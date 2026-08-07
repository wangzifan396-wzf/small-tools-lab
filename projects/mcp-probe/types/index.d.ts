export type Severity = 'high' | 'medium' | 'low';
export interface ProbeFinding { rule: string; severity: Severity; title: string; kind: string; name: string; detail: string }
export interface ProbeReport {
  schemaVersion: 1; transport: 'stdio'; command: string; requestedProtocolVersion: string; protocolVersion: string | null;
  server: { name: string; version: string }; capabilities: string[];
  listings: { tools: { supported: boolean; count: number; pages: number }; resources: { supported: boolean; count: number; templates: number; pages: number }; prompts: { supported: boolean; count: number; pages: number } };
  latencies: Record<string, number>; stderrBytes: number; protocolErrors: Array<{ message: string }>;
  tools: unknown[]; resources: unknown[]; prompts: unknown[]; findings: ProbeFinding[];
  summary: { high: number; medium: number; low: number; total: number }; score: number; grade: string;
}
export const LATEST_PROTOCOL_VERSION: string;
export function encodeMessage(message: Record<string, unknown>): string;
export function decodeJsonLines(buffer: string, chunk: string | Uint8Array, options?: { maxBytes?: number }): { buffer: string; messages: Record<string, unknown>[]; errors: Array<{ message: string }> };
export function analyzeManifest(input: { tools?: unknown[]; resources?: unknown[]; prompts?: unknown[] }): Pick<ProbeReport, 'tools' | 'resources' | 'prompts' | 'findings' | 'summary' | 'score' | 'grade'>;
export function probeStdio(command: string, args?: string[], options?: { timeoutMs?: number; protocolVersion?: string; cleanEnv?: boolean; env?: Record<string, string | undefined>; maxBytes?: number }): Promise<ProbeReport>;
export function renderReport(report: ProbeReport, format?: 'pretty' | 'json' | 'markdown' | 'sarif'): string;
