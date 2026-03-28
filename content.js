(function() {
  'use strict';

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getVideoUrl') {
      sendResponse({ url: detectVideoUrl() });
      return false;
    }
    if (request.action === 'getTweetText') {
      sendResponse({
        text: extractTweetText(),
        thumbnail: extractTweetVideoThumbnail()
      });
      return false;
    }
    if (request.action === 'showNotification') {
      showToast(request.message);
      return false;
    }
  });

  // Extract tweet info: text and video thumbnail
  function extractTweetText() {
    try {
      const tweetArticle = document.querySelector('article[data-testid="tweet"]');
      if (!tweetArticle) return '';

      const tweetTextEl = tweetArticle.querySelector('[data-testid="tweetText"]');
      if (!tweetTextEl) return '';

      return tweetTextEl.innerText.trim();
    } catch (e) {
      return '';
    }
  }

  function extractTweetVideoThumbnail() {
    try {
      const tweetArticle = document.querySelector('article[data-testid="tweet"]');
      if (!tweetArticle) return null;

      // Try poster image first
      const video = tweetArticle.querySelector('video');
      if (video && video.poster) return video.poster;

      // Try to capture a frame from the video
      if (video && video.readyState >= 2) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 480;
        canvas.height = video.videoHeight || 270;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.8);
      }

      // Try the thumbnail/preview image in the video container
      const videoContainer = tweetArticle.querySelector('[data-testid="videoComponent"]');
      if (videoContainer) {
        const img = videoContainer.querySelector('img[src*="pbs.twimg.com"], img[src*="video_thumb"]');
        if (img) return img.src;
      }

      // Last resort: any image in the tweet
      const tweetImg = tweetArticle.querySelector('[data-testid="tweetPhoto"] img');
      if (tweetImg) return tweetImg.src;

      return null;
    } catch (e) {
      return null;
    }
  }

  function showToast(message) {
    const existing = document.getElementById('v2mp3-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'v2mp3-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 32px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 24px;
      background: #c0392b;
      color: white;
      font-family: -apple-system, sans-serif;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.04em;
      z-index: 2147483647;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      transition: opacity 0.3s;
    `;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; }, 2500);
    setTimeout(() => toast.remove(), 3000);
  }

  function detectVideoUrl() {
    const url = window.location.href;
    if (url.includes('youtube.com/watch') || url.includes('youtube.com/shorts')) return url;
    if ((url.includes('twitter.com') || url.includes('x.com')) && url.includes('/status/')) return url;
    return null;
  }

  const MP3_ICON = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

  function extractYouTubeId(url) {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }

  // Inject watch page button style
  const style = document.createElement('style');
  style.textContent = `
    #v2mp3-watch {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      margin-left: 8px;
      background: #c0392b;
      color: white;
      border: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      cursor: pointer;
      border-radius: 18px;
      transition: opacity 0.15s;
    }
    #v2mp3-watch:hover, .v2mp3-watch:hover { opacity: 0.85; }
    #v2mp3-watch.loading, .v2mp3-watch.loading { pointer-events: none; opacity: 0.6; }
    .v2mp3-watch {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      margin-left: 8px;
      background: #c0392b;
      color: white;
      border: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      cursor: pointer;
      border-radius: 18px;
      transition: opacity 0.15s;
    }
  `;
  document.head.appendChild(style);

  function convertAndSave(videoUrl, btn) {
    const originalHTML = btn.innerHTML;
    btn.classList.add('loading');
    btn.innerHTML = `${MP3_ICON} <span>SAVING...</span>`;

    const isTwitter = videoUrl.includes('twitter.com') || videoUrl.includes('x.com');
    const isYouTube = videoUrl.includes('youtu');

    chrome.runtime.sendMessage(
      { action: 'convert', videoUrl, customInstance: null },
      (resp) => {
        if (!resp || !resp.success) {
          btn.innerHTML = `${MP3_ICON} <span>FAILED</span>`;
          setTimeout(() => { btn.innerHTML = originalHTML; btn.classList.remove('loading'); }, 2000);
          return;
        }
        const result = resp.data;

        // YouTube: use YouTube thumbnail
        // Twitter: use tweet text as name + video frame as thumbnail
        let trackName = result.filename.replace(/\.[^/.]+$/, '');
        let thumbnail = null;

        if (isYouTube) {
          const videoId = extractYouTubeId(videoUrl);
          thumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
        } else if (isTwitter) {
          const tweetText = extractTweetText();
          if (tweetText) trackName = tweetText;
          thumbnail = extractTweetVideoThumbnail();
        }

        chrome.runtime.sendMessage({
          action: 'saveToLibrary',
          trackInfo: {
            downloadUrl: result.downloadUrl,
            name: trackName,
            source: isYouTube ? 'YouTube' : 'Twitter/X',
            sourceUrl: videoUrl,
            thumbnail: thumbnail
          }
        }, () => {
          btn.innerHTML = `${MP3_ICON} <span>ADDED ✓</span>`;
          setTimeout(() => { btn.innerHTML = originalHTML; btn.classList.remove('loading'); }, 2000);
        });
      }
    );
  }

  // Detect chapters from YouTube's embedded data and DOM
  function detectChapters() {
    let chapters;

    // Try each method in order, return first good result
    const methods = [
      scrapeChapterPanel,
      extractChaptersFromPageData,
      parseDescriptionChapters,
      extractFromTimestampLinks
    ];

    for (const method of methods) {
      chapters = dedupeChapters(method());
      if (chapters.length > 1) {
        console.log(`[v2mp3] Found ${chapters.length} chapters via ${method.name}`);
        return chapters;
      }
    }

    return [];
  }

  // Remove duplicate chapters by timestamp
  function dedupeChapters(chapters) {
    const seen = new Set();
    return chapters.filter(ch => {
      const key = ch.timestamp;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Scrape the "In this video" chapter panel
  function scrapeChapterPanel() {
    const chapters = [];

    // Target all chapter list items in the panel
    const items = document.querySelectorAll('ytd-macro-markers-list-item-renderer');
    if (items.length === 0) return chapters;

    items.forEach(item => {
      // Get all text content and find title and timestamp
      const allText = item.innerText || item.textContent || '';
      const lines = allText.trim().split('\n').map(l => l.trim()).filter(l => l);

      let title = '';
      let timestamp = '';

      for (const line of lines) {
        // Check if this line is a timestamp
        if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(line)) {
          timestamp = line;
        } else if (line.length > 1 && !/^(Sync to|Chapter)/.test(line)) {
          // Use the first non-timestamp, non-UI text as title
          if (!title) title = line;
        }
      }

      if (title && timestamp) {
        // Remove trailing period from titles like "SISTERS AND BROTHERS."
        title = title.replace(/\.\s*$/, '');
        chapters.push({ title, timestamp });
      }
    });

    console.log(`[v2mp3] Scraped ${chapters.length} chapters from panel`);
    return chapters;
  }

  // Extract chapters from YouTube's internal page data
  function extractChaptersFromPageData() {
    const chapters = [];

    try {
      // YouTube stores data in script tags
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const text = script.textContent;
        if (!text) continue;

        // Look for chapter data in ytInitialData or ytInitialPlayerResponse
        let dataStr = null;
        if (text.includes('ytInitialData')) {
          const match = text.match(/ytInitialData\s*=\s*({.+?});\s*(?:window|var|let|const|<\/script)/s);
          if (match) dataStr = match[1];
        }
        if (text.includes('ytInitialPlayerResponse')) {
          const match = text.match(/ytInitialPlayerResponse\s*=\s*({.+?});\s*(?:window|var|let|const|<\/script)/s);
          if (match) dataStr = match[1];
        }

        if (!dataStr) continue;

        try {
          const data = JSON.parse(dataStr);
          const markers = findInObject(data, 'macroMarkersListItemRenderer') ||
                          findInObject(data, 'chapterRenderer');
          if (markers && markers.length > 0) {
            for (const marker of markers) {
              const renderer = marker.macroMarkersListItemRenderer || marker.chapterRenderer || marker;

              // Extract title from various possible paths
              const title = renderer?.title?.simpleText ||
                            renderer?.title?.runs?.map(r => r.text).join('') ||
                            renderer?.label?.simpleText ||
                            renderer?.label?.runs?.map(r => r.text).join('') || '';

              // Extract start time in seconds from various paths
              const timeSecs =
                parseInt(renderer?.onTap?.watchEndpoint?.startTimeSeconds) ||
                parseInt(renderer?.startTimeSeconds) ||
                parseInt(renderer?.timeRangeStartMillis / 1000) ||
                parseInt(renderer?.startMillis / 1000) || 0;

              if (title.trim()) {
                const secs = timeSecs;
                const hrs = Math.floor(secs / 3600);
                const mins = Math.floor((secs % 3600) / 60);
                const remSecs = secs % 60;
                const timestamp = hrs > 0
                  ? `${hrs}:${String(mins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`
                  : `${mins}:${String(remSecs).padStart(2, '0')}`;

                chapters.push({ title: title.trim(), timestamp });
              }
            }
          }
        } catch (e) {
          // JSON parse failed, skip
        }
      }
    } catch (e) {
      console.log('[v2mp3] Page data extraction failed:', e);
    }

    return chapters;
  }

  // Recursively collect ALL objects containing a given key
  function findInObject(obj, key) {
    const results = [];

    function recurse(node) {
      if (!node || typeof node !== 'object') return;

      if (Array.isArray(node)) {
        for (const item of node) recurse(item);
      } else {
        if (node[key]) results.push(node);
        for (const val of Object.values(node)) {
          if (val && typeof val === 'object') recurse(val);
        }
      }
    }

    recurse(obj);
    return results.length > 0 ? results : null;
  }

  // Extract from clickable timestamp links in the description
  function extractFromTimestampLinks() {
    const chapters = [];
    const links = document.querySelectorAll(
      '#description a[href*="&t="], #description-inline-expander a[href*="&t="], ' +
      'ytd-structured-description-content-renderer a[href*="&t="]'
    );

    links.forEach(link => {
      const href = link.getAttribute('href') || '';
      const timeMatch = href.match(/[?&]t=(\d+)/);
      if (!timeMatch) return;

      const secs = parseInt(timeMatch[1]);
      // Get the text after the timestamp link on the same line
      const parent = link.closest('span') || link.parentElement;
      if (!parent) return;

      const linkText = link.textContent.trim();
      // The title might be the next text node or the link text itself
      let title = '';

      // Walk siblings after the link
      let sibling = link.nextSibling;
      while (sibling) {
        const t = sibling.textContent || '';
        if (t.trim()) {
          title = t.replace(/^\s*[-–—:)\]]\s*/, '').trim();
          break;
        }
        sibling = sibling.nextSibling;
      }

      if (!title) {
        // Try the full line text minus the timestamp
        const fullText = parent.textContent.trim();
        title = fullText.replace(/^\d{1,2}:\d{2}(?::\d{2})?\s*[-–—:).\]]*\s*/, '').trim();
      }

      if (title && title.length > 1) {
        const mins = Math.floor(secs / 60);
        const remSecs = secs % 60;
        const hours = Math.floor(mins / 60);
        const remMins = mins % 60;
        const timestamp = hours > 0
          ? `${hours}:${String(remMins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`
          : `${remMins}:${String(remSecs).padStart(2, '0')}`;

        chapters.push({ title, timestamp });
      }
    });

    return chapters;
  }

  // Parse description text for timestamp patterns
  function parseDescriptionChapters() {
    const text = getDescriptionText();
    if (!text) return [];

    const chapters = [];
    const lines = text.split('\n');

    for (const line of lines) {
      let match;

      // Pattern: "SONG NAME 00:00 - 02:44" (title, start - end)
      match = line.match(/^\s*(.+?)\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—]\s*\d{1,2}:\d{2}(?::\d{2})?\s*$/);
      if (match && match[1].trim().length > 1) {
        chapters.push({ timestamp: match[2].trim(), title: match[1].trim() });
        continue;
      }

      // Pattern: "0:00 - Song Name" or "0:00 Song Name"
      match = line.match(/^\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—:).\]]*\s*(.+)$/);
      if (match && match[2].trim().length > 1) {
        // Make sure the "title" part isn't just another timestamp
        if (!/^\d{1,2}:\d{2}/.test(match[2].trim())) {
          chapters.push({ timestamp: match[1].trim(), title: match[2].trim() });
          continue;
        }
      }

      // Pattern: "1. Song Name 0:00"
      match = line.match(/^\s*\d+[.)]\s*(.+?)\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*$/);
      if (match && match[1].trim().length > 1) {
        chapters.push({ timestamp: match[2].trim(), title: match[1].trim() });
        continue;
      }

      // Pattern: "Song Name - 0:00"
      match = line.match(/^\s*(.+?)\s*[-–—(\[]\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*[)\]]?\s*$/);
      if (match && match[1].trim().length > 1) {
        chapters.push({ timestamp: match[2].trim(), title: match[1].trim() });
      }
    }

    return chapters.length > 1 ? chapters : [];
  }

  function getDescriptionText() {
    const selectors = [
      '#description-inline-expander',
      'ytd-text-inline-expander',
      '#description ytd-text-inline-expander',
      '#description',
      'ytd-watch-metadata #description',
      'ytd-structured-description-content-renderer'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.innerText || el.textContent || '';
        if (text.length > 20) return text;
      }
    }
    return '';
  }

  function parseTimestamp(ts) {
    const parts = ts.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }

  // Watch page buttons
  function addWatchPageButton() {
    if (!window.location.href.includes('youtube.com/watch')) return;
    if (document.getElementById('v2mp3-watch')) return;

    const check = setInterval(() => {
      const container = document.querySelector('#top-level-buttons-computed, ytd-menu-renderer.ytd-watch-metadata');
      if (container && !document.getElementById('v2mp3-watch')) {
        clearInterval(check);

        // Single track button
        const btn = document.createElement('button');
        btn.id = 'v2mp3-watch';
        btn.innerHTML = `${MP3_ICON} <span>ADD TO LIBRARY</span>`;
        btn.addEventListener('click', () => convertAndSave(window.location.href, btn));
        container.appendChild(btn);

        // Keep checking for chapters (YouTube loads them async)
        let albumCheckCount = 0;
        const albumCheck = setInterval(() => {
          albumCheckCount++;
          if (document.getElementById('v2mp3-album') || albumCheckCount > 20) {
            clearInterval(albumCheck);
            return;
          }

          // Try to expand the description to access timestamps
          if (albumCheckCount === 2) {
            const expandBtn = document.querySelector('#expand, tp-yt-paper-button#expand, [aria-label="Show more"]');
            if (expandBtn) expandBtn.click();
          }

          const chapters = detectChapters();
          console.log(`[v2mp3] Check #${albumCheckCount}: found ${chapters.length} chapters`);
          if (chapters.length > 1) {
            clearInterval(albumCheck);
            const albumBtn = document.createElement('button');
            albumBtn.id = 'v2mp3-album';
            albumBtn.className = 'v2mp3-watch';
            albumBtn.innerHTML = `${MP3_ICON} <span>ADD ALBUM (${chapters.length} tracks)</span>`;
            albumBtn.addEventListener('click', () => {
              addAlbumToLibrary(chapters, albumBtn);
            });
            container.appendChild(albumBtn);
          }
        }, 2000);
      }
    }, 1000);
    setTimeout(() => clearInterval(check), 15000);
  }

  function addAlbumToLibrary(chapters, btn) {
    const originalHTML = btn.innerHTML;
    btn.classList.add('loading');
    btn.innerHTML = `${MP3_ICON} <span>CONVERTING...</span>`;

    const videoUrl = window.location.href;

    chrome.runtime.sendMessage(
      { action: 'convert', videoUrl, customInstance: null },
      (resp) => {
        if (!resp || !resp.success) {
          btn.innerHTML = `${MP3_ICON} <span>FAILED</span>`;
          setTimeout(() => { btn.innerHTML = originalHTML; btn.classList.remove('loading'); }, 2000);
          return;
        }

        const result = resp.data;
        const videoId = extractYouTubeId(videoUrl);
        const thumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;

        // Build chapters with start/end times
        const tracksToSave = chapters.map((ch, i) => ({
          title: ch.title,
          startTime: parseTimestamp(ch.timestamp),
          endTime: i < chapters.length - 1 ? parseTimestamp(chapters[i + 1].timestamp) : null
        }));

        // Save the album via background
        chrome.runtime.sendMessage({
          action: 'saveAlbum',
          trackInfo: {
            downloadUrl: result.downloadUrl,
            sourceUrl: videoUrl,
            source: 'YouTube',
            thumbnail: thumbnail,
            tracks: tracksToSave
          }
        }, (saveResp) => {
          if (saveResp && saveResp.success) {
            btn.innerHTML = `${MP3_ICON} <span>ADDED ${tracksToSave.length} TRACKS ✓</span>`;
          } else {
            btn.innerHTML = `${MP3_ICON} <span>FAILED</span>`;
          }
          setTimeout(() => { btn.innerHTML = originalHTML; btn.classList.remove('loading'); }, 3000);
        });
      }
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addWatchPageButton);
  } else {
    addWatchPageButton();
  }

  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(addWatchPageButton, 1000);
    }
  }).observe(document, { subtree: true, childList: true });
})();
