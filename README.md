# Redline

Your personal music library, built from YouTube and Twitter/X. Rip audio, organize tracks, and play them back — all from your browser.

### Demo

[![Redline Demo](https://img.youtube.com/vi/_jLQ5LlKXXM/maxresdefault.jpg)](https://youtu.be/_jLQ5LlKXXM)

## Features

- **One-click audio ripping** from YouTube videos, Shorts, and Twitter/X posts (320kbps MP3)
- **Full music player** — queue, shuffle, repeat, volume, and playback controls
- **Fullscreen now playing** with Apple Music-style blurred album art backgrounds
- **Lyrics** fetched automatically from Genius with a slide-out panel and fullscreen view
- **Album/chapter detection** — splits YouTube videos with chapters into individual tracks
- **Playlists** — create and manage custom playlists
- **Liked songs and recently played** with grid/list views and sorting
- **Auto metadata** — fetches artist, album, track number, and high-res artwork from Genius
- **Custom artwork** — right-click any track to set your own cover art
- **Dark and light mode**
- **Google Drive sync** — sync your library across devices
- **On-page YouTube button** — "Add to Library" injected directly on watch pages

## Install

[![How to Install](https://img.youtube.com/vi/b8E22WYvZfg/maxresdefault.jpg)](https://youtu.be/b8E22WYvZfg)

1. Go to the [Redline GitHub repo](https://github.com/basimhaqqui/redline)
2. Click the green **"Code"** button → **"Download ZIP"**
3. Unzip the downloaded folder (right-click → **Extract All** on Windows, double-click on Mac)
4. Open Chrome and go to `chrome://extensions/`
5. Enable **Developer mode** (top-right toggle)
6. Click **Load unpacked** and select the unzipped folder
7. Pin Redline from the extensions menu and you're good to go

## Usage

### Convert a video
Click the Redline icon in your toolbar, paste a YouTube or Twitter/X URL (or click **Detect from current tab**), and hit **Convert to MP3**. The track is saved to your library with full metadata and artwork.

### YouTube direct button
On any YouTube video page, a red **Add to Library** button appears next to the video actions. Videos with chapters get an **Add Album** button that splits and saves all tracks individually.

### Library
Click **Open Library** for the full dashboard. Browse all songs, liked tracks, recent plays, and playlists. Search, sort, rename, and manage your collection. Right-click any track for more options.

### Fullscreen player
Click the expand button in the bottom-right of the player bar to enter fullscreen with blurred album art backgrounds. Toggle lyrics from the top-right corner. Press Esc to exit.

## Google Drive Sync

Optionally sync your library across devices:

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project
2. Enable the **Google Drive API**
3. Create OAuth 2.0 credentials (type: **Chrome Extension**) using your extension ID
4. Replace the `client_id` in `manifest.json` with yours
5. Reload the extension, open the dashboard, and click **Sync Now**

## How It Works

Audio conversion is powered by the [Cobalt API](https://github.com/imputnet/cobalt), a free and open-source media conversion service (320kbps MP3). You can configure a custom Cobalt instance in the extension settings.

Track metadata (artist, album, track number, artwork) and lyrics are fetched from the [Genius API](https://genius.com/) and [LRCLIB](https://lrclib.net/).

## Supported Platforms

- YouTube (videos and Shorts)
- Twitter / X

## Privacy

Redline does not collect, transmit, or sell any personal data.

- All audio and metadata are stored locally in your browser
- Video URLs are sent only to Cobalt API instances for conversion
- Track names are sent to Genius/LRCLIB for metadata and lyrics lookup
- Google Drive sync is optional and only accesses files created by Redline
- No analytics, tracking, or cookies

Full privacy policy: [PRIVACY.md](PRIVACY.md)

## Disclaimer

Please respect copyright laws and only download content you have permission to use.

## License

GPL-3.0
