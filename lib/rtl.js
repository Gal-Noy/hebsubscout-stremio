'use strict';

// SRT subtitle compatibility helpers. Stremio tvOS may render neutral punctuation
// with an LTR base direction. Hebrew subtitle releases exist in TWO conventions:
//   legacy:  "?שלום"  with no Unicode embedding marks
//   logical: "שלום?"  often wrapped by RLE/PDF
//
// Only the dedicated Apple TV mode converts between these conventions. The
// old RLE wrapper is retained solely to compare historic behavior.
const HEBREW = /[\u0590-\u05FF]/;
const TIMESTAMP = /^\s*\d{2,}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2,}:\d{2}:\d{2}[,.]\d{3}/;
const DIRECTION_MARK = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/;
const RLE = '\u202B', PDF = '\u202C';
const EMBEDDING_MARKS = /[\u202B\u202C]/g;
const LEADING_PUNCTUATION = /^[?!.,…]+/u;
const TRAILING_PUNCTUATION = /[?!.,…]+$/u;
const LINE_BREAK = /\r\n|\n|\r/;
const HTML_TAG = /<[^>]+>/g;

function isWebVtt(text) {
  return /^\uFEFF?WEBVTT/.test(text);
}

// Apply a line-only operation to SRT cue text; never touch numeric cue
// indices, timestamps, gaps, or original line-ending conventions.
function mapCueLines(srt, mapFn) {
  let inCue = false;
  return srt.split(/(\r\n|\n|\r)/).map(line => {
    if (line === '\r\n' || line === '\n' || line === '\r') return line;
    if (!line.trim()) { inCue = false; return line; }
    if (TIMESTAMP.test(line)) { inCue = true; return line; }
    return inCue ? mapFn(line) : line;
  }).join('');
}

function fixSubtitleRtl(srt) {
  if (isWebVtt(srt)) return srt;
  return mapCueLines(srt, line =>
    !HEBREW.test(line) || DIRECTION_MARK.test(line)
      ? line
      : RLE + line + PDF
  );
}

// Intentionally conservative: only straight boundary punctuation is relocated.
// Skip dialogue hyphens, quotes, brackets, inline punctuation, and markup with
// attributes unless the trailing punctuation is unambiguous.
function moveTerminalPunctuationToFront(line) {
  if (!HEBREW.test(line)) return line;

  // Keep opening HTML tags at the beginning and closing tags at the end.
  const prefix = /^(\s*(?:<(?!\/)[^>]+>\s*)*)/.exec(line)[0];
  const remaining = line.slice(prefix.length);
  const closingMatch = /((?:\s*<\/[^>]+>)*\s*)$/.exec(remaining);
  const suffix = closingMatch[0];
  const inner = remaining.slice(0, remaining.length - suffix.length);
  const trailing = TRAILING_PUNCTUATION.exec(inner);
  if (!trailing || !HEBREW.test(inner) || LEADING_PUNCTUATION.test(inner)) return line;
  const punctuation = trailing[0];
  const body = inner.slice(0, inner.length - punctuation.length);
  if (!body.trim()) return line;
  return prefix + punctuation + body + suffix;
}

function subtitlePunctuationStats(srt) {
  const stats = { hebrewLines: 0, leading: 0, trailing: 0, bidiMarks: 0 };
  if (isWebVtt(srt)) return stats;
  mapCueLines(srt, line => {
    if (!HEBREW.test(line)) return line;
    stats.hebrewLines++;
    stats.bidiMarks += (line.match(EMBEDDING_MARKS) || []).length;
    const plain = line.replace(EMBEDDING_MARKS, '').replace(HTML_TAG, '').trim();
    if (LEADING_PUNCTUATION.test(plain)) stats.leading++;
    if (TRAILING_PUNCTUATION.test(plain)) stats.trailing++;
    return line;
  });
  return stats;
}

function normalizeForAppleTv(srt) {
  if (isWebVtt(srt)) return srt;
  const stats = subtitlePunctuationStats(srt);

  // We can identify dominant legacy vs logical convention from the *file*,
  // not merely from individual lines. A mixed/ambiguous file is passed through.
  if (stats.trailing === 0 || stats.trailing <= stats.leading * 4) return srt;

  return mapCueLines(srt, line => {
    // A logically-ordered file may wrap one multi-line cue in a single
    // RLE/PDF pair, so stripping wrappers must not depend on individual lines.
    const unwrapped = line.replace(EMBEDDING_MARKS, '');
    return moveTerminalPunctuationToFront(unwrapped);
  });
}

module.exports = {
  fixSubtitleRtl,
  normalizeForAppleTv,
  subtitlePunctuationStats,
  moveTerminalPunctuationToFront,
};
