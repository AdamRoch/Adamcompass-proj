# Decision 02 — Editor & Content Storage Format

**Status:** Accepted | **Date:** 2026-05-22 | **Owner:** Compass build (week 1)
**Scope:** Rich-text content storage for `note.body`, `project.prd_body`, `learning_goal.body`, and any future free-text field a human types into the app.

---

## TL;DR

We are storing rich content as **Markdown in a `TEXT` column** and editing it with a **plain `<textarea>` plus a live Markdown preview** in week 1.

We considered four options. This document exists because the storage half is a **one-way door** — once a month of capture data is in the DB in some format, migrating off that format is expensive and lossy. We want the reasoning recorded so future-you understands the trade space and knows exactly which signals justify climbing the editor ladder later.

The four options, ordered roughly by commitment level:

1. **Markdown TEXT + textarea + live preview** — chosen.
2. **Markdown TEXT + CodeMirror 6** (markdown mode, optional Vim bindings).
3. **Markdown TEXT + Tiptap WYSIWYG** with the Markdown extension.
4. **ProseMirror JSON + full Tiptap WYSIWYG.**

Options 1, 2, and 3 share a storage format — switching between them later is an editor swap with no schema migration. Option 4 is a different storage format and is what we are explicitly buying optionality *out of* by choosing option 1.

---

## Why this decision matters more than it looks

It looks like an editor question. It is actually a storage question dressed up as an editor question.

The editor is a week-long bet. The schema is a multi-year bet. The dual-DB constraint (SQLite ↔ Postgres swappable via env var) means the rich-content storage format must be portable across two engines whose JSON stories diverge (SQLite `JSON1`; Postgres `jsonb`; different indexing). The search abstraction indexes the content column — FTS5 and `tsvector` both want plain text, not nested JSON. The export-from-MVP requirement (PRD §8) means whatever lands in the column has to round-trip to a `.md` file without fidelity loss.

So the four options collapse into two storage families:

- **Family A (options 1, 2, 3):** Markdown TEXT. Editor is a UI concern, freely swappable.
- **Family B (option 4):** ProseMirror JSON. Editor *is* the schema.

Family A is reversible. Family B is one-way. That asymmetry, more than any UX consideration, drives the recommendation.

---

## Option 1 — Markdown TEXT + textarea + live preview (chosen)

### Storage
A plain `TEXT` column. Identical schema in SQLite and Postgres. Rows are exactly what the user typed, byte-for-byte. No serializer in the pipeline, no format version to track.

### Search
Trivial. FTS5 and `tsvector` both index the column directly. The corpus *is* the content; no rich-doc extraction step. When we later highlight matches, we highlight raw markdown — which the user reads comfortably.

### Export
The `.md` file is `fs.writeFile(path, row.body)`. PRD §8 satisfied by a `cat`. JSON export is `{ body: row.body }`. No fidelity loss because no transform.

### Editor UX
A `<textarea>` with monospace font, sensible defaults (tab-to-indent intercepted in JS, smart bullet continuation, autosave-on-blur). Below it, a `markdown-it` live preview. Split-pane on desktop; preview-with-edit-toggle on mobile.

This is exactly the IDE-paste-results pattern Compass needs. The CLI workflow is "I just ran `claude code` and got 200 lines of markdown — paste this into the project log." A textarea handles that without thinking. A rich editor either does the right thing (Tiptap *sometimes*), the wrong thing (pastes as plain text and you lose code fences), or the surprising thing (Tiptap renders your markdown as styled HTML, then on copy-out you get HTML, not the markdown you put in). Textarea is invisible — what goes in comes back out.

Keyboard ergonomics: arrow keys move characters, not blocks. Backspace deletes characters, not nodes. No invisible block-cursor state. More important than it sounds for capture-first usage.

### Mobile PWA
Textarea is the *best* mobile rich-text experience available, by a wide margin. On-screen keyboard, autocorrect, prediction, select-and-paste all work correctly. No contentEditable selection-jumping, no caret-vanishing-into-an-empty-block bug. Rich editors on mobile are functional but plagued by small papercuts (keyboard popping the viewport, cursor landing in the wrong inline node after autocorrect, toolbar competing with the keyboard).

