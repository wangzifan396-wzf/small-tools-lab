const HAN_PATTERN = /\p{Script=Han}/gu;
const LATIN_WORD_PATTERN = /(?:\p{Script=Latin}|\p{Number})[\p{Script=Latin}\p{Mark}\p{Number}]*(?:['’-][\p{Script=Latin}\p{Mark}\p{Number}]+)*/gu;

export function formatReadingTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new RangeError('Reading time must be a non-negative finite number');
  }
  if (seconds < 60) return `${Math.round(seconds)} 秒`;
  if (seconds < 3600) {
    const minutes = seconds / 60;
    return `${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)} 分钟`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return minutes === 0 ? `${hours} 小时` : `${hours} 小时 ${minutes} 分钟`;
}

export function countText(text) {
  if (typeof text !== 'string') throw new TypeError('Text must be a string');

  const trimmed = text.trim();
  const characters = [...text].length;
  const charactersNoWhitespace = [...text.replace(/\s/gu, '')].length;
  const hanCharacters = (text.match(HAN_PATTERN) || []).length;
  const latinWords = (text.match(LATIN_WORD_PATTERN) || []).length;
  const lines = text === '' ? 0 : text.split(/\r\n|\r|\n/u).length;
  const paragraphs = trimmed === '' ? 0 : trimmed.split(/(?:\r\n|\r|\n)[ \t]*(?:\r\n|\r|\n)+/u).length;
  const sentences = trimmed === '' ? 0 : text.split(/[.!?。！？]+/u).filter((part) => /\S/u.test(part)).length;
  const readingSeconds = Math.ceil((hanCharacters / 300 + latinWords / 200) * 60);

  return {
    characters,
    charactersNoWhitespace,
    hanCharacters,
    latinWords,
    lines,
    paragraphs,
    sentences,
    readingSeconds,
    readingLabel: formatReadingTime(readingSeconds),
  };
}
