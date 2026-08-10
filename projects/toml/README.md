# TOML ⇄ JSON 转换器 · TOML

纯前端、零依赖的 TOML 与 JSON 双向转换器。支持常见 TOML 语法的解析与序列化，双击 `index.html` 离线运行，数据不出本机。

## 解析（TOML → JSON）支持

- 字符串：基础 `"..."`、字面 `'...'`、多行 `"""..."""` / `'''...'''`，含转义（`\n \t \uXXXX \UXXXXXXXX` 等）与行尾反斜杠换行截断
- 整数：十进制、十六进制 `0x`、八进制 `0o`、二进制 `0b`、支持下划线 `1_000`
- 浮点：`3.14`、科学计数 `5e+22`、无穷大 `inf` / `nan`
- 布尔：`true` / `false`
- 日期时间：带时区 `1979-05-27T07:32:00Z`、本地日期时间、本地日期、本地时间
- 数组（含嵌套与异构成员）
- 内联表 `{ a = 1, b = { c = 2 } }`
- 点号键 `a.b.c = 1`
- 表 `[table]` 与数组表 `[[products]]`（首个单表自动成为数组首个元素）
- 注释 `#`

## 序列化（JSON → TOML）

- 标量（字符串/数字/布尔）与标量数组内联输出
- 嵌套对象输出为 `[a.b.c]` 子表
- 对象数组输出为 `[[items]]` 数组表

## 用法

浏览器：打开 [`index.html`](index.html)，选择方向并粘贴内容即时转换。

模块 / 命令行：

```js
const T = require("./src/toml.js");
T.parse('title = "hi"\n[owner]\nname = "Tom"');
// => { title: "hi", owner: { name: "Tom" } }
T.stringify({ name: "test", nested: { a: 1 } });
// => 'name = "test"\n\n[nested]\na = 1\n'
```

## 限制

- 整型一律按 Number 解析（超大整数可能损失精度，必要时可扩展 BigInt）。
- 日期时间按 ISO 字符串保留，不转换为 JS Date 对象，便于原样往返。
- 不强制校验 TOML 全部边界规则（如重复键定义），以常见配置场景为主。

## 测试

```bash
node --test tests/toml.test.js
```
