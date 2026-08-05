# Leafnote feature reference

A deeper look at what Leafnote supports and how each feature is implemented.

## Markdown support

The renderer (`src/markdown.js`) is a small hand-written parser — block-level
first, then inline. It covers:

| Element      | Syntax                                              |
| ------------ | --------------------------------------------------- |
| Heading      | `#` … `######`                                      |
| Bold         | `**text**`                                          |
| Italic       | `*text*`                                            |
| Strikethrough| `~~text~~`                                          |
| Inline code  | `` `code` ``                                        |
| Fenced code  | ```` ```lang ```` … ```` ``````                     |
| Link         | `[text](https://example.com)`                       |
| Image        | `![alt](https://example.com/i.png)`                |
| Blockquote   | `> quote` (multi-line)                              |
| List         | `-` / `*` / `+` (ul), `1.` (ol)                     |
| Task list    | `- [ ]` / `- [x]`                                   |
| Table        | `\| a \| b \|` with a `\| --- \| --- \|` divider   |
| Horizontal rule | `---`, `***`, or `___` (3+ of one char)          |
| Wiki-link    | `[[Note Title]]` or `[[Note Title|alias]]`          |
| Tag          | `#tag` (skips `#fff` hex colors and headings)       |

## Wiki-links & backlinks

- `[[Title]]` renders as a clickable link. Clicking navigates to that note,
  creating it (with a `# Title` heading) if it does not exist yet.
- Backlinks are computed by scanning every note's body for `[[...]]` whose
  target matches the current note's normalized title (case- and
  whitespace-insensitive). See `src/search.js → backlinks`.

## Tags

- Tags are detected with a Unicode-aware regex so `#中文标签` works too.
- Hex colors like `#fff` and Markdown headings (`# Heading`) are excluded.
- The sidebar shows a global tag cloud with per-tag note counts; clicking a
  tag filters the note list.

## Search

- `rankNotes(notes, query)` splits the query into terms and requires **all**
  terms to match (AND). Title matches score higher than body matches, and
  prefix title matches score even higher. Results are sorted by score, then
  alphabetically.

## Storage & backup

- Notes persist to `localStorage` under the key `leafnote:v1` as versioned
  JSON (`serialize` / `deserialize` in `src/store.js`).
- **Backup JSON** exports the full array; **Import** merges an incoming
  backup by note `id` (existing ids are updated, new ones appended).
- `.md` import creates one note per file, using the filename (minus
  extension) as the title and the file contents as the body.

## Security model

- Every piece of user text is escaped via `escapeHtml` before being inserted
  as HTML.
- URLs in links/images are passed through `sanitizeUrl`, which rewrites
  `javascript:`, `data:`, and `vbscript:` schemes to `#`.
- The app makes **no network requests**; it is fully local-first.

## Theming

- `src/theme.js` reads `leafnote:theme` from `localStorage`, falling back to
  the OS `prefers-color-scheme`. Toggling writes the choice back so it
  persists across sessions.
