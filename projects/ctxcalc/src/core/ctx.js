// Zero-dependency context / token estimator + multi-model context-window &
// cost preview. Token counts are HEURISTIC estimates (no real BPE tokenizer
// is bundled), which is enough to plan prompt size and compare models. Prices
// are illustrative USD-per-1K estimates for scale, NOT a billing system.

// Chinese / Japanese / Korean ideographs + fullwidth forms. Each roughly maps
// to ~1 token in modern tokenizers, so we count them 1:1.
const CJK_RE = /[⺀-〇一-鿿＀-￯぀-ヿ가-힯]/g;
const LATIN_RE = /[A-Za-z0-9]+/g;

// Curated model catalog. `ctx` = context window in tokens (token budget).
// `inPer1k` / `outPer1k` = approximate USD per 1K tokens, early-2026 ballpark,
// for relative scale only.
export const MODELS = [
  { id: 'gpt-4o', label: 'GPT-4o', icon: '🟢', provider: 'OpenAI', ctx: 128000, inPer1k: 0.005, outPer1k: 0.015 },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', icon: '🟢', provider: 'OpenAI', ctx: 128000, inPer1k: 0.00015, outPer1k: 0.0006 },
  { id: 'o3-mini', label: 'OpenAI o3-mini', icon: '🟢', provider: 'OpenAI', ctx: 200000, inPer1k: 0.0011, outPer1k: 0.0044 },
  { id: 'claude-3.7-sonnet', label: 'Claude 3.7 Sonnet', icon: '🟠', provider: 'Anthropic', ctx: 200000, inPer1k: 0.003, outPer1k: 0.015 },
  { id: 'claude-3.5-haiku', label: 'Claude 3.5 Haiku', icon: '🟠', provider: 'Anthropic', ctx: 200000, inPer1k: 0.0008, outPer1k: 0.004 },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', icon: '🔵', provider: 'Google', ctx: 1000000, inPer1k: 0.0001, outPer1k: 0.0004 },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', icon: '🔵', provider: 'Google', ctx: 1000000, inPer1k: 0.00125, outPer1k: 0.01 },
  { id: 'deepseek-chat', label: 'DeepSeek-V3', icon: '🔶', provider: 'DeepSeek', ctx: 128000, inPer1k: 0.00027, outPer1k: 0.0011 },
  { id: 'deepseek-reasoner', label: 'DeepSeek-R1', icon: '🔶', provider: 'DeepSeek', ctx: 64000, inPer1k: 0.00055, outPer1k: 0.00219 },
  { id: 'qwen-max', label: 'Qwen-Max', icon: '🟣', provider: 'Aliyun', ctx: 32768, inPer1k: 0.0016, outPer1k: 0.004 },
  { id: 'qwen3-235b', label: 'Qwen3-235B', icon: '🟣', provider: 'Aliyun', ctx: 128000, inPer1k: 0.0002, outPer1k: 0.0006 },
  { id: 'llama-3.1-405b', label: 'Llama 3.1 405B', icon: '⚪', provider: 'Meta', ctx: 131072, inPer1k: 0.0027, outPer1k: 0.0027 },
  { id: 'mistral-large', label: 'Mistral Large', icon: '🟡', provider: 'Mistral', ctx: 128000, inPer1k: 0.002, outPer1k: 0.006 },
  { id: 'grok-2', label: 'Grok-2', icon: '⚫', provider: 'xAI', ctx: 131072, inPer1k: 0.002, outPer1k: 0.01 },
];

export function modelById(id) {
  return MODELS.find((m) => m.id === id) || null;
}

// Break text into character classes so callers can explain the estimate.
export function analyze(text) {
  const s = String(text == null ? '' : text);
  const cjk = (s.match(CJK_RE) || []).length;
  const withoutCjk = s.replace(CJK_RE, '');
  const words = (withoutCjk.match(LATIN_RE) || []).length;
  const other = withoutCjk.replace(LATIN_RE, '').length;
  const tokens = s.length === 0 ? 0 : Math.max(1, Math.ceil(cjk * 1 + words * 1.3 + other * 0.3));
  return { chars: s.length, cjk, words, other, tokens };
}

export function estimateTokens(text) {
  return analyze(text).tokens;
}

// How a chunk of `tokens` fits into a model's context window.
export function fitContext(tokens, ctx) {
  const ratio = ctx > 0 ? tokens / ctx : 1;
  return {
    ctx,
    ratio,
    pct: ctx > 0 ? Math.min(100, Math.round(ratio * 100)) : 100,
    fits: tokens <= ctx,
    remaining: Math.max(0, ctx - tokens),
    fitCopies: tokens > 0 ? Math.floor(ctx / tokens) : 0,
  };
}

// Illustrative cost from token counts and a model's per-1K prices.
export function estimateCost(inTokens, outTokens, model) {
  const inPer1k = model && model.inPer1k ? model.inPer1k : 0;
  const outPer1k = model && model.outPer1k ? model.outPer1k : 0;
  const costIn = (inTokens / 1000) * inPer1k;
  const costOut = (outTokens / 1000) * outPer1k;
  return { inTokens: inTokens || 0, outTokens: outTokens || 0, costIn, costOut, cost: costIn + costOut };
}

// Combine everything into one preview object for a given text + model.
export function preview(text, modelId, outTokens = 0) {
  const m = modelById(modelId) || MODELS[0];
  const a = analyze(text);
  const fit = fitContext(a.tokens, m.ctx);
  const cost = estimateCost(a.tokens, outTokens, m);
  return {
    model: { id: m.id, label: m.label, icon: m.icon, provider: m.provider, ctx: m.ctx },
    chars: a.chars, cjk: a.cjk, words: a.words, other: a.other, tokens: a.tokens,
    ctx: fit.ctx, ratio: fit.ratio, pct: fit.pct, fits: fit.fits,
    remaining: fit.remaining, fitCopies: fit.fitCopies,
    inTokens: cost.inTokens, outTokens: cost.outTokens,
    costIn: cost.costIn, costOut: cost.costOut, cost: cost.cost,
  };
}
