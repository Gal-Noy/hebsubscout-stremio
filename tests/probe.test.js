'use strict';
const assert = require('node:assert/strict');
const { toLogicalSrt, makeRlmSrt, makeRliSrt, makeRlmWebVtt } = require('../lib/probe');
const cue = (line, eol = '\n') =>
  ['1', '00:00:01,000 --> 00:00:04,000', line, ''].join(eol);
const legacy = cue('.שלום');
const logical = cue('שלום.');
const wrapped = cue('\u202Bשלום.\u202C');
const mixed = cue('.שלום John!');
const newline = '\r\n';
assert.equal(toLogicalSrt(legacy), logical, 'legacy punctuation moved back to logical form');
assert.equal(toLogicalSrt(logical), logical, 'logical form preserved');
assert.equal(toLogicalSrt(wrapped), logical, 'RLE/PDF removed');
assert.equal(toLogicalSrt(mixed), mixed, 'ambiguous punctuation not guessed');
assert.equal(toLogicalSrt(cue('.שלום', newline)), cue('שלום.', newline), 'CRLF retained');
assert.equal(toLogicalSrt(toLogicalSrt(legacy)), toLogicalSrt(legacy), 'canonicalization idempotent');
assert.equal(makeRlmSrt(legacy), cue('\u200Fשלום.'), 'RLM first strong direction mark');
assert.equal(makeRlmSrt(wrapped), cue('\u200Fשלום.'), 'RLM canonicalized wrapped input');
assert.equal(makeRlmSrt(makeRlmSrt(legacy)), makeRlmSrt(legacy), 'RLM idempotent');
assert.equal(makeRliSrt(legacy), cue('\u2067שלום.\u2069'), 'RTL isolate wrapping');
assert.equal(makeRliSrt(makeRliSrt(legacy)), makeRliSrt(legacy), 'isolate idempotent');
const multi = '1\r\n00:00:01,000 --> 00:00:04,000\r\n\u202Bשלום\r\nעולם.\u202C\r\n';
assert.equal(makeRlmSrt(multi), '1\r\n00:00:01,000 --> 00:00:04,000\r\n\u200Fשלום\r\n\u200Fעולם.\r\n', 'cross-line legacy embed stripped');
const vtt = makeRlmWebVtt(wrapped);
assert.ok(vtt.startsWith('WEBVTT\n\n'), 'WebVTT signature');
assert.ok(vtt.includes('00:00:01.000 --> 00:00:04.000 align:start'), 'WebVTT cue alignment');
assert.ok(vtt.includes('\u200Fשלום.'), 'RLM in VTT');
assert.ok(!vtt.includes('00:00:01,000'), 'SRT timestamps removed');
assert.equal(makeRlmWebVtt(vtt), vtt, 'WebVTT idempotent');
assert.equal(makeRlmSrt(cue('Hello.')), cue('Hello.'), 'English subtitle preserved');
assert.equal(makeRliSrt(cue('Hello.')), cue('Hello.'), 'English isolate preserved');
const sample = [legacy, logical, wrapped, mixed, multi,
  cue('<i>.שלום</i>'), cue('שלום John?', newline), cue('?מה קורה')];
for (const original of sample) {
  for (const fn of [toLogicalSrt, makeRlmSrt, makeRliSrt, makeRlmWebVtt]) {
    const once = fn(original);
    assert.equal(fn(once), once, 'transformation idempotent');
  }
}
console.log('Subtitle probe tests passed');
