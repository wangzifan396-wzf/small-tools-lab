export interface RegexToken {
  raw: string;
  kind:
    | 'anchor'
    | 'wildcard'
    | 'alternation'
    | 'group'
    | 'class'
    | 'quantifier'
    | 'escape'
    | 'backreference'
    | 'literal';
  meaning: string;
}

export interface ExplainResult {
  error?: string;
  tokens?: RegexToken[];
}

export interface RegexMatch {
  index: number;
  end: number;
  value: string;
  groups: string[];
}

export interface FindMatchesResult {
  error?: string;
  matches: RegexMatch[];
  namedGroups: string[];
  capped: boolean;
}

export function explain(pattern: string, flags?: string): ExplainResult;
export function findMatches(text: string, pattern: string, flags?: string): FindMatchesResult;
export function highlight(text: string, pattern: string, flags?: string): string;
export function escapeHtml(s: string): string;
