// Music Dashboard - IndexedDB Storage & Audio Player

class MusicDB {
  constructor() {
    this.dbName = 'MusicPlayerDB';
    this.dbVersion = 1;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Tracks store
        if (!db.objectStoreNames.contains('tracks')) {
          const trackStore = db.createObjectStore('tracks', { keyPath: 'id', autoIncrement: true });
          trackStore.createIndex('name', 'name', { unique: false });
          trackStore.createIndex('dateAdded', 'dateAdded', { unique: false });
          trackStore.createIndex('favorite', 'favorite', { unique: false });
        }

        // Playlists store
        if (!db.objectStoreNames.contains('playlists')) {
          const playlistStore = db.createObjectStore('playlists', { keyPath: 'id', autoIncrement: true });
          playlistStore.createIndex('name', 'name', { unique: false });
        }

        // Recently played store
        if (!db.objectStoreNames.contains('recent')) {
          const recentStore = db.createObjectStore('recent', { keyPath: 'id', autoIncrement: true });
          recentStore.createIndex('playedAt', 'playedAt', { unique: false });
        }
      };
    });
  }

  async addTrack(track) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tracks'], 'readwrite');
      const store = transaction.objectStore('tracks');
      const request = store.add({
        ...track,
        dateAdded: new Date().toISOString(),
        favorite: false,
        playCount: 0
      });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllTracks() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tracks'], 'readonly');
      const store = transaction.objectStore('tracks');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getTrack(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tracks'], 'readonly');
      const store = transaction.objectStore('tracks');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updateTrack(track) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tracks'], 'readwrite');
      const store = transaction.objectStore('tracks');
      const request = store.put(track);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteTrack(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tracks'], 'readwrite');
      const store = transaction.objectStore('tracks');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getFavorites() {
    const tracks = await this.getAllTracks();
    return tracks.filter(t => t.favorite);
  }

  async addPlaylist(name) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['playlists'], 'readwrite');
      const store = transaction.objectStore('playlists');
      const request = store.add({
        name,
        tracks: [],
        createdAt: new Date().toISOString()
      });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllPlaylists() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['playlists'], 'readonly');
      const store = transaction.objectStore('playlists');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getPlaylist(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['playlists'], 'readonly');
      const store = transaction.objectStore('playlists');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updatePlaylist(playlist) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['playlists'], 'readwrite');
      const store = transaction.objectStore('playlists');
      const request = store.put(playlist);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deletePlaylist(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['playlists'], 'readwrite');
      const store = transaction.objectStore('playlists');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async addToRecent(trackId) {
    const recent = await this.getRecent();
    const existing = recent.find(r => r.trackId === trackId);

    if (existing) {
      existing.playedAt = new Date().toISOString();
      return this.updateRecent(existing);
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['recent'], 'readwrite');
      const store = transaction.objectStore('recent');
      const request = store.add({
        trackId,
        playedAt: new Date().toISOString()
      });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updateRecent(recent) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['recent'], 'readwrite');
      const store = transaction.objectStore('recent');
      const request = store.put(recent);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getRecent() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['recent'], 'readonly');
      const store = transaction.objectStore('recent');
      const request = store.getAll();
      request.onsuccess = () => {
        const results = request.result.sort((a, b) =>
          new Date(b.playedAt) - new Date(a.playedAt)
        ).slice(0, 50);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }
}

class MusicPlayer {
  constructor() {
    this.db = new MusicDB();
    this.audio = document.getElementById('audioPlayer');
    this.currentTrack = null;
    this.queue = [];
    this.queueIndex = 0;
    this.isPlaying = false;
    this.isShuffle = false;
    this.repeatMode = 0; // 0: off, 1: all, 2: one
    this.volume = 1.0; // 1.0 = 100%, max 2.0 = 200%
    this.currentView = 'library';
    this.currentPlaylistId = null;
    this.contextTrack = null;

    this.init();
  }

  async init() {
    await this.db.init();
    this.sync = new DriveSync();
    this.setupEventListeners();
    this.setupTheme();
    this.loadLibrary();
    this.loadPlaylists();
    this.audio.volume = 1; // Keep native volume at max
    this.setupAudioBoost();
    this.updateVolumeUI();
    this.checkSyncStatus();
  }

  setupTheme() {
    const saved = localStorage.getItem('theme');
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
    }
    this.updateThemeUI();

