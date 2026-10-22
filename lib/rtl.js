'use strict';

// Deliberately avoid moving punctuation: some legacy SRT files already reorder it.
const HEBREW = /[\u0590-\u05FF]/;
const TIMESTAMP = /^\s*\d{2,}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2,}:\d{2}:\d{2}[,.]\d{3}/;
const RLE = '\u202B', PDF = '\u202C';

function fixSubtitleRtl(srt) {
  if (/^\uFEFF?WEBVTT/.test(srt)) return srt;
  let inCue = false;
  return srt.split(/(\r\n|\n|\r)/).map(line => {
    if (line === '\r\n' || line === '\n' || line === '\r') return line;
    if (!line.trim()) { inCue = false; return line; }
    if (TIMESTAMP.test(line)) { inCue = true; return line; }
    if (!inCue || !HEBREW.test(line) || line.includes(RLE)) return line;
    return RLE + line + PDF;
  }).join('');
}

module.exports = { fixSubtitleRtl };
