'use strict';
const assert = require('node:assert/strict');
const {
  fixSubtitleRtl, normalizeForAppleTv, subtitlePunctuationStats,
} = require('../lib/rtl');

const S = (line, eol = '\n') => ['1', '00:00:01,000 --> 00:00:04,000', line, ''].join(eol);
const sample = [
  ['wrapped logical', S('\u202Bשלום?\u202C'), S('?שלום')],
  ['already legacy', S('?שלום'), S('?שלום')],
  ['logical plain', S('שלום.'), S('.שלום')],
  ['logical exclamation', S('שלום!'), S('!שלום')],
  ['legacy comma', S(',שלום'), S(',שלום')],
  ['English only', S('Hello!'), S('Hello!')],
  ['mixed Hebrew English', S('היי John!'), S('!היי John')],
  ['punctuation inside sentence', S('שלום, מה נשמע?'), S('?שלום, מה נשמע')],
  ['opening/closing italic tags', S('\u202B<i>שלום!</i>\u202C'), S('<i>!שלום</i>')],
  ['speaker hyphen', S('- שלום.'), S('.- שלום')],
  ['quotes ambiguous', S('״שלום!״'), S('״שלום!״')],
  ['leading and trailing', S('?שלום.'), S('?שלום.')],
  ['multiline embedding', '1\r\n00:00:01,000 --> 00:00:04,000\r\n\u202Bשלום\r\nעולם.\u202C\r\n',
   '1\r\n00:00:01,000 --> 00:00:04,000\r\nשלום\r\n.עולם\r\n'],
  ['WEBVTT unchanged', 'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nשלום!\n', 'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nשלום!\n'],
];
for (const [name, input, expected] of sample) {
 const actual = normalizeForAppleTv(input);
 assert.equal(actual, expected, name);
 assert.equal(normalizeForAppleTv(actual), actual, name + ' idempotence');
}
const legacy = S('.שלום\n?מה קורה\n!נהדר');
assert.equal(normalizeForAppleTv(legacy), legacy, 'real Wizdom-like prefix convention unchanged');
const logical = S('שלום.\nמה קורה?\nנהדר!');
assert.equal(normalizeForAppleTv(logical), S('.שלום\n?מה קורה\n!נהדר'), 'real Wizdom logical convention normalized');
assert.deepEqual(subtitlePunctuationStats(logical), {hebrewLines: 3, leading: 0, trailing: 3, bidiMarks: 0}, 'identify logical');
assert.deepEqual(subtitlePunctuationStats(legacy), {hebrewLines: 3, leading: 3, trailing: 0, bidiMarks: 0}, 'identify legacy');
const original = S('שלום?', '\r\n');
assert.equal(fixSubtitleRtl(original), S('\u202Bשלום?\u202C', '\r\n'), 'old RLE wrapper still opt-in');
assert.equal(fixSubtitleRtl(fixSubtitleRtl(original)), fixSubtitleRtl(original), 'old wrapper idempotent');
console.log('RTL tests passed: 34 assertions including idempotence and Apple TV punctuation mode');
