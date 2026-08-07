export type EpochUnit = 'auto' | 's' | 'ms';

export interface EpochResult {
  date: Date;
  unit: Exclude<EpochUnit, 'auto'>;
  milliseconds: number;
  seconds: number;
}

export function inferEpochUnit(value: string | number): 's' | 'ms';
export function epochToDate(value: string | number, unit?: EpochUnit): EpochResult;
export function parseDateTime(value: string | Date): Date;
export function formatLocal(value: string | number | Date): string;
export function formatUtc(value: string | number | Date): string;
export function formatRelative(value: number | Date, now?: number | Date): string;
