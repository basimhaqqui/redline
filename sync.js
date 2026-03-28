// Google Drive Sync - syncs music library across devices

class DriveSync {
  constructor() {
    this.FOLDER_NAME = 'VideoToMP3Library';
    this.METADATA_FILE = 'library_metadata.json';
    this.folderId = null;
    this.token = null;
    this.isSyncing = false;
  }

  // Get OAuth2 token via Chrome Identity API
  async getToken(interactive = true) {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          this.token = token;
          resolve(token);
        }
      });
    });
  }

  // Sign out / revoke token
  async signOut() {
    if (this.token) {
      // Revoke the token
      await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${this.token}`);
      return new Promise((resolve) => {
        chrome.identity.removeCachedAuthToken({ token: this.token }, () => {
          this.token = null;
          resolve();
        });
      });
    }
  }

  // Make authenticated request to Google Drive API
  async driveRequest(url, options = {}) {
    if (!this.token) await this.getToken();

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        ...options.headers
      }
    });

    if (response.status === 401) {
      // Token expired, refresh and retry
      await new Promise((resolve) => {
        chrome.identity.removeCachedAuthToken({ token: this.token }, resolve);
      });
      this.token = null;
      await this.getToken();

      return fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          ...options.headers
        }
      });
    }

    return response;
  }

  // Find or create the app folder in Google Drive
  async getOrCreateFolder() {
    if (this.folderId) return this.folderId;

    // Search for existing folder
    const query = `name='${this.FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;

    const response = await this.driveRequest(searchUrl);
    const data = await response.json();

    if (data.files && data.files.length > 0) {
      this.folderId = data.files[0].id;
      return this.folderId;
    }

    // Create folder
    const createResponse = await this.driveRequest('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: this.FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder'
      })
    });

    const folder = await createResponse.json();
    this.folderId = folder.id;
    return this.folderId;
  }

  // Upload metadata JSON to Drive
  async uploadMetadata(metadata) {
    const folderId = await this.getOrCreateFolder();
    const existingFileId = await this.findFile(this.METADATA_FILE);

    const content = JSON.stringify(metadata, null, 2);
    const blob = new Blob([content], { type: 'application/json' });

    if (existingFileId) {
      // Update existing file
      const response = await this.driveRequest(
        `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: blob
        }
      );
      return response.json();
    } else {
      // Create new file with multipart upload
      const metadataJson = JSON.stringify({
        name: this.METADATA_FILE,
        parents: [folderId]
      });

      const form = new FormData();
      form.append('metadata', new Blob([metadataJson], { type: 'application/json' }));
      form.append('file', blob);

      // Use multipart upload
      const boundary = 'boundary_' + Date.now();
      const body = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${metadataJson}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;

      const response = await this.driveRequest(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
          body: body
        }
      );
      return response.json();
    }
  }

  // Download metadata JSON from Drive
  async downloadMetadata() {
    const fileId = await this.findFile(this.METADATA_FILE);
    if (!fileId) return null;

    const response = await this.driveRequest(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
    );

    return response.json();
  }

  // Find a file by name in the app folder
  async findFile(fileName) {
    const folderId = await this.getOrCreateFolder();
    const query = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,size)`;

    const response = await this.driveRequest(url);
    const data = await response.json();

    return data.files && data.files.length > 0 ? data.files[0].id : null;
  }

  // Upload an audio file to Drive
  async uploadAudioFile(trackId, audioDataUrl, fileName) {
    const folderId = await this.getOrCreateFolder();
    const driveFileName = `track_${trackId}_${fileName}.mp3`;

    // Check if already uploaded
    const existingId = await this.findFile(driveFileName);
    if (existingId) return existingId;

    // Convert data URL to blob
    const response = await fetch(audioDataUrl);
    const blob = await response.blob();

    // Multipart upload
    const metadata = JSON.stringify({
      name: driveFileName,
      parents: [folderId]
    });

    const boundary = 'boundary_' + Date.now();

    // Build multipart body manually
    const metaPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`;
    const endBoundary = `\r\n--${boundary}--`;

    const metaBlob = new Blob([metaPart], { type: 'text/plain' });
    const audioHeader = new Blob([`--${boundary}\r\nContent-Type: audio/mpeg\r\n\r\n`], { type: 'text/plain' });
    const endBlob = new Blob([endBoundary], { type: 'text/plain' });

    const fullBody = new Blob([metaBlob, audioHeader, blob, endBlob]);

    const uploadResponse = await this.driveRequest(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: fullBody
      }
    );

    const result = await uploadResponse.json();
    return result.id;
  }

  // Download an audio file from Drive
  async downloadAudioFile(driveFileId) {
    const response = await this.driveRequest(
      `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`
    );

    const blob = await response.blob();
    const audioBlob = new Blob([blob], { type: 'audio/mpeg' });

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });
  }

  // List all audio files in the app folder
  async listAudioFiles() {
    const folderId = await this.getOrCreateFolder();
    const query = `'${folderId}' in parents and mimeType='audio/mpeg' and trashed=false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,size)&pageSize=1000`;

    const response = await this.driveRequest(url);
    const data = await response.json();
    return data.files || [];
  }

  // Full sync: upload local tracks to Drive, download remote tracks to local
  async sync(db, onProgress) {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      await this.getToken(true);

      const localTracks = await db.getAllTracks();
      const localPlaylists = await db.getAllPlaylists();
      const remoteMetadata = await this.downloadMetadata();

      // Build local metadata
      const localMeta = localTracks.map(t => ({
        syncId: t.syncId || `local_${t.id}_${Date.now()}`,
        name: t.name,
        source: t.source,
        sourceUrl: t.sourceUrl,
        thumbnail: t.thumbnail,
        favorite: t.favorite,
        playCount: t.playCount || 0,
        dateAdded: t.dateAdded,
        driveFileId: t.driveFileId || null
      }));

      let tracksToUpload = [];
      let tracksToDownload = [];

      if (!remoteMetadata) {
        // No remote data - upload everything
        tracksToUpload = localTracks;
      } else {
        // Find tracks to upload (local but not remote)
        const remoteSyncIds = new Set(remoteMetadata.tracks.map(t => t.syncId));
        tracksToUpload = localTracks.filter(t => !t.syncId || !remoteSyncIds.has(t.syncId));

        // Find tracks to download (remote but not local)
        const localSyncIds = new Set(localTracks.filter(t => t.syncId).map(t => t.syncId));
        tracksToDownload = remoteMetadata.tracks.filter(t => !localSyncIds.has(t.syncId));
      }

      const totalWork = tracksToUpload.length + tracksToDownload.length;
      let completed = 0;

      // Upload local tracks to Drive
      for (const track of tracksToUpload) {
        if (onProgress) onProgress(`Uploading: ${track.name}`, ++completed, totalWork);

        try {
          // Generate a sync ID
          if (!track.syncId) {
            track.syncId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          }

          // Upload audio file
          const driveFileId = await this.uploadAudioFile(track.id, track.audioData, track.name.replace(/[^a-zA-Z0-9]/g, '_'));
          track.driveFileId = driveFileId;

          // Update local track with sync info
          await db.updateTrack(track);
        } catch (err) {
          console.error(`Failed to upload track ${track.name}:`, err);
        }
      }

      // Download remote tracks to local
      for (const remoteMeta of tracksToDownload) {
        if (onProgress) onProgress(`Downloading: ${remoteMeta.name}`, ++completed, totalWork);

        try {
          if (!remoteMeta.driveFileId) continue;

          // Download audio
          const audioData = await this.downloadAudioFile(remoteMeta.driveFileId);

          // Save to local DB
          await db.addTrack({
            syncId: remoteMeta.syncId,
            name: remoteMeta.name,
            source: remoteMeta.source,
            sourceUrl: remoteMeta.sourceUrl,
            thumbnail: remoteMeta.thumbnail,
            audioData: audioData,
            driveFileId: remoteMeta.driveFileId,
            favorite: remoteMeta.favorite || false,
            playCount: remoteMeta.playCount || 0,
            dateAdded: remoteMeta.dateAdded || new Date().toISOString()
          });
        } catch (err) {
          console.error(`Failed to download track ${remoteMeta.name}:`, err);
        }
      }

      // Sync playlists
      if (remoteMetadata && remoteMetadata.playlists) {
        const localPlaylistNames = new Set(localPlaylists.map(p => p.name));
        for (const remotePl of remoteMetadata.playlists) {
          if (!localPlaylistNames.has(remotePl.name)) {
            await db.addPlaylist(remotePl.name);
          }
        }
      }

      // Upload final metadata
      const allTracks = await db.getAllTracks();
      const allPlaylists = await db.getAllPlaylists();

      await this.uploadMetadata({
        lastSynced: new Date().toISOString(),
        tracks: allTracks.map(t => ({
          syncId: t.syncId,
          name: t.name,
          source: t.source,
          sourceUrl: t.sourceUrl,
          thumbnail: t.thumbnail,
          favorite: t.favorite,
          playCount: t.playCount,
          dateAdded: t.dateAdded,
          driveFileId: t.driveFileId
        })),
        playlists: allPlaylists.map(p => ({
          name: p.name,
          trackSyncIds: p.tracks || []
        }))
      });

      if (onProgress) onProgress('Sync complete!', totalWork, totalWork);
      return { uploaded: tracksToUpload.length, downloaded: tracksToDownload.length };

    } finally {
      this.isSyncing = false;
    }
  }

  // Check if user is signed in (non-interactive)
  async isSignedIn() {
    try {
      await this.getToken(false);
      return true;
    } catch {
      return false;
    }
  }
}
