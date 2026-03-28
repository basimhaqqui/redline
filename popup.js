document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('urlInput');
  const pasteBtn = document.getElementById('pasteBtn');
  const detectBtn = document.getElementById('detectBtn');
  const convertBtn = document.getElementById('convertBtn');
  const status = document.getElementById('status');
  const downloadSection = document.getElementById('downloadSection');
  const downloadLink = document.getElementById('downloadLink');
  const openDashboardBtn = document.getElementById('openDashboard');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const cobaltUrlInput = document.getElementById('cobaltUrl');
  const saveSettingsBtn = document.getElementById('saveSettings');

  let cobaltInstance = '';

  // Load saved settings
  chrome.storage.local.get(['cobaltInstance'], (result) => {
    if (result.cobaltInstance) {
      cobaltInstance = result.cobaltInstance;
      cobaltUrlInput.value = cobaltInstance;
    }
  });

  // Settings toggle
  settingsBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
  });

  // Save settings
  saveSettingsBtn.addEventListener('click', () => {
    cobaltInstance = cobaltUrlInput.value.trim();
    chrome.storage.local.set({ cobaltInstance });
    settingsPanel.classList.add('hidden');
    showStatus('Settings saved!', 'success');
  });

  // URL validation patterns
  const patterns = {
    youtube: /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    twitter: /(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/
  };

  function validateUrl() {
    const url = urlInput.value.trim();
    const isValid = patterns.youtube.test(url) || patterns.twitter.test(url);
    convertBtn.disabled = !isValid;
    return isValid;
  }

  function showStatus(message, type = 'info') {
    status.textContent = message;
    status.className = `status show ${type}`;
  }

  function hideStatus() {
    status.className = 'status';
  }

  function detectPlatform(url) {
    if (patterns.youtube.test(url)) return 'youtube';
    if (patterns.twitter.test(url)) return 'twitter';
    return null;
  }

  function extractVideoId(url, platform) {
    const match = url.match(patterns[platform]);
    return match ? match[1] : null;
  }

  function getYouTubeThumbnail(videoId) {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }

  // Open dashboard
  openDashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  });

  // Paste from clipboard
  pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      urlInput.value = text;
      validateUrl();
      hideStatus();
    } catch (err) {
      showStatus('Unable to access clipboard', 'error');
    }
  });

  // Detect URL from current tab
  detectBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        const platform = detectPlatform(tab.url);
        if (platform) {
          urlInput.value = tab.url;
          validateUrl();
          showStatus(`Detected ${platform === 'youtube' ? 'YouTube' : 'Twitter/X'} video`, 'success');
        } else {
          showStatus('No supported video found on this page', 'error');
        }
      }
    } catch (err) {
      showStatus('Could not access current tab', 'error');
    }
  });

  // Input change handler
  urlInput.addEventListener('input', () => {
    validateUrl();
    hideStatus();
    downloadSection.classList.add('hidden');
  });

  // Convert to MP3
  convertBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!validateUrl()) return;

    const platform = detectPlatform(url);
    const videoId = extractVideoId(url, platform);
    convertBtn.classList.add('loading');
    convertBtn.disabled = true;
    downloadSection.classList.add('hidden');
    showStatus('Sending to server...', 'info');

    try {
      // Step 1: Convert via background service worker
      const result = await sendMessage({
        action: 'convert',
        videoUrl: url,
        customInstance: cobaltInstance || null
      });

      showStatus(`Converted via ${result.instance}! Saving to library...`, 'info');

      // For Twitter, try to get tweet text and thumbnail
      let trackName = result.filename.replace(/\.[^/.]+$/, '');
      let thumbnail = platform === 'youtube' ? getYouTubeThumbnail(videoId) : null;

      if (platform === 'twitter') {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab) {
            const tweetResp = await new Promise((resolve) => {
              chrome.tabs.sendMessage(tab.id, { action: 'getTweetText' }, (r) => {
                resolve(r || {});
              });
            });
            if (tweetResp.text) trackName = tweetResp.text;
            if (tweetResp.thumbnail) thumbnail = tweetResp.thumbnail;
          }
        } catch (e) {
          // Fallback to filename
        }
      }

      // Step 2: Save audio + thumbnail to library via background
      const trackInfo = {
        downloadUrl: result.downloadUrl,
        name: trackName,
        source: platform === 'youtube' ? 'YouTube' : 'Twitter/X',
        sourceUrl: url,
        thumbnail: thumbnail
      };

      try {
        await sendMessage({
          action: 'saveToLibrary',
          trackInfo: trackInfo
        });
        showStatus('Saved to library! Open dashboard to play.', 'success');
      } catch (saveErr) {
        console.error('Save error:', saveErr);
        // Still show the download link as fallback
        showStatus('Converted! Download available below.', 'success');
      }

      // Also show download link as backup
      downloadLink.href = result.downloadUrl;
      downloadSection.classList.remove('hidden');

    } catch (err) {
      console.error('Conversion error:', err);
      showStatus(err.message || 'Failed to convert. Try again later.', 'error');
    } finally {
      convertBtn.classList.remove('loading');
      convertBtn.disabled = false;
      validateUrl();
    }
  });

  // Helper to send message to background and get response
  function sendMessage(msg) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(msg, (resp) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!resp || !resp.success) {
          reject(new Error(resp?.error || 'No response'));
        } else {
          resolve(resp.data || resp);
        }
      });
    });
  }
});
