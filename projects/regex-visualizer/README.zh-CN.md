# Regex Visualizer 正则可视化

零依赖的正则解释器。把正则逐 token 翻译成人类可读的说明，在文本中找出全部匹配，
并输出 HTML 安全的的高亮预览——同时提供 CLI 与浏览器版本。无原生编译、无网络，
Node 与浏览器行为一致。

## 命令行

```bash
node bin/regex-visualizer.js --explain "\d{3}-\d{4}"   # 逐 token 解释
node bin/regex-visualizer.js "\b\w+\b" "hello world 123" g   # 查找匹配
```

`--explain` 输出每个 token 的 `raw`、`kind` 与 `meaning`；匹配模式输出匹配数量、
每个匹配的位置区间与捕获组，以及一段 HTML 高亮预览。`g` 标志决定是否全局匹配，
高亮始终在内部查找全部匹配。

## 作为库

```js
import { explain, findMatches, highlight } from './src/index.js';

explain('^(\\d{3})-[a-z]+$').tokens;   // [{ raw, kind, meaning }, ...]
findMatches('a1 b2', '\\w\\d', 'g');   // { matches, namedGroups, capped }
highlight('a<b>c', 'b');               // 'a<mark>b</mark>c'（已转义 HTML）
```

支持锚点 `^ $ \b \B`、字符集合 `[...]`、分组 `( ) (?: ) (?<name>)` 与环视、
量词 `* + ? {n,m}`（含懒惰变体）、或 `|`、转义 `\d \w \s \n \t`、反向引用。
非法正则返回 `{ error }` 而非抛异常。

## 浏览器

直接打开 `playground/index.html`（可在 `file://` 下运行），或 `start` 启动本地服务。
实时更新的说明列表、高亮输出与匹配计数。

## 测试

```bash
npm test     # node --test，零依赖
```
