# metalsmith-site-data

[![metalsmith:plugin][metalsmith-badge]][metalsmith-url]
[![npm: version][npm-badge]][npm-url]
[![license: MIT][license-badge]][license-url]
[![test coverage][coverage-badge]][coverage-url]
[![Known Vulnerabilities](https://snyk.io/test/npm/metalsmith-site-data/badge.svg)](https://snyk.io/test/npm/metalsmith-site-data)

> Emit read-only build artifacts (pages.json and site-data.json) that an in-situ admin editor consumes: a snapshot of page frontmatter, and the site's data namespace plus collection membership.

Emit read-only build artifacts that an in-situ admin editor fetches to browse and author a structured-content site. Two plugins, exported separately because they belong at different points in the build:

- **`pagesArtifact()`** → `assets/pages.json`: every page's source frontmatter, so the editor can list and open existing pages.
- **`dataArtifact()`** → `assets/site-data.json`: the `metadata.data` namespace plus collection membership, so sections that consume data files or collections can be authored and previewed against the site's real data.

The editor fetches both statically; there is no server component.

## Installation

```bash
npm install metalsmith-site-data
```

## Usage

```js
import Metalsmith from 'metalsmith';
import drafts from '@metalsmith/drafts';
import collections from '@metalsmith/collections';
import permalinks from '@metalsmith/permalinks';
import { pagesArtifact, dataArtifact } from 'metalsmith-site-data';

Metalsmith(import.meta.dirname)
  .use(drafts())
  .use(pagesArtifact())            // before collections/permalinks
  .use(collections({ blog: { pattern: 'blog/*.md' } }))
  .use(dataArtifact())             // after collections, before permalinks
  .use(permalinks())
  .build((err) => {
    if (err) throw err;
  });
```

### Placement matters

The two artifacts snapshot different stages of the build, so they go in different places:

- **`pagesArtifact()`** must run **after `drafts()`** (so `draft: true` pages are excluded) and **before `collections()` / `permalinks()` / `layouts()`**, so the snapshot is the clean authored frontmatter (no injected collection or card data) and the file keys are the source `.md` paths the editor writes back to.
- **`dataArtifact()`** must run **after `collections()`** (so collection membership is populated) and **before `permalinks()`** (so the member keys are still the source `.md` paths, matching `pages.json`).

`dataArtifact()` reads `metalsmith.metadata().data`; populate it however your site already does (an inline loader, `@metalsmith/metadata`, etc.) before this plugin runs.

## Options

Both plugins take a single `dest` option, the output path within the build:

| Plugin | Option | Default |
|--------|--------|---------|
| `pagesArtifact` | `dest` | `'assets/pages.json'` |
| `dataArtifact` | `dest` | `'assets/site-data.json'` |

## Artifact shapes

`pages.json` — a map of source path to authored frontmatter and body:

```json
{
  "blog/hello.md": {
    "frontmatter": { "layout": "pages/sections.njk", "sections": [ ... ] },
    "content": ""
  }
}
```

`site-data.json` — the data namespace verbatim, plus each collection mapped to its ordered member source paths (the same keys as `pages.json`, so a consumer joins to it rather than duplicating entries):

```json
{
  "data": { "author": [ { "name": "Ada Lovelace" } ], "site": { "title": "..." } },
  "collections": { "blog": [ "blog/hello.md", "blog/world.md" ] }
}
```

The pure builder functions (`buildPagesArtifact(files)` and `buildDataArtifact(files, metadata)`) are also exported, for testing or custom wiring.

## Testing and Coverage

```bash
# Run tests
npm test

# Generate coverage report
npm run test:coverage

# View HTML coverage report
open coverage/index.html
```

This project maintains 80% code coverage across branches, lines, functions, and statements.

## Automated CI/CD

This plugin includes GitHub workflows for automated testing and review:

### GitHub Actions Workflows

- **`.github/workflows/test.yml`**: Runs on every push and pull request
  - Automated testing across Node.js versions
  - Coverage calculation and badge updates
  - Automatic README updates with coverage percentages

- **`.github/workflows/claude-code.yml`**: AI-assisted code review
  - Automatic code review on pull requests
  - Integration with Claude Code for automated feedback
  - Requires `ANTHROPIC_API_KEY` secret in repository settings

### Coverage Badges

Coverage badges are automatically updated by the test workflow. The badge color changes based on coverage percentage:
- 90%+ = bright green
- 80-89% = green  
- 70-79% = yellow-green
- 60-69% = yellow
- 50-59% = orange
- <50% = red

## Release Management

This plugin uses an improved release system that generates GitHub releases:

- **Clean Release Notes**: Each release shows only relevant changes
- **Automatic Formatting**: Proper GitHub markdown with commit links
- **Full Changelog Links**: Easy access to detailed comparisons
- **Consistent Quality**: No more messy "Unreleased" sections

Release process:

```bash
npm run release:patch  # Bug fixes (1.2.3 → 1.2.4)
npm run release:minor  # New features (1.2.3 → 1.3.0)
npm run release:major  # Breaking changes (1.2.3 → 2.0.0)
```

### Writing Commit Messages for Rich Release Notes

Since release notes are auto-generated from commit messages, write detailed commits that clearly explain what changed and why:

**Good Examples:**
```bash
feat: add HTML attribute minification support

- Implement the attribute optimization algorithm
- Add support for preserving custom elements
- Improve processing performance by 40% on large files
- Add configuration option for selective attribute handling

Closes #123, resolves #124
```

```bash
fix: resolve nested script tag processing issue

- Fix edge case where nested script tags caused parsing errors
- Add comprehensive test coverage for complex HTML structures
- Improve error messages for malformed HTML
- Update documentation with troubleshooting guide

Fixes #156
```

```bash
docs: update usage examples with new API patterns

- Add async/await examples for modern JavaScript patterns
- Include TypeScript usage examples
- Update configuration options table
- Add troubleshooting section for common issues
```

**Commit Message Format:**
- **type**: Brief description (50 chars or less)
- **body**: Detailed explanation with bullet points
- **footer**: Issue references and breaking change notices

**Commit Types:**
- `feat:` New features or enhancements
- `fix:` Bug fixes
- `docs:` Documentation updates
- `perf:` Performance improvements
- `refactor:` Code refactoring without functional changes
- `test:` Test additions or modifications
- `build:` Build system or dependency changes

**Why This Matters:**
- Each commit message becomes a release note entry
- Users see exactly what changed and the impact
- Links to issues/PRs are preserved in GitHub releases
- Breaking changes are clearly documented
- Professional release notes are generated automatically

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT © [Werner Glinka](https://github.com/wernerglinka)

[metalsmith-badge]: https://img.shields.io/badge/metalsmith-plugin-green.svg?longCache=true
[metalsmith-url]: https://metalsmith.io
[npm-badge]: https://img.shields.io/npm/v/metalsmith-site-data.svg
[npm-url]: https://www.npmjs.com/package/metalsmith-site-data
[license-badge]: https://img.shields.io/github/license/wernerglinka/metalsmith-site-data
[license-url]: LICENSE
[coverage-badge]: https://img.shields.io/badge/test%20coverage-025-red
[coverage-url]: https://github.com/wernerglinka/metalsmith-site-data/actions/workflows/test.yml
