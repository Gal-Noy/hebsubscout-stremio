# HebSubScout RTL — Stremio subtitle aggregator

Same fork, same stream results, release matching, Real-Debrid, Render blueprint and dependencies. Subtitle lookup now uses **three existing Stremio addons** instead of scraping Ktuvit or asking for an OpenSubtitles API key.

| Provider | Source |
| --- | --- |
| OpenSubtitles v3 | `https://opensubtitles-v3.strem.io` (official) |
| Ktuvit | `https://4b139a4b7f94-ktuvit-stremio.baby-beamup.club` |
| Wizdom | `https://4b139a4b7f94-wizdom-stremio-v2.baby-beamup.club`; original Wizdom API used if the addon returns nothing |

The addon calls `/subtitles/{movie|series}/{imdbId[:season:episode]}.json`, filters results to Hebrew and proxies the downloaded subtitle file through our existing UTF-8 conversion. A provider outage or missing subtitle may still produce zero results.

## Install

Deploy this fork's `main` on Render using the **unchanged** `render.yaml`. Open `https://YOUR-HOST/configure` to generate an install URL, then install in Stremio with the same account used on Apple TV. Your existing Render environment variables remain accepted:

- Still used: `PORT`, `BASE_URL`, `RENDER_EXTERNAL_URL`, `RD_TOKEN`, `MEDIAFUSION_URL`.
- No longer needed for subtitle lookup: `KTUVIT_EMAIL`, `KTUVIT_PASSWORD`, `OPENSUBS_API_KEY`. You can remove these secrets from Render and reinstall using the simplified configure page.

## RTL modes

**RLI/PDI is now the default** based on user-confirmed results in both Stremio desktop and Stremio tvOS (The Boys S02E04). It is not guaranteed to fix every subtitle release:

| `RTL_MODE` env | Subtitle picker | Processing |
| --- | --- | --- |
| `rli` (default) | One track per result | Normalize legacy leading punctuation to logical order, then wrap Hebrew SRT lines in U+2067 RLI / U+2069 PDI |
| `off` | One unchanged track per result | Disable all directional edits if a particular file is worse |
| `compare` | Original and RTL-test versions | Compare on the same Apple TV player |
| `on` | One RTL-test track per provider result | Legacy RLE/PDF experiment (often worsens desktop punctuation) |
| `apple` | One Apple TV experimental track per provider result | Convert logical final punctuation to legacy leading punctuation, unwrapping RLE/PDF |
| `compare-apple` | Original and Apple TV versions | Side-by-side device testing |
| `probe` | Four versions of one release per provider, visibly prefixed `PROBE-RAW`, `PROBE-RLM`, `PROBE-RLI`, `PROBE-VTT` | Temporary tvOS rendering diagnosis; do not leave enabled |

RLI normalization is **idempotent**: a second pass does not add more isolate markers. It normalizes the two common real-world Hebrew SRT punctuation conventions before isolating cue lines and preserves timestamps, line endings and English-only lines. Ambiguous punctuation remains unchanged. WebVTT is passed through unchanged. The result was verified visually for one episode on desktop and Apple TV, not universally.

## Test

```sh
npm ci
node tests/rtl.test.js
node tests/probe.test.js
node tests/mode.test.js
npm start
```

To diagnose a source's availability, inspect Render logs: each search logs the number of subtitles returned per provider.

For **The Boys S02E04: Nothing Like It in the World** use series ID `tt1190634:2:4`. We downloaded actual Wizdom/Ktuvit/OpenSubtitles SRT files for this episode in the prior diagnostic workflow. Among 1,067 Hebrew lines, one Wizdom release had 933 leading punctuation lines and another had 933 trailing punctuation lines with RLE/PDF. Server-side normalization tests passed, but actual tvOS visual rendering remained incorrect. This is why the diagnostic probe exists.

## Implementation notes

No new runtime dependencies. The subtitle proxy uses 128-bit random short-lived download tokens and accepts only result URLs provided by the trusted upstream subtitle addons. It extracts .srt from ZIP and decodes UTF-8, Windows-1255 or BOM-identified UTF-16.

The three upstream subtitle services are outside this fork's control. If one fails, it may still show up independently in Stremio if you have its original addon installed; remove redundant addons only when you're satisfied with the aggregator.

The installer shows the actual active mode from the public `/status` endpoint. `apple` is an **experimental tvOS-specific convention** and is not guaranteed to improve every player. It is likely to produce the wrong punctuation on desktops that expect logical RTL punctuation.

## tvOS rendering probe (diagnostic, no confirmed fix yet)

If `off`, `on` and `apple` still leave punctuation reversed on tvOS,
temporarily set `RTL_MODE=probe` in Render and deploy. The addon returns
exactly four variants **from the same subtitle file for each source**:

- `[PROBE-RAW]`: Unmodified source.
- `[PROBE-RLM]`: Normalize legacy leading punctuation back to logical order, then prepend U+200F RIGHT-TO-LEFT MARK to Hebrew lines.
- `[PROBE-RLI]`: Same logical normalization, wrap each Hebrew line in U+2067 RIGHT-TO-LEFT ISOLATE and U+2069 POP DIRECTIONAL ISOLATE.
- `[PROBE-VTT]`: Convert to WebVTT with `align:start` and U+200F. The `.vtt` URL extension and MIME are set explicitly.

Select variants from **the same source** at the same timestamp, ideally The Boys S02E04.
Do not compare arbitrary different release files: the originals use different
punctuation conventions. The node server logs only the probe format and byte
size when selected, never the subtitle dialogue or credential data.

This is an **instrumented experiment**, NOT a resolved RTL fix. If none of the
variants works in KSPlayer or libVLC, the native subtitle renderer likely needs
a bidi/base-paragraph-direction fix. Restore `RTL_MODE=off` after testing,
especially for desktop, where RTL processing can be counterproductive.

To verify that the flag is active, open `/status` and check
`"rtlMode":"probe"`. If all four choices display the same output, inspect
Render logs for `[HebSubScout] served probe-...` to determine whether the
tvOS player requested the differing subtitle files.

## Production settings after Apple TV + desktop validation

Stremio on Apple TV: PROBE-RLI worked; RAW did not. On desktop, PROBE-RLI and RAW worked, but RLM/VTT did not. The server therefore now defaults to RLI for both players. Do **not** leave `RTL_MODE=probe` in Render after upgrading: that env var overrides the default. Set `RTL_MODE=rli` or remove the variable from Render entirely, then redeploy.

To check: open `/status` and confirm `"version":"2.0.5"` and `"rtlMode":"rli"`. Normal subtitle lists contain a single RLI-processed track per result; no PROBE variants.

If a particular release is still incorrect, test that specific file with `RTL_MODE=probe` temporarily and then report its provider/release label. Do not assume the RLI success on The Boys guarantees success on every subtitle or media player.
