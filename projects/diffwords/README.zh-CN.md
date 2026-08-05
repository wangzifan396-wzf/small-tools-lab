# diffwords

> 词级、**CJK 感知**的文本差异对比工具。零依赖，可在 Node.js 与浏览器中运行。精确展示两份草稿之间到底改了什么。

[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Tests](https://img.shields.io/badge/tests-36%20passing-brightgreen)](./test)
[![Zero deps](https://img.shields.io/badge/dependencies-0-brightgreen)](#)

`diff` 和 `git diff` 都按行比较。对散文、文档和译文来说这太粗糙了：改一个词就整行重写；而**中文 / 日文 / 韩文**根本没有词间空格，字符级的改动在行级别上根本看不出来。diffwords 以「真正有意义的单位」做差异对比——拉丁文按词、CJK 按字——并提供四种呈现：终端行内、统一 diff、独立 HTML、JSON。

```bash
# 行内（默认）：删除加删除线，新增高亮
npx diffwords draft-v1.txt draft-v2.txt

# 经典统一 diff
npx diffwords a.txt b.txt --unified

# 一份可直接打开的 HTML 报告
npx diffwords zh-old.txt zh-new.txt --html review.html

# 机器可读
npx diffwords a.txt b.txt --json
```

---

## 为什么是 diffwords？

- **CJK 感知。** 中文没有空格，所以「改动的单位」就是字。diffwords 把 CJK 按字、拉丁文按词切分，于是替换一个字就显示为一个字的差异——而不是整行重写。
- **拉丁文按词。** `jumps` → `leaps` 是一次词替换，不是整行替换。
- **四种呈现。** 行内（终端）、统一（补丁/审阅）、HTML（可分享报告）、JSON（工具链）。
- **零依赖。** 纯 ES 模块，无需打包，直接用于 Node 或 `<script type="module">`。

---

## 安装

```bash
npm install diffwords       # 作为库
npm install -g diffwords    # 作为命令行
```

Node ≥ 18。

---

## 命令行

```
diffwords <a> <b> [选项]

  a, b     文件路径，或用 "-" 表示 stdin

选项
  -u, --unified     经典统一 diff（按行分块）
      --inline      行内视图：删除加删除线、新增高亮（默认）
      --html [文件] 独立 HTML 差异（省略文件则输出到 stdout）
      --side        --html 采用左右对照布局
      --json        机器可读 JSON（ops + stats）
      --stats       打印 token 统计行
      --context N   统一 diff 的上下文行数（默认 3）
      --color on|off|auto
      --a-label S   统一 diff 中旧侧的标签
      --b-label S   统一 diff 中新侧的标签
  -h, --help
      --version
```

退出码：文本不同为 `1`，相同为 `0`——方便接入脚本与 CI。

### 示例

```bash
diffwords old.md new.md --stats
diffwords a.txt b.txt --unified --context 1
diffwords zh-v1.txt zh-v2.txt --html --side report.html
cat old.md | diffwords - new.md --json
```

---

## 作为库使用

```js
import { diff, formatInline, formatUnified, formatHtml, formatJson } from 'diffwords';

const result = diff(originalText, revisedText);
console.log(result.stats);          // { unchanged, added, removed, similarity, ... }

process.stdout.write(formatInline(result));        // 终端
process.stdout.write(formatUnified(result));       // 补丁
```

模块也可单独引入以便按需打包：

```js
import { tokenize, isCjk } from 'diffwords/src/core/tokenize.js';
import { diffArrays } from 'diffwords/src/core/lcs.js';
```

输出格式与 `DiffResult` 结构见 [`docs/format.md`](./docs/format.md)。

---

## 浏览器

diffwords 核心不依赖 Node 专有 API，可在浏览器运行。在线试玩位于
[`playground/`](./playground) —— 运行 `npm run playground` 后打开打印出的地址，
粘贴两段文本即可实时看差异（行内与左右对照）。

---

## 开发

```bash
git clone <你的-fork>
cd diffwords
npm test        # node --test，零依赖
npm run demo    # 对比内置的 before/after 示例
```

欢迎参与贡献，详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 许可证

[MIT](./LICENSE)
