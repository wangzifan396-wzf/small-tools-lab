# ULID 生成 / 解析

零依赖、可离线运行的 [ULID](https://github.com/ulid/spec) 工具。生成按时间排序、26 字符的通用唯一标识符，或解析已有的 ULID。

## 功能
- 生成 ULID：基于当前时间（或自定义毫秒时间戳），随机部分使用密码学安全随机源
- 解析 ULID：还原时间戳、对应时间与 80-bit 随机熵（hex）
- Crockford Base32 字母表（无 I/L/O/U），大小写规范化为大写
- 校验：长度 26、字符集合法

## 用法
打开 `index.html`：
- 「生成」：点按钮得到新 ULID，可填时间戳复现；「复制」复制结果
- 「解析」：粘贴 ULID 查看时间戳与时间

## 实现
- `src/ulid.js`：UMD 模块，导出 `generate / decode / isValid / ALPHABET`（用 BigInt 处理 48/80-bit 字段）
- `tests/ulid.test.js`：5 个用例（格式、时间戳 0、固定时间戳往返、规范向量结构、合法性）

## 注意
ULID 的时间部分为毫秒时间戳，可排序但**不保证严格单调**（无锁情况下高并发可能重复时间戳）；如需严格单调请使用带单调保护的实现。
