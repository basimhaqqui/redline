// Background service worker - handles Cobalt API requests and library storage

// ---- Context Menu ----

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'addToLibrary',
    title: 'Add to Library as MP3',
    contexts: ['link', 'page'],
    targetUrlPatterns: [
      'https://www.youtube.com/watch*',
      'https://youtube.com/watch*',
      'https://youtu.be/*',
      'https://www.youtube.com/shorts/*',
      'https://twitter.com/*/status/*',
      'https://x.com/*/status/*'
    ],
    documentUrlPatterns: [
      'https://www.youtube.com/*',
      'https://youtube.com/*',
      'https://twitter.com/*',
      'https://x.com/*'
    ]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'addToLibrary') return;

  // Use the link URL if right-clicked a link, otherwise the page URL
  const videoUrl = info.linkUrl || info.pageUrl;
  if (!videoUrl) return;

  // Validate it's a supported URL
  const isYouTube = /youtube\.com\/watch|youtube\.com\/shorts|youtu\.be\//.test(videoUrl);
  const isTwitter = /twitter\.com\/.*\/status|x\.com\/.*\/status/.test(videoUrl);
  if (!isYouTube && !isTwitter) return;

  try {
    // Convert
    const result = await handleConvert(videoUrl, null);

    // Extract YouTube video ID for thumbnail
    const videoIdMatch = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    // For Twitter, try to get the tweet text and video thumbnail
    let trackName = result.filename.replace(/\.[^/.]+$/, '');
    let thumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;

    if (isTwitter) {
      try {
        const tweetResp = await new Promise((resolve) => {
          chrome.tabs.sendMessage(tab.id, { action: 'getTweetText' }, (r) => {
            resolve(r || {});
          });
        });
        if (tweetResp.text) trackName = tweetResp.text;
        if (tweetResp.thumbnail) thumbnail = tweetResp.thumbnail;
      } catch (e) {
        // Fallback to filename
      }
    }

    // Save to library
    await handleSaveToLibrary({
      downloadUrl: result.downloadUrl,
      name: trackName,
      source: isYouTube ? 'YouTube' : 'Twitter/X',
      sourceUrl: videoUrl,
      thumbnail: thumbnail
    });

    // Notify user
    chrome.tabs.sendMessage(tab.id, { action: 'showNotification', message: 'Added to Library' });
  } catch (err) {
    console.error('Context menu convert failed:', err);
    chrome.tabs.sendMessage(tab.id, { action: 'showNotification', message: 'Failed: ' + err.message });
  }
});

const FALLBACK_INSTANCES = [
  'https://cobaltapi.squair.xyz/',
  'https://cobaltapi.kittycat.boo/',
  'https://dog.kittycat.boo/',
  'https://fox.kittycat.boo/',
  'https://cobaltapi.cjs.nz/',
  'https://api.cobalt.liubquanti.click/',
  'https://api.cobalt.blackcat.sweeux.org/',
];

// ---- IndexedDB helpers (runs in service worker context) ----

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MusicPlayerDB', 1);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('tracks')) {
        const store = db.createObjectStore('tracks', { keyPath: 'id', autoIncrement: true });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('dateAdded', 'dateAdded', { unique: false });
        store.createIndex('favorite', 'favorite', { unique: false });
      }
      if (!db.objectStoreNames.contains('playlists')) {
        db.createObjectStore('playlists', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('recent')) {
        db.createObjectStore('recent', { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function saveTrack(track) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['tracks'], 'readwrite');
    const store = tx.objectStore('tracks');
    const req = store.add(track);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Convert a URL to a base64 data URL
async function urlToDataUrl(url, forceMime = null) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  console.log(`[background] Fetched ${url} - type: ${blob.type}, size: ${blob.size}`);

  // YouTube returns a tiny ~1-2KB default image when maxresdefault doesn't exist
  // Reject small images so we can fall back to hqdefault
  if (blob.type && blob.type.startsWith('image/') && blob.size < 5000) {
    throw new Error('Image too small, likely a placeholder');
  }

  // If the blob has no type or wrong type, force the correct MIME
  const finalBlob = forceMime && (!blob.type || !blob.type.startsWith('audio/'))
    ? new Blob([blob], { type: forceMime })
    : blob;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(finalBlob);
  });
}

// ---- Clean up track names ----

