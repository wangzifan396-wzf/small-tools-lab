# Regex Visualizer

Zero-dependency regular-expression explainer. Turn a pattern into a
token-by-token human explanation, find every match in your text, and render an
HTML-safe highlighted preview — in the CLI and the browser. No native build, no
network, works in Node and the browser the same way.

## CLI

```bash
node bin/regex-visualizer.js --explain "\d{3}-\d{4}"   # token explanation
node bin/regex-visualizer.js "\b\w+\b" "hello world 123" g   # find matches
```

`--explain` prints each token with `raw`, `kind`, and a `meaning`. Match mode
prints match count, each match's span and captured groups, and an HTML highlight
preview. The `g` flag toggles global matching; highlighting always finds all
matches internally.

## Library

```js
import { explain, findMatches, highlight } from './src/index.js';

explain('^(\\d{3})-[a-z]+$').tokens;   // [{ raw, kind, meaning }, ...]
findMatches('a1 b2', '\\w\\d', 'g');   // { matches, namedGroups, capped }
highlight('a<b>c', 'b');               // 'a<mark>b</mark>c' (HTML-escaped)
```

Handles anchors `^ $ \b \B`, character classes `[...]`, groups `( ) (?: )
(?<name>)` and lookarounds, quantifiers `* + ? {n,m}` with lazy variants,
alternation `|`, escapes `\d \w \s \n \t`, and backreferences. Bad patterns
return `{ error }` instead of throwing.

## Browser

Run `npm start`, then open <http://localhost:4173/>. The hosted version is
available from the [Small Tools Lab catalog](https://wangzifan396-wzf.github.io/small-tools-lab/).
The browser keeps the pattern and sample text in memory only.

## Test

```bash
npm test     # node --test, zero dependencies
```
