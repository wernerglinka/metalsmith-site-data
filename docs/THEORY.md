# Theory of Operations

This document explains how `metalsmith-site-data` functions and why it is
built this way. Read this once before making non-trivial changes to the
plugin.

---

## 1. The job

The plugin emits read-only JSON artifacts into the build that an in-situ admin
editor fetches statically to browse and author a structured-content site. It is
the build-time half of an editor whose runtime half is a static page; there is
no server.

It exports two plugins, each a small read-only snapshot:

- `pagesArtifact()` reads the `files` object and writes `assets/pages.json`: a
  map of each `.md` source path to its authored frontmatter and body. The
  editor opens a page by reading this, exactly as if it had read the source
  file.
- `dataArtifact()` reads `metalsmith.metadata()` and the `files` object and
  writes `assets/site-data.json`: the `metadata.data` namespace verbatim, plus
  each collection mapped to its member source paths. The editor uses this to
  author fields that reference site data (an author from `data.author`, a
  collection name) and to preview data-driven sections.

It deliberately does **not** load data, define collections, transform pages, or
talk to any server. It only snapshots what the rest of the pipeline has already
produced.

## 2. Architecture

`src/index.js` is the whole plugin. It has two layers:

- **Pure builders** — `buildPagesArtifact(files)` and
  `buildDataArtifact(files, metadata)` take plain inputs and return the
  serializable artifact. No I/O, no Metalsmith. These are exported so they can
  be unit-tested directly and reused for custom wiring.
- **Plugin factories** — `pagesArtifact(options)` and `dataArtifact(options)`
  return the `(files, metalsmith, done)` functions. Each one calls its builder
  and writes the result through the shared `writeArtifact` helper, which is the
  only side effect (it adds one key to `files`).

There is no `src/utils/` and no config layer; each plugin takes a single `dest`
string. The package is intentionally small.

## 3. Data flow

```
drafts()            removes draft:true pages
  |
pagesArtifact()     files (clean frontmatter, .md keys) -> assets/pages.json
  |
collections()       populates metadata.collections (member file objects)
  |
dataArtifact()      metadata.data + collections -> assets/site-data.json
  |
permalinks()        rewrites file keys to output paths
```

`buildDataArtifact` resolves collection membership by **object identity**: a
collection in `metadata.collections` holds the same file objects that are values
in `files`, so the builder inverts `files` into an object→path map and looks
each member up. The member paths it emits are therefore identical to the keys
`buildPagesArtifact` emits, which lets a consumer join `site-data.json` to
`pages.json` instead of duplicating entry frontmatter.

## 4. Design invariants

- **Placement is the contract.** `pagesArtifact` must run after `drafts()` and
  before `collections()`/`permalinks()`/`layouts()`; `dataArtifact` must run
  after `collections()` and before `permalinks()`. The whole point of the
  split into two plugins is that these two correct positions are different, and
  a single `.use()` cannot occupy both. See section 7.
- **Builders are pure.** All I/O lives in the factory functions; the builders
  never touch Metalsmith or the filesystem. This keeps them trivially testable.
- **The plugin only snapshots.** `dataArtifact` reads `metadata().data`; it
  never loads it. Whatever populates the data namespace for the templates
  (an inline loader, `@metalsmith/metadata`) is the site's concern and must run
  earlier. This keeps the artifact consistent with what the templates render.

## 5. Deliberate non-features

- **No data loading / `dataDir` option.** Considered and declined: the data the
  artifact should contain is exactly what the templates see, which is already in
  `metadata.data`. Reading a directory directly would create a second source of
  truth that could diverge from the rendered site.
- **No single combined plugin.** A one-call API was rejected because the two
  artifacts have genuinely different correct pipeline positions (section 4).
- **No collection entry duplication.** `site-data.json` stores member paths, not
  member frontmatter, because `pages.json` already holds it. Consumers join.

## 6. Testing notes

Tests are hermetic: they pass plain in-memory `files` objects and a minimal
fake `metalsmith` (`{ metadata: () => ({...}) }`) to the builders and plugin
factories, and assert on the returned/written JSON. The builders need no
Metalsmith at all. This is appropriate here precisely because the plugins do so
little — there is no framework behavior worth exercising a real instance for.
If a future change starts depending on real Metalsmith behavior (path helpers,
matching), switch those tests to a real `Metalsmith()` instance.

## 7. Known sharp edges

- **Ordering with `collections()` and `permalinks()`** is the one real
  gotcha. Run `dataArtifact` before `permalinks()` or the file keys will be
  output paths, not source `.md` paths, and they will no longer match
  `pages.json`. Run it after `collections()` or `metadata.collections` will be
  empty.
- **`pagesArtifact` after `collections()`** would capture the
  collection-injected `collection` property (and any card/og data added later)
  into the page snapshot, which the editor does not expect. Keep it before.
- **Collection arrays carry extra properties** (`metadata`, `next`, `previous`)
  alongside their numeric entries; the builder guards with `Array.isArray` and
  iterates entries, so those non-member properties are ignored.
