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

An opt-in compatibility **experiment**, not an automatic, universal fix:

| `RTL_MODE` env | Subtitle picker | Processing |
| --- | --- | --- |
| `off` (default) | One track from each provider | No directional edits |
| `compare` | Original and RTL-test versions | Compare on the same Apple TV player |
| `on` | One RTL-test track per provider result | Legacy RLE/PDF experiment (often worsens desktop punctuation) |
| `apple` | One Apple TV experimental track per provider result | Convert logical final punctuation to legacy leading punctuation, unwrapping RLE/PDF |
| `compare-apple` | Original and Apple TV versions | Side-by-side device testing |

The function is **idempotent**: running twice has the same result as running once. It respects existing Unicode BiDi marks, text in other languages, subtitle timestamps and WebVTT. It does not attempt to guess where punctuation belongs in historically pre-reversed SRTs, and RTL may still look worse on some players.

## Test

```sh
npm ci
node tests/rtl.test.js
npm start
```

To diagnose a source's availability, inspect Render logs: each search logs the number of subtitles returned per provider.

For **The Boys S02E04: Nothing Like It in the World** use series ID `tt1190634:2:4`. This task inspected the subtitle retrieval and renderer preprocessing code but could **not** fetch the exact Wizdom SRT file from the research environment; its visual punctuation order has not been verified. If you provide that SRT file, we can inspect the actual leading and trailing symbols and the exact Unicode controls without guessing.

## Implementation notes

No new runtime dependencies. The subtitle proxy uses 128-bit random short-lived download tokens and accepts only result URLs provided by the trusted upstream subtitle addons. It extracts .srt from ZIP and decodes UTF-8, Windows-1255 or BOM-identified UTF-16.

The three upstream subtitle services are outside this fork's control. If one fails, it may still show up independently in Stremio if you have its original addon installed; remove redundant addons only when you're satisfied with the aggregator.

The installer shows the actual active mode from the public `/status` endpoint. `apple` is an **experimental tvOS-specific convention** and is not guaranteed to improve every player. It is likely to produce the wrong punctuation on desktops that expect logical RTL punctuation.
