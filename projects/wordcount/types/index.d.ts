export interface TextCounts {
  characters: number;
  charactersNoWhitespace: number;
  hanCharacters: number;
  latinWords: number;
  lines: number;
  paragraphs: number;
  sentences: number;
  readingSeconds: number;
  readingLabel: string;
}

export function countText(text: string): TextCounts;
export function formatReadingTime(seconds: number): string;
