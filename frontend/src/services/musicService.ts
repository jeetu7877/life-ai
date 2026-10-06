/**
 * Life AI Music Service
 * Multi-provider audio playback engine supporting official YouTube IFrame Player API,
 * dynamic search via YouTube Data API backend, play queue, persistent background playback,
 * Liked Songs, Custom & Curated Playlists, Shuffle, Repeat, and Search History.
 */

import { api } from './api';
import { handsFreeService } from './handsFreeService';
import { Track, Playlist, PlayerState, PlayerStatus, RepeatMode } from './musicProvider';

export type { Track, Playlist, PlayerState, PlayerStatus, RepeatMode };

// Core featured tracks with verified YouTube video IDs and high-res album thumbnails
export const FEATURED_TRACKS: Track[] = [
  {
    id: '284Ov7ysmfA',
    title: 'Channa Mereya',
    artist: 'Arijit Singh, Pritam',
    channel: 'Sony Music India',
    thumbnail: 'https://i.ytimg.com/vi/284Ov7ysmfA/hqdefault.jpg',
    duration: '4:49',
    durationSeconds: 289,
    source: 'youtube',
    videoId: '284Ov7ysmfA',
    url: 'https://www.youtube.com/watch?v=284Ov7ysmfA',
    album: 'Ae Dil Hai Mushkil'
  },
  {
    id: 'BddP6PYo2gs',
    title: 'Kesariya',
    artist: 'Arijit Singh, Pritam',
    channel: 'Sony Music India',
    thumbnail: 'https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg',
    duration: '4:28',
    durationSeconds: 268,
    source: 'youtube',
    videoId: 'BddP6PYo2gs',
    url: 'https://www.youtube.com/watch?v=BddP6PYo2gs',
    album: 'Brahmāstra'
  },
  {
    id: 'ElZfdU54Cp8',
    title: 'Apna Bana Le',
    artist: 'Arijit Singh, Sachin-Jigar',
    channel: 'Zee Music Company',
    thumbnail: 'https://i.ytimg.com/vi/ElZfdU54Cp8/hqdefault.jpg',
    duration: '4:21',
    durationSeconds: 261,
    source: 'youtube',
    videoId: 'ElZfdU54Cp8',
    url: 'https://www.youtube.com/watch?v=ElZfdU54Cp8',
    album: 'Bhediya'
  },
  {
    id: 'sK7riqg2mr4',
    title: 'Saiyaara',
    artist: 'Mohit Chauhan, Taraannum Mallik',
    channel: 'YRF',
    thumbnail: 'https://i.ytimg.com/vi/sK7riqg2mr4/hqdefault.jpg',
    duration: '4:13',
    durationSeconds: 253,
    source: 'youtube',
    videoId: 'sK7riqg2mr4',
    url: 'https://www.youtube.com/watch?v=sK7riqg2mr4',
    album: 'Ek Tha Tiger'
  },
  {
    id: 'Umqb9KENgmk',
    title: 'Tum Hi Ho',
    artist: 'Arijit Singh, Mithoon',
    channel: 'T-Series',
    thumbnail: 'https://i.ytimg.com/vi/Umqb9KENgmk/hqdefault.jpg',
    duration: '4:22',
    durationSeconds: 262,
    source: 'youtube',
    videoId: 'Umqb9KENgmk',
    url: 'https://www.youtube.com/watch?v=Umqb9KENgmk',
    album: 'Aashiqui 2'
  },
  {
    id: 'sAZlWVDHL78',
    title: 'Agar Tum Saath Ho',
    artist: 'Alka Yagnik, Arijit Singh',
    channel: 'T-Series',
    thumbnail: 'https://i.ytimg.com/vi/sAZlWVDHL78/hqdefault.jpg',
    duration: '5:41',
    durationSeconds: 341,
    source: 'youtube',
    videoId: 'sAZlWVDHL78',
    url: 'https://www.youtube.com/watch?v=sAZlWVDHL78',
    album: 'Tamasha'
  },
  {
    id: 'HqUeSjsYLNU',
    title: 'Tujhe Kitna Chahne Lage',
    artist: 'Arijit Singh, Mithoon',
    channel: 'T-Series',
    thumbnail: 'https://i.ytimg.com/vi/HqUeSjsYLNU/hqdefault.jpg',
    duration: '4:44',
    durationSeconds: 284,
    source: 'youtube',
    videoId: 'HqUeSjsYLNU',
    url: 'https://www.youtube.com/watch?v=HqUeSjsYLNU',
    album: 'Kabir Singh'
  },
  {
    id: 'bC36hd479i8',
    title: 'O Maahi',
    artist: 'Arijit Singh, Pritam',
    channel: 'T-Series',
    thumbnail: 'https://i.ytimg.com/vi/bC36hd479i8/hqdefault.jpg',
    duration: '3:53',
    durationSeconds: 233,
    source: 'youtube',
    videoId: 'bC36hd479i8',
    url: 'https://www.youtube.com/watch?v=bC36hd479i8',
    album: 'Dunki'
  },
  {
    id: '9n4sZ9gH_6c',
    title: 'Zid - Saanson Ko',
    artist: 'Shaarib Toshi, Arijit Singh',
    channel: 'Sony Music India',
    thumbnail: 'https://i.ytimg.com/vi/9n4sZ9gH_6c/hqdefault.jpg',
    duration: '4:48',
    durationSeconds: 288,
    source: 'youtube',
    videoId: '9n4sZ9gH_6c',
    url: 'https://www.youtube.com/watch?v=9n4sZ9gH_6c',
    album: 'Zid'
  },
  {
    id: '1IpA8G5x-tM',
    title: 'Sanam Teri Kasam',
    artist: 'Himesh Reshammiya, Ankit Tiwari',
    channel: 'Eros Now',
    thumbnail: 'https://i.ytimg.com/vi/1IpA8G5x-tM/hqdefault.jpg',
    duration: '5:14',
    durationSeconds: 314,
    source: 'youtube',
    videoId: '1IpA8G5x-tM',
    url: 'https://www.youtube.com/watch?v=1IpA8G5x-tM',
    album: 'Sanam Teri Kasam'
  },
  {
    id: 'curated_3',
    title: 'Lo-Fi Chill Study Beats',
    artist: 'Life AI Relax & Focus',
    channel: 'Life AI Audio',
    thumbnail: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300&q=80',
    duration: '3:00',
    durationSeconds: 180,
    source: 'direct',
    streamUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3'
  },
  {
    id: 'curated_4',
    title: 'Peaceful Rain & Acoustic Piano',
    artist: 'Calm Sanctuary',
    channel: 'Sanctuary Sounds',
    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80',
    duration: '3:15',
    durationSeconds: 195,
    source: 'direct',
    streamUrl: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=rain-and-nostalgia-18151.mp3'
  },
  {
    id: 'curated_6',
    title: 'Deep Meditation & Ambient Flow',
    artist: 'Mindful Harmony',
    channel: 'Inner Peace',
    thumbnail: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=300&q=80',
    duration: '3:30',
    durationSeconds: 210,
    source: 'direct',
    streamUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=meditation-piano-flow-10702.mp3'
  }
];

