export interface CurlHeader { name: string; value: string }
export interface CurlData { mode: 'raw' | 'urlencode'; value: string; name?: string }
export interface CurlFormField { name: string; value: string }
export interface CurlAuth { username: string; password: string }
export interface ParsedCurl { method: string; methodExplicit: boolean; url: string; headers: CurlHeader[]; data: CurlData[]; form: CurlFormField[]; auth: CurlAuth | null; cookie: string | null; follow: boolean; insecure: boolean; getMode: boolean; timeoutSeconds: number | null; warnings: string[] }
export interface CurlConversion { request: ParsedCurl; fetch: string; python: string }
export function tokenizeCurl(input: string): string[];
export function parseCurl(input: string): ParsedCurl;
export function toFetch(request: ParsedCurl): string;
export function toPythonRequests(request: ParsedCurl): string;
export function convertCurl(input: string): CurlConversion;
