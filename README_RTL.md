# HebSubScout RTL — Apple TV proof of concept

Based on [HebSubScout](https://github.com/shahar015/hebsubscout-stremio). Keeps existing matching, source providers, environment variables, Render blueprint, RD integration and installer page.

The addon has a distinct ID (`com.hebsubscout.rtl`) and returns **RTL** and **Original** tracks for the same Wizdom, Ktuvit and OpenSubtitles result. The RTL track adds Unicode RLE/PDF controls only to Hebrew SRT cue lines; punctuation is not reordered. **Not yet verified on tvOS hardware.**

### Local

```sh
npm ci
node tests/rtl.test.js
npm start
```

Open `http://localhost:7070/manifest.json` for local testing. Apple TV needs a publicly reachable HTTPS address.

### Deploy / install

Deploy **this fork** with the existing `render.yaml`. Set your credentials in Render, not GitHub. Existing `PORT`, `RD_TOKEN`, `KTUVIT_EMAIL`, `KTUVIT_PASSWORD`, `OPENSUBS_API_KEY`, `MEDIAFUSION_URL`, `BASE_URL` and `RENDER_EXTERNAL_URL` are supported as before; Ktuvit requires its hashed password. Then open `https://YOUR-RENDER-HOST/configure` or install `https://YOUR-RENDER-HOST/manifest.json` with the same Stremio account as Apple TV.

Choose one RTL track and its Original counterpart on the *same* video. Track labels depend on the Stremio client. Ktuvit and other proxy URLs expire after two hours (or restart); refresh subtitles to issue new links.

The proxy issues unguessable, short-lived download tokens instead of accepting arbitrary URLs. For wider public deployment, review upstream's user configuration URLs (these can contain secrets), rate limits and shared Ktuvit session behavior. Original provider/API constraints remain.
