// Pure, zero-dependency password strength analyzer. Works in Node (ESM) and the
// browser. Entropy is estimated from character-class pool sizes; crack time is
// a rough offline estimate at 1e10 guesses/sec.

const COMMON = [
  'password', '123456', '12345678', '123456789', 'qwerty', 'abc123',
  'letmein', 'welcome', 'admin', 'iloveyou', 'monkey', 'dragon',
  'sunshine', 'princess', 'football', 'baseball', 'master', 'hello',
  'free', 'shadow', 'superman', 'batman', 'trustno1', 'whatever',
  'azerty', '111111', '000000', 'passw0rd', 'p@ssword', 'charlie',
  'donald', 'access', 'login', 'secret',
];

const ATTACK_RATE = 1e10; // guesses / second (offline)

function detectSequential(pw) {
  const s = pw.toLowerCase();
  if (s.length < 3) return false;
  // repeated run of 3+
  for (let i = 0; i + 2 < s.length; i++) {
    if (s[i] === s[i + 1] && s[i] === s[i + 2]) return true;
  }
  // ascending / descending consecutive (letters or digits)
  for (let i = 0; i + 2 < s.length; i++) {
    const a = s.charCodeAt(i), b = s.charCodeAt(i + 1), c = s.charCodeAt(i + 2);
    if (b === a + 1 && c === b + 1) return true;
    if (b === a - 1 && c === b - 1) return true;
  }
  return false;
}

function detectCommon(pw) {
  const s = pw.toLowerCase();
  if (COMMON.includes(s)) return true;
  const reversed = [...s].reverse().join('');
  if (COMMON.includes(reversed)) return true;
  return false;
}

function estimateCrack(bits) {
  const avgGuesses = Math.pow(2, bits) / 2;
  const secs = avgGuesses / ATTACK_RATE;
  if (secs < 1) return '~instant';
  if (secs < 60) return '~seconds';
  if (secs < 3600) return '~minutes';
  if (secs < 86400) return '~hours';
  if (secs < 86400 * 365) return '~days';
  if (secs < 86400 * 365 * 100) return '~years';
  return '~centuries';
}

export function analyze(password = '') {
  const length = password.length;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const hasSequential = detectSequential(password);
  const hasRepeats = /(.)\1\1/.test(password);
  const hasCommonPattern = detectCommon(password);
  const tooShort = length < 8;
  const allSameClass = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length <= 1;

  let pool = 0;
  if (hasLower) pool += 26;
  if (hasUpper) pool += 26;
  if (hasDigit) pool += 10;
  if (hasSymbol) pool += 32;
  const entropyBits = pool > 0 ? length * Math.log2(pool) : 0;

  let score;
  if (entropyBits < 28) score = 0;
  else if (entropyBits < 36) score = 1;
  else if (entropyBits < 60) score = 2;
  else if (entropyBits < 128) score = 3;
  else score = 4;

  const crackEstimate = estimateCrack(entropyBits);

  const suggestions = [];
  if (length === 0) suggestions.push('请输入密码');
  else {
    if (tooShort) suggestions.push('使用至少 8 个字符');
    if (!hasLower) suggestions.push('加入小写字母');
    if (!hasUpper) suggestions.push('加入大写字母');
    if (!hasDigit) suggestions.push('加入数字');
    if (!hasSymbol) suggestions.push('加入符号（如 !@#$%）');
    if (hasSequential) suggestions.push('避免使用连续序列（如 123、abc）');
    if (hasRepeats) suggestions.push('避免重复字符（如 aaa、111）');
    if (hasCommonPattern) suggestions.push('避免使用常见密码或单词');
    if (allSameClass) suggestions.push('混合多种字符类型以提高强度');
    if (suggestions.length === 0) suggestions.push('很强，继续保持！');
  }

  return {
    score,
    entropyBits: Math.round(entropyBits * 10) / 10,
    crackEstimate,
    timeToCrack: crackEstimate,
    length,
    flags: {
      tooShort,
      hasLower,
      hasUpper,
      hasDigit,
      hasSymbol,
      hasSequential,
      hasRepeats,
      hasCommonPattern,
      allSameClass,
    },
    suggestions,
  };
}
