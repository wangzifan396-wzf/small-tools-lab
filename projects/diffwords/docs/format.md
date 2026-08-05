# Output formats

Every `diff()` call returns a `DiffResult`:

```ts
interface DiffResult {
  ops: Op[];          // token-level operations
  stats: DiffStats;
}

type Op = { type: 'equal' | 'insert' | 'delete'; tokens: Token[] };

interface DiffStats {
  unchanged: number; // equal tokens
  added: number;     // inserted tokens
  removed: number;   // deleted tokens
  total: number;     // unchanged + added + removed
  changeRatio: number; // (added + removed) / total
  similarity: number;  // unchanged / total, 0..1
}
```

`Token` is `{ value: string, type: 'space' | 'cjk' | 'word' | 'punct' }`.

## `formatInline(result, { color })`

Default terminal view. Equal text is printed as-is; deletions are struck
through in red; insertions are in green. With `color: false` the ANSI codes are
omitted (handy for logs). Adjacent operations of the same kind are merged, so a
one-word change reads naturally.

```
The quick brown fox jumps␛[9m␛[31mleaps␛[0m over the lazy dog.
```

## `formatUnified(result, { context, aLabel, bLabel })`

Classic unified diff. The token diff is projected back onto lines, then a
line-level LCS produces `@@ -a,b +c,d @@` hunks with `context` lines of
surrounding text (default 3). Empty when the texts are identical.

```
--- a
+++ b
@@ -1,3 +1,3 @@
-The quick brown fox jumps over the lazy dog.
+The quick brown fox leaps over the lazy dog.
 We shipped the feature last week and it worked well.
```

## `formatHtml(result, { mode })`

A standalone, styled HTML document (`mode: 'inline'` by default, or
`'side'` for a two-column table). Inline mode wraps deletions in `<del>` and
insertions in `<ins>`; side-by-side paints removed lines on the left and added
lines on the right. Open it directly in a browser or embed it in a review tool.

## `formatJson(result)`

```json
{
  "tool": "diffwords",
  "stats": { "unchanged": 8, "added": 1, "removed": 1, "total": 10, "changeRatio": 0.2, "similarity": 0.8 },
  "ops": [
    { "type": "equal", "value": "The quick brown fox " },
    { "type": "delete", "value": "jumps" },
    { "type": "insert", "value": "leaps" },
    { "type": "equal", "value": " over the lazy dog." }
  ]
}
```

## Exit codes (CLI)

| Code | Meaning                                |
| ---- | -------------------------------------- |
| `0`  | texts are identical                   |
| `1`  | texts differ (the normal diff result) |
| `2`  | usage error (missing arguments, etc.) |
