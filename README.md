# Video to MP3 Downloader

A Chrome extension that converts YouTube and Twitter/X videos to downloadable MP3 files.

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
4. Click "Download MP3" when ready

### Method 2: On YouTube (Direct Button)
When watching a YouTube video, you'll see an "MP3" button next to the like/dislike buttons.

## Supported Platforms

- YouTube videos and Shorts
- Twitter/X videos

## How It Works

The extension uses the [Cobalt API v10](https://github.com/imputnet/cobalt), a free and open-source media downloading service, to convert videos to MP3 format (320kbps quality).

## Troubleshooting

- **"Conversion failed"**: The video might be private, age-restricted, or unavailable
- **Button not appearing on YouTube**: Refresh the page or disable conflicting extensions
- **Download not starting**: Check your browser's download settings

## Privacy

- No data is stored or tracked
- Video URLs are sent only to the Cobalt API for conversion
- No account required

## Disclaimer

Please respect copyright laws and only download content you have permission to use.
