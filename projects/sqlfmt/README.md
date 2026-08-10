# SQL Formatter

A lexically safe, zero-dependency SQL whitespace formatter and minifier for common SQL syntax.

[Open the browser tool](https://wangzifan396-wzf.github.io/small-tools-lab/projects/sqlfmt/) · [Security notes](SECURITY.md)

## Lexer coverage

- SQL-standard doubled single and double quotes
- MySQL backtick and SQL Server bracket identifiers
- PostgreSQL dollar-quoted strings
- Positional and named placeholders (`?`, `$1`, `:name`, `@name`)
- Line comments, nested block comments, and optimizer hints
- JSON, cast, comparison, concatenation, and assignment operators
- Unicode identifiers, numeric literals, and balanced-parenthesis validation

Formatting is deterministic and idempotent. Keyword case and indentation are configurable. Minification preserves comments by default because hints and executable comments may affect behavior; removal requires an explicit option.

## Library API

```js
import { formatSql, minifySql, tokenizeSql } from './src/index.js';

formatSql('select id,name from users where active=true');
formatSql(sql, { keywordCase: 'lower', indent: 4 });
minifySql(sql, { removeComments: false });
tokenizeSql(sql);
```

TypeScript declarations and compatibility aliases (`format`, `minify`) are included.

This is a whitespace formatter, not a dialect-complete parser or validator. Review vendor-specific procedural SQL and production migrations after formatting.

## Develop

```bash
npm test
npm start -- 4173
```
