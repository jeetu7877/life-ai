/**
 * Music Provider Abstraction for Life AI
 * Clean interfaces supporting YouTube and future music providers (e.g., Spotify, Local).
 */

export interface Track {
  id: string;
  title: string;
  artist: string;
  channel?: string;
  thumbnail: string;
  duration?: string;
  durationSeconds: number;
  source: 'youtube' | 'direct' | 'system';
  videoId?: string;
  streamUrl?: string;
  url?: string;
  album?: string;
  genre?: string;
}

export interface Playlist {
  id: string;
  title: string;
  description?: string;
  artwork?: string;
  tracks: Track[];
  createdAt: string;
  isCustom?: boolean;
}

export type PlayerStatus = 'UNSTARTED' | 'PLAYING' | 'PAUSED' | 'BUFFERING' | 'ENDED' | 'ERROR';
export type RepeatMode = 'off' | 'all' | 'one';

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  playerStatus: PlayerStatus;
  currentTime: number;
  duration: number;
  volume: number; // 0 to 100
  queue: Track[];
  queueIndex: number;
  recentlyPlayed: Track[];
  likedTracks: Track[];
  playlists: Playlist[];
  repeatMode: RepeatMode;
  isShuffle: boolean;
  provider: 'youtube' | 'direct';
  errorMessage: string | null;
}

export interface MusicProvider {
  readonly name: string;
  search(query: string): Promise<Track[]>;
  play(track: Track): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
  seek(seconds: number): void;
  setVolume(volume: number): void;
}
