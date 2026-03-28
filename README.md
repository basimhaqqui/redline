# Video to MP3 Downloader

A Chrome extension that converts YouTube and Twitter/X videos to downloadable MP3 files with a built-in music dashboard and cross-device sync.

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `video-to-mp3-extension` folder
5. The extension icon will appear in your toolbar

## Usage

### Method 1: Popup Interface
1. Click the extension icon in your toolbar
2. Either:
   - Paste a YouTube or Twitter/X video URL into the input field
   - Click "Detect from current tab" when on a video page
3. Click "Convert to MP3"
4. Track is automatically saved to your library

### Method 2: On YouTube (Direct Button)
When watching a YouTube video, you'll see an "MP3" button next to the like/dislike buttons.

### Music Dashboard
Click "Open Music Dashboard" to access the full player with playlists, favorites, queue, and playback controls.

## Cross-Device Sync (Google Drive)

Sync your music library across devices using your Google account.

### Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable the **Google Drive API**:
   - Go to APIs & Services > Library
   - Search "Google Drive API" and click Enable
4. Create OAuth 2.0 credentials:
   - Go to APIs & Services > Credentials
   - Click "Create Credentials" > "OAuth client ID"
   - Application type: **Chrome Extension**
   - Enter your extension ID (found at `chrome://extensions/`)
   - Copy the Client ID
5. Open `manifest.json` and replace `YOUR_CLIENT_ID.apps.googleusercontent.com` with your Client ID
6. Reload the extension

### Using Sync
1. Open the Music Dashboard
2. Click **Sync Now** in the sidebar
3. Sign in with your Google account when prompted
4. Your library will sync to Google Drive

## Supported Platforms

- YouTube videos and Shorts
- Twitter/X videos

## How It Works

The extension uses the [Cobalt API](https://github.com/imputnet/cobalt), a free and open-source media downloading service, to convert videos to MP3 format (320kbps quality).

## Privacy

- Audio files are stored locally in your browser and optionally in your personal Google Drive
- Video URLs are sent only to Cobalt API instances for conversion
- No external tracking or analytics

## Disclaimer

Please respect copyright laws and only download content you have permission to use.
