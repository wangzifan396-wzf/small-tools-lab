# radix

零依赖的 **进制 / 数位转换器**。在 2–36 进制间用 BigInt 精确互转，并查看二/八/十/十六进制形式与位、字节视图。CLI + 浏览器 playground，无依赖、无构建。

## 功能

- 在 2–36 进制间自由转换
- BigInt 精确计算：大数不丢精度（无浮点误差）
- 一键查看二进制 / 八进制 / 十进制 / 十六进制
- 无符号数值的位宽与字节对齐视图
- CLI + 浏览器 playground —— 同一套逻辑，零依赖

## 浏览器

直接双击打开 `index.html`，或启动本地服务：

```bash
node playground/serve.js      # 或：npm start
# → http://localhost:4173/
```

## 命令行

```bash
radix <值> <源进制> <目标进制>   # 转换
radix --all <值> <源进制>      # 显示 2/8/10/16
radix --bits <值> <源进制>     # 二进制 + 字节视图
radix --help
```

示例：

```bash
radix ff 16 10        # → 255
radix 255 10 16       # → ff
radix --all 255 10    # 二进制 / 八进制 / 十进制 / 十六进制
```

## API

```js
import { convert, commonConversions, bitView } from "radix";

convert("ff", 16, 10);          // { value: "255", decimal: "255", ... }
commonConversions("255", 10);   // { binary, octal, decimal, hex }
bitView("255", 10);             // { binary, bits, byteLength, bytes }
```

## 测试

```bash
npm test
```

## 许可证

MIT