### Week-1 implementation cost
- Textarea component (autosize, tab-intercept): 1 hour.
- Live preview (`markdown-it` + `DOMPurify` + CSS pass): 2 hours.
- Split-pane / mobile mode toggle: 1 hour.
- Total: **half a day**.

### Footprint
`markdown-it` ~40 KB gz, `DOMPurify` ~20 KB gz, lazy-loaded on the editor route only. Zero new schema, zero migrations, zero new build steps. Maintenance surface: one component, two mature dependencies.

### Extensibility
Real talk: weak on paper. No slash menu, no drag handles, no tables-by-typing, no inline mentions. If you want any of those, you swap the editor — which is fine, because the *storage* doesn't change. That's the entire point.

What you *do* get for free: every IDE keyboard shortcut the user already knows, markdown tables that render in preview, and clean paste from any markdown source.

### Failure modes
- **Pasted markdown table:** Lands as raw markdown, renders correctly. Best case.
- **Pasted from Word / Google Docs:** Plain text or HTML chunks; recoverable since the user can see and edit what's there.
- **Embedded base64 images:** Land as `![](data:image/png;base64,…)` blobs. Mitigation: 256 KB row cap.
- **Invalid markdown:** Preview shows what the parser thinks; user fixes it. Self-correcting.
- **Corrupted bytes:** Recoverable — value is human-readable. Contrast with corrupted JSON, which loads as `null`.

### Migration cost out of this option
Trivial. → CodeMirror or → Tiptap reads from the same column. → ProseMirror JSON requires a one-time parse-and-convert (Tiptap does this in a Node script); the new schema *adds* a `body_json` column while `body_markdown` stays as a write-through fallback during transition. Lowest-cost-to-leave of the four.

---

## Option 2 — Markdown TEXT + CodeMirror 6 (markdown mode)

CodeMirror 6 is the modern, modular successor to CodeMirror 5. Used by Obsidian (in the source-mode editor), Replit, Sourcegraph, and large parts of the Jupyter ecosystem. It is what a "serious" markdown editor looks like.

### Storage / Search / Export
All identical to option 1 — same `TEXT` column, same indexing, same byte-for-byte round-trip. Dual-DB-clean.

### Editor UX
Where it earns its keep: real markdown syntax highlighting, smart list continuation (Enter in `- ` adds a bullet; Enter on empty bullet ends the list), bracket/quote matching, code-fence-aware editing (TS highlighting inside `\`\`\`ts`), optional Vim/Emacs keymaps via official extensions (`dd`, `ciw`, `:%s/foo/bar/g` all work), indentation guides, search-and-replace, multi-cursor, strong accessibility.

For someone with terminal habits this is "home." For everyone else it's a power-user surface that may feel chilly.

### Mobile PWA
Mid. Touch mode exists, but it's still a contentEditable code editor — virtual keyboard, autocorrect, and selection have the usual rough edges. Not awful, but markedly worse than a textarea for phone capture.

### Week-1 cost
Install + setup + Vim mode + preview + mobile fallback: **1 to 1.5 days**. The ~half-day differential vs option 1 sounds small but is real in a 7-day budget.

### Footprint
~200–300 KB gz for a markdown editor with one theme; +~80 KB for Vim. 5–8 packages to track vs 2. Well-maintained.

### Extensibility
Strong as a code/markdown editor; weak as a doc editor. Not the right substrate for slash menus, drag handles, embeds, or block UI — that's Tiptap's territory. If you want those, you switch, not extend.