function cleanTrackName(name) {
  let cleaned = name
    // Remove common YouTube suffixes
    .replace(/\s*\(official\s*(music\s*)?video\)/gi, '')
    .replace(/\s*\(official\s*audio\)/gi, '')
    .replace(/\s*\(official\s*lyric\s*video\)/gi, '')
    .replace(/\s*\(official\s*visualizer\)/gi, '')
    .replace(/\s*\(official\)/gi, '')
    .replace(/\s*\[official\s*(music\s*)?video\]/gi, '')
    .replace(/\s*\[official\s*audio\]/gi, '')
    .replace(/\s*\(lyrics?\)/gi, '')
    .replace(/\s*\[lyrics?\]/gi, '')
    .replace(/\s*\(lyric\s*video\)/gi, '')
    .replace(/\s*\[lyric\s*video\]/gi, '')
    .replace(/\s*\(audio\)/gi, '')
    .replace(/\s*\[audio\]/gi, '')
    .replace(/\s*\(visualizer\)/gi, '')
    .replace(/\s*\[visualizer\]/gi, '')
    .replace(/\s*\(music\s*video\)/gi, '')
    .replace(/\s*\[music\s*video\]/gi, '')
    .replace(/\s*\(prod\.?\s*[^)]*\)/gi, '')
    .replace(/\s*\(dir\.?\s*[^)]*\)/gi, '')
    .replace(/\s*\(directed\s+by\s*[^)]*\)/gi, '')
    // Remove quality tags
    .replace(/\s*\(?(HD|HQ|4K|1080p|720p|high\s*quality)\)?/gi, '')
    .replace(/\s*\[?(HD|HQ|4K|1080p|720p)\]?/gi, '')
    // Remove year tags like (2021), [2024], etc.
    .replace(/\s*\(?(19|20)\d{2}\)?/gi, '')
    .replace(/\s*\[?(19|20)\d{2}\]?/gi, '')
    // Remove "ft." "feat." variations but keep the artist name
    .replace(/\s*\(ft\.?\s*/gi, ' ft. ')
    .replace(/\s*\(feat\.?\s*/gi, ' feat. ')
    .replace(/\)$/g, '')
    // Remove leading/trailing special chars
    .replace(/^\s*[-|:]\s*/, '')
    .replace(/\s*[-|:]\s*$/, '')
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned;
}

// ---- Look up actual artist/title via iTunes ----

async function lookupTrackInfo(rawName) {
  const result = await _lookupTrackInfoInner(rawName);

  // Fetch album + track number + thumbnail from Genius song detail API if we have a songId
  if (result.songId) {
    try {
      const albumInfo = await fetchGeniusAlbum(result.songId);
      if (albumInfo.name) result.album = albumInfo.name;
      if (albumInfo.trackNumber) result.trackNumber = albumInfo.trackNumber;
      if (albumInfo.thumbnail) result.thumbnail = albumInfo.thumbnail;
      if (albumInfo.artworkFull) result.artworkFull = albumInfo.artworkFull;
    } catch (e) {
      console.log('[background] Album fetch failed:', e.message);
    }
  }
  if (!result.album) result.album = '';
  if (!result.trackNumber) result.trackNumber = null;
  if (!result.thumbnail) result.thumbnail = '';
  if (!result.artworkFull) result.artworkFull = '';
  return result;
}

async function fetchGeniusAlbum(songId) {
  const resp = await fetch(`https://genius.com/api/songs/${songId}`);
  const data = await resp.json();
  const song = data?.response?.song;
  const album = song?.album;
  const artworkFull = song?.song_art_image_url || '';
  const thumbnail = artworkFull || song?.song_art_image_thumbnail_url || '';

  if (!album) return { name: '', trackNumber: null, thumbnail, artworkFull };

  // Fetch track number from album tracklist
  let trackNumber = null;
  try {
    const tracksResp = await fetch(`https://genius.com/api/albums/${album.id}/tracks`);
    const tracksData = await tracksResp.json();
    const tracks = tracksData?.response?.tracks || [];
    const match = tracks.find(t => t.song?.id === songId);
    if (match) trackNumber = match.number;
  } catch (e) {
    console.log('[background] Track number fetch failed:', e.message);
  }

  return { name: album.name || '', trackNumber, thumbnail, artworkFull };
}

async function fetchAlbumForTrack(title, artist) {
  // Search Genius with artist + title for precise matching
  const query = artist ? `${artist} ${title}` : title;
  const searchQuery = query.replace(/&/g, 'and');
  const url = `https://genius.com/api/search/multi?q=${encodeURIComponent(searchQuery)}`;

  const searchResp = await fetch(url);
  const searchData = await searchResp.json();
  const sections = searchData?.response?.sections || [];
  const songSection = sections.find(s => s.type === 'song');
  const hits = songSection?.hits || [];

  if (hits.length === 0) return '';

  const artistLower = (artist || '').toLowerCase().replace(/&/g, 'and').trim();
  const titleLower = title.toLowerCase();

  for (const hit of hits.slice(0, 5)) {
    const song = hit.result;
    if (!song) continue;

    const geniusArtist = (song.primary_artist?.name || '').toLowerCase();
    const geniusTitle = (song.title || '').toLowerCase();

    // Artist match — use word boundary matching for short names (e.g. "Ye")
    let artistMatch = false;
    if (artistLower) {
      const artistWords = artistLower.split(/\s+/);
      const geniusArtistWords = geniusArtist.split(/\s+/);
      artistMatch = artistWords.some(w => geniusArtistWords.includes(w)) ||
                    geniusArtist === artistLower;
    }

    // Title match — fuzzy: check if most characters match (handles typos like CIRLCES/CIRCLES)
    const titleMatch = geniusTitle === titleLower ||
      geniusTitle.includes(titleLower) ||
      titleLower.includes(geniusTitle) ||
      fuzzyTitleMatch(titleLower, geniusTitle);

    if (artistMatch && titleMatch && song.id) {
      console.log(`[background] Album lookup matched: "${song.primary_artist.name} - ${song.title}" (id: ${song.id})`);
      const albumInfo = await fetchGeniusAlbum(song.id);
      // Normalize edition names: "BULLY (First Pressing Edition)" → "BULLY"
      const albumName = albumInfo.name.replace(/\s*\(.*?(edition|deluxe|version|remaster|expanded|bonus).*?\)\s*$/i, '').trim();
      return { album: albumName, trackNumber: albumInfo.trackNumber, thumbnail: albumInfo.thumbnail, artworkFull: albumInfo.artworkFull };
    }
  }

  return { album: '', trackNumber: null, thumbnail: '', artworkFull: '' };
}

