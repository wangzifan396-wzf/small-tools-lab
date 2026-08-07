# SQL 格式化 / 压缩

零依赖、纯前端的 SQL 排版工具。把挤在一行的 SQL 整理成易读的缩进结构，或压缩成单行。

## 功能
- **格式化**：关键字大写（`SELECT` / `FROM` / `WHERE` …），主子句（`SELECT` / `FROM` / `WHERE` / `JOIN` / `GROUP BY` / `ORDER BY` …）各占一行，`AND` / `OR` 条件二次缩进。
- **压缩**：去除多余空白、统一 `,` `;` `=` 两侧空格。
- **安全**：字符串字面量（`'...'` / `"..."` / `` `...` ``）与注释（`--` / `/* */`）原样保留，不会被误当成关键字大写。
- 数据完全在浏览器本机处理，不上传任何内容。

## 用法
打开 `index.html`，粘贴 SQL，点「格式化」或「压缩」。

## 示例
输入：
```sql
select id,name from users where age>18 and active=1 order by name desc
```
格式化后：
```sql
SELECT id,name
FROM users
WHERE age>18
  AND active=1
ORDER BY name DESC
```

## 实现
`src/sqlfmt.js`，UMD 模块，导出 `format` 与 `minify`，无第三方依赖。`node --test` 覆盖关键字、连接、字符串保护与压缩用例。
