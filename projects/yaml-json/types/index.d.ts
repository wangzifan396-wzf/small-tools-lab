export type YamlValue = null | boolean | number | string | YamlValue[] | { [key: string]: YamlValue };
export function parseScalar(source: string): YamlValue;
export function parseYaml(source: string): YamlValue;
export function stringifyScalar(value: null | boolean | number | string): string;
export function stringifyYaml(value: YamlValue): string;
