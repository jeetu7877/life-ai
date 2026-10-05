/**
 * Life AI Music Service
 * Multi-provider audio playback engine supporting official YouTube IFrame Player API,
 * dynamic search via YouTube Data API backend, play queue, and persistent background playback.
 */

import { api } from './api';
import { Track, PlayerState, PlayerStatus } from './musicProvider';

export type { Track, PlayerState, PlayerStatus };

// Curated instant-play library for immediate offline/featured playback
export const CURATED_TRACKS: Track[] = [
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
    url: 'https://www.youtube.com/watch?v=284Ov7ysmfA'
  },
  {
    id: 'BddP6PYo2gs',
    title: 'Kesariya (Brahmāstra)',
    artist: 'Arijit Singh, Pritam',
    channel: 'Sony Music India',
    thumbnail: 'https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg',
    duration: '4:28',
    durationSeconds: 268,
    source: 'youtube',
    videoId: 'BddP6PYo2gs',
    url: 'https://www.youtube.com/watch?v=BddP6PYo2gs'
  },
  {
    id: 'ElZfdU54Cp8',
    title: 'Apna Bana Le (Bhediya)',
    artist: 'Arijit Singh, Sachin-Jigar',
    channel: 'Zee Music Company',
    thumbnail: 'https://i.ytimg.com/vi/ElZfdU54Cp8/hqdefault.jpg',
    duration: '4:21',
    durationSeconds: 261,
    source: 'youtube',
    videoId: 'ElZfdU54Cp8',
    url: 'https://www.youtube.com/watch?v=ElZfdU54Cp8'
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

type StateListener = (state: PlayerState) => void;

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

class MusicService {
  private static instance: MusicService;

  private state: PlayerState = {
    currentTrack: null,
    isPlaying: false,
    playerStatus: 'UNSTARTED',
    currentTime: 0,
    duration: 0,
    volume: 85,
    queue: [...CURATED_TRACKS],
    queueIndex: 0,
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
    return { ...this.state, queue: [...this.state.queue] };
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
      console.log('[MUSIC] Direct track ended -> auto-advance next');
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
      host.style.position = 'fixed';
      host.style.bottom = '-9999px';
      host.style.left = '-9999px';
      host.style.width = '240px';
      host.style.height = '180px';
      host.style.zIndex = '-9999';
      host.style.opacity = '0.01';
      host.style.pointerEvents = 'none';

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
            this.ytPlayer.setVolume(this.state.volume);
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
      this.startProgressTicker();
      this.notify();
    } else if (ytState === 2) {
      this.state.isPlaying = false;
      this.state.playerStatus = 'PAUSED';
      this.stopProgressTicker();
      this.notify();
    } else if (ytState === 3) {
      this.state.playerStatus = 'BUFFERING';
      this.notify();
    } else if (ytState === 0) {
      console.log('[MUSIC] Track finished playing -> auto-advancing next track in queue');
      this.state.playerStatus = 'ENDED';
      this.stopProgressTicker();
      this.notify();
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
      this.pendingVideoId = videoId;
      return;
    }

    try {
      this.ytPlayer.loadVideoById({
        videoId: videoId,
        suggestedQuality: 'small'
      });
      this.ytPlayer.playVideo();
    } catch (e) {
      console.warn('[MUSIC_ERROR] loadVideoById error:', e);
    }
  }

  /**
   * Search for songs dynamically via official backend music router.
   */
  public async search(query: string, limit: number = 10): Promise<Track[]> {
    const q = query.trim();
    if (!q) return [];

    console.log(`[MUSIC_SEARCH] provider=youtube query="${q}"`);
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

    // Fallback search in curated catalog
    const qLower = q.toLowerCase();
    const matched = CURATED_TRACKS.filter(
      (t) => t.title.toLowerCase().includes(qLower) || t.artist.toLowerCase().includes(qLower)
    );
    return matched.length > 0 ? matched : CURATED_TRACKS;
  }

  /**
   * Voice & Fast Intent: search for a song, choose top match, setup queue, and play immediately.
   */
  public async searchAndPlay(query: string): Promise<Track> {
    const clean = query.trim();
    console.log(`[MUSIC_PLAY] searchAndPlay requested for query="${clean}"`);

    const results = await this.search(clean, 10);
    if (!results || results.length === 0) {
      const fallback = CURATED_TRACKS[0];
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
    this.notify();
  }

  public next(): void {
    if (this.state.queue.length === 0) return;
    const nextIdx = (this.state.queueIndex + 1) % this.state.queue.length;
    this.state.queueIndex = nextIdx;
    console.log(`[MUSIC] next() -> playing track #${nextIdx}: "${this.state.queue[nextIdx]?.title}"`);
    this.play(this.state.queue[nextIdx]);
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
    console.log(`[MUSIC] previous() -> playing track #${prevIdx}: "${this.state.queue[prevIdx]?.title}"`);
    this.play(this.state.queue[prevIdx]);
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

  /**
   * Dock persistent YouTube player container inside a custom UI host (e.g., in MusicPage)
   */
  public dockPlayerToContainer(targetElement: HTMLElement | null): void {
    if (!this.hostContainer) return;
    if (targetElement) {
      // Dock into visible UI
      this.hostContainer.style.position = 'relative';
      this.hostContainer.style.bottom = 'auto';
      this.hostContainer.style.left = 'auto';
      this.hostContainer.style.width = '100%';
      this.hostContainer.style.height = '100%';
      this.hostContainer.style.zIndex = '1';
      this.hostContainer.style.opacity = '1';
      this.hostContainer.style.pointerEvents = 'auto';
      targetElement.appendChild(this.hostContainer);
    } else {
      // Undock to background
      this.hostContainer.style.position = 'fixed';
      this.hostContainer.style.bottom = '-9999px';
      this.hostContainer.style.left = '-9999px';
      this.hostContainer.style.width = '240px';
      this.hostContainer.style.height = '180px';
      this.hostContainer.style.zIndex = '-9999';
      this.hostContainer.style.opacity = '0.01';
      this.hostContainer.style.pointerEvents = 'none';
      document.body.appendChild(this.hostContainer);
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