export const CURATED_TRACKS: Track[] = FEATURED_TRACKS;

// Premium curated playlists styled precisely like the reference image
export const CURATED_PLAYLISTS: Playlist[] = [
  // Made for You
  {
    id: 'pl_arijit_mix',
    title: 'Arijit Singh Mix',
    description: 'Your emotional picks',
    artwork: 'https://i.ytimg.com/vi/284Ov7ysmfA/hqdefault.jpg',
    createdAt: '2026-01-01T00:00:00.000Z',
    isCustom: false,
    tracks: [
      FEATURED_TRACKS[0],
      FEATURED_TRACKS[1],
      FEATURED_TRACKS[2],
      FEATURED_TRACKS[4],
      FEATURED_TRACKS[6],
      FEATURED_TRACKS[5],
      FEATURED_TRACKS[7],
    ]
  },
  {
    id: 'pl_lofi_vibes',
    title: 'Lo-Fi Vibes',
    description: 'Focus · Study · Relax',
    artwork: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400&q=80',
    createdAt: '2026-01-01T00:00:00.000Z',
    isCustom: false,
    tracks: [
      FEATURED_TRACKS[8],
      FEATURED_TRACKS[9],
      FEATURED_TRACKS[10],
    ]
  },
  {
    id: 'pl_romantic_hits',
    title: 'Romantic Hits',
    description: 'Feel the love',
    artwork: 'https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg',
    createdAt: '2026-01-01T00:00:00.000Z',
    isCustom: false,
    tracks: [
      FEATURED_TRACKS[1],
      FEATURED_TRACKS[3],
      FEATURED_TRACKS[2],
      FEATURED_TRACKS[4],
      FEATURED_TRACKS[5],
    ]
  },
  {
    id: 'pl_bollywood_2024',
    title: 'Bollywood 2024',
    description: 'Latest hits',
    artwork: 'https://i.ytimg.com/vi/ElZfdU54Cp8/hqdefault.jpg',
    createdAt: '2026-01-01T00:00:00.000Z',
    isCustom: false,
    tracks: [
      FEATURED_TRACKS[2],
      FEATURED_TRACKS[7],
      FEATURED_TRACKS[1],
      FEATURED_TRACKS[0],
      FEATURED_TRACKS[6],
    ]
  },
  // Popular Playlists
  {
    id: 'pl_bollywood_hits',
    title: 'Bollywood Hits',
    description: 'By Life AI',
    artwork: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80',
    createdAt: '2026-01-01T00:00:00.000Z',
    isCustom: false,
    tracks: [
      FEATURED_TRACKS[0],
      FEATURED_TRACKS[1],
      FEATURED_TRACKS[2],
      FEATURED_TRACKS[3],
      FEATURED_TRACKS[4],
      FEATURED_TRACKS[5],
      FEATURED_TRACKS[6],
    ]
  },
  {
    id: 'pl_chill_lofi',
    title: 'Chill Lo-Fi',
    description: 'By Life AI',
    artwork: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&q=80',
    createdAt: '2026-01-01T00:00:00.000Z',
    isCustom: false,
    tracks: [
      FEATURED_TRACKS[8],
      FEATURED_TRACKS[9],
      FEATURED_TRACKS[10],
    ]
  },
  {
    id: 'pl_workout_beats',
    title: 'Workout Beats',
    description: 'By Life AI',
    artwork: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=400&q=80',
    createdAt: '2026-01-01T00:00:00.000Z',
    isCustom: false,
    tracks: [
      FEATURED_TRACKS[0],
      FEATURED_TRACKS[2],
      FEATURED_TRACKS[4],
      FEATURED_TRACKS[6],
    ]
  },
  {
    id: 'pl_travel_vibes',
    title: 'Travel Vibes',
    description: 'By Life AI',
    artwork: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400&q=80',
    createdAt: '2026-01-01T00:00:00.000Z',
    isCustom: false,
    tracks: [
      FEATURED_TRACKS[3],
      FEATURED_TRACKS[1],
      FEATURED_TRACKS[5],
      FEATURED_TRACKS[7],
    ]
  },
  {
    id: 'pl_party_anthems',
    title: 'Party Anthems',
    description: 'By Life AI',
    artwork: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&q=80',
    createdAt: '2026-01-01T00:00:00.000Z',
    isCustom: false,
    tracks: [
      FEATURED_TRACKS[2],
      FEATURED_TRACKS[0],
      FEATURED_TRACKS[1],
      FEATURED_TRACKS[4],
    ]
  }
];

