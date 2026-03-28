# Redline

A Chrome extension that rips audio from YouTube and Twitter/X videos into your own personal music library with a full-featured player.

## Features

- **Convert to MP3** from YouTube videos, Shorts, and Twitter/X posts
- **Built-in music player** with queue, shuffle, repeat, and volume controls
- **Fullscreen now playing** with Apple Music-style blurred album art backgrounds
- **Lyrics** fetched automatically from Genius
- **Album/chapter detection** — automatically splits YouTube videos with chapters into individual tracks
- **Playlists** — create and manage custom playlists
- **Liked songs & recently played** views with sorting and grid/list layouts
- **Track metadata** — auto-fetches artist, album, track number, and artwork from Genius
- **Dark/light mode**
- **Google Drive sync** for cross-device library syncing
- **On-page buttons** — "Add to Library" button injected directly on YouTube watch pages

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the extension folder
5. The extension icon will appear in your toolbar

## Usage

### Popup
Click the extension icon, paste a YouTube or Twitter/X URL (or click "Detect from current tab"), and hit **Convert to MP3**. The track is saved to your library automatically.

### YouTube Direct Button
On any YouTube video page, click the red **Add to Library** button next to the video actions. If the video has chapters, an **Add Album** button appears to split and save all tracks.

### Library
Click **Open Library** to access the full dashboard — browse all songs, liked tracks, recent plays, and playlists. Search, sort, rename, and manage your collection.

## Google Drive Sync

Sync your library across devices using your Google account.

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project and enable the **Google Drive API**
3. Create OAuth 2.0 credentials (type: **Chrome Extension**) with your extension ID
4. Replace the `client_id` in `manifest.json` with yours
5. Reload the extension, open the dashboard, and click **Sync Now**

## How It Works

Uses the [Cobalt API](https://github.com/imputnet/cobalt) to convert videos to MP3 (320kbps). You can configure a custom Cobalt instance in settings. Track metadata and lyrics are fetched from the Genius API.

## Supported Platforms

- YouTube (videos and Shorts)
- Twitter / X

## Privacy

- Audio files are stored locally in your browser (and optionally in your personal Google Drive)
- Video URLs are sent only to Cobalt API instances for conversion
- No external tracking or analytics

## Disclaimer

Please respect copyright laws and only download content you have permission to use.
