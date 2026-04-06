// Global variables
let currentPlaylist = [];
let currentSongIndex = 0;
let isPlaying = false;
let repeatMode = 'none'; // 'none', 'one', 'all'
let shuffleMode = false;
let currentUser = null;

// DOM elements
const audioPlayer = document.getElementById('audioPlayer');
const playBtn = document.getElementById('playBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const repeatBtn = document.getElementById('repeatBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const volumeSlider = document.getElementById('volumeSlider');
const progressBar = document.querySelector('.progress-bar');
const progressFill = document.getElementById('progressFill');
const currentTimeSpan = document.getElementById('currentTime');
const durationSpan = document.getElementById('duration');
const currentSongTitle = document.getElementById('currentSongTitle');
const currentSongArtist = document.getElementById('currentSongArtist');
const songsGrid = document.getElementById('songsGrid');
const songsList = document.getElementById('songsList');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadSongs();
    setupEventListeners();
    checkAuthStatus();
    setupDragAndDrop();
    
    // Mobile menu toggle
    document.getElementById('mobileMenuBtn').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('show');
    });
    
    // Tab switching
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = item.dataset.tab;
            switchTab(tab);
        });
    });
});

function setupEventListeners() {
    playBtn.addEventListener('click', togglePlay);
    prevBtn.addEventListener('click', playPrevious);
    nextBtn.addEventListener('click', playNext);
    repeatBtn.addEventListener('click', toggleRepeat);
    shuffleBtn.addEventListener('click', toggleShuffle);
    volumeSlider.addEventListener('input', (e) => {
        audioPlayer.volume = e.target.value;
    });
    
    audioPlayer.addEventListener('timeupdate', updateProgress);
    audioPlayer.addEventListener('loadedmetadata', () => {
        durationSpan.textContent = formatTime(audioPlayer.duration);
    });
    audioPlayer.addEventListener('ended', handleSongEnd);
    
    progressBar.addEventListener('click', seek);
    
    // Login modal
    const modal = document.getElementById('loginModal');
    const loginBtn = document.getElementById('loginBtn');
    const closeBtn = document.querySelector('.close');
    
    loginBtn.onclick = () => modal.style.display = 'flex';
    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (e) => {
        if (e.target === modal) modal.style.display = 'none';
    };
    
    // Auth tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const authType = tab.dataset.auth;
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('loginForm').style.display = authType === 'login' ? 'flex' : 'none';
            document.getElementById('registerForm').style.display = authType === 'register' ? 'flex' : 'none';
        });
    });
    
    // Login form
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username, password})
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = username;
            document.getElementById('loginModal').style.display = 'none';
            document.getElementById('userInfo').style.display = 'flex';
            document.getElementById('username').textContent = username;
            document.getElementById('loginBtn').style.display = 'none';
            loadSongs();
            loadUserStats();
            showNotification('Đăng nhập thành công!', 'success');
        } else {
            showNotification('Đăng nhập thất bại!', 'error');
        }
    });
    
    // Register form
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('regUsername').value;
        const password = document.getElementById('regPassword').value;
        const confirm = document.getElementById('regConfirmPassword').value;
        
        if (password !== confirm) {
            showNotification('Mật khẩu không khớp!', 'error');
            return;
        }
        
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username, password})
        });
        
        if (response.ok) {
            showNotification('Đăng ký thành công! Vui lòng đăng nhập.', 'success');
            document.querySelector('.auth-tab[data-auth="login"]').click();
        } else {
            showNotification('Đăng ký thất bại!', 'error');
        }
    });
    
    // Upload handlers
    document.getElementById('selectFileBtn').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });
    
    document.getElementById('fileInput').addEventListener('change', handleFileSelect);
    document.getElementById('submitUpload').addEventListener('click', uploadSong);
    document.getElementById('cancelUpload').addEventListener('click', cancelUpload);
}

async function loadSongs() {
    try {
        const response = await fetch('/api/songs');
        const songs = await response.json();
        currentPlaylist = songs;
        displaySongs(songs);
        displayLibrary(songs);
    } catch (error) {
        console.error('Error loading songs:', error);
    }
}

function displaySongs(songs) {
    if (!songsGrid) return;
    
    songsGrid.innerHTML = songs.map((song, index) => `
        <div class="song-card" onclick="playSong(${index})">
            <div class="song-card-icon">
                <i class="fas fa-music"></i>
            </div>
            <h3>${escapeHtml(song.title)}</h3>
            <p>${escapeHtml(song.artist)}</p>
            <div class="song-meta">
                <span><i class="fas fa-user"></i> ${escapeHtml(song.username)}</span>
                <span><i class="fas fa-play"></i> ${song.play_count}</span>
                <span>${formatTime(song.duration)}</span>
            </div>
        </div>
    `).join('');
}

function displayLibrary(songs) {
    if (!songsList) return;
    
    songsList.innerHTML = songs.map((song, index) => `
        <div class="song-list-item" onclick="playSong(${index})">
            <div class="index">${index + 1}</div>
            <div class="info">
                <h4>${escapeHtml(song.title)}</h4>
                <p>${escapeHtml(song.artist)}</p>
            </div>
            <div class="duration">${formatTime(song.duration)}</div>
        </div>
    `).join('');
}

function playSong(index) {
    if (index >= 0 && index < currentPlaylist.length) {
        currentSongIndex = index;
        const song = currentPlaylist[currentSongIndex];
        audioPlayer.src = song.filepath;
        currentSongTitle.textContent = song.title;
        currentSongArtist.textContent = song.artist;
        audioPlayer.play();
        isPlaying = true;
        updatePlayButton();
        
        // Increment play count
        fetch(`/api/song/${song.id}/play`, {method: 'POST'});
    }
}