type StateListener = (state: PlayerState) => void;

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

class MusicService {
  private static instance: MusicService;

  private static loadSavedRecentTracks(): Track[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('life_music_recently_played');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return [];
  }

  private static loadSavedLikedTracks(): Track[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('life_music_liked_tracks');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    // Default initial favorites
    return [FEATURED_TRACKS[0], FEATURED_TRACKS[6]];
  }

  private static loadSavedPlaylists(): Playlist[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('life_music_user_playlists');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    // Initial Starter User Playlists matching reference image
    return [
      {
        id: 'user_pl_favorites',
        title: 'My Favorites',
        description: 'Personal favorite hits',
        artwork: 'https://i.ytimg.com/vi/284Ov7ysmfA/hqdefault.jpg',
        createdAt: '2026-01-01T00:00:00.000Z',
        isCustom: true,
        tracks: [FEATURED_TRACKS[0], FEATURED_TRACKS[1], FEATURED_TRACKS[2], FEATURED_TRACKS[4]]
      },
      {
        id: 'user_pl_study',
        title: 'Study Mix',
        description: 'Focus and study music',
        artwork: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400&q=80',
        createdAt: '2026-01-01T00:00:00.000Z',
        isCustom: true,
        tracks: [FEATURED_TRACKS[8], FEATURED_TRACKS[9]]
      }
    ];
  }

  private static loadSavedRecentSearches(): string[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('life_music_recent_searches');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return ['Arijit Singh', 'Lo-Fi Chill', 'Kesariya', 'Bollywood Romantic'];
  }

  private state: PlayerState = {
    currentTrack: null,
    isPlaying: false,
    playerStatus: 'UNSTARTED',
    currentTime: 0,
    duration: 0,
    volume: 85,
    queue: [...FEATURED_TRACKS],
    queueIndex: 0,
    recentlyPlayed: MusicService.loadSavedRecentTracks(),
    likedTracks: MusicService.loadSavedLikedTracks(),
    playlists: MusicService.loadSavedPlaylists(),
    repeatMode: 'off',
    isShuffle: false,
    provider: 'youtube',
    errorMessage: null
  };

  private listeners: Set<StateListener> = new Set();
  private directAudio: HTMLAudioElement | null = null;
  private ytPlayer: any = null;
  private ytReady: boolean = false;
  private pendingVideoId: string | null = null;
  private tickerTimer: any = null;
  private hostContainer: HTMLElement | null = null;
  private isApiScriptLoading: boolean = false;
  private dockTarget: HTMLElement | null = null;
  private dockObserver: ResizeObserver | null = null;
  private dockScrollHandler: (() => void) | null = null;

  private constructor() {
    this.initDirectAudio();
    this.setupPersistentHost();
    this.loadYouTubeIframeAPI();
  }

  public static getInstance(): MusicService {
    if (!MusicService.instance) {
      MusicService.instance = new MusicService();
    }
    return MusicService.instance;
  }

  public getState(): PlayerState {
    return {
      ...this.state,
      queue: [...this.state.queue],
      recentlyPlayed: [...this.state.recentlyPlayed],
      likedTracks: [...this.state.likedTracks],
      playlists: [...this.state.playlists]
    };
  }

