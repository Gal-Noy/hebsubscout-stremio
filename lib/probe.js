'use strict';

/**
 * Temporary tvOS diagnostics only: four views of the SAME provider subtitle.
 *
 * The Apple TV device decides how to render the SRT/VTT. No transform is a
 * confirmed fix; the probe differentiates parsing/rendering behavior.
 *
 * Canonicalize two observed real-world Hebrew SRT conventions before adding
 * a directional mark:
 *    legacy: ".שלום"    => logical "שלום."
 *    logical: "שלום." or RLE-embedded "שלום." => "שלום."
 */
const { subtitlePunctuationStats } = require('./rtl');
const HEBREW = /[\u0590-\u05ff]/;
const CONTROL = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
const PUNCT_START = /^[?!.,…]+/u;
const TIMESTAMP = /^\s*\d{2,}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2,}:\d{2}:\d{2}[,.]\d{3}/;
const WEBVTT = /^\uFEFF?WEBVTT/;

function mapSrt(srt, fn) {
  let inCue = false;
  return srt.split(/(\r\n|\n|\r)/).map(line => {
    if (line === '\r\n' || line === '\n' || line === '\r') return line;
    if (!line.trim()) { inCue = false; return line; }
    if (TIMESTAMP.test(line)) { inCue = true; return line; }
    return inCue ? fn(line) : line;
  }).join('');
}

function moveLeadingPunctuationToEnd(line) {
  if (!HEBREW.test(line)) return line;
  const prefix = /^(\s*(?:<(?!\/)[^>]+>\s*)*)/.exec(line)[0];
  const rest = line.slice(prefix.length);
  const suffix = /((?:\s*<\/[^>]+>)*\s*)$/.exec(rest)[0];
  const inner = rest.slice(0, rest.length - suffix.length);
  const start = PUNCT_START.exec(inner);
  if (!start) return line;
  const body = inner.slice(start[0].length);
  if (!HEBREW.test(body) || !body.trim()) return line;
  return prefix + body + start[0] + suffix;
}

function toLogicalSrt(srt) {
  if (WEBVTT.test(srt)) return srt;
  const stats = subtitlePunctuationStats(srt);
  const legacy = stats.leading > 0 && stats.leading > stats.trailing * 4;
  return mapSrt(srt, line => {
    const plain = line.replace(CONTROL, '');
    return legacy ? moveLeadingPunctuationToEnd(plain) : plain;
  });
}

function makeRlmSrt(srt) {
  if (WEBVTT.test(srt)) return srt;
  return mapSrt(toLogicalSrt(srt), line => HEBREW.test(line) ? '\u200F' + line : line);
}

function makeRliSrt(srt) {
  if (WEBVTT.test(srt)) return srt;
  return mapSrt(toLogicalSrt(srt), line => HEBREW.test(line) ? '\u2067' + line + '\u2069' : line);
}

function makeRlmWebVtt(srt) {
  if (WEBVTT.test(srt)) return srt;
  const normalized = makeRlmSrt(srt)
    .replace(/^\uFEFF/, '')
    .replace(/\r\n|\r/g, '\n')
    .replace(/^(\s*\d{2,}:\d{2}:\d{2}),([0-9]{3})(\s*-->\s*)(\d{2,}:\d{2}:\d{2}),([0-9]{3})(.*)$/gm,
      (_all, a, b, arrow, c, d, extra) => `${a}.${b}${arrow}${c}.${d}${extra} align:start`);
  return 'WEBVTT\n\n' + normalized;
}

module.exports = { toLogicalSrt, makeRlmSrt, makeRliSrt, makeRlmWebVtt };
