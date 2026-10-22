/**
 * Fetch Hebrew subtitles from the installed ecosystem's Stremio addons.
 * Keep the existing Wizdom lookup only as a fallback.
 */
const fetch = require('node-fetch');
const cache = require('./cache');
const ADDONS = [
  ['opensubtitles', 'https://opensubtitles-v3.strem.io'],
  ['ktuvit', 'https://4b139a4b7f94-ktuvit-stremio.baby-beamup.club'],
  ['wizdom', 'https://4b139a4b7f94-wizdom-stremio-v2.baby-beamup.club'],
];

async function searchAddon(provider, base, imdbId, season, episode) {
  const type = season == null ? 'movie' : 'series';
  const id = [imdbId, season, episode].filter(v => v != null).join(':');
  try {
    const resp = await fetch(`${base}/subtitles/${type}/${id}.json`, { timeout: 12000 });
    if (!resp.ok) return [];
    const data = await resp.json();
    if (!Array.isArray(data.subtitles)) return [];
    return data.subtitles.flatMap((sub, i) => {
      if (!['he', 'heb', 'iw'].includes(String(sub.lang || '').toLowerCase())) return [];
      if (typeof sub.url !== 'string' || !sub.url.startsWith('https://')) return [];
      const id = String(sub.id || i);
      return [{ id, provider, downloadUrl: sub.url, name: id.length > 6 ? id : String(sub.label || id) }];
    });
  } catch (err) {
    console.warn(`[HebSubScout] ${provider} addon unavailable: ${err.message}`);
    return [];
  }
}

// Upstream Wizdom implementation, retained as fallback.
async function searchWizdom(imdbId, season, episode) {
  const cacheKey = `wizdom:${imdbId}:${season || 0}:${episode || 0}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    let url = `https://wizdom.xyz/api/search?action=by_id&imdb=${imdbId}`;
    if (season != null && episode != null) {
      url += `&season=${season}&episode=${episode}`;
    }

    const resp = await fetch(url, { timeout: 8000 });
    if (!resp.ok) return [];
    const data = await resp.json();

    let results = [];

    if (Array.isArray(data)) {
      // Direct array response
      results = data
        .filter(s => (s.versioname || s.version) && s.id)
        .map(s => ({
          id: String(s.id),
          name: s.versioname || s.version || '',
          provider: 'wizdom',
          downloadUrl: `https://wizdom.xyz/api/files/sub/${s.id}`,
        }));
    }

    // Fallback: releases endpoint
    if (results.length === 0) {
      try {
        const fallbackResp = await fetch(`https://wizdom.xyz/api/releases/${imdbId}`, { timeout: 8000 });
        if (fallbackResp.ok) {
          const fallbackData = await fallbackResp.json();
          if (fallbackData && fallbackData.subs) {
            let subs = fallbackData.subs;
            // TV: nested subs[season][episode]
            if (season != null && episode != null && subs[season]) {
              subs = subs[season][episode] || [];
            }
            if (Array.isArray(subs)) {
              results = subs
                .filter(s => (s.versioname || s.version) && s.id)
                .map(s => ({
                  id: String(s.id),
                  name: s.versioname || s.version || '',
                  provider: 'wizdom',
                  downloadUrl: `https://wizdom.xyz/api/files/sub/${s.id}`,
                }));
            }
          }
        }
      } catch (e) { /* fallback failed, ignore */ }
    }

    cache.set(cacheKey, results);
    return results;
  } catch (e) {
    console.error('Wizdom error:', e.message);
    return [];
  }
}

async function searchAll(imdbId, season, episode, _config = {}) {
  const key = `all:v3:${imdbId}:${season || 0}:${episode || 0}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const results = await Promise.all(
    ADDONS.map(([name, base]) => searchAddon(name, base, imdbId, season, episode))
  );
  if (results[2].length === 0) results[2] = await searchWizdom(imdbId, season, episode);
  const subtitles = results.flat();
  console.log(`[HebSubScout] ${imdbId} S${season || '-'}E${episode || '-'}: OpenSubtitles=${results[0].length}, Ktuvit=${results[1].length}, Wizdom=${results[2].length}`);
  cache.set(key, subtitles, subtitles.length ? 5 * 60 * 1000 : 60 * 1000);
  return subtitles;
}

module.exports = { searchAll };
