'use strict';

// This is an opt-in player compatibility test, NOT punctuation reordering.
const HEBREW = /[\u0590-\u05FF]/;
const TIMESTAMP = /^\s*\d{2,}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2,}:\d{2}:\d{2}[,.]\d{3}/;
const DIRECTION_MARK = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/;
const RLE = '\u202B', PDF = '\u202C';

function fixSubtitleRtl(srt) {
  if (/^\uFEFF?WEBVTT/.test(srt)) return srt;
  let inCue = false;
  return srt.split(/(\r\n|\n|\r)/).map(line => {
    if (line === '\r\n' || line === '\n' || line === '\r') return line;
    if (!line.trim()) { inCue = false; return line; }
    if (TIMESTAMP.test(line)) { inCue = true; return line; }
    // Respect existing bidi controls; never move legacy punctuation characters.
    if (!inCue || !HEBREW.test(line) || DIRECTION_MARK.test(line)) return line;
    return RLE + line + PDF;
  }).join('');
}

module.exports = { fixSubtitleRtl };
