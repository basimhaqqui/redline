// Content script for detecting video URLs on YouTube and Twitter/X pages

(function() {
  'use strict';

  // Listen for messages from the popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getVideoUrl') {
      const url = detectVideoUrl();
      sendResponse({ url: url });
    }
    return true;
  });

  // Detect video URL based on current page
  function detectVideoUrl() {
    const currentUrl = window.location.href;

    // YouTube video detection
    if (currentUrl.includes('youtube.com/watch') || currentUrl.includes('youtube.com/shorts')) {
      return currentUrl;
    }

    // YouTube - if on homepage or search, try to get selected video
    if (currentUrl.includes('youtube.com')) {
      const videoLink = document.querySelector('a#video-title[href*="watch"]');
      if (videoLink) {
        return 'https://www.youtube.com' + videoLink.getAttribute('href');
      }
    }

    // Twitter/X video detection
    if (currentUrl.includes('twitter.com') || currentUrl.includes('x.com')) {
      // Check if we're on a tweet with video
      if (currentUrl.includes('/status/')) {
        const video = document.querySelector('video');
        if (video) {
          return currentUrl;
        }
      }

      // Try to find a tweet with video in the feed
      const tweetWithVideo = document.querySelector('article:has(video) a[href*="/status/"]');
      if (tweetWithVideo) {
        const href = tweetWithVideo.getAttribute('href');
        if (href && href.includes('/status/')) {
          return 'https://twitter.com' + href;
        }
      }
    }

    return null;
  }

  // Add context menu support by injecting a button on video pages
  function addDownloadButton() {
    // Only add on YouTube watch pages
    if (!window.location.href.includes('youtube.com/watch')) return;

    // Check if button already exists
    if (document.getElementById('mp3-download-btn')) return;

    // Wait for YouTube's UI to load
    const checkForUI = setInterval(() => {
      const actionsContainer = document.querySelector('#top-level-buttons-computed');

      if (actionsContainer && !document.getElementById('mp3-download-btn')) {
        clearInterval(checkForUI);

        const btn = document.createElement('button');
        btn.id = 'mp3-download-btn';
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-5l-2.5 2.5L7 12.5l5-5 5 5-1.5 1.5-2.5-2.5v5h-2z" transform="rotate(180 12 12)"/>
          </svg>
          <span>MP3</span>
        `;
        btn.style.cssText = `
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          margin-left: 8px;
          border: none;
          border-radius: 18px;
          background: linear-gradient(90deg, #ff6b6b, #ee5a5a);
          color: white;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        `;

        btn.addEventListener('mouseenter', () => {
          btn.style.transform = 'scale(1.05)';
          btn.style.boxShadow = '0 4px 12px rgba(255, 107, 107, 0.4)';
        });

        btn.addEventListener('mouseleave', () => {
          btn.style.transform = 'scale(1)';
          btn.style.boxShadow = 'none';
        });

        btn.addEventListener('click', () => {
          // Open the extension popup or trigger download
          chrome.runtime.sendMessage({
            action: 'convertVideo',
            url: window.location.href
          });
        });

        actionsContainer.appendChild(btn);
      }
    }, 1000);

    // Stop checking after 10 seconds
    setTimeout(() => clearInterval(checkForUI), 10000);
  }

  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addDownloadButton);
  } else {
    addDownloadButton();
  }

  // Handle YouTube's SPA navigation
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      setTimeout(addDownloadButton, 1000);
    }
  }).observe(document, { subtree: true, childList: true });
})();
