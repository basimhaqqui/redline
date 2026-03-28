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
    this.volume = 0.7;
    this.currentView = 'library';
    this.currentPlaylistId = null;
    this.contextTrack = null;

    this.init();
  }

  async init() {
    await this.db.init();
    this.sync = new DriveSync();
    this.setupEventListeners();
    this.loadLibrary();
    this.loadPlaylists();
    this.audio.volume = this.volume;
    this.updateVolumeUI();
    this.checkSyncStatus();
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
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const layout = btn.dataset.layout;
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const grid = document.getElementById('libraryGrid');
        grid.classList.toggle('list-view', layout === 'list');
      });
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

    // Progress bar
    const progressBar = document.getElementById('progressBar');
    progressBar.addEventListener('click', (e) => {
      const rect = progressBar.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      this.audio.currentTime = percent * this.audio.duration;
    });

    // Volume
    document.getElementById('volumeBtn').addEventListener('click', () => this.toggleMute());
    const volumeBar = document.getElementById('volumeBar');
    volumeBar.addEventListener('click', (e) => {
      const rect = volumeBar.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      this.setVolume(percent);
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
          this.setVolume(Math.min(1, this.volume + 0.1));
          break;
        case 'ArrowDown':
          this.setVolume(Math.max(0, this.volume - 0.1));
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

  async loadLibrary() {
    const tracks = await this.db.getAllTracks();
    const grid = document.getElementById('libraryGrid');
    const empty = document.getElementById('emptyLibrary');

    if (tracks.length === 0) {
      grid.style.display = 'none';
      empty.style.display = 'flex';
      return;
    }

    grid.style.display = 'grid';
    empty.style.display = 'none';

    grid.innerHTML = tracks.map(track => this.renderTrackCard(track)).join('');
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

  renderTrackCard(track) {
    const thumbnail = track.thumbnail || '';
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
        <div class="track-name">${track.name}</div>
        <div class="track-source">${track.source || 'Local File'}</div>
      </div>
    `;
  }

  attachTrackListeners(container) {
    container.querySelectorAll('.track-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = parseInt(card.dataset.id);
        this.playTrack(id);
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
      // Convert base64 data URL to blob URL for better playback support
      if (track.audioData && track.audioData.startsWith('data:')) {
        const response = await fetch(track.audioData);
        const blob = await response.blob();
        // Ensure correct MIME type
        const audioBlob = blob.type.startsWith('audio/')
          ? blob
          : new Blob([blob], { type: 'audio/mpeg' });
        const blobUrl = URL.createObjectURL(audioBlob);

        // Revoke previous blob URL to prevent memory leaks
        if (this._currentBlobUrl) {
          URL.revokeObjectURL(this._currentBlobUrl);
        }
        this._currentBlobUrl = blobUrl;
        this.audio.src = blobUrl;
      } else if (track.audioData) {
        this.audio.src = track.audioData;
      } else {
        console.error('No audio data for track:', track.name);
        return;
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

    document.getElementById('nowPlayingTitle').textContent = this.currentTrack.name;
    document.getElementById('nowPlayingArtist').textContent = this.currentTrack.source || 'Local File';

    const artContainer = document.getElementById('nowPlayingArt');
    if (this.currentTrack.thumbnail) {
      artContainer.innerHTML = `<img src="${this.currentTrack.thumbnail}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;">`;
    }

    // Update favorite button
    const favBtn = document.getElementById('favoriteBtn');
    favBtn.classList.toggle('active', this.currentTrack.favorite);
  }

  updateProgress() {
    if (!this.audio.duration) return;

    const percent = (this.audio.currentTime / this.audio.duration) * 100;
    document.getElementById('progressFill').style.width = `${percent}%`;
    document.getElementById('progressHandle').style.left = `${percent}%`;
    document.getElementById('currentTime').textContent = this.formatTime(this.audio.currentTime);
  }

  updateDuration() {
    document.getElementById('totalTime').textContent = this.formatTime(this.audio.duration);
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
      this.playNext();
    } else if (this.repeatMode === 1 && this.queue.length > 0) {
      // Repeat all
      this.queueIndex = 0;
      this.playTrack(this.queue[0]);
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
    this.volume = Math.max(0, Math.min(1, value));
    this.audio.volume = this.volume;
    this.updateVolumeUI();
  }

  updateVolumeUI() {
    const percent = this.volume * 100;
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
      this.setVolume(this.previousVolume || 0.7);
    }
  }

  async importFiles(files) {
    for (const file of files) {
      if (!file.type.startsWith('audio/')) continue;

      const reader = new FileReader();
      reader.onload = async (e) => {
        const audioData = e.target.result;
        const name = file.name.replace(/\.[^/.]+$/, '');

        await this.db.addTrack({
          name,
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
