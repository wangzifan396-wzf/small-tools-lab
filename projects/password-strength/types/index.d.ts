export interface PasswordFlags {
  tooShort: boolean;
  hasLower: boolean;
  hasUpper: boolean;
  hasDigit: boolean;
  hasSymbol: boolean;
  hasSequential: boolean;
  hasRepeats: boolean;
  hasCommonPattern: boolean;
  allSameClass: boolean;
}

export interface AnalyzeResult {
  score: 0 | 1 | 2 | 3 | 4;
  entropyBits: number;
  crackEstimate: string;
  timeToCrack: string;
  length: number;
  flags: PasswordFlags;
  suggestions: string[];
}

export function analyze(password?: string): AnalyzeResult;
