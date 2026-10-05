/**
 * Life AI Music Service
 * Multi-provider audio playback engine supporting YouTube embed streams,
 * direct royalty-free audio streams, and device system intents.
 */

export interface Track {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  durationSeconds: number;
  source: 'youtube' | 'direct' | 'system';
  videoId?: string;
  streamUrl?: string;
}

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number; // 0 to 100
  queue: Track[];
  queueIndex: number;
}

type StateListener = (state: PlayerState) => void;

// Curated instant-play library for immediate playback
export const CURATED_TRACKS: Track[] = [
  {
    id: 'curated_1',
    title: 'Kesariya (Brahmastra)',
    artist: 'Arijit Singh, Pritam',
    thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80',
    durationSeconds: 268,
    source: 'youtube',
    videoId: 'BddP6PYo2gs'
  },
  {
    id: 'curated_2',
    title: 'Apna Bana Le (Bhediya)',
    artist: 'Arijit Singh, Sachin-Jigar',
    thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80',
    durationSeconds: 261,
    source: 'youtube',
    videoId: 'ElZfdU54Cp8'
  },
  {
    id: 'curated_3',
    title: 'Lo-Fi Chill Study Beats',
    artist: 'Life AI Relax & Focus',
    thumbnail: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300&q=80',
    durationSeconds: 180,
    source: 'direct',
    streamUrl: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3'
  },
  {
    id: 'curated_4',
    title: 'Peaceful Rain & Acoustic Piano',
    artist: 'Calm Sanctuary',
    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80',
    durationSeconds: 195,
    source: 'direct',
    streamUrl: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=rain-and-nostalgia-18151.mp3'
  },
  {
    id: 'curated_5',
    title: 'Channa Mereya',
    artist: 'Arijit Singh, Pritam',
    thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&q=80',
    durationSeconds: 289,
    source: 'youtube',
    videoId: '284Ov7ysmfA'
  },
  {
    id: 'curated_6',
    title: 'Deep Meditation & Ambient Flow',
    artist: 'Mindful Harmony',
    thumbnail: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=300&q=80',
    durationSeconds: 210,
    source: 'direct',
    streamUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=meditation-piano-flow-10702.mp3'
  }
];

class MusicService {
  private static instance: MusicService;

  private state: PlayerState = {
    currentTrack: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 85,
    queue: [...CURATED_TRACKS],
    queueIndex: 0
  };

  private listeners: Set<StateListener> = new Set();
  private directAudio: HTMLAudioElement | null = null;
  private youtubeContainer: HTMLDivElement | null = null;
  private ytIframe: HTMLIFrameElement | null = null;
  private tickerTimer: any = null;

  private constructor() {
    this.initDirectAudio();
    this.initYouTubeContainer();
  }

  public static getInstance(): MusicService {
    if (!MusicService.instance) {
      MusicService.instance = new MusicService();
    }
    return MusicService.instance;
  }

  public getState(): PlayerState {
    return { ...this.state };
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
      if (this.directAudio && this.state.isPlaying) {
        this.state.currentTime = Math.floor(this.directAudio.currentTime);
        this.state.duration = Math.floor(this.directAudio.duration || 0);
        this.notify();
      }
    };

    this.directAudio.onended = () => {
      this.next();
    };

