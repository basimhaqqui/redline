// Background service worker - handles Cobalt API requests and library storage

const FALLBACK_INSTANCES = [
  'https://cobaltapi.kittycat.boo/',
  'https://dog.kittycat.boo/',
  'https://fox.kittycat.boo/',
  'https://api.cobalt.blackcat.sweeux.org/',
  'https://api.cobalt.liubquanti.click/',
  'https://cobaltapi.squair.xyz/',
  'https://api.dl.woof.monster/',
  'https://cobaltapi.cjs.nz/'
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
  const blob = await response.blob();
  console.log(`[background] Fetched ${url} - type: ${blob.type}, size: ${blob.size}`);

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

// ---- Message handler ----

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'convert') {
    handleConvert(request.videoUrl, request.customInstance)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
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

  for (const instance of instances) {
    try {
      const apiUrl = instance.endsWith('/') ? instance : instance + '/';

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

      if (!response.ok) {
        lastError = `${new URL(apiUrl).hostname}: HTTP ${response.status}`;
        continue;
      }

      const data = await response.json();
      console.log(`[background] ${apiUrl} responded:`, data);

      if (data.status === 'error') {
        lastError = `${new URL(apiUrl).hostname}: ${data.error?.code || 'API error'}`;
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

  throw new Error(`All servers failed. Last: ${lastError}`);
}

// ---- Save track: fetch audio + thumbnail, store in IndexedDB ----

async function handleSaveToLibrary(trackInfo) {
  console.log('[background] Saving track to library:', trackInfo.name);

  // Fetch audio data as base64, force audio/mpeg MIME type
  let audioData;
  try {
    audioData = await urlToDataUrl(trackInfo.downloadUrl, 'audio/mpeg');
    console.log(`[background] Audio data URL length: ${audioData.length}, starts with: ${audioData.substring(0, 30)}`);
  } catch (err) {
    console.error('[background] Failed to fetch audio:', err);
    throw new Error('Failed to download audio file');
  }

  // Fetch thumbnail as base64 (so it works offline)
  let thumbnailData = null;
  if (trackInfo.thumbnail) {
    try {
      thumbnailData = await urlToDataUrl(trackInfo.thumbnail);
    } catch (err) {
      console.log('[background] Could not fetch thumbnail, using URL:', err.message);
      thumbnailData = trackInfo.thumbnail; // Fallback to URL
    }
  }

  const track = {
    name: trackInfo.name,
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
