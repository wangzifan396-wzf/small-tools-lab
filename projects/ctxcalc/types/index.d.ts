export interface ModelInfo {
  id: string;
  label: string;
  icon: string;
  provider: string;
  ctx: number;
  inPer1k: number;
  outPer1k: number;
}

export interface Analysis {
  chars: number;
  cjk: number;
  words: number;
  other: number;
  tokens: number;
}

export interface FitInfo {
  ctx: number;
  ratio: number;
  pct: number;
  fits: boolean;
  remaining: number;
  fitCopies: number;
}

export interface CostInfo {
  inTokens: number;
  outTokens: number;
  costIn: number;
  costOut: number;
  cost: number;
}

export interface Preview extends Analysis, FitInfo, CostInfo {
  model: { id: string; label: string; icon: string; provider: string; ctx: number };
}

export const MODELS: ModelInfo[];
export function modelById(id: string): ModelInfo | null;
export function analyze(text: string): Analysis;
export function estimateTokens(text: string): number;
export function fitContext(tokens: number, ctx: number): FitInfo;
export function estimateCost(inTokens: number, outTokens: number, model: ModelInfo): CostInfo;
export function preview(text: string, modelId: string, outTokens?: number): Preview;
