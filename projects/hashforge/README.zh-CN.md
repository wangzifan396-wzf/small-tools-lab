# hashforge

零依赖的哈希、HMAC 与编解码工具集。基于 **Web Crypto API** 实现，同一份代码在
**Node 18+ 与浏览器**中都能运行，**无任何依赖、无需构建**。

可计算 **SHA-1 / SHA-256 / SHA-384 / SHA-512** 摘要与 **HMAC**，并对文本做
**base64 / hex** 编解码——适合做文件校验、接口签名、数据脱敏等日常开发场景。

```js
import { hashText, hmacText, encode, decode, verify } from 'hashforge';

await hashText('abc', 'sha256');   // "ba7816bf…f20015ad"
await hmacText('msg', 'key', 'sha256');
encode('hi', 'base64');            // "aGk="
decode('aGk=', 'base64');          // "hi"
verify(expectedHex, actualHex);    // true / false
```

## 安装

```bash
npm install hashforge
```

不会安装任何依赖。也可以直接用 `npx` 试用命令行：

```bash
npx hashforge hash "hello"
```

## 库用法

| 函数 | 返回 | 说明 |
| --- | --- | --- |
| `hashText(text, algo?)` | `Promise<string>` | 对 UTF-8 字符串取十六进制摘要（默认 `sha256`）。 |
| `hashBytes(bytes, algo?)` | `Promise<string>` | 对 `Uint8Array` / `ArrayBuffer` 取摘要。 |
| `hashFile(path, algo?)` | `Promise<string>` | 仅 Node —— 读取并哈希文件。 |
| `hmacText(text, secret, algo?)` | `Promise<string>` | 对字符串做 HMAC-SHA 十六进制。 |
| `hmac(algo, secret, message)` | `Promise<string>` | 对字节做 HMAC。 |
| `encode(text, enc?)` | `string` | `base64`（默认）或 `hex`。 |
| `decode(str, enc?)` | `string` | `encode` 的逆操作。 |
| `verify(expected, actual)` | `boolean` | 忽略大小写与空白的摘要对比。 |

MD5 故意不提供（不安全，且 Web Crypto 不支持）。

## 命令行

```bash
hashforge hash  "hello"                  # sha256 十六进制
hashforge hash  "hello" --algo sha512    # sha512 十六进制
hashforge hmac  "msg"  --secret key      # hmac-sha256 十六进制
hashforge encode "hi"   --enc base64     # aGk=
hashforge decode "aGk=" --enc base64     # hi
hashforge file  ./build.zip --algo sha256
hashforge check ./build.zip <expected-hex>   # OK | MISMATCH
hashforge --help
```

## 浏览器

原生 ESM + Web Crypto，可直接放进 `<script type="module">`：

```html
<script type="module">
  import { hashText } from '../src/index.js';
  document.body.textContent = await hashText('hello', 'sha256');
</script>
```

也可以打开在线演示：

```bash
npm run playground   # → http://localhost:4173/
```

## 开发

```bash
node --test "test/*.test.js"   # 运行测试
npm run demo                   # 几个示例调用
```

## 许可证

[MIT](./LICENSE)
