"use strict";

const TOOLS = [
  {
    id: "chromacraft",
    name: "ChromaCraft",
    category: "browser",
    label: "Color systems",
    description:
      "Extract perceptual palettes, validate contrast, lock colors, and export CSS, JSON, or Tailwind tokens.",
    tech: "Browser · OKLab · WCAG",
    live: "projects/chromacraft/",
    docs: "projects/chromacraft/README.md",
    featured: true,
  },
  {
    id: "schema-scout",
    name: "Schema Scout",
    category: "browser",
    label: "JSON discovery",
    description:
      "Inspect real JSON samples, measure field coverage, and infer JSON Schema, TypeScript, or path catalogs.",
    tech: "Browser · JSON Schema",
    live: "projects/schema-scout/",
    docs: "projects/schema-scout/README.md",
    featured: false,
  },
  {
    id: "timeweave",
    name: "TimeWeave",
    category: "browser",
    label: "Time-zone planning",
    description:
      "Compare working hours across time zones, find shared slots, and export calendar-ready events.",
    tech: "Browser · Intl API",
    live: "projects/timeweave/",
    docs: "projects/timeweave/README.md",
    featured: false,
  },
  {
    id: "readme-studio",
    name: "README Studio",
    category: "browser",
    label: "Project documentation",
    description:
      "Build a structured project README with live preview, badges, optional sections, and Markdown export.",
    tech: "Browser · Markdown",
    live: "projects/readme-studio/",
    docs: "projects/readme-studio/README.md",
    featured: false,
  },
  {
    id: "browser-todo",
    name: "Browser Todo",
    category: "browser",
    label: "Local productivity",
    description:
      "A tiny local-first task list retained from the original Small Tools Lab.",
    tech: "Browser · localStorage",
    live: "projects/browser-todo/",
    docs: "projects/browser-todo/README.md",
    featured: false,
  },
  {
    id: "harnesslint",
    name: "HarnessLint",
    category: "cli",
    label: "Agent configuration",
    description:
      "Lint agent instructions, MCP configuration, permissions, pinned dependencies, and repository harness safety.",
    tech: "Node.js CLI · SARIF",
    docs: "projects/harnesslint/README.md",
    featured: true,
  },
  {
    id: "git-risk-map",
    name: "Git Risk Map",
    category: "cli",
    label: "Review planning",
    description:
      "Turn a Git diff into a transparent, evidence-backed review order using path and change-risk signals.",
    tech: "Node.js CLI · Git",
    docs: "projects/git-risk-map/README.md",
    featured: false,
  },
  {
    id: "forge-ready",
    name: "ForgeReady",
    category: "cli",
    label: "Release readiness",
    description:
      "Audit documentation, community health, quality, security, and release engineering before going public.",
    tech: "Node.js CLI · GitHub Action",
    docs: "projects/forge-ready/README.md",
    featured: true,
  },
  {
    id: "patchbrief",
    name: "PatchBrief",
    category: "cli",
    label: "AI review context",
    description:
      "Build minimal, redacted, token-budgeted context packets around a Git change for agents and reviewers.",
    tech: "Node.js CLI · Git",
    docs: "projects/patchbrief/README.md",
    featured: true,
  },
  {
    id: "env-matrix",
    name: "Env Matrix",
    category: "cli",
    label: "Configuration contracts",
    description:
      "Map environment variables across source, examples, CI, containers, deployment files, and docs.",
    tech: "Node.js CLI · GitHub Action",
    docs: "projects/env-matrix/README.md",
    featured: true,
  },
  {
    id: "action-budget",
    name: "Action Budget",
    category: "cli",
    label: "CI cost exposure",
    description:
      "Expand GitHub Actions matrices and expose job fanout, concurrency, timeout limits, and unknown cost.",
    tech: "Node.js CLI · YAML",
    docs: "projects/action-budget/README.md",
    featured: true,
  },
  {
    id: "lockfile-lens",
    name: "Lockfile Lens",
    category: "cli",
    label: "Dependency review",
    description:
      "Explain npm lockfile risk across sources, integrity, install scripts, registry drift, and pull-request changes.",
    tech: "Node.js CLI · Supply chain",
    docs: "projects/lockfile-lens/README.md",
    featured: true,
  },
  {
    id: "log-sift",
    name: "Log Sift",
    category: "cli",
    label: "Agent-ready logs",
    description:
      "Compress noisy logs into deterministic, redacted, error-first context within an explicit token budget.",
    tech: "Node.js CLI · Redaction",
    docs: "projects/log-sift/README.md",
    featured: true,
  },
  {
    id: "ignore-doctor",
    name: "Ignore Doctor",
    category: "cli",
    label: "Repository boundaries",
    description:
      "Audit Git, Docker, npm, and formatter ignore rules for leaks, dangerous negations, and context bloat.",
    tech: "Node.js CLI · Ignore rules",
    docs: "projects/ignore-doctor/README.md",
    featured: true,
  },
  {
    id: "port-matrix",
    name: "Port Matrix",
    category: "cli",
    label: "Port contracts",
    description:
      "Map ports across code, environment files, containers, orchestration, and docs to expose drift and collisions.",
    tech: "Node.js CLI · YAML",
    docs: "projects/port-matrix/README.md",
    featured: true,
  },
  {
    id: "local-kb",
    name: "Local KB",
    category: "local-ai",
    label: "Private RAG",
    description:
      "Index local documents with Ollama embeddings and SQLite, then answer questions with a local chat model.",
    tech: "Python · Ollama · SQLite",
    docs: "projects/local-kb/README.md",
    featured: false,
  },
  {
    id: "screenshot-qa",
    name: "Screenshot QA",
    category: "local-ai",
    label: "OCR assistance",
    description:
      "Extract screenshot text locally and ask an Ollama or DeepSeek model for an actionable explanation.",
    tech: "Python · OCR · Ollama",
    docs: "projects/screenshot-qa/README.md",
    featured: false,
  },
  {
    id: "leafnote",
    name: "Leafnote",
    category: "browser",
    label: "Local Markdown notes",
    description:
      "Local-first Markdown notes & knowledge base with wiki-links, backlinks, tags, full-text search, and XSS-safe rendering. Data stays in your browser.",
    tech: "Browser · localStorage",
    live: "projects/leafnote/",
    docs: "projects/leafnote/README.md",
    featured: false,
  },
  {
    id: "sketchly",
    name: "Sketchly",
    category: "browser",
    label: "Hand-drawn whiteboard",
    description:
      "Local-first infinite-canvas whiteboard with a hand-drawn renderer, shapes, undo/redo, and PNG/JSON export. Works offline.",
    tech: "Browser · Canvas",
    live: "projects/sketchly/",
    docs: "projects/sketchly/README.md",
    featured: false,
  },
  {
    id: "subzen",
    name: "Subzen",
    category: "cli",
    label: "Subtitle toolkit",
    description:
      "Zero-dependency subtitle parser, quality linter and auto-fixer with first-class CJK typography (line width, spacing, kinsoku).",
    tech: "Node.js CLI · SRT/VTT/ASS",
    docs: "projects/subzen/README.md",
    featured: false,
  },
  {
    id: "diffwords",
    name: "Diffwords",
    category: "cli",
    label: "Word-level text diff",
    description:
      "Word-level, CJK-aware text differ that renders inline, unified, standalone HTML, and JSON — far finer than line-based diff for prose.",
    tech: "Node.js CLI · LCS",
    docs: "projects/diffwords/README.md",
    featured: false,
  },
  {
    id: "cronly",
    name: "Cronly",
    category: "cli",
    label: "Cron toolkit",
    description:
      "Parse, validate, and describe cron expressions in English or Chinese, and compute next/previous run times with timezone and DST handling.",
    tech: "Node.js CLI · Intl",
    docs: "projects/cronly/README.md",
    featured: false,
  },
  {
    id: "quanty",
    name: "Quanty",
    category: "cli",
    label: "Number & byte formatting",
    description:
      "Zero-dependency number and byte formatting: formatBytes/parseBytes, grouped numbers, SI or Chinese compact notation, and ordinals.",
    tech: "Node.js CLI · Intl",
    docs: "projects/quanty/README.md",
    featured: false,
  },
  {
    id: "hashforge",
    name: "Hashforge",
    category: "cli",
    label: "Hash · HMAC · codec",
    description:
      "Zero-dependency hashing, HMAC and codec toolkit (SHA-1/256/384/512, HMAC, base64/hex) built on Web Crypto — runs in Node and the browser.",
    tech: "Node.js · Web Crypto",
    docs: "projects/hashforge/README.md",
    featured: false,
  },
  {
    id: "jsonq",
    name: "Jsonq",
    category: "cli",
    label: "JSON query & transform",
    description:
      "Zero-dependency JSON query & transform: get by path, pick/omit keys, filter arrays, sort — for the CLI and the browser.",
    tech: "Node.js CLI · ESM",
    docs: "projects/jsonq/README.md",
    featured: false,
  },
  {
    id: "unit-convert",
    name: "Unit Convert",
    category: "cli",
    label: "Zero-dependency unit converter",
    description:
      "Convert across length, mass, temperature, speed, data (decimal + binary), time, area, volume, energy, pressure — for the CLI and the browser.",
    tech: "Node.js CLI · ESM",
    live: "projects/unit-convert/playground/",
    docs: "projects/unit-convert/README.md",
    featured: false,
  },
  {
    id: "regex-visualizer",
    name: "Regex Visualizer",
    category: "browser",
    label: "Regex explainer",
    description:
      "Explain a regular expression token by token, find every match, and render an HTML-safe highlight — pure, zero-dependency, in the CLI and the browser.",
    tech: "Browser · RegExp",
    live: "projects/regex-visualizer/",
    docs: "projects/regex-visualizer/README.md",
    featured: false,
  },
  {
    id: "password-strength",
    name: "Password Strength",
    category: "browser",
    label: "Password strength",
    description:
      "Estimate password strength from character-class entropy, with a rough offline crack-time estimate and a checklist of weaknesses. Weak = red, strong = green.",
    tech: "Browser · Entropy",
    live: "projects/password-strength/",
    docs: "projects/password-strength/README.md",
    featured: false,
  },
  {
    id: "text-forge",
    name: "Text Forge",
    category: "cli",
    label: "Text toolkit",
    description:
      "Zero-dependency text toolkit: slugify, case conversion, Unicode normalization, diacritic removal, full/half-width conversion, and whitespace cleaning — for the CLI and the browser.",
    tech: "Node.js CLI · Unicode",
    live: "projects/text-forge/",
    docs: "projects/text-forge/README.md",
    featured: false,
  },
  {
    id: "cron-describe",
    name: "Cron Describe",
    category: "browser",
    label: "Cron 解读",
    description:
      "Zero-dependency cron expression parser + humanizer: turn `分 时 日 月 周` into plain Chinese and list the next run times — in the browser, no build step.",
    tech: "Browser · Cron",
    live: "projects/cron-describe/",
    docs: "projects/cron-describe/README.md",
    featured: false,
  },
  {
    id: "ctxcalc",
    name: "CtxCalc",
    category: "browser",
    label: "上下文 / Token 估算",
    description:
      "Zero-dependency context / token estimator: estimate prompt tokens (mixed CJK + Latin), check fit against a model's context window, and preview illustrative cost — in the browser, no build step.",
    tech: "Browser · Estimator",
    live: "projects/ctxcalc/",
    docs: "projects/ctxcalc/README.md",
    featured: false,
  },
  {
    id: "jwtpeek",
    name: "JwtPeek",
    category: "browser",
    label: "JWT 解码",
    description:
      "Zero-dependency JWT decoder: decode the header and payload of a token, surface expiry / issued / not-before timing, and show a clear verdict — in the browser, no build step. Decode only, no signature verification.",
    tech: "Browser · JWT",
    live: "projects/jwtpeek/",
    docs: "projects/jwtpeek/README.md",
    featured: false,
  },
  {
    id: "radix",
    name: "Radix",
    category: "browser",
    label: "进制 / 数位转换",
    description:
      "Zero-dependency number base converter: convert across bases 2–36 with BigInt-exact math and inspect binary / octal / decimal / hex plus a bit & byte view — in the browser, no build step.",
    tech: "Browser · BigInt",
    live: "projects/radix/",
    docs: "projects/radix/README.md",
    featured: false,
  },
  {
    id: "epoch",
    name: "Epoch",
    category: "browser",
    label: "时间戳转换",
    description:
      "Zero-dependency Unix timestamp ⇄ date converter: local / UTC / ISO 8601, auto-detect seconds vs milliseconds, and show relative duration — in the browser, no build step.",
    tech: "Browser · Date",
    live: "projects/epoch/",
    docs: "projects/epoch/README.md",
    featured: false,
  },
  {
    id: "wordcount",
    name: "Word Count",
    category: "browser",
    label: "文本统计",
    description:
      "Zero-dependency text statistics for mixed CJK + Latin text: characters, words, lines, paragraphs, sentences, and an estimated reading time — in the browser, no build step.",
    tech: "Browser · Unicode",
    live: "projects/wordcount/",
    docs: "projects/wordcount/README.md",
    featured: false,
  },
  {
    id: "csvjson",
    name: "CSV ⇄ JSON",
    category: "browser",
    label: "表格转换",
    description:
      "Zero-dependency CSV ⇄ JSON converter with a correct quoted-field parser (commas / newlines / quotes), auto-detected delimiters, and RFC4180 escaping — in the browser, no build step.",
    tech: "Browser · Parser",
    live: "projects/csvjson/",
    docs: "projects/csvjson/README.md",
    featured: false,
  },
  {
    id: "uuidgen",
    name: "UUID Gen",
    category: "browser",
    label: "唯一标识生成",
    description:
      "Zero-dependency RFC4122 v4 UUID generator: batch up to 200, toggle dashes and uppercase, and require cryptographically secure randomness — in the browser, no build step.",
    tech: "Browser · Crypto",
    live: "projects/uuidgen/",
    docs: "projects/uuidgen/README.md",
    featured: false,
  },
  {
    id: "base64",
    name: "Base64 编解码",
    category: "browser",
    label: "文本编码",
    description:
      "UTF-8 安全的 Base64 编解码，用 TextEncoder/TextDecoder 正确处理中文与 emoji，支持编码、解码、互换与复制，纯浏览器零依赖。",
    tech: "Browser · Encoding",
    live: "projects/base64/",
    docs: "projects/base64/README.md",
    featured: false,
  },
  {
    id: "sqlfmt",
    name: "SQL 格式化 / 压缩",
    category: "browser",
    label: "代码格式化",
    description:
      "词法安全的 SQL 排版与压缩，隔离字符串、标识符、占位符和嵌套注释，并检测括号错误。",
    tech: "Browser · SQL · Library",
    live: "projects/sqlfmt/",
    docs: "projects/sqlfmt/README.md",
    featured: false,
  },
  {
    id: "curlcon",
    name: "curl 转代码",
    category: "browser",
    label: "代码转换",
    description:
      "严格解析 curl 并生成 Fetch / Python requests，拒绝 shell 执行、重定向和本地文件读取。",
    tech: "Browser · HTTP · Library",
    live: "projects/curlcon/",
    docs: "projects/curlcon/README.md",
    featured: false,
  },
  {
    id: "cssfmt",
    name: "CSS 美化 / 压缩",
    category: "browser",
    label: "代码格式化",
    description:
      "零依赖 CSS 排版：按花括号层级缩进美化，或去除注释与空白压缩成单行，字符串与注释内容原样保留。",
    tech: "Browser · CSS",
    live: "projects/cssfmt/",
    docs: "projects/cssfmt/README.md",
    featured: false,
  },
  {
    id: "htmlfmt",
    name: "HTML 美化 / 压缩",
    category: "browser",
    label: "代码格式化",
    description:
      "零依赖 HTML 排版：按标签嵌套层级缩进美化，或去除注释压缩成单行；script/style 与属性字符串原样保留。",
    tech: "Browser · HTML",
    live: "projects/htmlfmt/",
    docs: "projects/htmlfmt/README.md",
    featured: false,
  },
  {
    id: "xmlfmt",
    name: "XML 美化 / 压缩",
    category: "browser",
    label: "代码格式化",
    description:
      "零依赖 XML 排版：按元素嵌套缩进美化，或去除注释压缩成单行；CDATA、处理指令与属性字符串原样保留。",
    tech: "Browser · XML",
    live: "projects/xmlfmt/",
    docs: "projects/xmlfmt/README.md",
    featured: false,
  },
  {
    id: "totp",
    name: "TOTP 动态口令",
    category: "browser",
    label: "安全工具",
    description:
      "零依赖 RFC 6238 动态口令：SHA-1/256/512 三算法，Base32/Hex/文本密钥，倒计时自动刷新，可生成 otpauth 导入链接。",
    tech: "Browser · TOTP",
    live: "projects/totp/",
    docs: "projects/totp/README.md",
    featured: false,
  },
  {
    id: "uaparse",
    name: "User-Agent 解析",
    category: "browser",
    label: "类型查询",
    description:
      "零依赖 UA 解析：识别浏览器、渲染引擎（Blink/Gecko/WebKit…）、操作系统与设备类型/厂商/型号，含爬虫判定。",
    tech: "Browser · UA",
    live: "projects/uaparse/",
    docs: "projects/uaparse/README.md",
    featured: false,
  },
  {
    id: "hashid",
    name: "哈希类型识别",
    category: "browser",
    label: "安全工具",
    description:
      "零依赖哈希识别：依前缀/长度/字符集推断算法，覆盖 bcrypt/Argon2/MD5/SHA 系列等，仅识别类型不还原明文。",
    tech: "Browser · Hash",
    live: "projects/hashid/",
    docs: "projects/hashid/README.md",
    featured: false,
  },
  {
    id: "macaddr",
    name: "MAC 地址工具",
    category: "browser",
    label: "网络工具",
    description:
      "零依赖 MAC 处理：规范化与任意分隔符重排、随机生成、OUI 厂商识别，并解析单播/多播与本地/全局管理位。",
    tech: "Browser · MAC",
    live: "projects/macaddr/",
    docs: "projects/macaddr/README.md",
    featured: false,
  },
  {
    id: "nato",
    name: "NATO 音标字母",
    category: "browser",
    label: "文本工具",
    description:
      "零依赖 NATO/ICAO 音标转换：文字编码为 Alfa Bravo Charlie，或音标词解码回文本，附完整字母表速查。",
    tech: "Browser · Text",
    live: "projects/nato/",
    docs: "projects/nato/README.md",
    featured: false,
  },
  {
    id: "rsa",
    name: "RSA 加解密",
    category: "browser",
    label: "安全工具",
    description:
      "纯 JS RSA：Miller–Rabin 生成密钥对并加解密，PKCS#1 v1.5 填充与 OpenSSL/Node 互通，file:// 双击即跑。",
    tech: "Browser · RSA",
    live: "projects/rsa/",
    docs: "projects/rsa/README.md",
    featured: false,
  },
  {
    id: "mathcalc",
    name: "数学表达式计算器",
    category: "browser",
    label: "计算工具",
    description:
      "零依赖数学表达式求值：四则、取模、幂（右结合），sqrt/log/sin 等函数与 pi/e 常量，递归下降安全求值（不用 eval）。",
    tech: "Browser · Math",
    live: "projects/mathcalc/",
    docs: "projects/mathcalc/README.md",
    featured: false,
  },
  {
    id: "wifiqr",
    name: "WiFi 二维码生成器",
    category: "browser",
    label: "二维码",
    description:
      "生成可扫码连接的 WiFi 配置二维码：支持 WPA/WEP/开放网络与隐藏网络，自动转义特殊字符，复用内置二维码编码器。",
    tech: "Browser · WiFi",
    live: "projects/wifiqr/",
    docs: "projects/wifiqr/README.md",
    featured: false,
  },
  {
    id: "toml",
    name: "TOML ⇄ JSON 转换器",
    category: "browser",
    label: "格式转换",
    description:
      "零依赖 TOML 与 JSON 双向转换：覆盖字符串/整数/浮点/布尔/日期时间/数组/内联表/点号键/数组表，离线运行。",
    tech: "Browser · TOML",
    live: "projects/toml/",
    docs: "projects/toml/README.md",
    featured: false,
  },
  {
    id: "mime",
    name: "MIME 类型查询",
    category: "browser",
    label: "类型查询",
    description:
      "扩展名与 MIME 类型双向查询，提示文本类类型的 charset，内建约 120 条常用映射，纯浏览器零依赖。",
    tech: "Browser · Web",
    live: "projects/mime/",
    docs: "projects/mime/README.md",
    featured: false,
  },
  {
    id: "cidr",
    name: "CIDR 子网计算",
    category: "browser",
    label: "网络计算",
    description:
      "严格 IPv4 / IPv6 子网计算、BigInt 地址计数、包含与重叠检查，以及有界网段拆分。",
    tech: "Browser · IPv6 · Library",
    live: "projects/cidr/",
    docs: "projects/cidr/README.md",
    featured: false,
  },
  {
    id: "ulid",
    name: "ULID 生成 / 解析",
    category: "browser",
    label: "ID 生成",
    description:
      "规范严格的 ULID 生成与解析，强制 Web Crypto，并支持时钟回拨下仍有序的单调模式。",
    tech: "Browser · Crypto · Library",
    live: "projects/ulid/",
    docs: "projects/ulid/README.md",
    featured: false,
  },
  {
    id: "base58",
    name: "Base58 编解码",
    category: "browser",
    label: "文本编码",
    description:
      "Bitcoin 风格 Base58（不含易混字符 0/O/I/l）编解码，纯浏览器零依赖，常用于钱包地址与短标识。",
    tech: "Browser · Encoding",
    live: "projects/base58/",
    docs: "projects/base58/README.md",
    featured: false,
  },
  {
    id: "base32",
    name: "Base32 编解码",
    category: "browser",
    label: "文本编码",
    description:
      "RFC 4648 与 Crockford 两种 Base32 编解码，5-bit 分组、大小写容错，纯浏览器零依赖。",
    tech: "Browser · Encoding",
    live: "projects/base32/",
    docs: "projects/base32/README.md",
    featured: false,
  },
  {
    id: "base85",
    name: "Base85 编解码",
    category: "browser",
    label: "文本编码",
    description:
      "Ascii85 与 Z85 两种 Base85 编解码，4 字节一组紧凑编码，纯浏览器零依赖。",
    tech: "Browser · Encoding",
    live: "projects/base85/",
    docs: "projects/base85/README.md",
    featured: false,
  },
  {
    id: "crc",
    name: "CRC 校验",
    category: "browser",
    label: "校验和计算",
    description:
      "CRC-16/CCITT-FALSE、CRC-16/XMODEM、CRC-16/IBM-ARC、CRC-16/MODBUS 与 CRC-32 计算，纯浏览器零依赖。",
    tech: "Browser · Checksum",
    live: "projects/crc/",
    docs: "projects/crc/README.md",
    featured: false,
  },
  {
    id: "punycode",
    name: "Punycode 域名编码",
    category: "browser",
    label: "国际化域名",
    description:
      "RFC 3492 Punycode 编解码，支持中文与 emoji 域名的 toASCII / toUnicode 转换，纯浏览器零依赖。",
    tech: "Browser · IDN",
    live: "projects/punycode/",
    docs: "projects/punycode/README.md",
    featured: false,
  },
  {
    id: "qrcode",
    name: "二维码生成",
    category: "browser",
    label: "二维码",
    description:
      "生成可缩放 SVG 二维码，支持纠错等级与静区，零依赖纯浏览器，适合离线使用。",
    tech: "Browser · QR Code",
    live: "projects/qrcode/",
    docs: "projects/qrcode/README.md",
    featured: false,
  },
  {
    id: "barcode",
    name: "Code 128 条码",
    category: "browser",
    label: "条码生成",
    description:
      "生成 Code 128（Code B）条码 SVG，覆盖 ASCII 32–127，带校验位与静区，纯浏览器零依赖。",
    tech: "Browser · Barcode",
    live: "projects/barcode/",
    docs: "projects/barcode/README.md",
    featured: false,
  },
  {
    id: "jsonfmt",
    name: "JSON 格式化",
    category: "browser",
    label: "数据美化",
    description:
      "JSON 美化（缩进）、压缩（单行）与仅校验三种模式，错误定位清晰，纯浏览器零依赖。",
    tech: "Browser · Format",
    live: "projects/jsonfmt/",
    docs: "projects/jsonfmt/README.md",
    featured: false,
  },
  {
    id: "colorconv",
    name: "颜色转换",
    category: "browser",
    label: "色彩工具",
    description:
      "HEX ⇄ RGB ⇄ HSL 互转，实时色块预览，支持常见格式解析，纯浏览器零依赖。",
    tech: "Browser · Color",
    live: "projects/colorconv/",
    docs: "projects/colorconv/README.md",
    featured: false,
  },
  {
    id: "morse",
    name: "Morse",
    category: "browser",
    label: "摩斯电码互译",
    description:
      "文本与摩斯电码双向互译，支持字母、数字与常用标点，纯浏览器零依赖。",
    tech: "Browser · Morse",
    live: "projects/morse/",
    docs: "projects/morse/README.md",
    featured: false,
  },
  {
    id: "roman",
    name: "RomanNum",
    category: "browser",
    label: "罗马数字互转",
    description:
      "阿拉伯数字与罗马数字双向转换（1–3999），校验不规范写法，纯浏览器零依赖。",
    tech: "Browser · Roman",
    live: "projects/roman/",
    docs: "projects/roman/README.md",
    featured: false,
  },
  {
    id: "dice",
    name: "DiceBox",
    category: "browser",
    label: "随机数 / 掷骰 / 抽奖",
    description:
      "密码学安全随机：掷多面骰、取整数区间、不重复抽奖，纯浏览器零依赖。",
    tech: "Browser · Web Crypto",
    live: "projects/dice/",
    docs: "projects/dice/README.md",
    featured: false,
  },
  {
    id: "datediff",
    name: "DateDiff",
    category: "browser",
    label: "日期差 / 年龄",
    description:
      "计算两日期相差的年 / 月 / 日与总天数，可算年龄与倒计时，纯浏览器零依赖。",
    tech: "Browser · Date",
    live: "projects/datediff/",
    docs: "projects/datediff/README.md",
    featured: false,
  },
  {
    id: "regex",
    name: "RegexTester",
    category: "browser",
    label: "正则测试器",
    description:
      "实时正则匹配、捕获组高亮与错误提示，纯浏览器零依赖。",
    tech: "Browser · RegExp",
    live: "projects/regex/",
    docs: "projects/regex/README.md",
    featured: false,
  },
  {
    id: "num-base",
    name: "NumBase",
    category: "browser",
    label: "进制转换器",
    description:
      "在 2~36 进制之间互转，并一键查看二/八/十/十六进制结果，纯浏览器零依赖。",
    tech: "Browser · Number",
    live: "projects/num-base/",
    docs: "projects/num-base/README.md",
    featured: false,
  },
  {
    id: "password-generator",
    name: "PassGen",
    category: "browser",
    label: "密码生成器",
    description:
      "Web Crypto 无偏随机与安全洗牌，保证每类字符出现，可批量生成并估算熵强度。",
    tech: "Browser · Crypto · Library",
    live: "projects/password-generator/",
    docs: "projects/password-generator/README.md",
    featured: false,
  },
  {
    id: "timer",
    name: "Timer",
    category: "browser",
    label: "计时器（倒计时 / 秒表）",
    description:
      "倒计时与秒表双模式，支持计次，基于真实时间戳，纯浏览器零依赖。",
    tech: "Browser · Timer",
    live: "projects/timer/",
    docs: "projects/timer/README.md",
    featured: false,
  },
  {
    id: "text-diff",
    name: "TextDiff",
    category: "browser",
    label: "文本差异",
    description:
      "基于 LCS 的逐行对比，标出新增/删除/未变更并汇总，纯浏览器零依赖。",
    tech: "Browser · Diff",
    live: "projects/text-diff/",
    docs: "projects/text-diff/README.md",
    featured: false,
  },
  {
    id: "bmi",
    name: "BMI",
    category: "browser",
    label: "BMI 计算",
    description:
      "计算 BMI 与健康分级，支持中国/WHO 标准并给出健康体重区间，纯浏览器零依赖。",
    tech: "Browser · Health",
    live: "projects/bmi/",
    docs: "projects/bmi/README.md",
    featured: false,
  },
  {
    id: "url-encode",
    name: "URLEncode",
    category: "browser",
    label: "URL 编解码",
    description:
      "百分号编码 / 解码双向转换，可选「空格 → +」表单模式，纯浏览器零依赖。",
    tech: "Browser · Encode",
    live: "projects/url-encode/",
    docs: "projects/url-encode/README.md",
    featured: false,
  },
  {
    id: "html-entity",
    name: "HTMLEntity",
    category: "browser",
    label: "HTML 实体编解码",
    description:
      "HTML 实体（命名 / 十进制 / 十六进制）双向转换，转义与还原文本，纯浏览器零依赖。",
    tech: "Browser · Encode",
    live: "projects/html-entity/",
    docs: "projects/html-entity/README.md",
    featured: false,
  },
  {
    id: "lorem",
    name: "LoremGen",
    category: "browser",
    label: "Lorem 生成器",
    description:
      "按段落 / 句子 / 单词生成 Lorem Ipsum 占位文本，数量可调，纯浏览器零依赖。",
    tech: "Browser · Text",
    live: "projects/lorem/",
    docs: "projects/lorem/README.md",
    featured: false,
  },
  {
    id: "contrast",
    name: "Contrast",
    category: "browser",
    label: "对比度检查 (WCAG)",
    description:
      "计算前景 / 背景色 WCAG 2.1 对比度，判定 AA / AAA 可读性，纯浏览器零依赖。",
    tech: "Browser · Color",
    live: "projects/contrast/",
    docs: "projects/contrast/README.md",
    featured: false,
  },
  {
    id: "json-diff",
    name: "JSONDiff",
    category: "browser",
    label: "JSON 结构差异",
    description:
      "逐路径比较两个 JSON，标注新增 / 删除 / 修改，纯浏览器零依赖。",
    tech: "Browser · JSON",
    live: "projects/json-diff/",
    docs: "projects/json-diff/README.md",
    featured: false,
  },
  {
    id: "unicode",
    name: "UnicodeView",
    category: "browser",
    label: "Unicode 码点查看",
    description:
      "逐字符查看 Unicode 码点、UTF-8 / UTF-16 编码与类别，纯浏览器零依赖。",
    tech: "Browser · Unicode",
    live: "projects/unicode/",
    docs: "projects/unicode/README.md",
    featured: false,
  },
  {
    id: "agent-trace",
    name: "Agent Trace",
    category: "cli",
    label: "本地 Agent 会话分析",
    description:
      "Analyze Codex, Claude Code, and generic JSONL traces for tokens, tool latency, repeated reads, and failure loops without exposing prompt bodies.",
    tech: "Node.js · JSONL · Local-first",
    docs: "projects/agent-trace/README.md",
    featured: true,
  },
  {
    id: "skill-sentry",
    name: "Skill Sentry",
    category: "cli",
    label: "Agent Skill 安全扫描",
    description:
      "Scan SKILL.md packages for prompt injection, exfiltration, hidden Unicode, destructive commands, unsafe references, and supply-chain risk.",
    tech: "Node.js · Security · SARIF",
    docs: "projects/skill-sentry/README.md",
    featured: true,
  },
  {
    id: "hash",
    name: "HashLab",
    category: "browser",
    label: "Hash 校验台",
    description:
      "计算文本 / 文件的 MD5、SHA 系列摘要与 HMAC，纯浏览器零依赖。",
    tech: "Browser · Web Crypto",
    live: "projects/hash/",
    docs: "projects/hash/README.md",
    featured: false,
  },
  {
    id: "base64-image",
    name: "Base64Image",
    category: "browser",
    label: "图片 Base64",
    description:
      "图片与 Base64 Data URL 互转，支持拖入与下载，纯浏览器零依赖。",
    tech: "Browser · Image",
    live: "projects/base64-image/",
    docs: "projects/base64-image/README.md",
    featured: false,
  },
  {
    id: "gradient",
    name: "GradientLab",
    category: "browser",
    label: "渐变生成器",
    description:
      "生成线性 / 径向 CSS 渐变，多色标可调，纯浏览器零依赖。",
    tech: "Browser · CSS",
    live: "projects/gradient/",
    docs: "projects/gradient/README.md",
    featured: false,
  },
  {
    id: "semver",
    name: "SemverCheck",
    category: "browser",
    label: "SemVer 检查",
    description:
      "严格校验、精确排序 SemVer 2.0，并支持常用范围语法与预发布规则。",
    tech: "Browser · SemVer · Library",
    live: "projects/semver/",
    docs: "projects/semver/README.md",
    featured: false,
  },
  {
    id: "cron-maker",
    name: "CronMaker",
    category: "browser",
    label: "Cron 构建器",
    description:
      "可视化构建 5 字段 Cron 表达式并生成中文描述，纯浏览器零依赖。",
    tech: "Browser · Cron",
    live: "projects/cron-maker/",
    docs: "projects/cron-maker/README.md",
    featured: false,
  },
  {
    id: "color-palette",
    name: "PaletteLab",
    category: "browser",
    label: "配色生成器",
    description:
      "基于基准色生成互补 / 近似 / 三元等调色板，纯浏览器零依赖。",
    tech: "Browser · Color",
    live: "projects/color-palette/",
    docs: "projects/color-palette/README.md",
    featured: false,
  },
  {
    id: "http-codes",
    name: "HTTPCodes",
    category: "browser",
    label: "HTTP 状态码速查",
    description:
      "覆盖 1xx–5xx 状态码，支持实时搜索与一键复制，纯浏览器零依赖。",
    tech: "Browser · HTTP",
    live: "projects/http-codes/",
    docs: "projects/http-codes/README.md",
    featured: false,
  },
  {
    id: "query-parse",
    name: "QueryParse",
    category: "browser",
    label: "查询参数解析",
    description:
      "无损解析与重建 URL 查询串，保留重复键、flag / 空值差异和 fragment。",
    tech: "Browser · URL · Library",
    live: "projects/query-parse/",
    docs: "projects/query-parse/README.md",
    featured: false,
  },
  {
    id: "nanoid",
    name: "NanoID",
    category: "browser",
    label: "ID / Token 生成器",
    description:
      "基于 Web Crypto 的安全随机 ID，自定义字母表与批量生成，纯浏览器零依赖。",
    tech: "Browser · Web Crypto",
    live: "projects/nanoid/",
    docs: "projects/nanoid/README.md",
    featured: false,
  },
  {
    id: "cipher",
    name: "CipherLab",
    category: "browser",
    label: "古典密码",
    description:
      "Caesar / ROT13 / Atbash / Vigenère / Base64 编解码，纯浏览器零依赖。",
    tech: "Browser · Cipher",
    live: "projects/cipher/",
    docs: "projects/cipher/README.md",
    featured: false,
  },
  {
    id: "yaml-json",
    name: "YamlFlow",
    category: "browser",
    label: "YAML ⇄ JSON",
    description:
      "严格 YAML block 子集与 JSON 互转，行号错误、重复键检测与原型污染防护。",
    tech: "Browser · YAML · Library",
    live: "projects/yaml-json/",
    docs: "projects/yaml-json/README.md",
    featured: false,
  },
  {
    id: "html-preview",
    name: "HTMLPreview",
    category: "browser",
    label: "HTML 实时预览",
    description:
      "左侧写 HTML、右侧隔离 iframe 即时渲染，可下载 .html，纯浏览器零依赖。",
    tech: "Browser · HTML",
    live: "projects/html-preview/",
    docs: "projects/html-preview/README.md",
    featured: false,
  },
  {
    id: "chart-maker",
    name: "ChartForge",
    category: "browser",
    label: "图表生成器",
    description:
      "纯 SVG 生成柱状 / 折线 / 饼图，可下载矢量 .svg，纯浏览器零依赖。",
    tech: "Browser · SVG",
    live: "projects/chart-maker/",
    docs: "projects/chart-maker/README.md",
    featured: false,
  },
  {
    id: "mock-data",
    name: "MockGen",
    category: "browser",
    label: "假数据生成",
    description:
      "中 / 英词表生成虚构人员数据，支持 JSON / CSV 导出，纯浏览器零依赖。",
    tech: "Browser · Data",
    live: "projects/mock-data/",
    docs: "projects/mock-data/README.md",
    featured: false,
  },
  {
    id: "ini-json",
    name: "IniFlow",
    category: "browser",
    label: "INI ⇄ JSON",
    description:
      "INI 配置与 JSON 互转，支持分段与类型推断，纯浏览器零依赖。",
    tech: "Browser · INI",
    live: "projects/ini-json/",
    docs: "projects/ini-json/README.md",
    featured: false,
  },
  {
    id: "lorem-ipsum",
    name: "LoremGen",
    category: "browser",
    label: "Lorem Ipsum",
    description:
      "生成 Latin / 中文占位文段，可调段落与句数，纯浏览器零依赖。",
    tech: "Browser · Text",
    live: "projects/lorem-ipsum/",
    docs: "projects/lorem-ipsum/README.md",
    featured: false,
  },
  {
    id: "markdown-preview",
    name: "MDView",
    category: "browser",
    label: "Markdown 预览",
    description:
      "轻量 Markdown 子集渲染（已转义 + 链接校验），输入即预览，纯浏览器零依赖。",
    tech: "Browser · Markdown",
    live: "projects/markdown-preview/",
    docs: "projects/markdown-preview/README.md",
    featured: false,
  },
  {
    id: "diff-text",
    name: "DiffLab",
    category: "browser",
    label: "文本对比 Diff",
    description:
      "逐行 LCS 差异对比，字符级内联高亮，纯浏览器零依赖。",
    tech: "Browser · Diff",
    live: "projects/diff-text/",
    docs: "projects/diff-text/README.md",
    featured: false,
  },
  {
    id: "port-origin",
    name: "Port Origin",
    category: "cli",
    label: "端口与进程溯源",
    description:
      "Trace a listening port or PID to its command, owner, parent-process chain, and runtime hints across Windows, Linux, and macOS.",
    tech: "Node.js · Process · Cross-platform",
    docs: "projects/port-origin/README.md",
    featured: true,
  },
  {
    id: "mcp-probe",
    name: "MCP Probe",
    category: "cli",
    label: "只读 MCP 能力检查",
    description:
      "Initialize an MCP stdio server, list advertised capabilities, measure latency, and flag risky metadata without invoking tools or reading resources.",
    tech: "Node.js · MCP · JSON-RPC · SARIF",
    docs: "projects/mcp-probe/README.md",
    featured: true,
  },
  {
    id: "passphrase",
    name: "Passphrase",
    category: "browser",
    label: "助记词口令生成",
    description:
      "Diceware 风格助记词口令：从 256 词表随机拼词，易记且高熵，实时显示熵估值与强度，纯浏览器零依赖。",
    tech: "Browser · Security",
    live: "projects/passphrase/",
    docs: "projects/passphrase/README.md",
    featured: false,
  },
  {
    id: "svgfmt",
    name: "SvgFmt",
    category: "browser",
    label: "SVG 压缩 / 美化",
    description:
      "SVG 源码一键压缩（去注释、去冗余空白）或美化（缩进排版），实时显示字节节省，纯浏览器零依赖。",
    tech: "Browser · SVG",
    live: "projects/svgfmt/",
    docs: "projects/svgfmt/README.md",
    featured: false,
  },
  {
    id: "numwords",
    name: "NumWords",
    category: "browser",
    label: "数字转英文单词",
    description:
      "把整数写成英文单词（如 1234 → one thousand, two hundred and thirty-four），支持负数与英式 and，纯浏览器零依赖。",
    tech: "Browser · Number",
    live: "projects/numwords/",
    docs: "projects/numwords/README.md",
    featured: false,
  },
  {
    id: "jsonpath",
    name: "JSONPath Explorer",
    category: "browser",
    label: "JSON 路径查询",
    description:
      "安全查询 JSON 的属性、索引、通配符与递归路径，同时返回每个匹配值的精确位置；无 eval，数据不离开浏览器。",
    tech: "Browser · JSONPath",
    live: "projects/jsonpath/",
    docs: "projects/jsonpath/README.md",
    featured: false,
  },
  {
    id: "openapi-lab",
    name: "OpenAPI Lab",
    category: "browser",
    label: "本地 API 契约浏览与代码生成",
    description:
      "导入 OpenAPI 3.0/3.1 JSON 或 YAML，检查结构、浏览接口，并生成带参数、请求体和认证占位符的 curl、Fetch 与 Python 代码。",
    tech: "Browser · OpenAPI · Local-first",
    live: "projects/openapi-lab/",
    docs: "projects/openapi-lab/README.md",
    featured: true,
  },
  {
    id: "har-viewer",
    name: "HAR Viewer",
    category: "browser",
    label: "Local network waterfall and diagnostics",
    description:
      "Inspect HAR 1.2 captures locally with request filters, phase waterfalls, performance findings, safe CSV output, and a redacted HAR export that strips bodies and secrets.",
    tech: "Browser · HAR · Performance · Privacy",
    live: "projects/har-viewer/",
    docs: "projects/har-viewer/README.md",
    featured: true,
  },
  {
    id: "sbom-atlas",
    name: "SBOM Atlas",
    category: "browser",
    label: "Local CycloneDX and SPDX supply-chain explorer",
    description:
      "Normalize, diagnose, filter, trace, and compare CycloneDX or SPDX inventories locally, with metadata coverage, dependency paths, VEX context, and safe CSV export.",
    tech: "Browser · SBOM · CycloneDX · SPDX",
    live: "projects/sbom-atlas/",
    docs: "projects/sbom-atlas/README.md",
    featured: true,
  },
  {
    id: "sarif-compass",
    name: "SARIF Compass",
    category: "browser",
    label: "Local SARIF triage, comparison, and privacy cleaning",
    description:
      "Unify SARIF 2.1.0 runs, inspect rules and code flows, filter baselines and suppressions, compare scans, and export privacy-clean reports or safe CSV locally.",
    tech: "Browser · SARIF · AppSec · Local-first",
    live: "projects/sarif-compass/",
    docs: "projects/sarif-compass/README.md",
    featured: true,
  },
  {
    id: "oci-image-inspector",
    name: "OCI Image Inspector",
    category: "browser",
    label: "Sparse local Docker and OCI archive analysis",
    description:
      "Inspect Docker save and OCI image-layout tar metadata without loading or extracting layers; review history, runtime config, baked secrets, users, sizes, tags, and provenance.",
    tech: "Browser · OCI · Docker · Supply chain",
    live: "projects/oci-image-inspector/",
    docs: "projects/oci-image-inspector/README.md",
    featured: true,
  },
];