    document.getElementById('themeToggle').addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const isDark = current === 'dark' ||
        (!current && window.matchMedia('(prefers-color-scheme: dark)').matches);
      const next = isDark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      this.updateThemeUI();
    });
  }

  updateThemeUI() {
    const theme = document.documentElement.getAttribute('data-theme');
    const isDark = theme === 'dark' ||
      (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const label = document.getElementById('themeLabel');
    const icon = document.getElementById('themeIcon');
    label.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    // Moon for dark mode toggle, sun for light mode toggle
    icon.innerHTML = isDark
      ? '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>'
      : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
  }

  setupAudioBoost() {
    // Web Audio API gain node allows volume beyond 100%
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.gainNode = this.audioContext.createGain();
    const source = this.audioContext.createMediaElementSource(this.audio);
    source.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);
    this.gainNode.gain.value = this.volume; // 0-2 range (0-200%)
  }

  setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.dataset.view;
        this.switchView(view);
      });
    });

    // View layout toggle
    this.layoutMode = 'grid';
    this.sortBy = 'dateAdded';
    this.sortDir = 'desc';
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const layout = btn.dataset.layout;
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.layoutMode = layout;
        this.loadLibrary();
      });
    });

    // Sort dropdown
    document.getElementById('sortSelect').addEventListener('change', (e) => {
      const [sortBy, sortDir] = e.target.value.split('-');
      this.sortBy = sortBy;
      this.sortDir = sortDir;
      this.loadLibrary();
    });

    // Import buttons
    document.getElementById('importBtn').addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });

    document.getElementById('emptyImportBtn')?.addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });

    document.getElementById('fileInput').addEventListener('change', (e) => {
      this.importFiles(e.target.files);
    });

    document.getElementById('rescanBtn').addEventListener('click', async () => {
      const btn = document.getElementById('rescanBtn');
      btn.textContent = 'Scanning...';
      btn.style.pointerEvents = 'none';
      await this.rescanLibrary();
      btn.textContent = 'Scan Info';
      btn.style.pointerEvents = '';
    });

    // Search
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.searchTracks(e.target.value);
    });

    // Player controls
    document.getElementById('playPauseBtn').addEventListener('click', () => this.togglePlay());
    document.getElementById('prevBtn').addEventListener('click', () => this.playPrevious());
    document.getElementById('nextBtn').addEventListener('click', () => this.playNext());
    document.getElementById('shuffleBtn').addEventListener('click', () => this.toggleShuffle());
    document.getElementById('repeatBtn').addEventListener('click', () => this.toggleRepeat());
    document.getElementById('favoriteBtn').addEventListener('click', () => this.toggleCurrentFavorite());

    // Progress bar (click + drag)
    const progressBar = document.getElementById('progressBar');
    const seekFromEvent = (e) => {
      const rect = progressBar.getBoundingClientRect();
      const percent = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      if (this.audio.duration) {
        const track = this.currentTrack;
        const start = track?.startTime || 0;
        const end = track?.endTime || this.audio.duration;
        this.audio.currentTime = start + percent * (end - start);
      }
    };
    progressBar.addEventListener('mousedown', (e) => {
      seekFromEvent(e);
      const onMove = (e) => seekFromEvent(e);
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    // Volume (click + drag)
    document.getElementById('volumeBtn').addEventListener('click', () => this.toggleMute());
    const volumeBar = document.getElementById('volumeBar');
    const setVolumeFromEvent = (e) => {
      const rect = volumeBar.getBoundingClientRect();
      const percent = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      this.setVolume(percent * 2); // 0-200% range
    };
    volumeBar.addEventListener('mousedown', (e) => {
      setVolumeFromEvent(e);
      const onMove = (e) => setVolumeFromEvent(e);
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    // Audio events
    this.audio.addEventListener('timeupdate', () => this.updateProgress());
    this.audio.addEventListener('ended', () => this.handleTrackEnd());
    this.audio.addEventListener('loadedmetadata', () => this.updateDuration());

    // Queue panel
    document.getElementById('queueBtn').addEventListener('click', () => {
      document.getElementById('queuePanel').classList.toggle('open');
    });
    document.getElementById('closeQueue').addEventListener('click', () => {
      document.getElementById('queuePanel').classList.remove('open');
    });

    // Create playlist
    document.getElementById('createPlaylistBtn').addEventListener('click', () => {
      document.getElementById('createPlaylistModal').classList.add('show');
      document.getElementById('playlistNameInput').focus();
    });

    document.getElementById('cancelPlaylist').addEventListener('click', () => {
      document.getElementById('createPlaylistModal').classList.remove('show');
    });

    document.getElementById('confirmPlaylist').addEventListener('click', () => this.createPlaylist());

    document.getElementById('playlistNameInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.createPlaylist();
    });

    // Rename modal
    document.getElementById('cancelRename').addEventListener('click', () => {
      document.getElementById('renameModal').classList.remove('show');
    });
    document.getElementById('confirmRename').addEventListener('click', () => this.confirmRename());

    // Add to playlist modal
    document.getElementById('cancelAddToPlaylist').addEventListener('click', () => {
      document.getElementById('addToPlaylistModal').classList.remove('show');
    });

    // Context menu
    document.addEventListener('click', () => {
      document.getElementById('contextMenu').classList.remove('show');
    });

    document.querySelectorAll('.context-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.dataset.action;
        this.handleContextAction(action);
      });
    });

    // Playlist actions
    document.getElementById('playPlaylistBtn')?.addEventListener('click', () => this.playPlaylist());
    document.getElementById('shufflePlaylistBtn')?.addEventListener('click', () => this.shufflePlaylist());

    // Sync
    document.getElementById('syncBtn').addEventListener('click', () => this.startSync());

    // Lyrics
    document.getElementById('lyricsBtn').addEventListener('click', () => {
      document.getElementById('lyricsPanel').classList.toggle('open');
      document.getElementById('queuePanel').classList.remove('open');
      if (document.getElementById('lyricsPanel').classList.contains('open') && this.currentTrack) {
        this.loadLyrics();
      }
    });
    document.getElementById('closeLyrics').addEventListener('click', () => {
      document.getElementById('lyricsPanel').classList.remove('open');
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          this.togglePlay();
          break;
        case 'ArrowRight':
          if (e.ctrlKey) this.playNext();
          else this.audio.currentTime += 5;
          break;
        case 'ArrowLeft':
          if (e.ctrlKey) this.playPrevious();
          else this.audio.currentTime -= 5;
          break;
        case 'ArrowUp':
          this.setVolume(Math.min(2, this.volume + 0.2));
          break;
        case 'ArrowDown':
          this.setVolume(Math.max(0, this.volume - 0.2));
          break;
      }
    });
  }

  switchView(view) {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === view);
    });

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`${view}View`).classList.add('active');

    this.currentView = view;

    switch (view) {
      case 'library':
        this.loadLibrary();
        break;
      case 'favorites':
        this.loadFavorites();
        break;
      case 'recent':
        this.loadRecent();
        break;
      case 'playlists':
        this.loadPlaylistsView();
        break;
    }
  }

  updateSortSelect() {
    const select = document.getElementById('sortSelect');
    const val = `${this.sortBy}-${this.sortDir}`;
    if (select.querySelector(`option[value="${val}"]`)) {
      select.value = val;
    }
  }

  sortTracks(tracks) {
    const dir = this.sortDir === 'asc' ? 1 : -1;

    tracks.sort((a, b) => {
      if (this.sortBy === 'title') {
        return dir * (a.title || a.name || '').localeCompare(b.title || b.name || '');
      }
      if (this.sortBy === 'album') {
        const albumA = (a.album || '').toLowerCase();
        const albumB = (b.album || '').toLowerCase();
        // Songs without album go to the end
        if (!albumA && albumB) return 1;
        if (albumA && !albumB) return -1;
        if (!albumA && !albumB) return 0;
        // Same album: sort by track number from Genius
        if (albumA === albumB) {
          const numA = a.trackNumber || 999;
          const numB = b.trackNumber || 999;
          return numA - numB;
        }
        return dir * albumA.localeCompare(albumB);
      }
      if (this.sortBy === 'dateAdded') {
        const dateA = a.dateAdded || '';
        const dateB = b.dateAdded || '';
        return dir * dateA.localeCompare(dateB);
      }
      if (this.sortBy === 'duration') {
        const durA = a.duration || 0;
        const durB = b.duration || 0;
        // Songs without duration go to the end
        if (!durA && durB) return 1;
        if (durA && !durB) return -1;
        return dir * (durA - durB);
      }
      return 0;
    });
  }

  async loadLibrary() {
    const tracks = await this.db.getAllTracks();
    const grid = document.getElementById('libraryGrid');
    const empty = document.getElementById('emptyLibrary');

    if (tracks.length === 0) {
      grid.style.display = 'none';
      empty.style.display = 'flex';
      return;
    }

    empty.style.display = 'none';

    const trackCount = document.getElementById('trackCount');
    if (trackCount) trackCount.textContent = `${tracks.length} track${tracks.length !== 1 ? 's' : ''}`;

    if (this.layoutMode === 'list') {
      this.sortTracks(tracks);
      grid.style.display = 'block';
      grid.className = 'track-table';
      const arrow = (col) => {
        if (this.sortBy !== col) return '';
        return this.sortDir === 'asc' ? ' ▲' : ' ▼';
      };
      grid.innerHTML = `
        <div class="track-table-header">
          <span class="col-num">#</span>
          <span class="col-title sort-header${this.sortBy === 'title' ? ' active' : ''}" data-sort="title">Title${arrow('title')}</span>
          <span class="col-album sort-header${this.sortBy === 'album' ? ' active' : ''}" data-sort="album">Album${arrow('album')}</span>
          <span class="col-date sort-header${this.sortBy === 'dateAdded' ? ' active' : ''}" data-sort="dateAdded">Date Added${arrow('dateAdded')}</span>
          <span class="col-duration sort-header${this.sortBy === 'duration' ? ' active' : ''}" data-sort="duration">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>${arrow('duration')}
          </span>
        </div>
        ${tracks.map((track, i) => this.renderTrackRow(track, i + 1)).join('')}
      `;
      // Attach sort header click listeners
      grid.querySelectorAll('.sort-header').forEach(header => {
        header.addEventListener('click', () => {
          const col = header.dataset.sort;
          if (this.sortBy === col) {
            this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
          } else {
            this.sortBy = col;
            this.sortDir = col === 'dateAdded' ? 'desc' : 'asc';
          }
          this.updateSortSelect();
          this.loadLibrary();
        });
      });
    } else {
      this.sortTracks(tracks);
      grid.style.display = 'grid';
      grid.className = 'track-grid';
      grid.innerHTML = tracks.map(track => this.renderTrackCard(track)).join('');
    }
    this.attachTrackListeners(grid);
  }

  async loadFavorites() {
    const tracks = await this.db.getFavorites();
    const grid = document.getElementById('favoritesGrid');

    if (tracks.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
          <h2>No favorites yet</h2>
          <p>Like songs to add them here</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = tracks.map(track => this.renderTrackCard(track)).join('');
    this.attachTrackListeners(grid);
  }

  async loadRecent() {
    const recent = await this.db.getRecent();
    const grid = document.getElementById('recentGrid');

    if (recent.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <h2>No recent plays</h2>
          <p>Start playing music to see history</p>
        </div>
      `;
      return;
    }

    const tracks = await Promise.all(
      recent.map(r => this.db.getTrack(r.trackId))
    );

    const validTracks = tracks.filter(t => t);
    grid.innerHTML = validTracks.map(track => this.renderTrackCard(track)).join('');
    this.attachTrackListeners(grid);
  }

  // Get title and artist from track
  splitTrackName(track) {
    // Use dedicated fields if set by iTunes lookup
    if (track.artist && track.title) {
      return { title: track.title, artist: track.artist };
    }
    // No lookup data — show full name as title, no artist guess
    return { title: track.name, artist: '' };
  }

  // Re-scan all tracks — fill in missing artist/title/album/trackNumber
  async rescanLibrary() {
    const tracks = await this.db.getAllTracks();
    if (tracks.length === 0) return;

    for (const track of tracks) {
      const needsInfo = !track.artist || !track.title;
      const needsAlbum = !track.album || !track.trackNumber || !track.thumbnail;

      if (!needsInfo && !needsAlbum) continue;

      // If missing artist/title, do a full lookup using the filename/name
      if (needsInfo) {
        try {
          const searchName = track.originalName || track.name;
          const resp = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'lookupTrack', name: searchName }, (r) => {
              if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
              else resolve(r);
            });
          });
          if (resp && resp.artist) {
            track.artist = resp.artist;
            track.title = resp.title;
            track.name = `${resp.artist} - ${resp.title}`;
            if (resp.album) track.album = resp.album;
            if (resp.trackNumber) track.trackNumber = resp.trackNumber;
            if (resp.thumbnail && !track.thumbnail) track.thumbnail = resp.thumbnail;
            await this.db.updateTrack(track);
            continue; // already got album from full lookup
          }
        } catch (e) {
          console.log('Rescan lookup failed for:', track.name, e);
        }
      }

      // If only missing album/trackNumber, fetch just that
      if (needsAlbum) {
        const { title, artist } = this.splitTrackName(track);
        try {
          const resp = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'fetchAlbum', title, artist }, (r) => {
              if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
              else resolve(r);
            });
          });
          let updated = false;
          if (resp.album) { track.album = resp.album; updated = true; }
          if (resp.trackNumber) { track.trackNumber = resp.trackNumber; updated = true; }
          if (resp.thumbnail && !track.thumbnail) { track.thumbnail = resp.thumbnail; updated = true; }
          if (updated) await this.db.updateTrack(track);
        } catch (e) {
          console.log('Rescan album failed for:', track.name, e);
        }
      }
    }
    this.loadLibrary();
  }

  renderTrackCard(track) {
    const thumbnail = track.thumbnail || '';
    const { title, artist } = this.splitTrackName(track);
    return `
      <div class="track-card" data-id="${track.id}">
        <div class="track-artwork-container">
          <div class="track-artwork">
            ${thumbnail ?
              `<img src="${thumbnail}" alt="${track.name}">` :
              `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                <path d="M9 18V5l12-2v13"></path>
                <circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="16" r="3"></circle>
              </svg>`
            }
          </div>
          <div class="track-play-overlay">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </div>
        </div>
        <div class="track-name">${title}</div>
        ${artist ? `<div class="track-artist">${artist}</div>` : ''}
      </div>
    `;
  }

  renderTrackRow(track, index) {
    const thumbnail = track.thumbnail || '';
    const { title, artist } = this.splitTrackName(track);
    const dateAdded = track.dateAdded ? this.formatDateAdded(track.dateAdded) : '';
    const duration = track.duration ? this.formatDuration(track.duration) : '-';
    const album = track.album || '';
    return `
      <div class="track-row track-card" data-id="${track.id}">
        <span class="col-num">${index}</span>
        <div class="col-title">
          <div class="track-row-art">
            ${thumbnail ?
              `<img src="${thumbnail}" alt="${track.name}">` :
              `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                <path d="M9 18V5l12-2v13"></path>
                <circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="16" r="3"></circle>
              </svg>`
            }
          </div>
          <div class="track-row-info">
            <div class="track-row-name">${title}</div>
            ${artist ? `<div class="track-row-artist">${artist}</div>` : ''}
          </div>
        </div>
        <span class="col-album">${album}</span>
        <span class="col-date">${dateAdded}</span>
        <span class="col-duration">${duration}</span>
      </div>
    `;
  }

  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  formatDateAdded(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) !== 1 ? 's' : ''} ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  attachTrackListeners(container) {
    container.querySelectorAll('.track-card').forEach(card => {
      card.addEventListener('click', async () => {
        const id = parseInt(card.dataset.id);

        // Auto-queue all tracks in the current view (like Spotify Liked Songs)
        const allCards = container.querySelectorAll('.track-card');
        const allIds = Array.from(allCards).map(c => parseInt(c.dataset.id));
        this.queue = allIds;
        this.queueIndex = allIds.indexOf(id);

        this.playTrack(id);
        this.updateQueueUI();
      });

      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const id = parseInt(card.dataset.id);
        this.showContextMenu(e, id);
      });
    });
  }

  async playTrack(id) {
    const track = await this.db.getTrack(id);
    if (!track) return;

    this.currentTrack = track;

    // Try playing from stored audio data
    try {
      if (track.audioData) {
        // Convert data URL to blob URL for reliable playback
        const response = await fetch(track.audioData);
        const blob = await response.blob();

        // Revoke previous blob URL to prevent memory leaks
        if (this._currentBlobUrl) {
          URL.revokeObjectURL(this._currentBlobUrl);
        }
        this._currentBlobUrl = URL.createObjectURL(blob);
        this.audio.src = this._currentBlobUrl;

        // If track has start time (album chapter), seek to it once loaded
        if (track.startTime) {
          this.audio.addEventListener('loadedmetadata', () => {
            this.audio.currentTime = track.startTime;
          }, { once: true });
        }
      } else {
        console.error('No audio data for track:', track.name);
        return;
      }

      // Resume AudioContext on user interaction (browser requirement)
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      await this.audio.play();
    } catch (err) {
      console.error('Playback error:', err);
      // Fallback: try direct source URL if available
      if (track.sourceUrl) {
        console.log('Trying source URL fallback...');
      }
      return;
    }

    this.isPlaying = true;
    this.updatePlayPauseUI();
    this.updateNowPlaying();

    // Add to recent
    await this.db.addToRecent(id);

    // Update play count
    track.playCount = (track.playCount || 0) + 1;
    await this.db.updateTrack(track);
  }

  togglePlay() {
    if (!this.currentTrack) return;

    if (this.isPlaying) {
      this.audio.pause();
    } else {
      this.audio.play();
    }
    this.isPlaying = !this.isPlaying;
    this.updatePlayPauseUI();
  }

  updatePlayPauseUI() {
    const btn = document.getElementById('playPauseBtn');
    const playIcon = btn.querySelector('.play-icon');
    const pauseIcon = btn.querySelector('.pause-icon');

    playIcon.style.display = this.isPlaying ? 'none' : 'block';
    pauseIcon.style.display = this.isPlaying ? 'block' : 'none';
  }

  updateNowPlaying() {
    if (!this.currentTrack) return;

    const { title, artist } = this.splitTrackName(this.currentTrack);
    document.getElementById('nowPlayingTitle').textContent = title;
    document.getElementById('nowPlayingArtist').textContent = artist || this.currentTrack.source || 'Local File';

    const artContainer = document.getElementById('nowPlayingArt');
    if (this.currentTrack.thumbnail) {
      artContainer.innerHTML = `<img src="${this.currentTrack.thumbnail}" style="width:100%;height:100%;object-fit:cover;">`;
    }

    // Update favorite button
    const favBtn = document.getElementById('favoriteBtn');
    favBtn.classList.toggle('active', this.currentTrack.favorite);

    // Auto-load lyrics if panel is open
    if (document.getElementById('lyricsPanel').classList.contains('open')) {
      this.loadLyrics();
    }
  }

  updateProgress() {
    if (!this.audio.duration) return;

    const track = this.currentTrack;
    const start = track?.startTime || 0;
    const end = track?.endTime || this.audio.duration;
    const duration = end - start;
    const current = this.audio.currentTime - start;

    // If chapter track reached its end, go to next
    if (track?.endTime && this.audio.currentTime >= track.endTime) {
      this.handleTrackEnd();
      return;
    }

    const percent = Math.max(0, Math.min(100, (current / duration) * 100));
    document.getElementById('progressFill').style.width = `${percent}%`;
    document.getElementById('progressHandle').style.left = `${percent}%`;
    document.getElementById('currentTime').textContent = this.formatTime(Math.max(0, current));
  }

  updateDuration() {
    const track = this.currentTrack;
    const start = track?.startTime || 0;
    const end = track?.endTime || this.audio.duration;
    const duration = end - start;
    document.getElementById('totalTime').textContent = this.formatTime(duration);

    // Store duration on track if not already set
    if (track && !track.duration && duration > 0 && isFinite(duration)) {
      track.duration = duration;
      this.db.updateTrack(track);
    }
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  handleTrackEnd() {
    if (this.repeatMode === 2) {
      // Repeat one
      this.audio.currentTime = 0;
      this.audio.play();
    } else if (this.queue.length > 0 && this.queueIndex < this.queue.length - 1) {
      // Play next track in queue
      this.playNext();
    } else if (this.queue.length > 0 && this.repeatMode === 1) {
      // Repeat all - loop back to start
      this.queueIndex = 0;
      this.playTrack(this.queue[0]);
      this.updateQueueUI();
    } else if (this.queue.length > 0 && this.isShuffle) {
      // Shuffle mode - pick a random track even at end of queue
      this.playNext();
    } else {
      this.isPlaying = false;
      this.updatePlayPauseUI();
    }
  }

  playNext() {
    if (this.queue.length === 0) return;

    if (this.isShuffle) {
      const randomIndex = Math.floor(Math.random() * this.queue.length);
      this.queueIndex = randomIndex;
    } else {
      this.queueIndex = (this.queueIndex + 1) % this.queue.length;
    }

    this.playTrack(this.queue[this.queueIndex]);
  }

  playPrevious() {
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0;
      return;
    }

    if (this.queue.length === 0) return;

    this.queueIndex = this.queueIndex > 0 ? this.queueIndex - 1 : this.queue.length - 1;
    this.playTrack(this.queue[this.queueIndex]);
  }

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    document.getElementById('shuffleBtn').classList.toggle('active', this.isShuffle);
  }

  toggleRepeat() {
    this.repeatMode = (this.repeatMode + 1) % 3;
    const btn = document.getElementById('repeatBtn');
    btn.classList.toggle('active', this.repeatMode > 0);

    if (this.repeatMode === 2) {
      btn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="17 1 21 5 17 9"></polyline>
          <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
          <polyline points="7 23 3 19 7 15"></polyline>
          <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
          <text x="12" y="14" font-size="8" fill="currentColor" text-anchor="middle">1</text>
        </svg>
      `;
    } else {
      btn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="17 1 21 5 17 9"></polyline>
          <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
          <polyline points="7 23 3 19 7 15"></polyline>
          <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
        </svg>
      `;
    }
  }

  async toggleCurrentFavorite() {
    if (!this.currentTrack) return;

    this.currentTrack.favorite = !this.currentTrack.favorite;
    await this.db.updateTrack(this.currentTrack);

    const favBtn = document.getElementById('favoriteBtn');
    favBtn.classList.toggle('active', this.currentTrack.favorite);

    // Refresh views if needed
    if (this.currentView === 'favorites') {
      this.loadFavorites();
    }
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(2, value)); // 0-200%
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume;
    }
    this.updateVolumeUI();
  }

  updateVolumeUI() {
    const percent = Math.min(100, Math.max(0, (this.volume / 2) * 100)); // map 0-2 to 0-100%
    document.getElementById('volumeFill').style.width = `${percent}%`;
    document.getElementById('volumeHandle').style.left = `${percent}%`;

    const highIcon = document.querySelector('.volume-high');
    const muteIcon = document.querySelector('.volume-mute');
    highIcon.style.display = this.volume > 0 ? 'block' : 'none';
    muteIcon.style.display = this.volume === 0 ? 'block' : 'none';
  }

  toggleMute() {
    if (this.volume > 0) {
      this.previousVolume = this.volume;
      this.setVolume(0);
    } else {
      this.setVolume(this.previousVolume || 1.4);
    }
  }

  async importFiles(files) {
    for (const file of files) {
      if (!file.type.startsWith('audio/')) continue;

      const reader = new FileReader();
      reader.onload = async (e) => {
        const audioData = e.target.result;
        const rawName = file.name.replace(/\.[^/.]+$/, '');

        // Look up artist/title/album from Genius using the filename
        let title = rawName;
        let artist = '';
        let album = '';
        let trackNumber = null;

        try {
          const resp = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'lookupTrack', name: rawName }, (r) => {
              if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
              else resolve(r);
            });
          });
          if (resp) {
            title = resp.title || rawName;
            artist = resp.artist || '';
            album = resp.album || '';
            trackNumber = resp.trackNumber || null;
          }
        } catch (err) {
          console.log('Lookup failed for import:', rawName, err);
        }

        const name = artist ? `${artist} - ${title}` : title;

        await this.db.addTrack({
          name,
          originalName: rawName,
          title,
          artist,
          album,
          trackNumber,
          source: 'Local File',
          audioData,
          thumbnail: null,
          duration: null
        });

        this.loadLibrary();
      };
      reader.readAsDataURL(file);
    }
  }

  async searchTracks(query) {
    if (!query.trim()) {
      this.loadLibrary();
      return;
    }

    const tracks = await this.db.getAllTracks();
    const filtered = tracks.filter(t =>
      t.name.toLowerCase().includes(query.toLowerCase())
    );

    const grid = document.getElementById('libraryGrid');
    grid.innerHTML = filtered.map(track => this.renderTrackCard(track)).join('');
    this.attachTrackListeners(grid);
  }

  showContextMenu(e, trackId) {
    this.contextTrack = trackId;
    const menu = document.getElementById('contextMenu');
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    menu.classList.add('show');

    // Update favorite text
    this.db.getTrack(trackId).then(track => {
      const favItem = menu.querySelector('[data-action="favorite"] span');
      if (favItem) {
        favItem.textContent = track.favorite ? 'Remove from Favorites' : 'Add to Favorites';
      }
    });
  }

  async handleContextAction(action) {
    const menu = document.getElementById('contextMenu');
    menu.classList.remove('show');

    if (!this.contextTrack) return;

    switch (action) {
      case 'play':
        this.playTrack(this.contextTrack);
        break;
      case 'addToQueue':
        this.queue.push(this.contextTrack);
        this.updateQueueUI();
        break;
      case 'addToPlaylist':
        this.showAddToPlaylistModal();
        break;
      case 'rename':
        this.showRenameModal();
        break;
      case 'favorite':
        await this.toggleFavorite(this.contextTrack);
        break;
      case 'delete':
        await this.deleteTrack(this.contextTrack);
        break;
    }
  }

  async toggleFavorite(trackId) {
    const track = await this.db.getTrack(trackId);
    track.favorite = !track.favorite;
    await this.db.updateTrack(track);

    if (this.currentView === 'favorites') {
      this.loadFavorites();
    }
  }

  async deleteTrack(trackId) {
    await this.db.deleteTrack(trackId);
    this.loadLibrary();

    if (this.currentTrack && this.currentTrack.id === trackId) {
      this.audio.pause();
      this.audio.src = '';
      this.currentTrack = null;
      document.getElementById('nowPlayingTitle').textContent = 'No track playing';
      document.getElementById('nowPlayingArtist').textContent = '-';
    }
  }

  async showRenameModal() {
    const track = await this.db.getTrack(this.contextTrack);
    if (!track) return;

    const { title, artist } = this.splitTrackName(track);
    document.getElementById('renameTitleInput').value = title;
    document.getElementById('renameArtistInput').value = artist;
    document.getElementById('renameModal').classList.add('show');
    document.getElementById('renameTitleInput').focus();
  }

  async confirmRename() {
    const title = document.getElementById('renameTitleInput').value.trim();
    const artist = document.getElementById('renameArtistInput').value.trim();

    if (!title) return;

    const track = await this.db.getTrack(this.contextTrack);
    if (!track) return;

    track.title = title;
    track.artist = artist;
    track.name = artist ? `${artist} - ${title}` : title;
    await this.db.updateTrack(track);

    document.getElementById('renameModal').classList.remove('show');
    this.loadLibrary();

    // Update now playing if this is the current track
    if (this.currentTrack && this.currentTrack.id === track.id) {
      this.currentTrack = track;
      this.updateNowPlaying();
    }
  }

  async loadPlaylists() {
    const playlists = await this.db.getAllPlaylists();
    const list = document.getElementById('playlistList');

    list.innerHTML = playlists.map(pl => `
      <div class="playlist-item" data-id="${pl.id}">${pl.name}</div>
    `).join('');

    list.querySelectorAll('.playlist-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = parseInt(item.dataset.id);
        this.openPlaylist(id);
      });
    });
  }

  async loadPlaylistsView() {
    const playlists = await this.db.getAllPlaylists();
    const grid = document.getElementById('playlistsGrid');

    if (playlists.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
          </svg>
          <h2>No playlists yet</h2>
          <p>Create a playlist to organize your music</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = playlists.map(pl => `
      <div class="playlist-card" data-id="${pl.id}">
        <div class="playlist-card-cover">
          <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="18" cy="16" r="3"></circle>
          </svg>
        </div>
        <div class="playlist-card-name">${pl.name}</div>
        <div class="playlist-card-count">${pl.tracks.length} songs</div>
      </div>
    `).join('');

    grid.querySelectorAll('.playlist-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = parseInt(card.dataset.id);
        this.openPlaylist(id);
      });
    });
  }

  async openPlaylist(id) {
    const playlist = await this.db.getPlaylist(id);
    if (!playlist) return;

    this.currentPlaylistId = id;

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('playlistDetailView').classList.add('active');

    document.getElementById('playlistTitle').textContent = playlist.name;
    document.getElementById('playlistMeta').textContent = `${playlist.tracks.length} songs`;

    const tracksList = document.getElementById('playlistTracks');

    if (playlist.tracks.length === 0) {
      tracksList.innerHTML = `
        <div class="empty-state">
          <p>This playlist is empty</p>
        </div>
      `;
      return;
    }

    const tracks = await Promise.all(
      playlist.tracks.map(id => this.db.getTrack(id))
    );

    tracksList.innerHTML = tracks.filter(t => t).map((track, i) => `
      <div class="track-list-item" data-id="${track.id}">
        <div class="track-number">${i + 1}</div>
        <div class="track-list-info">
          <div class="track-list-art">
            ${track.thumbnail ?
              `<img src="${track.thumbnail}">` :
              `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M9 18V5l12-2v13"></path>
              </svg>`
            }
          </div>
          <div class="track-list-name">${track.name}</div>
        </div>
        <div class="track-list-source">${track.source || 'Local'}</div>
        <div class="track-list-duration">${this.formatTime(track.duration)}</div>
      </div>
    `).join('');

    tracksList.querySelectorAll('.track-list-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = parseInt(item.dataset.id);
        this.queue = playlist.tracks;
        this.queueIndex = playlist.tracks.indexOf(id);
        this.playTrack(id);
      });
    });
  }

  async createPlaylist() {
    const input = document.getElementById('playlistNameInput');
    const name = input.value.trim();

    if (!name) return;

    await this.db.addPlaylist(name);
    input.value = '';
    document.getElementById('createPlaylistModal').classList.remove('show');

    this.loadPlaylists();
    if (this.currentView === 'playlists') {
      this.loadPlaylistsView();
    }
  }

  async showAddToPlaylistModal() {
    const playlists = await this.db.getAllPlaylists();
    const options = document.getElementById('playlistOptions');

    if (playlists.length === 0) {
      options.innerHTML = '<p style="color: var(--text-secondary);">No playlists. Create one first.</p>';
    } else {
      options.innerHTML = playlists.map(pl => `
        <button class="playlist-option" data-id="${pl.id}">
          <div class="playlist-option-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M9 18V5l12-2v13"></path>
            </svg>
          </div>
          ${pl.name}
        </button>
      `).join('');

      options.querySelectorAll('.playlist-option').forEach(opt => {
        opt.addEventListener('click', async () => {
          const playlistId = parseInt(opt.dataset.id);
          await this.addToPlaylist(playlistId, this.contextTrack);
          document.getElementById('addToPlaylistModal').classList.remove('show');
        });
      });
    }

    document.getElementById('addToPlaylistModal').classList.add('show');
  }

  async addToPlaylist(playlistId, trackId) {
    const playlist = await this.db.getPlaylist(playlistId);
    if (!playlist.tracks.includes(trackId)) {
      playlist.tracks.push(trackId);
      await this.db.updatePlaylist(playlist);
    }
    this.loadPlaylists();
  }

  async playPlaylist() {
    if (!this.currentPlaylistId) return;
    const playlist = await this.db.getPlaylist(this.currentPlaylistId);
    if (playlist.tracks.length === 0) return;

    this.queue = [...playlist.tracks];
    this.queueIndex = 0;
    this.playTrack(this.queue[0]);
  }

  async shufflePlaylist() {
    if (!this.currentPlaylistId) return;
    const playlist = await this.db.getPlaylist(this.currentPlaylistId);
    if (playlist.tracks.length === 0) return;

    this.queue = [...playlist.tracks].sort(() => Math.random() - 0.5);
    this.queueIndex = 0;
    this.playTrack(this.queue[0]);
  }

  updateQueueUI() {
    const queueList = document.getElementById('queueList');
    const nowPlaying = document.getElementById('queueNowPlaying');

    if (this.currentTrack) {
      nowPlaying.innerHTML = `
        <div class="queue-track-art">
          ${this.currentTrack.thumbnail ?
            `<img src="${this.currentTrack.thumbnail}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;">` :
            `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M9 18V5l12-2v13"></path>
            </svg>`
          }
        </div>
        <div class="queue-track-info">
          <div class="queue-track-name">${this.currentTrack.name}</div>
          <div class="queue-track-source">${this.currentTrack.source || 'Local'}</div>
        </div>
      `;
    }

    // Show upcoming tracks
    const upcoming = this.queue.slice(this.queueIndex + 1);
    if (upcoming.length === 0) {
      queueList.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">Queue is empty</p>';
    } else {
      Promise.all(upcoming.map(id => this.db.getTrack(id))).then(tracks => {
        queueList.innerHTML = tracks.filter(t => t).map(track => `
          <div class="queue-track" data-id="${track.id}">
            <div class="queue-track-art">
              ${track.thumbnail ?
                `<img src="${track.thumbnail}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;">` :
                `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M9 18V5l12-2v13"></path>
                </svg>`
              }
            </div>
            <div class="queue-track-info">
              <div class="queue-track-name">${track.name}</div>
              <div class="queue-track-source">${track.source || 'Local'}</div>
            </div>
          </div>
        `).join('');
      });
    }
  }

  // ---- Lyrics ----

  async loadLyrics() {
    const content = document.getElementById('lyricsContent');
    const credit = document.getElementById('lyricsCredit');
    const titleEl = document.getElementById('lyricsTitle');

    if (!this.currentTrack) {
      content.innerHTML = '<p class="lyrics-placeholder">Play a song to see lyrics</p>';
      credit.innerHTML = '';
      return;
    }

    const { title, artist } = this.splitTrackName(this.currentTrack);
    titleEl.textContent = title;
    content.innerHTML = '<p class="lyrics-loading">Finding lyrics...</p>';
    credit.innerHTML = '';

    try {
      const resp = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { action: 'fetchLyrics', title, artist },
          (r) => {
            if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
            else if (!r || !r.success) reject(new Error(r?.error || 'Failed'));
            else resolve(r.data);
          }
        );
      });

      content.textContent = resp.lyrics;
      credit.innerHTML = `Lyrics via <a href="${resp.songUrl}" target="_blank">Genius</a>`;

    } catch (err) {
      console.log('Lyrics error:', err);
      content.innerHTML = `<p class="lyrics-error">Lyrics not found for this track</p>`;
      credit.innerHTML = '';
    }
  }

  // ---- Sync Methods ----

  async checkSyncStatus() {
    try {
      const signedIn = await this.sync.isSignedIn();
      const dot = document.querySelector('.sync-dot');
      const text = document.getElementById('syncText');

      if (signedIn) {
        dot.className = 'sync-dot online';
        text.textContent = 'Connected to Google';
      } else {
        dot.className = 'sync-dot offline';
        text.textContent = 'Not connected';
      }
    } catch (err) {
      console.log('Sync status check failed:', err);
    }
  }

  async startSync() {
    const syncBtn = document.getElementById('syncBtn');
    const syncBtnText = document.getElementById('syncBtnText');
    const syncProgress = document.getElementById('syncProgress');
    const syncProgressFill = document.getElementById('syncProgressFill');
    const syncProgressText = document.getElementById('syncProgressText');
    const dot = document.querySelector('.sync-dot');
    const syncText = document.getElementById('syncText');

    if (this.sync.isSyncing) return;

    syncBtn.classList.add('syncing');
    syncBtnText.textContent = 'Syncing...';
    syncProgress.classList.remove('hidden');
    dot.className = 'sync-dot syncing';
    syncText.textContent = 'Syncing...';

    try {
      const result = await this.sync.sync(this.db, (message, current, total) => {
        const percent = total > 0 ? (current / total) * 100 : 0;
        syncProgressFill.style.width = `${percent}%`;
        syncProgressText.textContent = message;
      });

      dot.className = 'sync-dot online';
      syncText.textContent = 'Synced just now';
      syncProgressText.textContent = `Done! ${result.uploaded} uploaded, ${result.downloaded} downloaded`;

      // Reload library to show new tracks
      this.loadLibrary();
      this.loadPlaylists();

      // Hide progress after 3 seconds
      setTimeout(() => {
        syncProgress.classList.add('hidden');
      }, 3000);

    } catch (err) {
      console.error('Sync failed:', err);
      dot.className = 'sync-dot offline';
      syncText.textContent = 'Sync failed';
      syncProgressText.textContent = err.message;

      setTimeout(() => {
        syncProgress.classList.add('hidden');
      }, 5000);
    } finally {
      syncBtn.classList.remove('syncing');
      syncBtnText.textContent = 'Sync Now';
    }
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  window.player = new MusicPlayer();
});
