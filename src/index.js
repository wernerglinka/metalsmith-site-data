/**
 * metalsmith-site-data
 *
 * Emit read-only build artifacts that an in-situ admin editor fetches to browse
 * and author a structured-content site. Two plugins, placed at different points
 * in the pipeline because they snapshot different things:
 *
 * - `pagesArtifact()` -> assets/pages.json: every page's source frontmatter,
 *   so the editor can browse and open existing pages. Run it AFTER drafts()
 *   and BEFORE collections()/permalinks()/layouts(), so the snapshot is the
 *   clean authored shape (no injected collection/card data) and the keys are
 *   the source .md paths the editor writes back to.
 *
 * - `dataArtifact()` -> assets/site-data.json: the metadata.data namespace plus
 *   collection membership, so sections that consume data files or collections
 *   can be authored and previewed against the site's real data. Run it AFTER
 *   collections() (so membership is populated) and BEFORE permalinks() (so the
 *   member keys are still the source .md paths that key pages.json).
 *
 * Both are read-only snapshots written into the build; the editor fetches them
 * statically with no server access. See README.md for the artifact shapes.
 */

// Metalsmith file internals that are not authored frontmatter.
const INTERNAL_KEYS = new Set(['contents', 'stats', 'mode']);

/**
 * Serialize a value and write it into the files object as a build artifact.
 * @param {Object} files - The Metalsmith files object.
 * @param {string} dest - The output path within the build.
 * @param {*} value - The JSON-serializable artifact.
 */
function writeArtifact(files, dest, value) {
  files[dest] = { contents: Buffer.from(JSON.stringify(value, null, 2), 'utf8') };
}

/**
 * Build the { sourcePath: { frontmatter, content } } map from a Metalsmith
 * files object. Pure. Only .md sources are included; the markdown body (usually
 * empty for structured pages) rides along as `content` so the editor's
 * hydration path (frontmatter + content) round-trips unchanged.
 * @param {Object} files - The Metalsmith files object.
 * @returns {Object} Map of source path to { frontmatter, content }.
 */
export function buildPagesArtifact(files) {
  const pages = {};
  for (const [filePath, file] of Object.entries(files)) {
    if (!filePath.endsWith('.md')) {
      continue;
    }
    const frontmatter = {};
    for (const [key, value] of Object.entries(file)) {
      if (INTERNAL_KEYS.has(key)) {
        continue;
      }
      frontmatter[key] = value;
    }
    pages[filePath] = {
      frontmatter,
      content: file.contents ? file.contents.toString() : ''
    };
  }
  return pages;
}

/**
 * Build the { data, collections } artifact from a Metalsmith files object and
 * metadata. Pure. `data` is the metadata.data namespace verbatim; `collections`
 * maps each collection name to the ordered list of its member source paths
 * (the same keys buildPagesArtifact emits), so a consumer joins to pages.json
 * rather than duplicating entry frontmatter. Collection entries are the same
 * file objects that are values in the files map, so membership is resolved by
 * object identity.
 * @param {Object} files - The Metalsmith files object.
 * @param {Object} metadata - The Metalsmith metadata (has .data and .collections).
 * @returns {Object} { data, collections }.
 */
export function buildDataArtifact(files, metadata) {
  const meta = metadata || {};
  const pathOf = new Map();
  for (const [filePath, file] of Object.entries(files)) {
    pathOf.set(file, filePath);
  }
  const collections = {};
  for (const [name, entries] of Object.entries(meta.collections || {})) {
    if (!Array.isArray(entries)) {
      continue;
    }
    collections[name] = entries.map((entry) => pathOf.get(entry)).filter(Boolean);
  }
  return { data: meta.data || {}, collections };
}

/**
 * Plugin: snapshot page frontmatter to a build artifact.
 * @param {Object} [options]
 * @param {string} [options.dest='assets/pages.json'] - Output path in the build.
 * @returns {import('metalsmith').Plugin} Metalsmith plugin function.
 */
export function pagesArtifact(options = {}) {
  const dest = options.dest || 'assets/pages.json';
  return function metalsmithSiteDataPages(files, _metalsmith, done) {
    try {
      writeArtifact(files, dest, buildPagesArtifact(files));
      done();
    } catch (err) {
      // JSON.stringify throws on circular refs or BigInt in frontmatter;
      // surface it to Metalsmith instead of crashing the build.
      done(err);
    }
  };
}

/**
 * Plugin: snapshot the data namespace and collection membership to a build
 * artifact.
 * @param {Object} [options]
 * @param {string} [options.dest='assets/site-data.json'] - Output path in the build.
 * @returns {import('metalsmith').Plugin} Metalsmith plugin function.
 */
export function dataArtifact(options = {}) {
  const dest = options.dest || 'assets/site-data.json';
  return function metalsmithSiteDataData(files, metalsmith, done) {
    try {
      writeArtifact(files, dest, buildDataArtifact(files, metalsmith.metadata()));
      done();
    } catch (err) {
      // JSON.stringify throws on circular refs or BigInt in the data namespace;
      // surface it to Metalsmith instead of crashing the build.
      done(err);
    }
  };
}
