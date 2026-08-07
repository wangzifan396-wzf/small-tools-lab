export interface ParseError { source: string; line: number; message: string }
export interface ParsedRecord { record: Record<string, unknown>; source: string; line: number }
export interface TokenTotals { input: number; output: number; cacheRead: number; cacheWrite: number; total: number }
export interface ToolStats { name: string; calls: number; results: number; errors: number; averageLatencyMs: number | null; p95LatencyMs: number | null }
export interface AgentTraceReport {
  schemaVersion: 1; sources: number; records: number; events: number; messages: number; turns: number; durationMs: number;
  tokens: TokenTotals; tools: ToolStats[]; repeatedReads: Array<{ tool: string; target: string; count: number }>;
  repeatedReadWaste: number; errorLoops: Array<{ tool: string; target: string; count: number }>; malformed: ParseError[];
}
export function parseJsonl(text: string, source?: string): { records: ParsedRecord[]; errors: ParseError[] };
export function normalizeRecord(entry: ParsedRecord | Record<string, unknown>, index?: number): Array<Record<string, unknown>>;
export function analyzeRecords(records: ParsedRecord[], options?: { errors?: ParseError[] }): AgentTraceReport;
export function analyzeJsonl(text: string, source?: string): AgentTraceReport;
export function renderPretty(report: AgentTraceReport): string;
export function renderMarkdown(report: AgentTraceReport): string;
export function renderReport(report: AgentTraceReport, format?: 'pretty' | 'json' | 'markdown'): string;
