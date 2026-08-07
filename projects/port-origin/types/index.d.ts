export interface Endpoint { address: string; port: number }
export interface Connection { protocol: string | null; local: Endpoint | null; remote: Endpoint | null; state: string | null; pid: number; command?: string | null }
export interface ProcessInfo { pid: number; ppid: number | null; user?: string | null; elapsed?: string | null; name: string | null; executable?: string | null; command: string }
export interface Owner { connection: Connection; process: ProcessInfo; ancestry: ProcessInfo[]; hints: string[] }
export interface OriginReport { schemaVersion: 1; platform: string; targetType: 'port' | 'pid'; target: number; status: 'found' | 'free' | 'missing'; owners: Owner[] }
export function parseWindowsNetstat(text: string): Connection[];
export function parseLsofFields(text: string): Connection[];
export function parseSs(text: string): Connection[];
export function parseWindowsProcesses(text: string): ProcessInfo[];
export function parsePosixProcesses(text: string): ProcessInfo[];
export function redactCommand(value: string): string;
export function buildAncestry(pid: number, processes: ProcessInfo[], maxDepth?: number): ProcessInfo[];
export function inspectSnapshot(input: { targetType?: 'port' | 'pid'; target: number; connections?: Connection[]; processes?: ProcessInfo[]; platform?: string }): OriginReport;
export function inspectPort(port: number | string, options?: { snapshot?: { platform: string; connections: Connection[]; processes: ProcessInfo[] } }): Promise<OriginReport>;
export function inspectPid(pid: number | string, options?: { snapshot?: { platform: string; connections: Connection[]; processes: ProcessInfo[] } }): Promise<OriginReport>;
export function renderReport(report: OriginReport, format?: 'pretty' | 'json' | 'markdown'): string;
