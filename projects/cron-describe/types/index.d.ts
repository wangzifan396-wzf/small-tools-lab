export interface ParsedCron {
  ok: boolean;
  error?: string;
  fields?: {
    sec: Set<number> | null;
    minute: Set<number>;
    hour: Set<number>;
    dom: Set<number>;
    month: Set<number>;
    dow: Set<number>;
  };
  hasSeconds?: boolean;
  stars?: { minute: boolean; hour: boolean; dom: boolean; month: boolean; dow: boolean };
}

export interface CronDescription {
  zh: string;
  en: string;
}

export function parse(expr: string): ParsedCron;
export function describe(parsed: ParsedCron): CronDescription;
export function nextRuns(expr: string, count?: number, from?: number): { ok: boolean; error?: string; runs?: Date[] };
