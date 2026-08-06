# ctxcalc · 上下文 / Token 估算器

零依赖的上下文窗口 / token 估算 + 多模型上下文容量与成本预览。估算一段提示词
约占多少 token、能否放进模型的上下文窗口、这次调用大致花多少钱。同时支持 CLI
与浏览器（自包含 playground，无需构建）。

## 用法

```bash
ctxcalc "你好 world" gpt-4o 500
ctxcalc --list
```

## 功能

- **混合文本 token 估算**：中文 / 日文 / 韩文按约 1 token/字，拉丁词约 1.3
  token/词，标点空格约 0.3 token/字符。不内置 BPE 分词器，因此结果是**估算值**，
  页面与输出都已明确标注。
- **多模型目录**：内置约 14 个主流模型的真实上下文窗口。
- **上下文容量**：占比、剩余预算、本文本能放几份。
- **示意成本**：按每千 token 单价估算输入/输出成本（仅作规模参考，非真实账单）。

## 库调用

```js
import { estimateTokens, preview, MODELS } from 'ctxcalc';
const t = estimateTokens('你好 world');
const r = preview('你好 world', 'claude-3.7-sonnet', 500);
```

## 试试看

直接用浏览器打开 `index.html`（也支持 `file://` 双击打开），
或运行 `npm start` 启动本地服务。
