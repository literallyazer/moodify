// Spotify API Configuration
const SPOTIFY_CLIENT_ID = 'db22c413e7634d3eaeb95e53cafe0f4c';
const SPOTIFY_REDIRECT_URI = 'https://literallyazer.github.io/moodify/';
const SPOTIFY_SCOPES = [
    'user-read-private',
    'playlist-modify-public',
    'playlist-modify-private'
].join(' ');

// DOM Elements
const moodCards = document.querySelectorAll('.mood-card');
const loadingContainer = document.querySelector('.loading-container');
const playlistSection = document.querySelector('.playlist-section');
const playlistGrid = document.querySelector('.playlist-grid');
const customizationSection = document.querySelector('.playlist-customization');
const loginButton = document.querySelector('.login-btn');

// Mood to Genre/Seed Mapping
const moodMappings = {
    happy: {
        genres: ['pop', 'dance', 'happy'],
        valence: 0.7,
        energy: 0.8
    },
    calm: {
        genres: ['ambient', 'chill', 'sleep'],
        valence: 0.5,
        energy: 0.3
    },
    energetic: {
        genres: ['electronic', 'dance', 'workout'],
        valence: 0.8,
        energy: 0.9
    },
    focused: {
        genres: ['study', 'classical', 'instrumental'],
        valence: 0.6,
        energy: 0.4
    }
};

// Animation Controllers
const animations = {
    fadeIn: (element) => {
        element.style.opacity = '0';
        element.classList.remove('hidden');
        requestAnimationFrame(() => {
            element.style.transition = 'opacity 0.5s ease';
            element.style.opacity = '1';
        });
    },

    fadeOut: (element) => {
        element.style.opacity = '0';
        setTimeout(() => element.classList.add('hidden'), 500);
    },

    addLoadingWave: () => {
        animations.fadeIn(loadingContainer);
        return setTimeout(() => animations.fadeOut(loadingContainer), 2000);
    }
};

// Spotify Authentication
class SpotifyAuth {
    static login() {
        const params = new URLSearchParams({
            client_id: SPOTIFY_CLIENT_ID,
            response_type: 'token',
            redirect_uri: SPOTIFY_REDIRECT_URI,
            scope: SPOTIFY_SCOPES,
            show_dialog: true
        });

        window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
    }

    static getToken() {
        const hash = window.location.hash
            .substring(1)
            .split('&')
            .reduce((initial, item) => {
                const parts = item.split('=');
                initial[parts[0]] = decodeURIComponent(parts[1]);
                return initial;
            }, {});

        return hash.access_token;
    }

    static checkAuthStatus() {
        const token = this.getToken();
        if (token) {
            console.log('Auth token found:', token.substring(0, 10) + '...');
            return true;
        } else {
            console.log('No auth token found');
            return false;
        }
    }
}

// Spotify API Handler
class SpotifyAPI {
    constructor(token) {
        this.token = token;
        this.baseUrl = 'https://api.spotify.com/v1';
    }

    async fetchWithAuth(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Spotify API Error:', errorData);
                throw new Error(`Spotify API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
            }

            return response.json();
        } catch (error) {
            console.error('Fetch error:', error);
            throw error;
        }
    }

    async getRecommendations(mood) {
        console.log('Getting recommendations for mood:', mood);
        console.log('Using token:', this.token.substring(0, 10) + '...');
        
        const { genres, valence, energy } = moodMappings[mood];
        const params = new URLSearchParams({
            seed_genres: genres.join(','),
            target_valence: valence,
            target_energy: energy,
            limit: 20
        });

        console.log('Request parameters:', params.toString());
        
        try {
            const data = await this.fetchWithAuth(`/recommendations?${params}`);
            console.log('Received recommendations:', data);
            return data;
        } catch (error) {
            console.error('Error getting recommendations:', error);
            throw error;
        }
    }

    async createPlaylist(userId, name, tracks) {
        const playlist = await this.fetchWithAuth(`/users/${userId}/playlists`, {
            method: 'POST',
            body: JSON.stringify({
                name: `${name} Mood - Moodify`,
                description: 'Created with Moodify - Your mood-based playlist generator'
            })
        });

        await this.fetchWithAuth(`/playlists/${playlist.id}/tracks`, {
            method: 'POST',
            body: JSON.stringify({
                uris: tracks.map(track => track.uri)
            })
        });

        return playlist;
    }
}

// UI Controller
class UIController {
    static renderPlaylist(tracks) {
        playlistGrid.innerHTML = tracks.map(track => `
            <div class="track-card" data-uri="${track.uri}">
                <img src="${track.album.images[0].url}" alt="${track.name}">
                <div class="track-info">
                    <h3>${track.name}</h3>
                    <p>${track.artists[0].name}</p>
                </div>
                <button class="play-preview" data-preview="${track.preview_url}">
                    <i class="fas fa-play"></i>
                </button>
            </div>
        `).join('');
    }

    static updateCustomizationUI(mood) {
        const { valence, energy } = moodMappings[mood];
        const energySlider = document.querySelector('input[name="energy"]');
        const valenceSlider = document.querySelector('input[name="valence"]');

        if (energySlider) {
            energySlider.value = energy * 100;
        }
        if (valenceSlider) {
            valenceSlider.value = valence * 100;
        }
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Check auth status on load
    SpotifyAuth.checkAuthStatus();

    // Handle mood selection
    moodCards.forEach(card => {
        card.addEventListener('click', async (e) => {
            const selectedMood = e.currentTarget.dataset.mood;
            console.log('Selected mood:', selectedMood);
            const loadingTimeout = animations.addLoadingWave();
            
            try {
                const token = SpotifyAuth.getToken();
                console.log('Token present:', !!token);
                
                if (!token) {
                    console.log('No token found, redirecting to login...');
                    SpotifyAuth.login();
                    return;
                }

                console.log('Creating Spotify API instance...');
                const spotifyAPI = new SpotifyAPI(token);
                
                console.log('Fetching recommendations...');
                const recommendations = await spotifyAPI.getRecommendations(selectedMood);
                console.log('Recommendations received:', recommendations);

                if (!recommendations.tracks || recommendations.tracks.length === 0) {
                    throw new Error('No tracks received from Spotify');
                }
                
                clearTimeout(loadingTimeout);
                animations.fadeOut(loadingContainer);

                // Make sections visible
                customizationSection.classList.remove('hidden');
                playlistSection.classList.remove('hidden');

                console.log('Rendering playlist...');
                UIController.renderPlaylist(recommendations.tracks);
                UIController.updateCustomizationUI(selectedMood);

            } catch (error) {
                console.error('Error in mood selection handler:', error);
                clearTimeout(loadingTimeout);
                animations.fadeOut(loadingContainer);
                
                // Show user-friendly error
                alert(`Error: ${error.message || 'Unable to generate playlist. Please try again.'}`);
            }
        });
    });

    // Handle login button
    loginButton.addEventListener('click', SpotifyAuth.login);

    // Handle audio preview
    playlistGrid.addEventListener('click', (e) => {
        const playButton = e.target.closest('.play-preview');
        if (!playButton) return;

        const previewUrl = playButton.dataset.preview;
        if (!previewUrl) return;

        // Stop any playing previews
        const audio = document.querySelector('audio');
        if (audio) audio.remove();

        // Create and play new audio
        const newAudio = new Audio(previewUrl);
        document.body.appendChild(newAudio);
        newAudio.play();
    });
});

// Add scroll animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('fade-in-visible');
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Observe elements for scroll animations
document.querySelectorAll('.mood-card, .track-card').forEach(
    element => observer.observe(element)
);
