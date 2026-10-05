import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  ListPlus,
  ListMusic,
  Trash2,
  Tv,
  TvMinimal,
  Maximize2,
  Minimize2,
  Radio,
  Disc3,
  Sparkles,
  RefreshCw,
  History,
  Headphones,
  X,
  Check
} from 'lucide-react';
import { musicService, PlayerState, Track, CURATED_TRACKS } from '../services/musicService';

export const MusicPage: React.FC = () => {
  const [playerState, setPlayerState] = useState<PlayerState>(musicService.getState());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showQueue, setShowQueue] = useState<boolean>(false);
  const [addedNotice, setAddedNotice] = useState<string | null>(null);

  const videoHostRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<any>(null);

  // Subscribe to central music service state
  useEffect(() => {
    const unsub = musicService.addListener((state) => {
      setPlayerState(state);
    });
    return unsub;
  }, []);

  // Dock persistent player into UI container when video is shown or fullscreen
  useEffect(() => {
    if ((showVideo || isFullscreen) && videoHostRef.current) {
      musicService.dockPlayerToContainer(videoHostRef.current);
    } else {
      musicService.dockPlayerToContainer(null);
    }
    return () => {
      musicService.dockPlayerToContainer(null);
    };
  }, [showVideo, isFullscreen]);

  // Listen for Escape key and fullscreenchange to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    const handleFsChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, [isFullscreen]);

  // Handle search input debounce (450ms)
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (!searchQuery.trim()) {
      setDebouncedQuery('');
      setSearchResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 450);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [searchQuery]);

  // Execute dynamic music search when debouncedQuery changes
  useEffect(() => {
    if (!debouncedQuery) return;

    let isMounted = true;
    setIsSearching(true);
    setSearchError(null);

    musicService
      .search(debouncedQuery, 12)
      .then((results) => {
        if (!isMounted) return;
        setSearchResults(results);
        setIsSearching(false);
        if (results.length === 0) {
          setSearchError('No matching songs found on YouTube.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setIsSearching(false);
        setSearchError('Music search service temporarily unavailable.');
        console.warn('[MUSIC_UI] Search error:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [debouncedQuery]);

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setDebouncedQuery(searchQuery.trim());
    }
  };

  const handleQuickChipClick = (queryText: string) => {
    setSearchQuery(queryText);
    setDebouncedQuery(queryText);
  };

  const handlePlayTrack = async (track: Track) => {
    await musicService.play(track);
  };

  const handleAddToQueue = (track: Track, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    musicService.addToQueue(track);
    setAddedNotice(`Added "${track.title}" to queue`);
    setTimeout(() => setAddedNotice(null), 2500);
  };

  const handleToggleFullscreen = () => {
    if (!isFullscreen) {
      setShowVideo(true);
      setIsFullscreen(true);
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch (_) {}
    } else {
      setIsFullscreen(false);
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } catch (_) {}
    }
  };

  const formatSecs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const currentTrack = playerState.currentTrack || CURATED_TRACKS[0];
  const progressPercent =
    playerState.duration > 0
      ? Math.min(100, (playerState.currentTime / playerState.duration) * 100)
      : 0;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 max-w-4xl mx-auto w-full custom-scrollbar pb-32 text-slate-100 min-w-0 box-border">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10 shrink-0">
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
              Search any song on YouTube, watch in full screen, or control hands-free.
            </p>
          </div>
        </div>

        {/* Queue Toggle Button */}
        <button
          onClick={() => setShowQueue(!showQueue)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
            showQueue
              ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
          }`}
          title="Play Queue"
        >
          <ListMusic size={15} />
          <span>Queue ({playerState.queue.length})</span>
        </button>
      </div>

      {/* Voice Tip Banner */}
      <div className="mb-6 p-3.5 rounded-2xl bg-[#0F172A]/80 border border-[#202B3D] flex items-start gap-3">
        <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 shrink-0 mt-0.5">
          <Sparkles size={16} />
        </div>
        <div className="text-xs">
          <span className="font-semibold text-slate-200">Voice Music Commands: </span>
          <span className="text-slate-400">
            Say <span className="text-cyan-300 font-medium">"Hey Life, Channa Mereya chalao"</span>,{' '}
            <span className="text-cyan-300 font-medium">"Life, gaana roko"</span>,{' '}
            <span className="text-cyan-300 font-medium">"Life, volume 50 percent karo"</span>, or{' '}
            <span className="text-cyan-300 font-medium">"Life, agla gaana"</span> anytime!
          </span>
        </div>
      </div>

      {/* Dynamic Search Box */}
      <div className="mb-6 space-y-2.5">
        <form onSubmit={handleManualSearch} className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search any song, artist, Bollywood hit, Lo-Fi (e.g. Channa Mereya)..."
            className="w-full bg-[#0E1524] border border-[#1E293B] rounded-2xl pl-11 pr-24 py-3.5 text-xs md:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-all shadow-inner"
          />
          <Search size={18} className="absolute left-3.5 top-3.5 text-slate-400" />

          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setDebouncedQuery('');
                setSearchResults([]);
              }}
              className="absolute right-14 top-3.5 text-slate-500 hover:text-slate-300 p-1"
            >
              <X size={16} />
            </button>
          )}

          <button
            type="submit"
            disabled={!searchQuery.trim()}
            className="absolute right-2 top-2 px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold text-xs transition-all shadow"
          >
            Search
          </button>
        </form>

        {/* Quick Suggestion Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] text-slate-400 custom-scrollbar">
          <span className="shrink-0 text-slate-500 text-[10px] uppercase font-semibold">Try:</span>
          {['Channa Mereya', 'Kesariya', 'Apna Bana Le', 'Tum Hi Ho', 'Lo-Fi Chill', 'Arijit Singh', 'Punjabi Hits'].map(
            (tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleQuickChipClick(tag)}
                className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 hover:text-cyan-300 transition-all"
              >
                {tag}
              </button>
            )
          )}
        </div>
      </div>

      {/* Temporary Toast Notice */}
      {addedNotice && (
        <div className="mb-4 px-3.5 py-2 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs flex items-center gap-2 animate-fade-in shadow-lg">
          <Check size={14} className="text-cyan-400" />
          <span>{addedNotice}</span>
        </div>
      )}

      {/* Now Playing Hero Deck */}
      <div className="mb-8 p-5 md:p-6 rounded-3xl bg-gradient-to-b from-[#111A2E] to-[#0A0F1D] border border-cyan-500/20 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
          {/* Album Artwork or Embedded Video Preview Container */}
          <div
            className={`relative rounded-2xl overflow-hidden shadow-2xl shrink-0 border border-slate-700/80 group bg-slate-950 transition-all ${
              isFullscreen
                ? 'fixed inset-0 z-[9999] w-screen h-screen rounded-none border-none p-3 sm:p-6 flex flex-col justify-between bg-black/95 backdrop-blur-xl'
                : 'w-40 h-40 md:w-48 md:h-48'
            }`}
          >
            {isFullscreen ? (
              <>
                {/* Fullscreen Top Navigation Bar */}
                <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-800/80 shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={handleToggleFullscreen}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-1.5 text-xs font-semibold transition-all border border-slate-700"
                      title="Exit Full Screen (ESC)"
                    >
                      <Minimize2 size={15} />
                      <span>Exit Fullscreen</span>
                    </button>
                    <div className="min-w-0">
                      <h3 className="text-xs md:text-sm font-bold text-white truncate">{currentTrack.title}</h3>
                      <p className="text-[11px] text-slate-400 truncate">{currentTrack.artist}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-semibold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Radio size={10} className="animate-pulse" /> Live Stream
                    </span>
                    <button
                      type="button"
                      onClick={handleToggleFullscreen}
                      className="p-1.5 rounded-full bg-slate-800/80 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all"
                      title="Close Fullscreen"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Fullscreen Video Centerpiece */}
                <div className="flex-1 w-full flex items-center justify-center my-3 relative">
                  <div className="w-full max-w-5xl aspect-video max-h-[72vh] bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 relative flex items-center justify-center">
                    <div
                      ref={videoHostRef}
                      className="w-full h-full flex items-center justify-center bg-black"
                    />
                  </div>
                </div>

                {/* Fullscreen Bottom Playback Deck */}
                <div className="w-full max-w-4xl mx-auto space-y-3 pt-2 shrink-0">
                  {/* Scrubber */}
                  <div className="space-y-1">
                    <div
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                        musicService.seek(ratio * (playerState.duration || 1));
                      }}
                      className="h-2 w-full bg-slate-800 rounded-full overflow-hidden cursor-pointer relative"
                    >
                      <div
                        className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                      <span>{formatSecs(playerState.currentTime)}</span>
                      <span>{formatSecs(playerState.duration)}</span>
                    </div>
                  </div>

                  {/* Buttons & Volume */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => musicService.previous()}
                        className="w-10 h-10 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white flex items-center justify-center active:scale-95 transition-all"
                        title="Previous"
                      >
                        <SkipBack size={18} />
                      </button>
                      <button
                        onClick={() => musicService.togglePlay()}
                        className="w-12 h-12 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-500/25 active:scale-95 transition-all"
                        title={playerState.isPlaying ? 'Pause' : 'Play'}
                      >
                        {playerState.playerStatus === 'BUFFERING' ? (
                          <RefreshCw size={20} className="animate-spin text-slate-950" />
                        ) : playerState.isPlaying ? (
                          <Pause size={22} />
                        ) : (
                          <Play size={22} className="ml-0.5" />
                        )}
                      </button>
                      <button
                        onClick={() => musicService.next()}
                        className="w-10 h-10 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white flex items-center justify-center active:scale-95 transition-all"
                        title="Next"
                      >
                        <SkipForward size={18} />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 max-w-[150px] w-full">
                      <Volume2 size={16} className="text-slate-400 shrink-0" />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={playerState.volume}
                        onChange={(e) => musicService.setVolume(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Standard Compact Player Card View */}
                {showVideo ? (
                  <div
                    ref={videoHostRef}
                    className="w-full h-full flex items-center justify-center bg-black"
                  />
                ) : (
                  <>
                    <img
                      src={currentTrack.thumbnail}
                      alt={currentTrack.title}
                      className={`w-full h-full object-cover transition-all ${
                        playerState.isPlaying ? 'scale-105' : 'grayscale-[20%]'
                      }`}
                    />
                    {playerState.isPlaying && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2.5 justify-center gap-1 pointer-events-none">
                        <span className="w-1.5 h-4 bg-cyan-400 rounded-full animate-[bounce_1s_infinite_100ms]" />
                        <span className="w-1.5 h-7 bg-cyan-400 rounded-full animate-[bounce_1s_infinite_300ms]" />
                        <span className="w-1.5 h-3 bg-cyan-400 rounded-full animate-[bounce_1s_infinite_200ms]" />
                        <span className="w-1.5 h-5 bg-cyan-400 rounded-full animate-[bounce_1s_infinite_400ms]" />
                      </div>
                    )}
                  </>
                )}

                {/* Top Overlay Buttons: Fullscreen + Video/Audio Mode */}
                <div className="absolute top-2 right-2 flex items-center gap-1">
                  {/* Fullscreen Button */}
                  <button
                    type="button"
                    onClick={handleToggleFullscreen}
                    className="p-1.5 rounded-lg bg-black/70 backdrop-blur-md text-white hover:text-cyan-300 border border-white/10 text-[10px] flex items-center gap-1 transition-all shadow"
                    title="Full Screen Video"
                  >
                    <Maximize2 size={13} />
                    <span className="hidden sm:inline">Full</span>
                  </button>

                  {/* Toggle Video/Audio Button */}
                  <button
                    type="button"
                    onClick={() => setShowVideo(!showVideo)}
                    className="p-1.5 rounded-lg bg-black/70 backdrop-blur-md text-white hover:text-cyan-300 border border-white/10 text-[10px] flex items-center gap-1 transition-all shadow"
                    title={showVideo ? 'Audio Mode' : 'Video Mode'}
                  >
                    {showVideo ? <TvMinimal size={13} /> : <Tv size={13} />}
                    <span className="hidden sm:inline">{showVideo ? 'Audio' : 'Video'}</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Details & Controls */}
          <div className="flex-1 w-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                  <Radio size={12} className={playerState.isPlaying ? 'animate-pulse' : ''} />
                  {playerState.playerStatus === 'BUFFERING'
                    ? 'Buffering...'
                    : playerState.isPlaying
                    ? 'Now Playing'
                    : 'Paused'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleFullscreen}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 flex items-center gap-1 transition-all"
                  >
                    <Maximize2 size={11} /> Full Screen
                  </button>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {currentTrack.source === 'youtube' ? 'YouTube Stream' : 'Direct Audio'}
                  </span>
                </div>
              </div>
              <h2 className="text-base md:text-xl font-bold text-white truncate mb-0.5" title={currentTrack.title}>
                {currentTrack.title}
              </h2>
              <p className="text-xs text-slate-400 truncate mb-4" title={currentTrack.artist}>
                {currentTrack.artist}
              </p>
            </div>

            {/* Error Message if any */}
            {playerState.errorMessage && (
              <div className="mb-3 px-3 py-1.5 rounded-xl bg-amber-950/60 border border-amber-500/30 text-amber-300 text-[11px]">
                {playerState.errorMessage}
              </div>
            )}

            {/* Scrubber / Progress Bar */}
            <div className="space-y-1.5 mb-4">
              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                  musicService.seek(ratio * (playerState.duration || 1));
                }}
                className="h-2 w-full bg-slate-800 rounded-full overflow-hidden cursor-pointer relative group"
              >
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full relative transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>{formatSecs(playerState.currentTime)}</span>
                <span>{formatSecs(playerState.duration)}</span>
              </div>
            </div>

            {/* Controls Row */}
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
                  disabled={playerState.playerStatus === 'BUFFERING'}
                  className="w-12 h-12 rounded-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-75 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-500/25 active:scale-95 transition-all"
                  title={playerState.isPlaying ? 'Pause' : 'Play'}
                >
                  {playerState.playerStatus === 'BUFFERING' ? (
                    <RefreshCw size={20} className="animate-spin text-slate-950" />
                  ) : playerState.isPlaying ? (
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
              <div className="flex items-center gap-2 max-w-[130px] w-full">
                {playerState.volume === 0 ? (
                  <VolumeX
                    size={16}
                    className="text-slate-500 shrink-0 cursor-pointer"
                    onClick={() => musicService.setVolume(50)}
                  />
                ) : (
                  <Volume2
                    size={16}
                    className="text-slate-400 shrink-0 cursor-pointer"
                    onClick={() => musicService.setVolume(0)}
                  />
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

      {/* Queue Drawer (Collapsible) */}
      {showQueue && (
        <div className="mb-8 p-4 rounded-2xl bg-[#0D1527] border border-[#1F2C45] shadow-xl animate-fade-in">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
            <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <ListMusic size={15} className="text-cyan-400" />
              Playback Queue ({playerState.queue.length} songs)
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => musicService.clearQueue()}
                className="text-[11px] text-slate-400 hover:text-red-400 flex items-center gap-1 transition-all"
                title="Clear Queue"
              >
                <Trash2 size={13} /> Clear
              </button>
            </div>
          </div>

          <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar">
            {playerState.queue.map((track, idx) => {
              const isCurrent = playerState.currentTrack?.id === track.id;
              return (
                <div
                  key={`${track.id}_${idx}`}
                  onClick={() => musicService.play(track)}
                  className={`p-2 rounded-xl flex items-center justify-between gap-3 cursor-pointer text-xs transition-all ${
                    isCurrent
                      ? 'bg-cyan-950/50 border border-cyan-500/40 text-cyan-300'
                      : 'hover:bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[10px] font-mono text-slate-500 w-4 text-center">
                      {idx + 1}
                    </span>
                    <img
                      src={track.thumbnail}
                      alt={track.title}
                      className="w-8 h-8 rounded-lg object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{track.title}</p>
                      <p className="text-[10px] text-slate-400 truncate">{track.artist}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono text-slate-400">
                      {track.duration || formatSecs(track.durationSeconds || 0)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        musicService.removeFromQueue(track.id);
                      }}
                      className="p-1 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-700"
                      title="Remove from Queue"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dynamic Search Results Section */}
      {debouncedQuery && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Search size={14} className="text-cyan-400" />
              Search Results for "{debouncedQuery}"
            </h3>
            {isSearching && (
              <span className="text-[11px] text-cyan-400 flex items-center gap-1 animate-pulse">
                <RefreshCw size={12} className="animate-spin" /> Searching YouTube...
              </span>
            )}
          </div>

          {searchError && (
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400">
              {searchError}
            </div>
          )}

          {isSearching && searchResults.length === 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="p-3 rounded-2xl bg-[#0E1524] border border-[#1E293B] flex items-center gap-3 animate-pulse"
                >
                  <div className="w-12 h-12 rounded-xl bg-slate-800 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-800 rounded w-3/4" />
                    <div className="h-2 bg-slate-800 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {searchResults.map((track) => {
                const isCurrent = playerState.currentTrack?.id === track.id;
                return (
                  <div
                    key={track.id}
                    onClick={() => handlePlayTrack(track)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                      isCurrent
                        ? 'bg-cyan-950/40 border-cyan-500/40 shadow-lg shadow-cyan-500/5'
                        : 'bg-[#0E1524] border-[#1E293B] hover:border-slate-700 hover:bg-[#121B2F]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
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

                      <div className="min-w-0">
                        <h4
                          className={`text-xs md:text-sm font-semibold truncate ${
                            isCurrent ? 'text-cyan-400' : 'text-white group-hover:text-cyan-300'
                          }`}
                          title={track.title}
                        >
                          {track.title}
                        </h4>
                        <p className="text-[11px] text-slate-400 truncate" title={track.artist}>
                          {track.artist}
                        </p>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {track.duration || '3:30'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Add to Queue Button */}
                      <button
                        type="button"
                        onClick={(e) => handleAddToQueue(track, e)}
                        className="p-2 rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-all"
                        title="Add to Queue"
                      >
                        <ListPlus size={16} />
                      </button>

                      {/* Play / Pause Button */}
                      <button
                        type="button"
                        className="p-2 rounded-xl text-slate-400 group-hover:text-cyan-400 transition-all"
                        title="Play Now"
                      >
                        {isCurrent && playerState.isPlaying ? (
                          <Pause size={18} />
                        ) : (
                          <Play size={18} />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Recently Played Songs Section (History-driven, NO fixed songs) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <History size={15} className="text-cyan-400" />
            Recently Played Songs ({playerState.recentlyPlayed.length})
          </h3>

          {playerState.recentlyPlayed.length > 0 && (
            <button
              type="button"
              onClick={() => musicService.clearRecentlyPlayed()}
              className="text-[11px] text-slate-400 hover:text-red-400 flex items-center gap-1 transition-all"
              title="Clear History"
            >
              <Trash2 size={13} /> Clear History
            </button>
          )}
        </div>

        {playerState.recentlyPlayed.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {playerState.recentlyPlayed.map((track) => {
              const isCurrent = currentTrack.id === track.id;
              return (
                <div
                  key={`recent_${track.id}`}
                  onClick={() => handlePlayTrack(track)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                    isCurrent
                      ? 'bg-cyan-950/40 border-cyan-500/40 shadow-lg shadow-cyan-500/5'
                      : 'bg-[#0E1524] border-[#1E293B] hover:border-slate-700 hover:bg-[#121B2F]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
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

                    <div className="min-w-0">
                      <h4
                        className={`text-xs md:text-sm font-semibold truncate ${
                          isCurrent ? 'text-cyan-400' : 'text-white group-hover:text-cyan-300'
                        }`}
                        title={track.title}
                      >
                        {track.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate" title={track.artist}>
                        {track.artist}
                      </p>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {track.duration || '3:30'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleAddToQueue(track, e)}
                      className="p-2 rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-all"
                      title="Add to Queue"
                    >
                      <ListPlus size={16} />
                    </button>

                    <button
                      type="button"
                      className="p-2 rounded-xl text-slate-400 group-hover:text-cyan-400 transition-all"
                      title="Play Now"
                    >
                      {isCurrent && playerState.isPlaying ? (
                        <Pause size={18} />
                      ) : (
                        <Play size={18} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-[#0E1524]/70 border border-[#1E293B] text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto">
              <Headphones size={22} />
            </div>
            <div>
              <p className="text-xs md:text-sm font-medium text-slate-300">
                Abhi tak koi gaana nahi suna hai
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Upar search karein ya voice se bolein <span className="text-cyan-400">"Hey Life, gaana chalao"</span>.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
              {['Channa Mereya', 'Kesariya', 'Apna Bana Le', 'Lo-Fi Chill Beats'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleQuickChipClick(s)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-cyan-950/60 border border-slate-700 hover:border-cyan-500/40 text-[11px] text-slate-300 hover:text-cyan-300 transition-all"
                >
                  ▶ {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