function togglePlay() {
    if (audioPlayer.src) {
        if (isPlaying) {
            audioPlayer.pause();
        } else {
            audioPlayer.play();
        }
        isPlaying = !isPlaying;
        updatePlayButton();
    }
}

function updatePlayButton() {
    const icon = playBtn.querySelector('i');
    if (isPlaying) {
        icon.className = 'fas fa-pause';
    } else {
        icon.className = 'fas fa-play';
    }
}

function playNext() {
    if (currentPlaylist.length === 0) return;
    
    if (shuffleMode) {
        let newIndex;
        do {
            newIndex = Math.floor(Math.random() * currentPlaylist.length);
        } while (newIndex === currentSongIndex && currentPlaylist.length > 1);
        currentSongIndex = newIndex;
    } else {
        currentSongIndex = (currentSongIndex + 1) % currentPlaylist.length;
    }
    playSong(currentSongIndex);
}

function playPrevious() {
    if (currentPlaylist.length === 0) return;
    
    if (audioPlayer.currentTime > 3) {
        audioPlayer.currentTime = 0;
    } else {
        currentSongIndex = (currentSongIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
        playSong(currentSongIndex);
    }
}

function handleSongEnd() {
    if (repeatMode === 'one') {
        audioPlayer.currentTime = 0;
        audioPlayer.play();
    } else if (repeatMode === 'all' || currentSongIndex < currentPlaylist.length - 1) {
        playNext();
    }
}

function toggleRepeat() {
    if (repeatMode === 'none') {
        repeatMode = 'one';
        repeatBtn.classList.add('active');
        repeatBtn.style.color = '#ff6b6b';
    } else if (repeatMode === 'one') {
        repeatMode = 'all';
        repeatBtn.style.color = '#ff6b6b';
    } else {
        repeatMode = 'none';
        repeatBtn.classList.remove('active');
        repeatBtn.style.color = 'white';
    }
    showNotification(`Chế độ lặp: ${repeatMode === 'none' ? 'Tắt' : repeatMode === 'one' ? 'Lặp 1 bài' : 'Lặp tất cả'}`, 'info');
}

function toggleShuffle() {
    shuffleMode = !shuffleMode;
    if (shuffleMode) {
        shuffleBtn.classList.add('active');
        shuffleBtn.style.color = '#ff6b6b';
        showNotification('Đã bật phát ngẫu nhiên', 'info');
    } else {
        shuffleBtn.classList.remove('active');
        shuffleBtn.style.color = 'white';
        showNotification('Đã tắt phát ngẫu nhiên', 'info');
    }
}

function updateProgress() {
    if (audioPlayer.duration) {
        const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progressFill.style.width = `${percent}%`;
        currentTimeSpan.textContent = formatTime(audioPlayer.currentTime);
    }
}

function seek(e) {
    const rect = progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audioPlayer.currentTime = percent * audioPlayer.duration;
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function setupDragAndDrop() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.type.includes('audio')) {
            handleFile(file);
        } else {
            showNotification('Vui lòng thả file nhạc!', 'error');
        }
    });
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

function handleFile(file) {
    if (!currentUser) {
        showNotification('Vui lòng đăng nhập để tải nhạc lên!', 'error');
        document.getElementById('loginModal').style.display = 'flex';
        return;
    }
    
    window.selectedFile = file;
    document.getElementById('uploadArea').style.display = 'none';
    document.getElementById('uploadForm').style.display = 'block';
    document.getElementById('songTitle').value = file.name.replace(/\.[^/.]+$/, '');
}

async function uploadSong() {
    const title = document.getElementById('songTitle').value;
    const artist = document.getElementById('songArtist').value;
    const file = window.selectedFile;
    
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('artist', artist);
    
    const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
    });
    
    if (response.ok) {
        showNotification('Tải lên thành công!', 'success');
        cancelUpload();
        loadSongs();
        loadUserStats();
    } else {
        showNotification('Tải lên thất bại!', 'error');
    }
}

function cancelUpload() {
    window.selectedFile = null;
    document.getElementById('uploadArea').style.display = 'block';
    document.getElementById('uploadForm').style.display = 'none';
    document.getElementById('songTitle').value = '';
    document.getElementById('songArtist').value = '';
    document.getElementById('fileInput').value = '';
}

async function loadUserStats() {
    if (currentUser) {
        const response = await fetch('/api/user/stats');
        const stats = await response.json();
        document.getElementById('songCount').textContent = stats.songs_count;
        document.getElementById('totalPlays').textContent = stats.total_plays;
        document.getElementById('statsCards').style.display = 'grid';
    }
}

function checkAuthStatus() {
    // Check if user is logged in via session
    fetch('/api/songs')
        .then(() => {
            // If we can access, user might be logged in
            // This is simplified; in production, add a /api/me endpoint
        });
}

function switchTab(tabName) {
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.dataset.tab === tabName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // Update active tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}Tab`).classList.add('active');
    
    // Update page title
    const titles = {
        home: 'Khám phá âm nhạc',
        library: 'Thư viện nhạc',
        upload: 'Tải lên bài hát'
    };
    document.getElementById('pageTitle').textContent = titles[tabName];
    
    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('show');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
        color: white;
        border-radius: 8px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add CSS animation for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .tab-content {
        display: none;
        animation: fadeInUp 0.5s ease;
    }
    
    .tab-content.active {
        display: block;
    }
`;
document.head.appendChild(style);