function fuzzyTitleMatch(a, b) {
  // Allow match if same length (±1) and at least 80% of characters overlap
  if (Math.abs(a.length - b.length) > 2) return false;
  const sorted = s => s.split('').sort().join('');
  const sa = sorted(a.replace(/\s/g, ''));
  const sb = sorted(b.replace(/\s/g, ''));
  if (sa === sb) return true; // anagram match (handles letter swaps like CIRLCES/CIRCLES)
  let matches = 0;
  for (let i = 0; i < Math.min(sa.length, sb.length); i++) {
    if (sa[i] === sb[i]) matches++;
  }
  return matches / Math.max(sa.length, sb.length) >= 0.8;
}

async function _lookupTrackInfoInner(rawName) {
  console.log(`[background] Genius lookup for: "${rawName}"`);

  // Extract quoted text as likely song title (common in tweets like: YE KODAK BLACK "BULLETPROOF")
  // Match paired quotes only — avoid straight apostrophe which appears in contractions (THAT'S, DON'T)
  const quotedMatch = rawName.match(/[""\u201C]([^""\u201C\u201D]+)[""\u201D]/) ||   // double quotes: "..." "..."
                      rawName.match(/[\u2018]([^\u2018\u2019]+)[\u2019]/);            // smart single quotes: '...'
  const quotedTitle = quotedMatch ? quotedMatch[1].trim() : null;

  // Extract artist context from non-quoted, non-junk text
  let extractedArtist = '';
  if (quotedTitle) {
    const junkPhrases = /^(new\s*(leak|music|song|drop|release|snippet)|out\s*now|listen\s*now|stream\s*now|link\s*in|coming\s*soon|dropping|released|available|from\s*\.|retweet|like\s*&|follow|subscribe|check\s*out|premiered|exclusive|snippet|unreleased|produced\s*by|prod\s*by|directed\s*by)/i;

    extractedArtist = rawName
      .replace(/[""\u201C][^""\u201C\u201D]+[""\u201D]/, '')  // remove quoted title
      .replace(/[\u2018][^\u2018\u2019]+[\u2019]/, '')
      .split('\n')
      .map(l => l.replace(/[^\w\s&'-]/g, '').trim())  // remove emojis/symbols
      .filter(l => l.length > 1 && !junkPhrases.test(l))
      .join(' & ');
  }

  // If we found a quoted title, search that first (most specific)
  if (quotedTitle) {
    // Search: "BULLETPROOF Kodak Black Ye"
    let result = await searchGenius(`${quotedTitle} ${extractedArtist}`);
    if (result) return result;

    // Try just the quoted title
    result = await searchGenius(quotedTitle);
    if (result) {
      // If Genius found the song but no artist, use the extracted artist from tweet
      if (!result.artist && extractedArtist) {
        result.artist = extractedArtist;
      }
      return result;
    }

    // Genius doesn't have it — use what we extracted from the tweet
    return { title: quotedTitle, artist: extractedArtist };
  }

  // Step 1: Search the raw name as-is
  let result = await searchGenius(rawName);
  if (result) return result;

  // Step 2: Clean and try again
  let cleaned = cleanTrackName(rawName);
  const segments = cleaned.split(/\s*[-–—]\s*/);

  // Search with all segments joined (e.g. "YEAT MONEY TWERK 4" instead of just "YEAT")
  const joinedSearch = segments.join(' ');
  result = await searchGenius(joinedSearch);
  if (result) return result;

  // If "Artist - Title" format, try title + artist order (better for Genius search)
  if (segments.length >= 2) {
    const titlePart = segments.slice(1).join(' ');
    const artistPart = segments[0];
    result = await searchGenius(`${titlePart} ${artistPart}`);
    if (result) return result;
  }

  // Step 3: Strip even more and try
  const simple = cleaned
    .replace(/\s*\(.*?\)/g, '')
    .replace(/\s*\[.*?\]/g, '')
    .replace(/["''""]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (simple !== cleaned) {
    result = await searchGenius(simple);
    if (result) return result;
  }

  // Step 4: If tweet-like multiline text, try each line
  const lines = rawName.split('\n').map(l => l.trim()).filter(l => l.length > 2);
  if (lines.length > 1) {
    // Filter out common non-song tweet phrases
    const junkPhrases = /^(new\s*(leak|music|song|drop|release|snippet)|out\s*now|listen\s*now|stream\s*now|link\s*in|coming\s*soon|dropping|released|available|from\s*\.|retweet|like\s*&|follow|subscribe|check\s*out|🚨|🔥|💿|🎵|🎶)/i;

    const filtered = lines.filter(line => {
      const clean = line.replace(/[^\w\s]/g, '').trim();
      return clean.length > 2 && !junkPhrases.test(clean);
    });

    // Try longest filtered line first (likely the title)
    const sorted = [...filtered].sort((a, b) => b.length - a.length);
    for (const line of sorted) {
      const cleanLine = line.replace(/["''""]/g, '').replace(/[^\w\s'-]/g, '').trim();
      if (cleanLine.length > 2) {
        result = await searchGenius(cleanLine);
        if (result) return result;
      }
    }
  }

  console.log('[background] No Genius match found');

  // If the name has "Artist - Title" format, split it properly for the fallback
  const fullCleaned = cleanTrackName(rawName);
  const dashSegments = fullCleaned.split(/\s*[-–—]\s*/);
  if (dashSegments.length >= 2) {
    return { title: dashSegments.slice(1).join(' - '), artist: dashSegments[0] };
  }

  return { title: quotedTitle || fullCleaned, artist: '' };
}

async function searchGenius(query) {
  if (!query || query.length < 3) return null;

  try {
    const url = `https://genius.com/api/search/multi?q=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    const data = await response.json();

    const sections = data?.response?.sections || [];
    const songSection = sections.find(s => s.type === 'song');
    const hits = songSection?.hits || [];

    if (hits.length === 0) return null;

    return pickBestGeniusMatch(hits, query);
  } catch (err) {
    console.log(`[background] Genius search failed for "${query}":`, err.message);
    return null;
  }
}

function pickBestGeniusMatch(hits, query) {
  const queryLower = query.toLowerCase()
    .replace(/\s*\(official\s*(music\s*)?video\)/gi, '')
    .replace(/\s*\(official\s*audio\)/gi, '')
    .replace(/\s*\(lyrics?\)/gi, '')
    .replace(/["''""]/g, '')
    .replace(/&/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Extract meaningful words from query (skip common junk)
  const queryWords = queryLower.split(/\s+/).filter(w =>
    w.length > 1 && !['the', 'a', 'an', 'of', 'in', 'on', 'my', 'official', 'audio', 'video', 'music', 'lyrics'].includes(w)
  );

  let bestHit = null;
  let bestScore = -1;

  for (const hit of hits.slice(0, 10)) {
    const song = hit.result;
    if (!song) continue;

    let score = 0;
    const geniusTitle = (song.title || '').toLowerCase();
    const geniusArtist = (song.primary_artist?.name || '').toLowerCase();
    const geniusArtistNorm = geniusArtist.replace(/&/g, ' ').replace(/\s+/g, ' ').trim();

    // PRIORITY: Song title match (worth the most)
    // Check if the Genius title words appear in the query
    const titleWords = geniusTitle.split(/\s+/).filter(w => w.length > 1);
    let titleWordsMatched = 0;
    for (const w of titleWords) {
      if (queryLower.includes(w)) titleWordsMatched++;
    }
    if (titleWords.length > 0) {
      const titleMatchRatio = titleWordsMatched / titleWords.length;
      if (titleMatchRatio === 1) score += 10;      // All title words found
      else if (titleMatchRatio >= 0.7) score += 7;
      else if (titleMatchRatio >= 0.5) score += 4;
    }

    // Exact title substring match
    if (queryLower.includes(geniusTitle)) score += 8;

    // Artist name appears in query (secondary) — normalize ampersands
    if (queryLower.includes(geniusArtist) || queryLower.includes(geniusArtistNorm)) score += 3;

    // Check if individual artist names match (for "Ye & Kodak Black" -> check "ye", "kodak", "black")
    const artistWords = geniusArtistNorm.split(/\s+/).filter(w => w.length > 1);
    const artistWordsMatched = artistWords.filter(w => queryLower.includes(w)).length;
    if (artistWords.length > 0 && artistWordsMatched === artistWords.length) score += 3;

    // Penalize if title doesn't appear at all
    if (titleWordsMatched === 0) score -= 5;

    if (score > bestScore) {
      bestScore = score;
      bestHit = hit;
    }
  }

  if (!bestHit || bestScore < 5) {
    return null; // No good match, let next search attempt try
  }

  const song = bestHit.result;
  const title = song?.title || query;
  const artist = song?.primary_artist?.name || '';
  const url = song?.url || null;
  const songId = song?.id || null;

  console.log(`[background] Genius match: "${artist} - ${title}" (score: ${bestScore})`);
  return { title, artist, url, songId };
}

// ---- Save album (chaptered video) ----

async function handleSaveAlbum(albumInfo) {
  console.log(`[background] Saving album: ${albumInfo.tracks.length} tracks`);

  // Fetch the full audio once
  const audioResp = await fetch(albumInfo.downloadUrl);
  const audioBlob = await audioResp.blob();
  const contentType = audioResp.headers.get('content-type') || audioBlob.type || '';

  if (audioBlob.size < 1000) {
    throw new Error('Audio too small, likely invalid');
  }

  let mimeType = 'audio/mpeg';
  if (contentType.includes('webm')) mimeType = 'audio/webm';
  else if (contentType.includes('ogg')) mimeType = 'audio/ogg';
  else if (contentType.includes('mp4') || contentType.includes('m4a')) mimeType = 'audio/mp4';
  else if (contentType.startsWith('audio/')) mimeType = contentType.split(';')[0];

  const typedBlob = new Blob([audioBlob], { type: mimeType });
  const audioData = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(typedBlob);
  });

  // Fetch thumbnail — try maxresdefault, fall back to hqdefault
  let thumbnailData = null;
  const albumThumbSources = [
    albumInfo.thumbnail,
    albumInfo.thumbnail?.replace('maxresdefault', 'hqdefault'),
  ].filter(Boolean);
  for (const src of albumThumbSources) {
    try {
      thumbnailData = await urlToDataUrl(src);
      break;
    } catch (e) {
      console.log(`[background] Album thumb failed for ${src.slice(0, 80)}`);
    }
  }
  if (!thumbnailData && albumInfo.thumbnail) thumbnailData = albumInfo.thumbnail;

  // Save each chapter as a separate track
  for (const chapterTrack of albumInfo.tracks) {
    const lookupRes = await lookupTrackInfo(chapterTrack.title);
    const { title, artist, album, trackNumber, artworkFull } = lookupRes;

    const track = {
      name: artist ? `${artist} - ${title}` : title,
      originalName: chapterTrack.title,
      title: title,
      artist: artist,
      album: album || '',
      trackNumber: trackNumber || null,
      artworkFull: artworkFull || '',
      source: albumInfo.source,
      sourceUrl: albumInfo.sourceUrl,
      thumbnail: thumbnailData,
      audioData: audioData,
      startTime: chapterTrack.startTime,
      endTime: chapterTrack.endTime,
      dateAdded: new Date().toISOString(),
      favorite: false,
      playCount: 0
    };

    await saveTrack(track);
    console.log(`[background] Saved chapter: ${track.name} (${chapterTrack.startTime}s - ${chapterTrack.endTime || 'end'}s)`);
  }
}

// ---- Fetch synced lyrics from LRCLIB ----

async function fetchSyncedLyrics(title, artist) {
  const params = new URLSearchParams({ artist_name: artist, track_name: title });
  const resp = await fetch(`https://lrclib.net/api/get?${params}`);
  if (!resp.ok) return null;

  const data = await resp.json();
  if (data.syncedLyrics) {
    // Parse LRC format: [mm:ss.xx] text
    const lines = data.syncedLyrics.split('\n').map(line => {
      const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)/);
      if (!match) return null;
      const mins = parseInt(match[1]);
      const secs = parseInt(match[2]);
      const ms = parseInt(match[3].padEnd(3, '0'));
      return { time: mins * 60 + secs + ms / 1000, text: match[4] };
    }).filter(l => l !== null);

    if (lines.length > 0) {
      return {
        synced: true,
        lines,
        plainText: lines.map(l => l.text).join('\n')
      };
    }
  }

  // Fall back to plain lyrics from LRCLIB if available
  if (data.plainLyrics) {
    return {
      synced: false,
      lines: null,
      plainText: data.plainLyrics
    };
  }

  return null;
}

// ---- Fetch lyrics from Genius ----

async function fetchLyrics(title, artist) {
  // Search Genius for the song — normalize ampersands for better search
  const query = artist ? `${artist} ${title}` : title;
  const searchQuery = query.replace(/&/g, 'and');
  const searchUrl = `https://genius.com/api/search/multi?q=${encodeURIComponent(searchQuery)}`;

  const searchResp = await fetch(searchUrl);
  const searchData = await searchResp.json();

  const sections = searchData?.response?.sections || [];
  const songSection = sections.find(s => s.type === 'song');
  const hits = songSection?.hits || [];

  if (hits.length === 0) {
    throw new Error('Song not found on Genius');
  }

  // Pick the best match
  const match = pickBestGeniusMatch(hits, query);
  if (!match) {
    throw new Error('No matching song found');
  }

  // Use URL from the match directly
  const songUrl = match.url || hits[0].result?.url;

  if (!songUrl) {
    throw new Error('Could not find song page');
  }

  // Fetch the Genius page and extract lyrics
  console.log(`[background] Fetching lyrics from: ${songUrl}`);
  const pageResp = await fetch(songUrl);
  const html = await pageResp.text();

  // Extract lyrics from data-lyrics-container elements
  const lyrics = extractLyricsFromHTML(html);

  if (!lyrics || lyrics.trim().length === 0) {
    throw new Error('Lyrics not available');
  }

  return {
    lyrics: lyrics,
    songUrl: songUrl,
    title: match.title,
    artist: match.artist
  };
}

function extractLyricsFromHTML(html) {
  // Method 1: Try __PRELOADED_STATE__ JSON (most reliable, has full lyrics)
  const preloadMatch = html.match(/window\.__PRELOADED_STATE__\s*=\s*JSON\.parse\('(.+?)'\)/s);
  if (preloadMatch) {
    try {
      // Genius double-escapes the JSON string
      const jsonStr = preloadMatch[1]
        .replace(/\\'/g, "'")
        .replace(/\\\\"/g, '\\"')
        .replace(/\\\\/g, '\\');
      const data = JSON.parse(jsonStr);
      const lyricsData = findInPreloadedState(data, 'lyrics');
      if (lyricsData && lyricsData.plain) {
        console.log('[background] Extracted lyrics from __PRELOADED_STATE__');
        return cleanLyricsText(lyricsData.plain);
      }
    } catch (e) {
      console.log('[background] Preloaded state parse failed, falling back to HTML');
    }
  }

  // Method 2: Extract from data-lyrics-container elements in HTML
  const lyrics = [];
  const containerRegex = /data-lyrics-container="true"[^>]*>([\s\S]*?)(?=<div[^>]*data-lyrics-container="true"|<div[^>]*class="LyricsFooter|<div[^>]*class="RightSidebar|$)/gi;
  let match;

  while ((match = containerRegex.exec(html)) !== null) {
    let chunk = match[1];

    // The chunk may include trailing </div> tags from the container — strip them
    // Count unclosed divs and trim the matching closing tags from the end
    const opens = (chunk.match(/<div[\s>]/gi) || []).length;
    const closes = (chunk.match(/<\/div>/gi) || []).length;
    const excess = closes - opens;
    if (excess > 0) {
      // Remove the last N </div> tags (they belong to parent containers)
      for (let i = 0; i < excess; i++) {
        const lastClose = chunk.lastIndexOf('</div>');
        if (lastClose !== -1) {
          chunk = chunk.substring(0, lastClose);
        }
      }
    }

    lyrics.push(chunk);
  }

  // Method 3: Fallback — manual div depth tracking
  if (lyrics.length === 0) {
    const marker = 'data-lyrics-container="true"';
    let searchFrom = 0;

    while (true) {
      const start = html.indexOf(marker, searchFrom);
      if (start === -1) break;

      const tagEnd = html.indexOf('>', start);
      if (tagEnd === -1) break;

      let depth = 1;
      let pos = tagEnd + 1;
      while (depth > 0 && pos < html.length) {
        const nextOpen = html.indexOf('<div', pos);
        const nextClose = html.indexOf('</div>', pos);

        if (nextClose === -1) break;

        if (nextOpen !== -1 && nextOpen < nextClose) {
          depth++;
          pos = nextOpen + 4;
        } else {
          depth--;
          if (depth === 0) {
            lyrics.push(html.substring(tagEnd + 1, nextClose));
          }
          pos = nextClose + 6;
        }
      }

      searchFrom = pos;
    }
  }

  let result = lyrics.map(chunk => {
    chunk = chunk.replace(/<br\s*\/?>/gi, '\n');
    chunk = chunk.replace(/<[^>]+>/g, '');
    chunk = decodeHTMLEntities(chunk);
    return chunk;
  }).join('\n');

  return cleanLyricsText(result);
}

function decodeHTMLEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8217;/g, "\u2019")
    .replace(/&#8216;/g, "\u2018")
    .replace(/&#8220;/g, "\u201C")
    .replace(/&#8221;/g, "\u201D")
    .replace(/&#\d+;/g, m => {
      const code = parseInt(m.slice(2, -1));
      return String.fromCharCode(code);
    })
    .replace(/&#x[0-9a-fA-F]+;/g, m => {
      const code = parseInt(m.slice(3, -1), 16);
      return String.fromCharCode(code);
    });
}

function cleanLyricsText(text) {
  return text
    .replace(/^\d+\s*Contributors.*$/gm, '')
    .replace(/^Translations.*$/gm, '')
    .replace(/^Espa[ñn]ol.*$/gm, '')
    .replace(/^Portugu[eê]s.*$/gm, '')
    .replace(/^Français.*$/gm, '')
    .replace(/^Deutsch.*$/gm, '')
    .replace(/^See.*translation.*$/gim, '')
    .replace(/^Embed$/gm, '')
    .replace(/^You might also like$/gm, '')
    .replace(/^\d+Embed$/gm, '')
    .replace(/^\s*\n\s*\n\s*\n/gm, '\n\n')
    .trim();
}

function findInPreloadedState(obj, key) {
  if (!obj || typeof obj !== 'object') return null;
  if (obj[key] && typeof obj[key] === 'object' && obj[key].plain) return obj[key];
  for (const val of Object.values(obj)) {
    if (val && typeof val === 'object') {
      const found = findInPreloadedState(val, key);
      if (found) return found;
    }
  }
  return null;
}

// ---- Message handler ----

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'convert') {
    handleConvert(request.videoUrl, request.customInstance)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'saveAlbum') {
    handleSaveAlbum(request.trackInfo)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'fetchLyrics') {
    fetchLyrics(request.title, request.artist)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'lookupTrack') {
    lookupTrackInfo(request.name)
      .then(result => sendResponse(result))
      .catch(() => sendResponse({ title: request.name, artist: '' }));
    return true;
  }

  if (request.action === 'fetchAlbum') {
    fetchAlbumForTrack(request.title, request.artist)
      .then(result => sendResponse(result))
      .catch(() => sendResponse({ album: '', trackNumber: null }));
    return true;
  }

  if (request.action === 'saveToLibrary') {
    handleSaveToLibrary(request.trackInfo)
      .then(id => sendResponse({ success: true, trackId: id }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// ---- Convert video URL to MP3 download URL ----

function cobaltErrorMessage(code, status) {
  const messages = {
    'error.api.content.video.unavailable': 'This video is unavailable or private',
    'error.api.content.video.live': "Can't download live streams",
    'error.api.content.video.age': 'This video is age-restricted',
    'error.api.content.video.region': 'This video is region-locked',
    'error.api.content.post.unavailable': 'This post is unavailable or private',
    'error.api.link.invalid': 'Invalid or unsupported URL',
    'error.api.link.unsupported': 'This platform is not supported',
    'error.api.rate_exceeded': 'Rate limited — try again in a moment',
    'error.api.content.too_long': 'Video is too long to process',
    'error.api.youtube.login': 'YouTube is currently blocking all downloads. This is a platform-wide issue — try again later.',
    'error.api.auth.jwt.missing': 'This server requires an API key',
    'error.api.youtube.decipher': 'YouTube blocked this request — try again later',
    'error.api.youtube.token_expired': 'YouTube session expired — try again',
  };
  if (code && messages[code]) return messages[code];
  if (code && code.startsWith('error.api.content.')) return 'This content cannot be downloaded';
  if (code && code.startsWith('error.api.youtube.')) return 'YouTube blocked this video';
  return null;
}

async function handleConvert(videoUrl, customInstance) {
  let instances = [];

  if (customInstance) {
    instances.push(customInstance);
  }

  try {
    const dynamic = await fetchInstances();
    instances = [...instances, ...dynamic];
  } catch (e) {
    // ignore
  }

  instances = [...new Set([...instances, ...FALLBACK_INSTANCES])];

  let lastError = '';

  console.log(`[background] Converting: ${videoUrl}`);
  console.log(`[background] Trying ${instances.length} instances`);

  for (const instance of instances) {
    try {
      const apiUrl = instance.endsWith('/') ? instance : instance + '/';
      console.log(`[background] Trying: ${apiUrl}`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: videoUrl,
          downloadMode: 'audio',
          audioFormat: 'mp3',
          audioBitrate: '320'
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      const data = await response.json().catch(() => null);
      console.log(`[background] ${new URL(apiUrl).hostname} [${response.status}]:`, data);

      if (!response.ok || data?.status === 'error') {
        const errorCode = data?.error?.code || '';
        const friendlyMsg = cobaltErrorMessage(errorCode, response.status);
        lastError = friendlyMsg || `${new URL(apiUrl).hostname}: HTTP ${response.status}`;
        // If the error is about the content itself, no point trying other instances
        // Skip to next instance for auth errors, bail entirely for content errors
        if (errorCode.includes('auth.')) {
          continue;
        }
        if (errorCode.includes('content.') || errorCode.includes('link.')) {
          throw new Error(lastError);
        }
        // youtube.login means this instance's cookies expired — try the next one
        continue;
      }

      let downloadUrl = null;
      let filename = 'audio';

      if (data.url) {
        downloadUrl = data.url;
        filename = data.filename || 'audio';
      } else if (data.status === 'picker' && data.picker?.length > 0) {
        const audioOption = data.picker.find(p => p.type === 'audio') || data.picker[0];
        downloadUrl = audioOption.url;
        filename = audioOption.filename || 'audio';
      }

      if (!downloadUrl) {
        lastError = `${new URL(apiUrl).hostname}: No download URL`;
        continue;
      }

      return { downloadUrl, filename, instance: new URL(apiUrl).hostname };
    } catch (err) {
      lastError = err.name === 'AbortError'
        ? `${instance}: Timed out`
        : `${instance}: ${err.message}`;
      console.log(`[background] ${instance} failed:`, err.message);
      continue;
    }
  }

  // Fallback: try self-hosted yt-dlp API
  try {
    console.log('[background] All Cobalt instances failed, trying yt-dlp fallback...');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const response = await fetch('https://redline-api-fy7t.onrender.com/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ url: videoUrl }),
      signal: controller.signal
    });

    clearTimeout(timeout);
    const data = await response.json();

    if (data.status === 'tunnel' && data.url) {
      return { downloadUrl: data.url, filename: data.filename || 'audio', instance: 'redline-api' };
    }

    lastError = data.error || 'yt-dlp fallback failed';
  } catch (err) {
    lastError = `yt-dlp fallback: ${err.message}`;
    console.log('[background] yt-dlp fallback failed:', err.message);
  }

  throw new Error(`All servers failed. Last: ${lastError}`);
}

// ---- Save track: fetch audio + thumbnail, store in IndexedDB ----

async function handleSaveToLibrary(trackInfo) {
  console.log('[background] Saving track to library:', trackInfo.name);

  // Fetch audio data as base64
  let audioData;
  try {
    const audioResp = await fetch(trackInfo.downloadUrl);
    const audioBlob = await audioResp.blob();
    const contentType = audioResp.headers.get('content-type') || audioBlob.type || '';

    console.log(`[background] Audio fetch: size=${audioBlob.size}, type="${contentType}"`);

    if (audioBlob.size < 1000) {
      throw new Error(`Audio too small (${audioBlob.size} bytes), likely not valid`);
    }

    // Determine the correct MIME type
    let mimeType = 'audio/mpeg';
    if (contentType.includes('webm')) mimeType = 'audio/webm';
    else if (contentType.includes('ogg')) mimeType = 'audio/ogg';
    else if (contentType.includes('mp4') || contentType.includes('m4a')) mimeType = 'audio/mp4';
    else if (contentType.includes('wav')) mimeType = 'audio/wav';
    else if (contentType.startsWith('audio/')) mimeType = contentType.split(';')[0];

    // Re-wrap blob with correct MIME type
    const typedBlob = new Blob([audioBlob], { type: mimeType });

    audioData = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(typedBlob);
    });

    console.log(`[background] Audio saved as ${mimeType}, data URL length: ${audioData.length}`);
  } catch (err) {
    console.error('[background] Failed to fetch audio:', err);
    throw new Error('Failed to download audio file');
  }

  // Look up actual artist and title (do this first so we can use Genius artwork)
  const lookupResult = await lookupTrackInfo(trackInfo.name);
  const { title, artist, album, trackNumber, artworkFull } = lookupResult;

  // Fetch the best available thumbnail as base64 (so it works offline)
  // Priority: Genius full artwork > provided thumbnail > fallback
  let thumbnailData = null;
  const thumbSources = [
    artworkFull,
    trackInfo.thumbnail,
    // If YouTube maxresdefault fails, try hqdefault
    trackInfo.thumbnail?.replace('maxresdefault', 'hqdefault'),
  ].filter(Boolean);

  for (const src of thumbSources) {
    try {
      thumbnailData = await urlToDataUrl(src);
      break;
    } catch (err) {
      console.log(`[background] Thumbnail fetch failed for ${src.slice(0, 80)}:`, err.message);
    }
  }
  if (!thumbnailData && trackInfo.thumbnail) {
    thumbnailData = trackInfo.thumbnail; // Last resort: use raw URL
  }
  console.log(`[background] Final: "${title}" by "${artist}" album: "${album || 'N/A'}" track#: ${trackNumber || 'N/A'}`);

  const track = {
    name: artist ? `${artist} - ${title}` : title,
    originalName: trackInfo.name, // preserve raw YouTube title for rescan
    title: title,
    artist: artist,
    album: album || '',
    trackNumber: trackNumber || null,
    artworkFull: artworkFull || '',
    source: trackInfo.source,
    sourceUrl: trackInfo.sourceUrl,
    thumbnail: thumbnailData,
    audioData: audioData,
    dateAdded: new Date().toISOString(),
    favorite: false,
    playCount: 0
  };

  const id = await saveTrack(track);
  console.log('[background] Track saved with id:', id);
  return id;
}

// ---- Fetch Cobalt instances ----

async function fetchInstances() {
  try {
    const response = await fetch('https://instances.cobalt.best/api/instances.json');
    const instances = await response.json();

    return instances
      .filter(i =>
        i.online === true &&
        i.api_online === true &&
        !i.turnstile &&
        !i.api_key_required
      )
      .sort((a, b) => (b.trust || 0) - (a.trust || 0))
      .map(i => i.api_url || i.api)
      .filter(url => url);
  } catch (err) {
    return [];
  }
}