    this.directAudio.onerror = (e) => {
      console.warn('[MUSIC] Direct audio error:', e);
      // Fallback to next track
      this.state.isPlaying = false;
      this.notify();
    };
  }

  private initYouTubeContainer(): void {
    if (typeof document === 'undefined') return;
    let box = document.getElementById('life-ai-music-yt-container') as HTMLDivElement;
    if (!box) {
      box = document.createElement('div');
      box.id = 'life-ai-music-yt-container';
      box.style.position = 'fixed';
      box.style.bottom = '-9999px';
      box.style.left = '-9999px';
      box.style.width = '1px';
      box.style.height = '1px';
      box.style.opacity = '0';
      box.style.pointerEvents = 'none';
      box.style.zIndex = '-999';
      document.body.appendChild(box);
    }
    this.youtubeContainer = box;
  }

  /**
   * Search for a song title or artist and start playback immediately.
   */
  public async searchAndPlay(query: string): Promise<Track> {
    const q = query.trim().toLowerCase();

    // 1. Check curated tracks first for instant zero-latency match
    const matchedCurated = CURATED_TRACKS.find(
      (t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
    );

    let trackToPlay: Track;

    if (matchedCurated) {
      trackToPlay = matchedCurated;
    } else {
      // 2. Dynamic YouTube embed search mapping
      const cleanTitle = query.trim().replace(/^(play|chalao|bajao|gaana|song)\s*/i, '');
      const encodedQuery = encodeURIComponent(cleanTitle + ' song');

      trackToPlay = {
        id: `yt_${Date.now()}`,
        title: cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1),
        artist: 'Life AI Audio Stream',
        thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80',
        durationSeconds: 240,
        source: 'youtube',
        // YouTube embed with search or direct query
        streamUrl: `https://www.youtube.com/embed?listType=search&list=${encodedQuery}&autoplay=1&enablejsapi=1`
      };
    }

    await this.play(trackToPlay);
    return trackToPlay;
  }

  /**
   * Play specific track or resume current.
   */
  public async play(track?: Track): Promise<void> {
    const target = track || this.state.currentTrack || this.state.queue[0];
    if (!target) return;

    // Stop current playback
    this.stopPlaybackStreams();

    this.state.currentTrack = target;
    this.state.isPlaying = true;
    this.state.currentTime = 0;
    this.state.duration = target.durationSeconds || 180;

    // Add to queue if not present
    const existingIndex = this.state.queue.findIndex((t) => t.id === target.id);
    if (existingIndex >= 0) {
      this.state.queueIndex = existingIndex;
    } else {
      this.state.queue.unshift(target);
      this.state.queueIndex = 0;
    }

    if (target.source === 'direct' && target.streamUrl && this.directAudio) {
      try {
        this.directAudio.src = target.streamUrl;
        this.directAudio.volume = this.state.volume / 100;
        await this.directAudio.play();
      } catch (err) {
        console.warn('[MUSIC] Direct playback error:', err);
      }
    } else if (target.source === 'youtube') {
      this.playYouTubeTrack(target);
    }

    this.startProgressTicker();
    this.notify();
  }

  private playYouTubeTrack(track: Track): void {
    if (!this.youtubeContainer) this.initYouTubeContainer();
    if (!this.youtubeContainer) return;

    let src = '';
    if (track.videoId) {
      src = `https://www.youtube.com/embed/${track.videoId}?autoplay=1&enablejsapi=1&playsinline=1`;
    } else if (track.streamUrl) {
      src = track.streamUrl;
    } else {
      const q = encodeURIComponent(track.title + ' ' + track.artist);
      src = `https://www.youtube.com/embed?listType=search&list=${q}&autoplay=1&enablejsapi=1&playsinline=1`;
    }

    this.youtubeContainer.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.width = '200';
    iframe.height = '200';
    iframe.allow = 'autoplay; encrypted-media';
    iframe.style.border = 'none';
    this.youtubeContainer.appendChild(iframe);
    this.ytIframe = iframe;
  }

  private stopPlaybackStreams(): void {
    if (this.directAudio) {
      try {
        this.directAudio.pause();
        this.directAudio.currentTime = 0;
      } catch (_) {}
    }
    if (this.youtubeContainer) {
      this.youtubeContainer.innerHTML = '';
      this.ytIframe = null;
    }
    this.stopProgressTicker();
  }

  /**
   * Pause playback.
   */
  public pause(): void {
    this.state.isPlaying = false;
    if (this.directAudio) {
      try {
        this.directAudio.pause();
      } catch (_) {}
    }
    if (this.ytIframe) {
      // Re-pause iframe
      try {
        this.ytIframe.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
      } catch (_) {}
    }
    this.stopProgressTicker();
    this.notify();
  }

  /**
   * Resume playback.
   */
  public resume(): void {
    if (!this.state.currentTrack) {
      this.play(this.state.queue[0]);
      return;
    }
    this.state.isPlaying = true;
    if (this.state.currentTrack.source === 'direct' && this.directAudio) {
      this.directAudio.play().catch(() => {});
    } else if (this.ytIframe) {
      try {
        this.ytIframe.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
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

  public next(): void {
    if (this.state.queue.length === 0) return;
    const nextIdx = (this.state.queueIndex + 1) % this.state.queue.length;
    this.state.queueIndex = nextIdx;
    this.play(this.state.queue[nextIdx]);
  }

  public previous(): void {
    if (this.state.queue.length === 0) return;
    const prevIdx = (this.state.queueIndex - 1 + this.state.queue.length) % this.state.queue.length;
    this.state.queueIndex = prevIdx;
    this.play(this.state.queue[prevIdx]);
  }

  public seek(seconds: number): void {
    this.state.currentTime = Math.max(0, Math.min(seconds, this.state.duration));
    if (this.state.currentTrack?.source === 'direct' && this.directAudio) {
      this.directAudio.currentTime = this.state.currentTime;
    } else if (this.ytIframe) {
      try {
        this.ytIframe.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: 'seekTo', args: [this.state.currentTime, true] }),
          '*'
        );
      } catch (_) {}
    }
    this.notify();
  }

  public setVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(100, vol));
    this.state.volume = clamped;
    if (this.directAudio) {
      this.directAudio.volume = clamped / 100;
    }
    if (this.ytIframe) {
      try {
        this.ytIframe.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: 'setVolume', args: [clamped] }),
          '*'
        );
      } catch (_) {}
    }
    this.notify();
  }

  private startProgressTicker(): void {
    this.stopProgressTicker();
    this.tickerTimer = setInterval(() => {
      if (this.state.isPlaying) {
        if (this.state.currentTrack?.source === 'youtube') {
          this.state.currentTime = (this.state.currentTime + 1) % (this.state.duration || 200);
          this.notify();
        }
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