  public addListener(cb: StateListener): () => void {
    this.listeners.add(cb);
    cb(this.getState());
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify(): void {
    const s = this.getState();
    this.listeners.forEach((l) => l(s));
  }

  private initDirectAudio(): void {
    if (typeof window === 'undefined') return;
    this.directAudio = new Audio();
    this.directAudio.volume = this.state.volume / 100;

    this.directAudio.ontimeupdate = () => {
      if (this.directAudio && this.state.isPlaying && this.state.currentTrack?.source === 'direct') {
        this.state.currentTime = Math.floor(this.directAudio.currentTime);
        this.state.duration = Math.floor(this.directAudio.duration || 0);
        this.notify();
      }
    };

    this.directAudio.onended = () => {
      console.log('[MUSIC] Direct track ended -> auto-advancing next');
      this.next();
    };

    this.directAudio.onerror = (e) => {
      console.warn('[MUSIC_ERROR] Direct audio playback error:', e);
      this.state.isPlaying = false;
      this.state.playerStatus = 'ERROR';
      this.state.errorMessage = 'Audio playback error';
      this.notify();
    };
  }

  private setupPersistentHost(): void {
    if (typeof document === 'undefined') return;
    let host = document.getElementById('life-ai-music-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'life-ai-music-host';
      // Keep inside viewport with minimal opacity and pointer-events: none
      // This ensures YouTube never pauses playback due to off-screen / 0px clipping
      host.style.position = 'fixed';
      host.style.bottom = '4px';
      host.style.right = '4px';
      host.style.width = '200px';
      host.style.height = '120px';
      host.style.zIndex = '1';
      host.style.opacity = '0.001';
      host.style.pointerEvents = 'none';
      host.style.visibility = 'visible';
      host.style.display = 'block';

      const targetDiv = document.createElement('div');
      targetDiv.id = 'life-ai-yt-target';
      targetDiv.style.width = '100%';
      targetDiv.style.height = '100%';
      host.appendChild(targetDiv);

      document.body.appendChild(host);
    }
    this.hostContainer = host;
  }

  private loadYouTubeIframeAPI(): void {
    if (typeof window === 'undefined') return;
    if (window.YT && window.YT.Player) {
      this.initYTPlayerInstance();
      return;
    }

    if (this.isApiScriptLoading) return;
    this.isApiScriptLoading = true;

    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevReady === 'function') prevReady();
      console.log('[MUSIC] YouTube IFrame API Ready');
      this.initYTPlayerInstance();
    };

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.body.appendChild(script);
  }

  private initYTPlayerInstance(): void {
    if (typeof window === 'undefined' || !window.YT || !window.YT.Player) return;
    if (this.ytPlayer) return;

    try {
      this.ytPlayer = new window.YT.Player('life-ai-yt-target', {
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          controls: 1,
          disablekb: 0,
          enablejsapi: 1,
          fs: 1,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin
        },
        events: {
          onReady: (event: any) => {
            console.log('[MUSIC] YouTube Player instance onReady');
            this.ytReady = true;
            try {
              this.ytPlayer.unMute();
              this.ytPlayer.setVolume(this.state.volume || 85);
            } catch (_) {}
            try {
              const iframe = this.ytPlayer.getIframe?.();
              if (iframe) {
                iframe.setAttribute('allowfullscreen', 'true');
                iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen');
              }
            } catch (_) {}
            if (this.pendingVideoId) {
              const vid = this.pendingVideoId;
              this.pendingVideoId = null;
              this.loadAndPlayYTVideo(vid);
            }
          },
          onStateChange: (event: any) => {
            this.handleYTStateChange(event.data);
          },
          onError: (event: any) => {
            this.handleYTError(event.data);
          }
        }
      });
    } catch (err) {
      console.error('[MUSIC_ERROR] YT.Player initialization failed:', err);
    }
  }

  private handleYTStateChange(ytState: number): void {
    // -1: UNSTARTED, 0: ENDED, 1: PLAYING, 2: PAUSED, 3: BUFFERING, 5: CUED
    console.log(`[MUSIC] YT onStateChange = ${ytState}`);
    if (ytState === 1) {
      this.state.isPlaying = true;
      this.state.playerStatus = 'PLAYING';
      this.state.errorMessage = null;
      handsFreeService.setMusicPlaying(true);
      this.startProgressTicker();
      this.notify();
    } else if (ytState === 2) {
      this.state.isPlaying = false;
      this.state.playerStatus = 'PAUSED';
      handsFreeService.setMusicPlaying(false);
      this.stopProgressTicker();
      this.notify();
    } else if (ytState === 3) {
      this.state.playerStatus = 'BUFFERING';
      this.notify();
    } else if (ytState === 0) {
      console.log('[MUSIC] Track finished playing -> auto-advancing next track in queue');
      this.state.playerStatus = 'ENDED';
      handsFreeService.setMusicPlaying(false);
      this.stopProgressTicker();
      this.notify();
      this.handleTrackEnded();
    }
  }

  private handleTrackEnded(): void {
    if (this.state.repeatMode === 'one' && this.state.currentTrack) {
      this.seek(0);
      this.play(this.state.currentTrack);
    } else {
      this.next();
    }
  }

  private handleYTError(errorCode: number): void {
    console.warn(`[MUSIC_ERROR] YouTube Player error: ${errorCode}`);
    this.state.isPlaying = false;
    this.state.playerStatus = 'ERROR';

    if (errorCode === 101 || errorCode === 150) {
      this.state.errorMessage = 'Playback is restricted for this video. Trying another track...';
      this.notify();
      setTimeout(() => {
        if (this.state.queue.length > 1) {
          this.next();
        }
      }, 1500);
    } else {
      this.state.errorMessage = 'Unable to play video on this device.';
      this.notify();
    }
  }

  private loadAndPlayYTVideo(videoId: string): void {
    if (!this.ytPlayer || !this.ytReady) {
      console.log(`[MUSIC] YouTube player not ready yet. Queuing video ${videoId}`);
      this.pendingVideoId = videoId;
      return;
    }

    try {
      console.log(`[MUSIC] Loading and playing YouTube video ID: ${videoId}`);
      this.ytPlayer.loadVideoById({
        videoId: videoId,
        suggestedQuality: 'small'
      });
      try {
        this.ytPlayer.unMute();
        this.ytPlayer.setVolume(this.state.volume || 85);
      } catch (_) {}
      this.ytPlayer.playVideo();
    } catch (e) {
      console.warn('[MUSIC_ERROR] loadVideoById error:', e);
    }
  }

  /**
   * Search for songs dynamically via official backend music router.
   */
  public async search(query: string, limit: number = 12): Promise<Track[]> {
    const q = query.trim();
    if (!q) return [];

    console.log(`[MUSIC_SEARCH] provider=youtube query="${q}"`);
    this.addRecentSearch(q);

    try {
      const data = await api.searchMusic(q, limit);
      if (data && data.success && Array.isArray(data.results)) {
        const mapped: Track[] = data.results.map((r: any) => ({
          id: r.id,
          title: r.title,
          artist: r.artist || r.channel || 'Official Music',
          channel: r.channel || r.artist,
          thumbnail: r.thumbnail || `https://i.ytimg.com/vi/${r.id}/hqdefault.jpg`,
          duration: r.duration || '3:30',
          durationSeconds: r.durationSeconds || 210,
          source: 'youtube',
          videoId: r.id,
          url: r.url || `https://www.youtube.com/watch?v=${r.id}`
        }));
        console.log(`[MUSIC_SEARCH] results=${mapped.length}`);
        return mapped;
      }
    } catch (err) {
      console.warn('[MUSIC_ERROR] Backend music search failed, falling back:', err);
    }

    // Fallback search in featured catalog
    const qLower = q.toLowerCase();
    const matched = FEATURED_TRACKS.filter(
      (t) => t.title.toLowerCase().includes(qLower) || t.artist.toLowerCase().includes(qLower)
    );
    return matched.length > 0 ? matched : FEATURED_TRACKS;
  }

  /**
   * Voice & Fast Intent: search for a song, choose top match, setup queue, and play immediately.
   */
  public async searchAndPlay(query: string): Promise<Track> {
    const clean = query.trim();
    console.log(`[MUSIC_PLAY] searchAndPlay requested for query="${clean}"`);

    const results = await this.search(clean, 10);
    if (!results || results.length === 0) {
      const fallback = FEATURED_TRACKS[0];
      await this.play(fallback);
      return fallback;
    }

    const bestTrack = results[0];
    console.log(`[MUSIC_PLAY] selected track="${bestTrack.title}" (id=${bestTrack.id})`);

    // Add remaining search results into current queue for seamless auto-play
    this.state.queue = [bestTrack, ...results.slice(1)];
    this.state.queueIndex = 0;

    await this.play(bestTrack);
    return bestTrack;
  }

  /**
   * Play specific track or resume.
   */
  public async play(track?: Track): Promise<void> {
    const target = track || this.state.currentTrack || this.state.queue[0];
    if (!target) return;

    this.stopPlaybackStreams();

    this.state.currentTrack = target;
    this.recordRecentlyPlayed(target);
    this.state.isPlaying = true;
    this.state.playerStatus = 'BUFFERING';
    this.state.currentTime = 0;
    this.state.duration = target.durationSeconds || 210;
    this.state.provider = target.source === 'direct' ? 'direct' : 'youtube';
    this.state.errorMessage = null;

    // Ensure target is in queue
    const existingIdx = this.state.queue.findIndex((t) => t.id === target.id);
    if (existingIdx >= 0) {
      this.state.queueIndex = existingIdx;
    } else {
      this.state.queue.unshift(target);
      this.state.queueIndex = 0;
    }

    if (target.source === 'direct' && target.streamUrl && this.directAudio) {
      try {
        this.directAudio.src = target.streamUrl;
        this.directAudio.volume = this.state.volume / 100;
        await this.directAudio.play();
        this.state.isPlaying = true;
        this.state.playerStatus = 'PLAYING';
      } catch (err) {
        console.warn('[MUSIC_ERROR] Direct playback failed:', err);
      }
    } else {
      // YouTube playback via official IFrame API
      const vid = target.videoId || target.id;
      this.loadAndPlayYTVideo(vid);
    }

    this.startProgressTicker();
    this.notify();
  }

  private stopPlaybackStreams(): void {
    if (this.directAudio) {
      try {
        this.directAudio.pause();
        this.directAudio.currentTime = 0;
      } catch (_) {}
    }
    if (this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.stopVideo();
      } catch (_) {}
    }
    this.stopProgressTicker();
  }

  public pause(): void {
    console.log('[MUSIC] pause() requested');
    this.state.isPlaying = false;
    this.state.playerStatus = 'PAUSED';
    handsFreeService.setMusicPlaying(false);

    if (this.directAudio) {
      try {
        this.directAudio.pause();
      } catch (_) {}
    }
    if (this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.pauseVideo();
      } catch (_) {}
    }

    this.stopProgressTicker();
    this.notify();
  }

  public resume(): void {
    console.log('[MUSIC] resume() requested');
    if (!this.state.currentTrack) {
      this.play(this.state.queue[0]);
      return;
    }

    this.state.isPlaying = true;
    this.state.playerStatus = 'PLAYING';
    handsFreeService.setMusicPlaying(true);

    if (this.state.currentTrack.source === 'direct' && this.directAudio) {
      this.directAudio.play().catch(() => {});
    } else if (this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.playVideo();
      } catch (_) {}
    } else {
      this.play(this.state.currentTrack);
    }

    this.startProgressTicker();
    this.notify();
  }

  public togglePlay(): void {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      this.resume();
    }
  }

  public stop(): void {
    this.stopPlaybackStreams();
    this.state.isPlaying = false;
    this.state.playerStatus = 'UNSTARTED';
    this.state.currentTime = 0;
    handsFreeService.setMusicPlaying(false);
    this.notify();
  }

  public next(): void {
    if (this.state.queue.length === 0) return;

    if (this.state.isShuffle && this.state.queue.length > 1) {
      let randIdx = Math.floor(Math.random() * this.state.queue.length);
      if (randIdx === this.state.queueIndex) {
        randIdx = (randIdx + 1) % this.state.queue.length;
      }
      this.state.queueIndex = randIdx;
    } else {
      const nextIdx = (this.state.queueIndex + 1) % this.state.queue.length;
      if (this.state.queueIndex + 1 >= this.state.queue.length && this.state.repeatMode === 'off') {
        // Queue finished and repeat is off
        this.pause();
        this.seek(0);
        return;
      }
      this.state.queueIndex = nextIdx;
    }

    console.log(`[MUSIC] next() -> track #${this.state.queueIndex}: "${this.state.queue[this.state.queueIndex]?.title}"`);
    this.play(this.state.queue[this.state.queueIndex]);
  }

  public previous(): void {
    if (this.state.queue.length === 0) return;
    // If playing > 3s, restart current track
    if (this.state.currentTime > 3) {
      this.seek(0);
      return;
    }
    const prevIdx = (this.state.queueIndex - 1 + this.state.queue.length) % this.state.queue.length;
    this.state.queueIndex = prevIdx;
    console.log(`[MUSIC] previous() -> track #${prevIdx}: "${this.state.queue[prevIdx]?.title}"`);
    this.play(this.state.queue[prevIdx]);
  }

  public toggleShuffle(): boolean {
    this.state.isShuffle = !this.state.isShuffle;
    console.log('[MUSIC] Shuffle mode is now:', this.state.isShuffle);
    this.notify();
    return this.state.isShuffle;
  }

  public toggleRepeat(): RepeatMode {
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const next = modes[(modes.indexOf(this.state.repeatMode) + 1) % modes.length];
    this.state.repeatMode = next;
    console.log('[MUSIC] Repeat mode is now:', next);
    this.notify();
    return next;
  }

  public setRepeatMode(mode: RepeatMode): void {
    this.state.repeatMode = mode;
    this.notify();
  }

  public seek(seconds: number): void {
    const clamped = Math.max(0, Math.min(seconds, this.state.duration));
    this.state.currentTime = clamped;

    if (this.state.currentTrack?.source === 'direct' && this.directAudio) {
      this.directAudio.currentTime = clamped;
    } else if (this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.seekTo(clamped, true);
      } catch (_) {}
    }
    this.notify();
  }

  public setVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(100, Math.round(vol)));
    this.state.volume = clamped;

    if (this.directAudio) {
      this.directAudio.volume = clamped / 100;
    }
    if (this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.setVolume(clamped);
      } catch (_) {}
    }
    this.notify();
  }

  private preDuckVolume: number = 85;
  private isDucked: boolean = false;

  public duckVolume(duckLevel: number = 20): void {
    if (this.isDucked) return;
    this.preDuckVolume = this.state.volume || 85;
    this.isDucked = true;
    const target = Math.min(this.preDuckVolume, duckLevel);
    console.log(`[MUSIC] Ducking volume from ${this.preDuckVolume}% to ${target}%`);
    if (this.directAudio) {
      this.directAudio.volume = target / 100;
    }
    if (this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.setVolume(target);
      } catch (_) {}
    }
  }

  public restoreVolume(): void {
    if (!this.isDucked) return;
    this.isDucked = false;
    const target = this.preDuckVolume || 85;
    console.log(`[MUSIC] Restoring volume to ${target}%`);
    if (this.directAudio) {
      this.directAudio.volume = target / 100;
    }
    if (this.ytPlayer && this.ytReady) {
      try {
        this.ytPlayer.setVolume(target);
      } catch (_) {}
    }
  }

  public addToQueue(track: Track): void {
    const exists = this.state.queue.some((t) => t.id === track.id);
    if (!exists) {
      this.state.queue.push(track);
      console.log(`[MUSIC_QUEUE] Added "${track.title}" to queue (length=${this.state.queue.length})`);
      this.notify();
    }
  }

  public removeFromQueue(trackId: string): void {
    this.state.queue = this.state.queue.filter((t) => t.id !== trackId);
    if (this.state.queueIndex >= this.state.queue.length) {
      this.state.queueIndex = Math.max(0, this.state.queue.length - 1);
    }
    this.notify();
  }

  public clearQueue(): void {
    if (this.state.currentTrack) {
      this.state.queue = [this.state.currentTrack];
      this.state.queueIndex = 0;
    } else {
      this.state.queue = [];
      this.state.queueIndex = 0;
    }
    this.notify();
  }

  // ==================== LIKED SONGS SYSTEM ====================

  public isLiked(trackId: string): boolean {
    return this.state.likedTracks.some((t) => t.id === trackId || (t.videoId && t.videoId === trackId));
  }

  public toggleLike(track: Track): boolean {
    if (!track || !track.id) return false;
    const exists = this.isLiked(track.id);
    let updated: Track[];
    if (exists) {
      updated = this.state.likedTracks.filter((t) => t.id !== track.id && t.videoId !== track.id);
    } else {
      updated = [track, ...this.state.likedTracks];
    }
    this.state.likedTracks = updated;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('life_music_liked_tracks', JSON.stringify(updated));
      } catch (_) {}
    }
    this.notify();
    return !exists;
  }

  public getLikedTracks(): Track[] {
    return [...this.state.likedTracks];
  }

  // ==================== USER PLAYLISTS SYSTEM ====================

  public getPlaylists(): Playlist[] {
    return [...this.state.playlists];
  }

  public createPlaylist(title: string, description?: string): Playlist {
    const cleanTitle = title.trim() || 'New Playlist';
    const newPl: Playlist = {
      id: `pl_custom_${Date.now()}`,
      title: cleanTitle,
      description: description || 'Personal created playlist',
      artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80',
      createdAt: new Date().toISOString(),
      isCustom: true,
      tracks: []
    };
    const updated = [...this.state.playlists, newPl];
    this.state.playlists = updated;
    this.savePlaylists(updated);
    this.notify();
    return newPl;
  }

  public deletePlaylist(id: string): void {
    const updated = this.state.playlists.filter((p) => p.id !== id);
    this.state.playlists = updated;
    this.savePlaylists(updated);
    this.notify();
  }

  public renamePlaylist(id: string, newTitle: string): void {
    const updated = this.state.playlists.map((p) =>
      p.id === id ? { ...p, title: newTitle.trim() || p.title } : p
    );
    this.state.playlists = updated;
    this.savePlaylists(updated);
    this.notify();
  }

  public addTrackToPlaylist(playlistId: string, track: Track): void {
    const updated = this.state.playlists.map((p) => {
      if (p.id === playlistId) {
        const exists = p.tracks.some((t) => t.id === track.id);
        if (!exists) {
          return { ...p, tracks: [...p.tracks, track] };
        }
      }
      return p;
    });
    this.state.playlists = updated;
    this.savePlaylists(updated);
    this.notify();
  }

  public removeTrackFromPlaylist(playlistId: string, trackId: string): void {
    const updated = this.state.playlists.map((p) => {
      if (p.id === playlistId) {
        return { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) };
      }
      return p;
    });
    this.state.playlists = updated;
    this.savePlaylists(updated);
    this.notify();
  }

  public playPlaylist(playlist: Playlist, shuffle: boolean = false): void {
    if (!playlist || playlist.tracks.length === 0) return;
    let targetTracks = [...playlist.tracks];
    if (shuffle) {
      targetTracks = targetTracks.sort(() => Math.random() - 0.5);
    }
    this.state.queue = targetTracks;
    this.state.queueIndex = 0;
    this.state.isShuffle = shuffle;
    this.play(targetTracks[0]);
  }

  private savePlaylists(playlists: Playlist[]): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('life_music_user_playlists', JSON.stringify(playlists));
      } catch (_) {}
    }
  }

  // ==================== SEARCH HISTORY SYSTEM ====================

  public getRecentSearches(): string[] {
    return MusicService.loadSavedRecentSearches();
  }

  public addRecentSearch(query: string): void {
    if (!query || !query.trim()) return;
    const q = query.trim();
    const curr = this.getRecentSearches().filter((s) => s.toLowerCase() !== q.toLowerCase());
    const updated = [q, ...curr].slice(0, 10);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('life_music_recent_searches', JSON.stringify(updated));
      } catch (_) {}
    }
  }

  public clearRecentSearches(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('life_music_recent_searches');
      } catch (_) {}
    }
  }

  // ==================== RECENTLY PLAYED SYSTEM ====================

  private recordRecentlyPlayed(track: Track): void {
    if (!track || !track.id) return;
    try {
      const filtered = this.state.recentlyPlayed.filter((t) => t.id !== track.id);
      const updated = [track, ...filtered].slice(0, 30);
      this.state.recentlyPlayed = updated;
      if (typeof window !== 'undefined') {
        localStorage.setItem('life_music_recently_played', JSON.stringify(updated));
      }
    } catch (e) {
      console.warn('[MUSIC] Failed to record recently played track:', e);
    }
  }

  public clearRecentlyPlayed(): void {
    this.state.recentlyPlayed = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('life_music_recently_played');
    }
    this.notify();
  }

  /**
   * Dock persistent YouTube player container inside a custom UI host (e.g., in MusicPage)
   * NEVER reparents DOM with appendChild to preserve iframe JavaScript context and playback.
   */
  public dockPlayerToContainer(targetElement: HTMLElement | null): void {
    if (!this.hostContainer) return;

    if (this.dockObserver) {
      this.dockObserver.disconnect();
      this.dockObserver = null;
    }
    if (this.dockScrollHandler) {
      window.removeEventListener('scroll', this.dockScrollHandler, true);
      window.removeEventListener('resize', this.dockScrollHandler);
      this.dockScrollHandler = null;
    }

    this.dockTarget = targetElement;

    if (targetElement) {
      const syncPos = () => {
        if (!this.hostContainer || !this.dockTarget) return;
        const rect = this.dockTarget.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          this.hostContainer.style.position = 'fixed';
          this.hostContainer.style.top = `${rect.top}px`;
          this.hostContainer.style.left = `${rect.left}px`;
          this.hostContainer.style.width = `${rect.width}px`;
          this.hostContainer.style.height = `${rect.height}px`;
          this.hostContainer.style.bottom = 'auto';
          this.hostContainer.style.right = 'auto';
          this.hostContainer.style.zIndex = '35';
          this.hostContainer.style.opacity = '1';
          this.hostContainer.style.pointerEvents = 'auto';
          this.hostContainer.style.visibility = 'visible';
          this.hostContainer.style.display = 'block';
          this.hostContainer.style.borderRadius = '16px';
          this.hostContainer.style.overflow = 'hidden';
        }
      };

      syncPos();

      this.dockScrollHandler = syncPos;
      window.addEventListener('scroll', syncPos, { passive: true, capture: true });
      window.addEventListener('resize', syncPos, { passive: true });

      if (typeof ResizeObserver !== 'undefined') {
        this.dockObserver = new ResizeObserver(() => syncPos());
        this.dockObserver.observe(targetElement);
      }
    } else {
      // Undock: keep inside viewport with minimal opacity so YouTube never suspends playback
      this.hostContainer.style.position = 'fixed';
      this.hostContainer.style.top = 'auto';
      this.hostContainer.style.left = 'auto';
      this.hostContainer.style.bottom = '4px';
      this.hostContainer.style.right = '4px';
      this.hostContainer.style.width = '200px';
      this.hostContainer.style.height = '120px';
      this.hostContainer.style.zIndex = '1';
      this.hostContainer.style.opacity = '0.001';
      this.hostContainer.style.pointerEvents = 'none';
      this.hostContainer.style.visibility = 'visible';
      this.hostContainer.style.display = 'block';
      this.hostContainer.style.borderRadius = '0px';
    }
  }

  private startProgressTicker(): void {
    this.stopProgressTicker();
    this.tickerTimer = setInterval(() => {
      if (!this.state.isPlaying) return;

      if (this.state.currentTrack?.source === 'youtube' && this.ytPlayer && this.ytReady) {
        try {
          const currentSec = Math.floor(this.ytPlayer.getCurrentTime() || 0);
          const durSec = Math.floor(this.ytPlayer.getDuration() || this.state.duration || 210);
          if (durSec > 0) this.state.duration = durSec;
          if (currentSec !== this.state.currentTime) {
            this.state.currentTime = currentSec;
            this.notify();
          }
        } catch (_) {}
      }
    }, 1000);
  }

  private stopProgressTicker(): void {
    if (this.tickerTimer) {
      clearInterval(this.tickerTimer);
      this.tickerTimer = null;
    }
  }
}

export const musicService = MusicService.getInstance();