const CATEGORY_NAMES = {
  all: "All",
  browser: "Browser",
  cli: "CLI",
  "local-ai": "Local AI",
};

function matchesTool(tool, query, category) {
  const categoryMatch = category === "all" || tool.category === category;
  const haystack =
    `${tool.name} ${tool.label} ${tool.description} ${tool.tech}`.toLowerCase();
  return categoryMatch && (!query || haystack.includes(query.toLowerCase()));
}

function toolCard(tool) {
  const primary = tool.live
    ? `<a class="button primary" href="${tool.live}">Open tool <span aria-hidden="true">↗</span></a>`
    : `<a class="button primary" href="${tool.docs}">Read docs <span aria-hidden="true">→</span></a>`;
  const secondary = tool.live
    ? `<a class="button ghost" href="${tool.docs}">Docs</a>`
    : `<a class="button ghost" href="${tool.docs.replace("README.md", "")}">Source</a>`;
  return `<article class="tool-card${tool.featured ? " featured" : ""}" data-category="${tool.category}">
    <div class="card-top"><span class="category">${CATEGORY_NAMES[tool.category]}</span>${tool.featured ? '<span class="signal">Featured</span>' : ""}</div>
    <h2>${tool.name}</h2><p class="label">${tool.label}</p><p class="description">${tool.description}</p>
    <div class="tech">${tool.tech}</div><div class="actions">${primary}${secondary}</div>
  </article>`;
}

function startPortal(documentObject) {
  const grid = documentObject.querySelector("#tool-grid");
  const search = documentObject.querySelector("#search");
  const count = documentObject.querySelector("#visible-count");
  let category = "all";
  function render() {
    const visible = TOOLS.filter((tool) =>
      matchesTool(tool, search.value.trim(), category),
    );
    grid.innerHTML =
      visible.map(toolCard).join("") ||
      '<div class="empty">No tool matches this filter.</div>';
    count.textContent = String(visible.length);
  }
  search.addEventListener("input", render);
  documentObject.querySelectorAll("[data-filter]").forEach((button) =>
    button.addEventListener("click", () => {
      category = button.dataset.filter;
      documentObject
        .querySelectorAll("[data-filter]")
        .forEach((item) =>
          item.setAttribute("aria-pressed", String(item === button)),
        );
      render();
    }),
  );
  render();
}

if (typeof document !== "undefined") startPortal(document);
if (typeof module !== "undefined")
  module.exports = { CATEGORY_NAMES, TOOLS, matchesTool, toolCard };
