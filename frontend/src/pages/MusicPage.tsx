import React, { useState, useEffect } from 'react';
import {
  Music,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Search,
  Sparkles,
  Radio,
  Disc3,
  Heart,
  TrendingUp,
  Headphones
} from 'lucide-react';
import { musicService, PlayerState, Track, CURATED_TRACKS } from '../services/musicService';

export const MusicPage: React.FC = () => {
  const [playerState, setPlayerState] = useState<PlayerState>(musicService.getState());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);

  useEffect(() => {
    const unsub = musicService.addListener((state) => {
      setPlayerState(state);
    });
    return unsub;
  }, []);

  const currentTrack = playerState.currentTrack || CURATED_TRACKS[0];

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      await musicService.searchAndPlay(searchQuery.trim());
    } finally {
      setIsSearching(false);
    }
  };

  const handleTrackSelect = async (track: Track) => {
    await musicService.play(track);
  };

  const formatSecs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = playerState.duration > 0
    ? Math.min(100, (playerState.currentTime / playerState.duration) * 100)
    : 0;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 max-w-4xl mx-auto w-full custom-scrollbar pb-28 text-slate-100">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
          <Disc3 size={22} className={playerState.isPlaying ? 'animate-spin' : ''} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Voice Music Player
            <span className="text-[10px] font-semibold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Radio size={10} className="animate-pulse" /> Live Stream
            </span>
          </h1>
          <p className="text-xs text-slate-400">
            Powered by YouTube & direct audio. Control hands-free with your voice.
          </p>
        </div>
      </div>

      {/* Voice Tip Banner */}
      <div className="mb-6 p-3.5 rounded-2xl bg-[#0F172A]/70 border border-[#202B3D] flex items-start gap-3">
        <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 shrink-0">
          <Sparkles size={16} />
        </div>
        <div className="text-xs">
          <span className="font-semibold text-slate-200">Voice Control Commands: </span>
          <span className="text-slate-400">
            Say <span className="text-cyan-300 font-medium">"Hey Life, Kesariya chalao"</span>,{' '}
            <span className="text-cyan-300 font-medium">"Life, gaana roko"</span>, or{' '}
            <span className="text-cyan-300 font-medium">"Life, agla gaana"</span> anytime!
          </span>
        </div>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="mb-6">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search any song, Bollywood hit, Arijit Singh, Lo-Fi..."
            className="w-full bg-[#0E1524] border border-[#1E293B] rounded-2xl pl-11 pr-24 py-3 text-xs md:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-all shadow-inner"
          />
          <Search size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="absolute right-2 top-2 px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition-all"
          >
            {isSearching ? 'Playing...' : 'Play'}
          </button>
        </div>
      </form>

      {/* Hero Now Playing Deck */}
      <div className="mb-8 p-5 md:p-6 rounded-3xl bg-gradient-to-b from-[#111A2E] to-[#0A0F1D] border border-cyan-500/20 shadow-2xl relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
          {/* Album Artwork */}
          <div className="relative w-36 h-36 md:w-44 md:h-44 rounded-2xl overflow-hidden shadow-2xl shrink-0 border border-slate-700/80 group">
            <img
              src={currentTrack.thumbnail}
              alt={currentTrack.title}
              className={`w-full h-full object-cover transition-all ${
                playerState.isPlaying ? 'scale-105' : 'grayscale-[20%]'
              }`}
            />
            {playerState.isPlaying && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2 justify-center gap-1">
                <span className="w-1 h-4 bg-cyan-400 rounded-full animate-[bounce_1s_infinite_100ms]" />
                <span className="w-1 h-6 bg-cyan-400 rounded-full animate-[bounce_1s_infinite_300ms]" />
                <span className="w-1 h-3 bg-cyan-400 rounded-full animate-[bounce_1s_infinite_200ms]" />
                <span className="w-1 h-5 bg-cyan-400 rounded-full animate-[bounce_1s_infinite_400ms]" />
              </div>
            )}
          </div>

          {/* Details & Controls */}
          <div className="flex-1 w-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                  <Headphones size={12} /> Now Playing
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  {currentTrack.source === 'youtube' ? 'YouTube Stream' : 'Direct Audio'}
                </span>
              </div>
              <h2 className="text-lg md:text-xl font-bold text-white truncate mb-0.5">
                {currentTrack.title}
              </h2>
              <p className="text-xs text-slate-400 truncate mb-4">
                {currentTrack.artist}
              </p>
            </div>

            {/* Scrubber */}
            <div className="space-y-1.5 mb-4">
              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const ratio = clickX / rect.width;
                  musicService.seek(ratio * playerState.duration);
                }}
                className="h-2 w-full bg-slate-800 rounded-full overflow-hidden cursor-pointer relative group"
              >
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full relative"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>{formatSecs(playerState.currentTime)}</span>
                <span>{formatSecs(playerState.duration)}</span>
              </div>
            </div>

            {/* Main Buttons */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => musicService.previous()}
                  className="w-9 h-9 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-200 flex items-center justify-center active:scale-95 transition-all"
                  title="Previous"
                >
                  <SkipBack size={16} />
                </button>

                <button
                  onClick={() => musicService.togglePlay()}
                  className="w-12 h-12 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-500/25 active:scale-95 transition-all"
                  title={playerState.isPlaying ? 'Pause' : 'Play'}
                >
                  {playerState.isPlaying ? (
                    <Pause size={22} />
                  ) : (
                    <Play size={22} className="ml-0.5" />
                  )}
                </button>

                <button
                  onClick={() => musicService.next()}
                  className="w-9 h-9 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-200 flex items-center justify-center active:scale-95 transition-all"
                  title="Next"
                >
                  <SkipForward size={16} />
                </button>
              </div>

              {/* Volume Slider */}
              <div className="flex items-center gap-2 max-w-[120px] w-full">
                {playerState.volume === 0 ? (
                  <VolumeX size={15} className="text-slate-500 shrink-0" />
                ) : (
                  <Volume2 size={15} className="text-slate-400 shrink-0" />
                )}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={playerState.volume}
                  onChange={(e) => musicService.setVolume(Number(e.target.value))}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Curated Recommendations */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <TrendingUp size={14} className="text-cyan-400" /> Featured & Curated Songs
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CURATED_TRACKS.map((track) => {
            const isCurrent = currentTrack.id === track.id;
            return (
              <div
                key={track.id}
                onClick={() => handleTrackSelect(track)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 group ${
                  isCurrent
                    ? 'bg-cyan-950/40 border-cyan-500/40 shadow-lg shadow-cyan-500/5'
                    : 'bg-[#0E1524] border-[#1E293B] hover:border-slate-700'
                }`}
              >
                <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-slate-800">
                  <img
                    src={track.thumbnail}
                    alt={track.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  {isCurrent && playerState.isPlaying && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="w-1 h-3 bg-cyan-400 animate-pulse" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h4
                    className={`text-xs md:text-sm font-semibold truncate ${
                      isCurrent ? 'text-cyan-400' : 'text-white group-hover:text-cyan-300'
                    }`}
                  >
                    {track.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 truncate">
                    {track.artist}
                  </p>
                </div>

                <div className="shrink-0 text-slate-400 group-hover:text-cyan-400">
                  {isCurrent && playerState.isPlaying ? (
                    <Pause size={18} />
                  ) : (
                    <Play size={18} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
