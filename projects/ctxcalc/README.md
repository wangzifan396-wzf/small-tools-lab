# ctxcalc

Zero-dependency context / token estimator + multi-model context-window and
cost preview. Estimate how many tokens a prompt uses, whether it fits a model's
context window, and what the call would roughly cost. Works in the CLI and in
the browser (self-contained playground, no build step).

## Usage

```bash
ctxcalc "你好 world" gpt-4o 500
# 🟢 GPT-4o（OpenAI）
# 字符 8 · 中文 2 · 词 1 · 其它 5
# 估算 token：4
# 上下文窗口：128,000 · 占比 0% · 可放下
# 约可放入 32000 份本文本
# 成本（参考价）：输入 $0.000020 + 输出 $0.007500 = $0.007520
# （token 为启发式估算，成本为示意参考价，非真实账单）

ctxcalc --list
```

## Features

- Heuristic token estimate that handles mixed **CJK + Latin** text (CJK ≈ 1
  token/char, Latin ≈ 1.3 token/word, punctuation ≈ 0.3 token/char). No BPE
  tokenizer bundled, so it is an *estimate*, clearly labelled.
- Curated catalog of ~14 popular models with real context windows.
- Context-window fit: ratio, percentage, remaining budget, and how many copies
  of the text fit.
- Illustrative input/output cost from per-1K prices (relative scale, not a
  billing system).

## Library

```js
import { estimateTokens, preview, MODELS } from 'ctxcalc';
const t = estimateTokens('你好 world');          // 4
const r = preview('你好 world', 'claude-3.7-sonnet', 500);
// { tokens, ctx, pct, fits, remaining, fitCopies, cost, ... }
```

## Try it

Open `index.html` directly in a browser (works over `file://` too),
or run `npm start` for the localhost server.
