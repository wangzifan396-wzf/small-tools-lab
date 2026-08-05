# Unit Convert 单位换算

零依赖单位换算。覆盖十大类别——长度、质量、温度、速度、数据（十进制 **与**
二进制）、时间、面积、体积、能量、压强——同时提供 CLI 与浏览器版本。无原生
编译、无网络，Node 与浏览器行为一致。

## 命令行

```bash
node bin/unit-convert.js 100 km mi        # 62.13711922 mi
node bin/unit-convert.js 0 C F            # 32 F
node bin/unit-convert.js 1 MB MiB        # 0.953674316 MiB（十进制 vs 二进制）
node bin/unit-convert.js --list           # 列出所有类别与单位
node bin/unit-convert.js --cat length     # 列出某类别的单位
```

数据单位区分二进制 `KiB`/`MiB`/`GiB`/`TiB`（1024 进制）与十进制
`KB`/`MB`/`GB`/`TB`（1000 进制）——这正是「硬盘少了 7%」的常见根源。

## 作为库

```js
import { convert, convertWithUnit } from './src/index.js';

convert(100, 'km', 'mi');                 // 62.1371192237334
convertWithUnit(0, 'C', 'F').formatted;   // "32 F"
```

温度走带偏移的 C/F/K 换算；其余类别都经基准单位放缩，新增单位只需加一行系数。

## 浏览器

打开 `playground/index.html`（或 `start` 启动本地服务），即可用两个下拉框实时换算。

## 测试

```bash
npm test     # node --test，零依赖
```
