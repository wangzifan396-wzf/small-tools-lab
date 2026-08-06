export interface DecodedSegment {
  ok: boolean;
  value: any | null;
  raw: string;
}

export type JwtStatus = "valid" | "expired" | "not-yet" | "no-exp";

export interface JwtTiming {
  exp: number | null;
  expAt: string | null;
  iat: number | null;
  iatAt: string | null;
  nbf: number | null;
  nbfAt: string | null;
  status: JwtStatus;
  msUntilExp: number | null;
  notYet: boolean;
  hasExpiry: boolean;
}

export interface JwtParseResult {
  valid: boolean;
  error: string | null;
  header: any | null;
  headerParsed: boolean;
  payload: any | null;
  payloadParsed: boolean;
  signature: string;
  hasSignature: boolean;
  claimCount: number;
  timing: JwtTiming | null;
}

export function b64urlDecode(segment: string): string;
export function decodeSegment(segment: string): DecodedSegment;
export function parse(token: string, now?: number): JwtParseResult;
export function summarize(token: string, now?: number): { code: number; out: string };
