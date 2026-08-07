# colorconv · 颜色格式转换

在 **HEX / RGB / HSL** 三种颜色表示之间互转，并实时预览色块。

## 功能
- 支持 `#hex`、`rgb(...)`、`hsl(...)` 三种输入
- 自动解析并输出另外两种格式
- 实时颜色预览、一键复制每种格式

## 用法

[在线使用](https://wangzifan396-wzf.github.io/small-tools-lab/projects/colorconv/)，或在本地运行：

```sh
npm start
```

核心模块支持 3/4/6/8 位 HEX、RGB 百分比、透明度和 HSL 色相环绕：

```js
import { parseColor, rgbToHex, formatHsl } from './src/index.js';

const color = parseColor('rgb(100% 0% 50% / 25%)');
console.log(rgbToHex(color), formatHsl(color));
```

Node.js 20+ 可运行 `npm test`。纯前端、零依赖、数据不出本机。
