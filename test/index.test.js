import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPagesArtifact, buildDataArtifact, pagesArtifact, dataArtifact } from '../src/index.js';

/** Run a plugin (files, metalsmith, done) and resolve when done is called. */
function run(plugin, files, metalsmith = { metadata: () => ({}) }) {
  return new Promise((resolve, reject) => {
    plugin(files, metalsmith, (err) => (err ? reject(err) : resolve(files)));
  });
}

describe('buildPagesArtifact', () => {
  it('includes only .md sources, keyed by source path', () => {
    const out = buildPagesArtifact({
      'blog/post.md': { title: 'Post', contents: Buffer.from('') },
      'index.html': { contents: Buffer.from('<h1>') },
      'assets/app.js': { contents: Buffer.from('') }
    });
    assert.deepEqual(Object.keys(out), ['blog/post.md']);
  });

  it('captures authored frontmatter and strips file internals', () => {
    const out = buildPagesArtifact({
      'page.md': {
        title: 'Hello',
        sections: [{ sectionType: 'hero' }],
        contents: Buffer.from('body text'),
        stats: { size: 1 },
        mode: '0644'
      }
    });
    assert.deepEqual(out['page.md'].frontmatter, {
      title: 'Hello',
      sections: [{ sectionType: 'hero' }]
    });
    assert.equal(out['page.md'].content, 'body text');
  });

  it('tolerates a missing contents buffer', () => {
    const out = buildPagesArtifact({ 'page.md': { title: 'X' } });
    assert.equal(out['page.md'].content, '');
  });
});

describe('buildDataArtifact', () => {
  it('returns the data namespace verbatim', () => {
    const data = { author: [{ name: 'Ada' }], site: { title: 'S' } };
    const out = buildDataArtifact({}, { data });
    assert.deepEqual(out.data, data);
  });

  it('maps each collection to its member source paths by identity', () => {
    const a = { title: 'A' };
    const b = { title: 'B' };
    const files = { 'blog/a.md': a, 'blog/b.md': b, 'about.md': {} };
    const out = buildDataArtifact(files, { collections: { blog: [a, b] } });
    assert.deepEqual(out.collections, { blog: ['blog/a.md', 'blog/b.md'] });
  });

  it('preserves collection order and drops entries not in files', () => {
    const a = { title: 'A' };
    const stray = { title: 'gone' };
    const out = buildDataArtifact({ 'b.md': a }, { collections: { blog: [stray, a] } });
    assert.deepEqual(out.collections.blog, ['b.md']);
  });

  it('defaults to empty shape when metadata is missing', () => {
    assert.deepEqual(buildDataArtifact({}, undefined), { data: {}, collections: {} });
  });

  it('ignores non-array collection entries', () => {
    const out = buildDataArtifact({}, { collections: { meta: { not: 'an array' } } });
    assert.deepEqual(out.collections, {});
  });
});

describe('pagesArtifact plugin', () => {
  it('writes valid JSON to the default destination and calls done', async () => {
    const files = { 'page.md': { title: 'X', contents: Buffer.from('') } };
    await run(pagesArtifact(), files);
    assert.ok(files['assets/pages.json'], 'artifact written');
    const parsed = JSON.parse(files['assets/pages.json'].contents.toString());
    assert.equal(parsed['page.md'].frontmatter.title, 'X');
  });

  it('honors a custom dest', async () => {
    const files = { 'page.md': { title: 'X' } };
    await run(pagesArtifact({ dest: 'data/pages.json' }), files);
    assert.ok(files['data/pages.json']);
  });
});

describe('dataArtifact plugin', () => {
  it('writes data and collections from metadata', async () => {
    const a = { title: 'A' };
    const files = { 'blog/a.md': a };
    const metalsmith = { metadata: () => ({ data: { site: { title: 'S' } }, collections: { blog: [a] } }) };
    await run(dataArtifact(), files, metalsmith);
    const parsed = JSON.parse(files['assets/site-data.json'].contents.toString());
    assert.equal(parsed.data.site.title, 'S');
    assert.deepEqual(parsed.collections.blog, ['blog/a.md']);
  });
});
