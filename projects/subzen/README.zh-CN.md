# subzen

> 零依赖字幕工具箱与质量检查器，对 **CJK（中文 / 日文 / 韩文）排版** 提供一等公民级支持。可在 Node.js 与浏览器中运行。

[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Tests](https://img.shields.io/badge/tests-93%20passing-brightgreen)](./test)
[![Zero deps](https://img.shields.io/badge/dependencies-0-brightgreen)](#)

subzen 帮你把字幕里那些枯燥又容易漏的活儿自动化：解析各种常见格式、**查出人工容易忽略的质量问题**、自动修复可修的部分、校正时间轴漂移、合并双语轨道、重新折行让中文不再断得别扭。它是一个**零依赖**的 ES 模块，无需打包构建，直接丢进 Node 脚本、CI 流水线或 `<script type="module">` 就能用。

```bash
# 检查文件（自动识别 SRT / VTT / ASS / LRC / JSON）
npx subzen lint subtitles.zh.srt

# 自动修复可修项并写回
npx subzen fix subtitles.zh.srt -w

# 转换格式并顺手规范化标点与空格
npx subzen convert eng.srt -as vtt -o eng.vtt
```

---

## 为什么是 subzen？

多数字幕工具都默认处理拉丁文字。到了 CJK 字幕就会出问题：

- **行宽算错** —— 一个汉字占 2 列宽，但多数工具按 1 列算，于是「每行最大宽度」的约束悄悄失效。
- **缺少盘古之白** —— 中日文与拉丁字母之间的空格（「模型 model」还是「模型model」），中文排版所要求。
- **全角半角串味** —— 中文里混进半角 `,`/`.`，或输入法串出全角拉丁字母（ＡＢＣ）。
- **断句断在半路** —— 不顾禁則処理：一行绝不该以 `。` `、` `」` 开头。

subzen 把这些全部建模进来。这是我们当年做中文/日文/韩文字幕时希望存在的检查器。

---

## 安装

```bash
npm install subzen          # 作为库
npm install -g subzen       # 作为命令行
```

无依赖、无原生编译，Node ≥ 18 即可。

---

## 命令行

```
subzen <命令> [文件...] [选项]

命令
  lint      检查文件并打印报告（有 error 时退出码为 1）
  fix       自动修复可修项并打印（或 -w 写回）
  convert   解析一种格式并序列化为另一种
  shift     将每条字幕整体偏移一段时间
  resync    用 2 个对齐锚点拉伸/压缩时间轴
  fps       在不同帧率间转换基于帧的时间
  merge     按时间重叠合并两条轨道（如 中 + 英）
  split     将双语轨道拆成两条单语轨道
  wrap      按显示宽度重新折行（CJK 感知）
  clean     只做空格/标点规范化，不跑检查
  stats     打印阅读速度与会话统计
  rules     列出所有规则及其默认等级
  init      从预设生成 .subzenrc

常用选项
  -a, --as <fmt>     强制输入格式（lint/fix）或输出格式（convert）
  -o, --out <file>   将结果写入文件
  -w, --write        原地覆盖输入文件
  --preset <name>    recommended | strict | loose | cjk | netflix
  --rules <json>     逐规则覆盖，如 '{"max-cps":"off"}'
  --encoding <enc>   兜底解码（utf8|gbk|gb18030|big5|shift-jis）
  --color <on|off>   强制彩色输出
  -q, --quiet        只打印报告摘要 / 错误
  -h, --help         显示帮助（命令后加可看命令帮助）
```

### 示例

```bash
# 用 CJK 预设检查，列出警告与错误
subzen lint drama.zh.srt --preset cjk

# 原地修复，再检查一遍剩下的
subzen fix drama.zh.srt -w --preset cjk
subzen lint drama.zh.srt --preset cjk

# 校正一条 50 分钟内漂移了 +1.2 秒的字幕
subzen resync sub.srt 00:01:00,000 00:01:01,200 00:50:00,000 00:50:01,200 -o fixed.srt

# 把中文 + 英文合并成上下排列的双语 SRT
subzen merge zh.srt en.srt -o bilingual.srt

# 把 40 字的中文行重新折成每行 18 的 2 行
subzen wrap long.zh.srt --width 18 --lines 2 -w
```

---

## 作为库使用

```js
import { parse, serialize, lint, fix, presets } from 'subzen';

const cues = parse(await readFile('ep01.zh.srt', 'utf8'));
const report = lint(cues, { preset: 'cjk' });
console.log(report.warningCount, '条警告');

const { cues: fixed } = fix(cues, { preset: 'cjk' });
await writeFile('ep01.fixed.srt', serialize(fixed, 'srt'));
```

每个模块也可单独引入以便按需打包：

```js
import { parseTimecode, formatSrtTime } from 'subzen/src/core/timecode.js';
import { mergeBilingual } from 'subzen/src/core/bilingual.js';
import { computeStats } from 'subzen/src/core/stats.js';
```

完整规则说明见 [`docs/rules.md`](./docs/rules.md)，配置文件说明见
[`docs/config.md`](./docs/config.md)。

---

## 规则

每条规则有等级（`off` / `info` / `warn` / `error`），部分可**自动修复**。预设打包了合理默认：

| 预设          | 适用场景                         |
| ------------- | -------------------------------- |
| `recommended` | 通用清理，开启安全的自动修复。   |
| `cjk`         | 专注中文/日文/韩文排版。         |
| `strict`      | 全部开启，含风格偏好。           |
| `loose`       | 只报硬性错误。                   |
| `netflix`     | 贴近 Netflix 字幕规范的经验规则。 |

运行 `subzen rules --preset cjk` 可查看每条规则的等级与是否可修复。

---

## 浏览器

subzen 核心部分纯 ESM、不依赖 Node 专有 API，因此可在浏览器中运行。在线试玩位于
[`playground/`](./playground) —— 打开 `playground/index.html`（或运行 `npm run playground`
后访问打印出的地址），粘贴字幕即可实时看修复效果。

---

## 开发

```bash
git clone <你的-fork>
cd subzen
npm test            # node --test，90+ 用例，零依赖
npm run demo        # 对内置示例做统计
npm run lint:self   # 检查内置的 messy 示例
```

欢迎参与贡献，详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 许可证

[MIT](./LICENSE)
