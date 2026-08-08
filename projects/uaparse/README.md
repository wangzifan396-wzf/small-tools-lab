# User-Agent 解析器

零依赖的 User-Agent 字符串解析器，从一段 UA 文本中识别出**浏览器**、**渲染引擎**、**操作系统**与**设备类型/厂商/型号**。纯前端、无规则库下载、无网络请求，可直接在 `file://` 下运行。

## 特性

- **浏览器识别**：Chrome / Edge / Opera / Firefox / Safari / Samsung Internet / UC / QQ / 百度 / Vivaldi / Yandex / Brave / 2345 / Maxthon / IE 等，含 iOS/Android 变体。
- **引擎识别**：Blink（Chromium 系）、Gecko（Firefox）、WebKit（Safari）、Trident（IE）、EdgeHTML、Presto。
- **系统识别**：Windows（含 7/8/8.1/10/11 版本）、macOS、iOS、Android、Chrome OS、Linux 发行版。
- **设备识别**：自动区分 桌面 / 手机 / 平板 / 爬虫，并提取 Apple/Android 设备的厂商与型号。
- **纯本地**：内置正则规则，解析在浏览器内完成，数据不出本机。

## 用法

将任意 UA 字符串粘贴入输入框，点击「解析」，或直接点击「填入示例」载入当前浏览器 UA。结果分四张卡片展示。

## API

```js
Uaparse.parse(uaString) // => { ua, browser:{name,version}, engine:{name,version}, os:{name,version}, device:{type,vendor,model,isBot} }
```

## 说明

- 解析基于常见 UA 特征正则，覆盖主流浏览器与系统；极冷门或高度自定义 UA 可能回落为 `Unknown`。
- 移动 / 平板判定结合 `Mobile`、`iPad`、Android 非移动标记与 `Tablet` 关键字；含 bot/spider/crawl 等特征时标记为爬虫。
