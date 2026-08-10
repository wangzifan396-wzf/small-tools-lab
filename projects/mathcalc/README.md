# 数学表达式计算器 · MathCalc

纯前端、零依赖的数学表达式求值器。使用**递归下降解析器**安全求值，**不使用 `eval`**，可双击 `index.html` 在浏览器离线运行，数据不出本机。

## 功能

- 四则运算与取模：`+ - * / %`
- 幂运算 `^`（**右结合**：`2 ^ 3 ^ 2` = 512）
- 一元正负号：`-3 + 5`
- 括号与嵌套：`2 * (3 + 4) ^ 2`
- 常量：`pi` `e` `tau` `phi`
- 单参数函数：`sqrt cbrt abs floor ceil round sign sin cos tan asin acos atan ln log log2 exp trunc`
  - `log` 表示以 10 为底；`ln` 为自然对数
- 多参数函数：`min(...) max(...) pow(a,b) atan2(y,x) hypot(x,y)`
- 安全报错：未知变量 / 未知函数 / 语法错误 / 参数数量错误都会给出清晰中文提示
- 对除零等产生 `Infinity` / `NaN` 的情况做可读化输出

## 用法

浏览器：直接打开 [`index.html`](index.html)，输入表达式即时计算结果，点击函数/常量芯片可插入。

命令行 / 模块：

```js
const M = require("./src/mathcalc.js");
M.evaluate("2 * (3 + 4) ^ 2 / sqrt(49)"); // => 14
M.evaluate("max(1, 5, 3)");                // => 5
M.format(M.evaluate("pi"));                // => "3.141592653589793"
```

## 设计说明

- 词法分析 → 递归下降语法分析（Pratt 风格处理运算符优先级）→ 树求值，全过程不使用 `eval` / `Function`，避免任意代码执行风险。
- 浮点噪声在 `format()` 中按默认 6 位小数裁剪，整数直接显示。

## 测试

```bash
node --test tests/mathcalc.test.js
```

覆盖：运算符优先级、右结合幂、常量、单/多参数函数、嵌套、错误处理、格式化、除零。
