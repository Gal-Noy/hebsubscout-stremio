'use strict';

// Ensure the server really issues production RLI subtitle URLs (not just labels).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const index = fs.readFileSync(require.resolve('../index.js'), 'utf8');
const start = index.indexOf('builder.defineSubtitlesHandler(async');
const end = index.indexOf('// =========================================================================\n// SERVER ', start);
assert.ok(start >= 0 && end > start, 'Could not locate subtitle handler');
const source = index.slice(start, end);

async function testMode(mode, expectedCount, expectedSuffix) {
  let handler = null;
  let token = 0;
  const builder = { defineSubtitlesHandler(fn) { handler = fn; } };
  const env = { RENDER_EXTERNAL_URL: 'https://example.onrender.com' };
  if (mode !== null) env.RTL_MODE = mode;

  vm.runInNewContext(source, {
    builder,
    parseId: () => ({ imdbId: 'tt1190634', season: 2, episode: 4 }),
    getConfig: () => ({}),
    searchAll: async () => [
      { id: 'w1', name: 'The.Boys.S02E04', provider: 'wizdom', downloadUrl: 'https://wizdom.example/sub.srt' },
      { id: 'k1', name: 'The.Boys.S02E04', provider: 'ktuvit', downloadUrl: 'https://ktuvit.example/sub.srt' },
      { id: 'o1', name: 'The.Boys.S02E04', provider: 'opensubtitles', downloadUrl: 'https://opensubtitles.example/sub.srt' },
    ],
    requestConfig: null,
    matchSource: () => [],
    process: { env },
    registerDownload: () => `token${++token}`,
    port: 10000,
    console: { log() {} },
  });

  assert.equal(typeof handler, 'function', 'Subtitle handler registration');
  const result = await handler({ type: 'series', id: 'tt1190634:2:4', extra: {} });
  assert.equal(result.subtitles.length, expectedCount, 'Expected track count');
  for (const sub of result.subtitles) {
    assert.equal(sub.lang, 'heb');
    if (expectedSuffix) assert.ok(sub.url.endsWith(expectedSuffix), 'Expected subtitle mode query');
    else assert.ok(!sub.url.includes('?'), 'Off must use original proxy URL');
  }
  assert.deepEqual([...new Set(result.subtitles.map(s => s.url.split('/')[5]))].length, expectedCount === 12 ? 4 : 1);
}

(async () => {
  await testMode(null, 3, '?rtl=rli');
  await testMode('rli', 3, '?rtl=rli');
  await testMode('off', 3, null);
  await testMode('on', 3, '?rtl=1');
  await testMode('apple', 3, '?apple=1');
  await testMode('probe', 12, null);
  assert.ok(index.includes("params.get('rtl') === 'rli' ? 'rli'"), 'Server parses rli query');
  assert.ok(index.includes("mode === 'rli' ? makeRliSrt(text)"), 'Server transforms rli SRT');
  console.log('Production RLI mode tests passed');
})().catch(err => { console.error(err); process.exitCode = 1; });