### Failure modes
- **Paste from Word:** Pastes as plain text (it's a code editor; no HTML parsing). Right behavior for markdown.
- **Pasted markdown table:** Raw text, highlighted as markdown. Looks great.
- **Bundle bloat over time:** Real risk if you start adding language modes. Audit periodically.

### Migration cost out of this option
Same column, so swapping CodeMirror → Tiptap or back to textarea is UI-only. Storage doesn't move.

---

## Option 3 — Markdown TEXT + Tiptap WYSIWYG with the Markdown extension

Tiptap is a high-level wrapper around ProseMirror. The Markdown extension serializes the ProseMirror document tree to markdown on save and parses markdown to a ProseMirror tree on load.

### Storage
Still `TEXT`, still markdown — schema unchanged from option 1. *But* the storage is no longer "the bytes the user typed." It's "the bytes Tiptap's serializer produced after round-tripping through ProseMirror." Meaningful distinction, see failure modes.

### Search
Effectively identical to option 1 — column is still markdown text. *Caveat:* the markdown may be Tiptap's serialized version, not what the user typed (`===` underline headings become `#`; lists normalize indentation; `__bold__` becomes `**bold**`). Search still works; in practice fine.

### Export
Export is byte-faithful to the DB, which is byte-faithful to what Tiptap serialized. Users get "Tiptap-flavored markdown" — a clean dialect that re-imports into Obsidian, IA Writer, GitHub Gist correctly (CommonMark + GFM). Some rough edges around tables, task lists, and inline HTML — Tiptap's serializer is opinionated.

### Editor UX
Genuinely nice. Headings render as you type, bullets as bullets, bold as bold. Slash menu (`/heading`, `/bullet`, `/code`), floating toolbar, bubble menu, drag handles, `@`-mentions. For a non-technical user editing a long-form PRD, this is the most pleasant option.

For *capture-first* usage — paste markdown from the CLI, type a quick note, dump some thoughts — it is meaningfully *worse* than a textarea or CodeMirror. ContentEditable quirks, round-trip can mangle whitespace, copy-out gives you HTML, not markdown.

### Mobile PWA
Functional. Tiptap is widely deployed on mobile (Notion-style editors). Standard issues: virtual keyboard, autocorrect landing the cursor in the wrong inline mark, toolbar competing with the keyboard. Not unusable; not as smooth as a textarea.

### Week-1 cost
Tiptap is opinionated and needs real setup: install + SSR wiring for App Router (`useEditor` is client-only) + styling-from-scratch (Tiptap ships no defaults) + round-trip test for tables/fences/task-lists + mobile-fallback decision: **2 to 3 days**. Real chunk of the week-1 budget for a payoff that doesn't help capture-first scope.

### Footprint
~250 KB gz baseline (core + StarterKit + Markdown extension); 400–500 KB with the typical extensions a real editor wants. Multiple ProseMirror packages underneath. Major version bumps require non-trivial editor migration.

### Extensibility
Strongest of the markdown-TEXT options. Tiptap is *designed* for extension: custom nodes/marks, slash commands, drag handles, Yjs collab cursors, embeds, mentions, suggestions. If the editor grows into a real composition surface, Tiptap is the obvious substrate.

### Failure modes
- **Round-trip drift:** User types markdown, Tiptap parses → ProseMirror → re-serializes on save. Output may not match input byte-for-byte (`*emphasis*` becomes `_emphasis_`; indented code becomes fenced). Usually harmless, occasionally surprising. Reported widely.
- **Paste from Word / Google Docs:** Tiptap parses HTML via input rules. OK for prose; tables and images land weirdly; inline styles stripped. Sometimes the paste produces a state the serializer can't fully represent → "best-effort" markdown.
- **Pasted markdown table or CLI output with code fences:** Correctly handled. One of Tiptap's better cases.
- **Divergent serializers between versions:** v2.x → v3.x may produce different markdown for the same input; old documents drift on next-save. Mitigation: version-pin and migrate deliberately.
- **Lost formatting on rich paste:** Biggest real-world failure. User pastes from Notion expecting fidelity; some makes it, some doesn't, some lands in-between. Hard to diagnose because the user can't see the ProseMirror tree.

### Migration cost out of this option
Same column, so markdown is portable. Migration *away* re-saves rows with a different editor — most round-trip cleanly; some need touch-up where Tiptap's serializer was idiosyncratic. Lower cost than migrating away from option 4.

---

## Option 4 — ProseMirror JSON + full Tiptap WYSIWYG

Now we're in a different storage family. The DB column holds a JSON serialization of the ProseMirror document tree, not markdown. This is what Notion, Linear, and most modern doc tools do internally.

### Storage
`body_json` as `TEXT` containing JSON, or engine-native (`jsonb` / `JSON1`). The dual-DB constraint pushes toward `TEXT` with app-layer parsing — engine-native JSON indexes differently, validates differently, and parity becomes a maintenance burden.

Even with `TEXT` JSON it's a serious commitment: the JSON shape is "whatever ProseMirror schema you had at write time produced." Change the editor schema later (add a custom node, remove an extension) and you may have rows whose document structure no longer parses cleanly. You now own a schema-versioning problem for editor content.

### Search
Hard. ProseMirror JSON is a nested tree with text leaves buried inside `content` arrays. FTS5 and `tsvector` index the column as one string — they'll index JSON keys and structural tokens alongside prose. Search for `"paragraph"` and every document matches.

Correct fix: on every write, walk the tree, extract text leaves, store in a parallel `body_text` column, index *that*. You're now maintaining two columns with a derive-on-write step that can fall out of sync. Real ongoing complexity the other three options don't have.

### Export
Hardest. Exporting `.md` requires running the ProseMirror → Markdown serializer at export time, which means importing Tiptap in the export path — either bundling it on the server (chunky) or doing exports client-side. Lossy on anything Tiptap can't represent (custom nodes, embeds, callouts). PRD §8's Markdown export becomes a feature you implement, test, and maintain, not a `cat`.

### Editor UX
Best of the four for long-form composition. Everything Tiptap offers without the markdown round-trip penalty. Custom nodes render arbitrary React components inline. State is rich and queryable. The right choice for a Notion-clone.

### Mobile PWA
Same as option 3 — the substrate doesn't change, only the storage underneath.

### Week-1 cost
Tiptap setup (2–3d) + schema column + serialization layer + content-extraction worker (1d) + ProseMirror→Markdown export path (0.5d) + fallback for malformed JSON (0.5d): **4 to 5 days**. Most of week 1 spent on the editor for a capture-first product where most rows will be 1–3 paragraphs.

### Footprint
Option 3's client footprint *plus* server-side deps for export/extraction. Highest maintenance — every Tiptap version bump is a content-format event.

### Extensibility
Maximal. The substrate for becoming Notion: custom blocks, embeds, mentions, collab, complex layouts — all doors open.

### Failure modes
- **Corrupted JSON:** A row with malformed JSON is unrecoverable without manual surgery. Body appears blank or errors on load.
- **Schema drift between writes:** Rows under editor schema v1 may not be readable under v2 without a migration. You own editor migrations as a category of work.
- **Lost text on broken parse:** The prose inside corrupted JSON is *not* recoverable without parsing the malformed JSON. Markdown TEXT, by contrast, is always readable.
- **Paste from Word:** Same as option 3, but now the resulting ProseMirror document *is* your storage, so the oddities are persisted.
- **Search-extraction drift:** The derived `body_text` falls out of sync with the canonical JSON if any write path forgets to update it.

### Migration cost out of this option
Highest. To leave: walk every row, run ProseMirror → Markdown, accept the lossy conversions (custom nodes that don't serialize cleanly), write to a new column, verify nothing critical was lost. For weeks-old data this is annoying; for months-old data with thousands of rows, it's a project. **This is the lock-in we're explicitly buying out of by choosing option 1.**

---

## Side-by-side summary

| Concern | Option 1 (textarea) | Option 2 (CodeMirror) | Option 3 (Tiptap + MD) | Option 4 (Tiptap + JSON) |
|---|---|---|---|---|
| Storage column | `TEXT` markdown | `TEXT` markdown | `TEXT` markdown | `TEXT` JSON (or `jsonb`) |
| Dual-DB clean | Yes | Yes | Yes | Yes (if `TEXT`); annoying if engine-native |
| Search indexability | Trivial | Trivial | Trivial | Requires extraction step |
| Export to `.md` | `fs.write(row.body)` | `fs.write(row.body)` | `fs.write(row.body)` (Tiptap dialect) | Run serializer; lossy |
| Capture speed | Fastest | Fast | Slower (toolbar friction) | Slower |
| Mobile UX | Best | Mid | Mid | Mid |
| CLI-paste-results | Perfect | Perfect | Sometimes mangled | Sometimes mangled |
| Vim bindings | No | Yes | No | No |
| WYSIWYG | No | No | Yes | Yes |
| Slash menu / mentions | No | No | Yes | Yes |
| Bundle (lazy-loaded) | ~60 KB | ~250 KB | ~400 KB | ~400 KB+ |
| Week-1 hours | ~4 | ~10 | ~16–24 | ~32–40 |
| Lock-in | None | None | Low | High |
| Migration cost out | Trivial | Trivial | Moderate | Hard |
| Failure when corrupted | Human-readable | Human-readable | Human-readable | Opaque |

---

## Why option 1 won for Compass week 1

Three reasons, in priority order:

**1. Capture-first scope.** Batch 1 (F1) locked week 1 as "capture-and-surface only." Almost every body field will be 1–5 sentences typed into a capture box, or a paragraph pasted from a CLI run. A textarea handles both better than any rich editor. The PRD authoring surface — the one place a richer editor might matter — is deferred to week 2+ per D2.

**2. Portability across SQLite ↔ Postgres.** Batch 2 locked dual-DB. Markdown TEXT works identically in both engines, with identical search-indexing semantics behind `SearchProvider` and identical export for PRD §8. ProseMirror JSON in `TEXT` is technically portable, but its search and export complications wipe out any reason to take on the JSON-shaped problems.

**3. Zero editor lock-in.** Options 1/2/3 share a column. Picking the smallest of the three for week 1 buys freedom to upgrade in place. Picking option 4 buys a JSON-shaped commitment that becomes a migration project to leave. Markdown TEXT is the format we'd reach for *if* we had to migrate off any of the other three anyway.

Secondary win: a textarea is *invisible*. No toolbar, no editor mode, no surprise on paste. For a tool whose premise is "capture friction is the failure mode" (PRD UX principle 1), invisibility is the feature. And concretely: half a day of week 1 against an already-ambitious 9–12-day budget. Those hours go to the design system (Radix + 5 themes per Batch 3 cascade #1), the dual-DB schema work, the offline capture queues across four clients, or simply finishing on time.

---

## When to upgrade

A textarea is not the final answer. It's the right starting point. Concrete signals that justify climbing the ladder:

### Signals to move to option 2 (CodeMirror 6)
- You're regularly editing 200+ line markdown bodies and the lack of syntax highlighting is annoying you.
- You miss Vim bindings inside the textarea.
- You want code-fence syntax highlighting inside markdown.
- You're pasting lots of code and the lack of bracket matching costs you.
- **Cost to upgrade:** ~1 day. No schema change. Drop the new editor in, keep the live preview, ship.

### Signals to move to option 3 (Tiptap + Markdown)
- A non-engineer is regularly asked to compose long-form content and the markdown surface intimidates them.
- You want a slash menu, `@`-mentions linking to projects, drag handles to reorder paragraphs, tables-by-typing.
- **Cost to upgrade:** ~3 days. No schema change in the simple case. Be aware of round-trip serialization edge cases; test by importing a sample of real rows first.

### Signals to move to option 4 (ProseMirror JSON + Tiptap)
- You want **collaborative editing** with cursors (Yjs needs the JSON document model, not markdown text).
- You want **custom block types** that can't be expressed in markdown (embedded data widgets, structured callouts with metadata, interactive checklists with assignees).
- You want **block-level metadata** (per-block comments, edit history, AI suggestions).
- Compass has stopped being a capture tool and become a composition tool — long-form writing is the primary use case, not capture.
- **Cost to upgrade:** ~1–2 weeks. Real schema migration: walk every row, parse markdown → ProseMirror, write JSON to new column, dual-write during transition, cut over once verified, deprecate old column. Edge-case risk on conversion. Do this *only* when the new features genuinely justify it — once committed to JSON storage, going back is the same migration in reverse.

### Anti-signals (do NOT upgrade)
- "It feels old-fashioned" — invisibility is a feature for capture tools, not a bug.
- "Other apps have a fancy editor" — other apps aren't capture-first single-user dashboards.
- "I want bold/italic buttons" — bold is `**`, italic is `*`. The preview shows it. Move on.
- "Markdown is hard for non-engineers" — Compass is single-user (PRD §3) and the user is a builder fluent with markdown.

---

## Verdict

**Option 1 (Markdown TEXT + textarea + live preview) for week 1.**

One sentence: capture-first scope makes textarea the *best* editor (not the worst); dual-DB portability and search-indexability make Markdown TEXT the only relaxed choice; zero editor lock-in across options 1/2/3 keeps today's choice reversible while option 4's lock-in is real.

When the signals above fire, upgrade in order — 1 → 2 → 3 are cheap UI swaps on the same column; 3 → 4 is the real schema migration to think hard about and only commit to with a concrete feature in hand.
