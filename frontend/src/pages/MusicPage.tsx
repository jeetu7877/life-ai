import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Sparkles,
  Flame,
  Clock,
  Star,
  ListMusic,
  Plus,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  MoreVertical,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronLeft,
  X,
  Radio,
  Tv,
  TvMinimal,
  Music,
  Mic,
  ListPlus,
  Trash2,
  Check,
  ExternalLink,
  Share2
} from 'lucide-react';
import {
  musicService,
  PlayerState,
  Track,
  Playlist,
  FEATURED_TRACKS,
  CURATED_PLAYLISTS
} from '../services/musicService';
import { useVoice } from '../context/VoiceContext';

export const MusicPage: React.FC = () => {
  const navigate = useNavigate();
  const { triggerManualListen, isAudioSpeaking, voiceState } = useVoice();

  // Primary State
  const [playerState, setPlayerState] = useState<PlayerState>(musicService.getState());
  const [activeTab, setActiveTab] = useState<'All' | 'Music' | 'Podcasts' | 'Live' | 'Liked'>('All');

  // Search State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // View & Modal States
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [showFullPlayer, setShowFullPlayer] = useState<boolean>(false);
  const [showVideo, setShowVideo] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showQueueDrawer, setShowQueueDrawer] = useState<boolean>(false);
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState<boolean>(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState<string>('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState<string>('');
  const [activeTrackMenu, setActiveTrackMenu] = useState<Track | null>(null);
  const [showAddToPlaylistModal, setShowAddToPlaylistModal] = useState<Track | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // References
  const videoHostRef = useRef<HTMLDivElement>(null);
  const fullPlayerVideoRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<any>(null);

  // Subscribe to central musicService
  useEffect(() => {
    const unsub = musicService.addListener((state) => {
      setPlayerState(state);
    });
    return unsub;
  }, []);

  // Video docking for persistent YouTube iframe
  useEffect(() => {
    const hostEl = isFullscreen || showVideo
      ? (fullPlayerVideoRef.current || videoHostRef.current)
      : null;
    musicService.dockPlayerToContainer(hostEl);
    return () => {
      musicService.dockPlayerToContainer(null);
    };
  }, [showVideo, isFullscreen, showFullPlayer]);

  // Debounced live YouTube search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (!searchQuery.trim()) {
      setDebouncedQuery('');
      setSearchResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    searchTimerRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 400);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  useEffect(() => {
    if (!debouncedQuery) return;
    let isMounted = true;
    setIsSearching(true);
    setSearchError(null);

    musicService
      .search(debouncedQuery, 16)
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
        setSearchError('Search service temporarily unavailable.');
        console.warn('[MUSIC_SEARCH] Error:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [debouncedQuery]);

  // Toast notification helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Time format helper
  const formatSecs = (sec: number) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const currentTrack = playerState.currentTrack || FEATURED_TRACKS[0];
  const progressPercent = playerState.duration > 0
    ? Math.min(100, (playerState.currentTime / playerState.duration) * 100)
    : 0;

  // Made for You playlists (first 4 curated)
  const madeForYouPlaylists = CURATED_PLAYLISTS.slice(0, 4);

  // Recommended tracks
  const recommendedTracks = FEATURED_TRACKS.slice(0, 4);

  // Recently played tracks: use real history or fall back to recent featured tracks
  const recentlyPlayedList: Track[] = playerState.recentlyPlayed.length > 0
    ? playerState.recentlyPlayed.slice(0, 8)
    : [
        FEATURED_TRACKS.find((t) => t.id === '9n4sZ9gH_6c') || FEATURED_TRACKS[6],
        FEATURED_TRACKS.find((t) => t.id === '1IpA8G5x-tM') || FEATURED_TRACKS[5],
        FEATURED_TRACKS[6],
        FEATURED_TRACKS[5]
      ];

  // Popular playlists
  const popularPlaylists = CURATED_PLAYLISTS.slice(4);

  // Liked Songs playlist object representation
  const likedSongsPlaylist: Playlist = {
    id: 'pl_liked_songs',
    title: 'Liked Songs',
    description: 'Your favorite tracks',
    artwork: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400&q=80',
    createdAt: '2026-01-01T00:00:00.000Z',
    isCustom: false,
    tracks: playerState.likedTracks.length > 0 ? playerState.likedTracks : [FEATURED_TRACKS[0], FEATURED_TRACKS[6]]
  };

  // Play a track immediately
  const handlePlayTrack = (track: Track) => {
    musicService.play(track);
  };

  // Toggle Like on track
  const handleToggleLike = (track: Track, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isNowLiked = musicService.toggleLike(track);
    showToast(isNowLiked ? `Added to Liked Songs ❤️` : `Removed from Liked Songs`);
  };

  // Open Playlist Details
  const handleOpenPlaylist = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
  };

  // Play entire playlist
  const handlePlayPlaylist = (playlist: Playlist, shuffle = false, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    musicService.playPlaylist(playlist, shuffle);
    showToast(`Playing "${playlist.title}"`);
  };

  // Create new user playlist
  const handleCreatePlaylistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistTitle.trim()) return;
    const created = musicService.createPlaylist(newPlaylistTitle.trim(), newPlaylistDesc.trim());
    setNewPlaylistTitle('');
    setNewPlaylistDesc('');
    setShowCreatePlaylistModal(false);
    showToast(`Created playlist "${created.title}"`);
    setSelectedPlaylist(created);
  };

  // Add track to playlist
  const handleAddTrackToPlaylist = (playlistId: string, track: Track) => {
    musicService.addTrackToPlaylist(playlistId, track);
    setShowAddToPlaylistModal(null);
    showToast(`Added to playlist`);
  };

  // Filter tab content
  const handleTabClick = (tab: 'All' | 'Music' | 'Podcasts' | 'Live' | 'Liked') => {
    setActiveTab(tab);
    if (tab === 'Liked') {
      handleOpenPlaylist(likedSongsPlaylist);
    } else if (tab === 'Live') {
      setSearchQuery('Live Indian Music Radio');
    } else if (tab === 'Podcasts') {
      setSearchQuery('Hindi Podcasts');
    } else {
      if (searchQuery === 'Live Indian Music Radio' || searchQuery === 'Hindi Podcasts') {
        setSearchQuery('');
      }
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[#070B14] text-slate-100 flex flex-col relative select-none pb-36 overflow-x-hidden custom-scrollbar">
      {/* Toast Notice */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-2xl bg-cyan-950/90 border border-cyan-400/40 text-cyan-200 text-xs font-medium shadow-2xl flex items-center gap-2 animate-fade-in backdrop-blur-md">
          <Check size={14} className="text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 px-4 md:px-8 py-3 max-w-5xl mx-auto w-full box-border">
        {/* Category Filter Pills matching reference image */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 pt-1 no-scrollbar">
          <button
            type="button"
            onClick={() => handleTabClick('All')}
            className={`px-5 py-2 rounded-full text-xs font-semibold transition-all shrink-0 ${
              activeTab === 'All'
                ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/25'
                : 'bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => handleTabClick('Music')}
            className={`px-4 py-2 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all shrink-0 ${
              activeTab === 'Music'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-lg shadow-cyan-500/25'
                : 'bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Music size={14} className={activeTab === 'Music' ? 'text-slate-950' : 'text-cyan-400'} />
            <span>Music</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabClick('Liked')}
            className={`px-4 py-2 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all shrink-0 ${
              activeTab === 'Liked'
                ? 'bg-rose-500 text-white font-semibold shadow-lg shadow-rose-500/25'
                : 'bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Heart size={14} className={activeTab === 'Liked' ? 'fill-white text-white' : 'text-rose-400 fill-rose-400/30'} />
            <span>Liked ({playerState.likedTracks.length})</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabClick('Podcasts')}
            className={`px-4 py-2 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all shrink-0 ${
              activeTab === 'Podcasts'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-lg shadow-cyan-500/25'
                : 'bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Mic size={14} className={activeTab === 'Podcasts' ? 'text-slate-950' : 'text-purple-400'} />
            <span>Podcasts</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabClick('Live')}
            className={`px-4 py-2 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all shrink-0 ${
              activeTab === 'Live'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-lg shadow-cyan-500/25'
                : 'bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Radio size={14} className={activeTab === 'Live' ? 'text-slate-950 animate-pulse' : 'text-rose-400'} />
            <span>Live</span>
          </button>
        </div>

        {/* Search Bar matching reference image with voice waveform icon */}
        <div className="relative mb-6 mt-1">
          <div className="relative flex items-center rounded-2xl bg-[#0C1220]/90 border border-cyan-500/30 focus-within:border-cyan-400 shadow-lg shadow-cyan-950/20 transition-all overflow-hidden">
            <Search size={18} className="absolute left-4 text-cyan-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search any song, artist, album, mood..."
              className="w-full bg-transparent pl-11 pr-24 py-3 text-xs md:text-sm text-white placeholder-slate-500 focus:outline-none"
            />

            {/* Clear Button if text entered */}
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setDebouncedQuery('');
                  setSearchResults([]);
                }}
                className="p-1.5 text-slate-400 hover:text-white transition-all mr-1"
                title="Clear"
              >
                <X size={16} />
              </button>
            )}

            {/* Voice Waveform Icon matching reference image */}
            <button
              type="button"
              onClick={() => {
                showToast('Voice listening active! Say: "Channa Mereya chalao"');
                triggerManualListen();
              }}
              className="px-3.5 py-2.5 text-cyan-400 hover:text-cyan-300 flex items-center justify-center transition-all group"
              title="Voice Search & Commands"
            >
              <div className="flex items-center gap-0.5 h-4">
                <span className={`w-0.5 rounded-full bg-cyan-400 transition-all ${
                  isAudioSpeaking || voiceState === 'listening' ? 'h-4 animate-[bounce_0.8s_infinite_100ms]' : 'h-2'
                }`} />
                <span className={`w-0.5 rounded-full bg-cyan-400 transition-all ${
                  isAudioSpeaking || voiceState === 'listening' ? 'h-5 animate-[bounce_0.8s_infinite_300ms]' : 'h-4'
                }`} />
                <span className={`w-0.5 rounded-full bg-cyan-400 transition-all ${
                  isAudioSpeaking || voiceState === 'listening' ? 'h-3 animate-[bounce_0.8s_infinite_200ms]' : 'h-2.5'
                }`} />
                <span className={`w-0.5 rounded-full bg-cyan-400 transition-all ${
                  isAudioSpeaking || voiceState === 'listening' ? 'h-4 animate-[bounce_0.8s_infinite_400ms]' : 'h-3.5'
                }`} />
              </div>
            </button>
          </div>
        </div>

        {/* Dynamic Search Results if Searching */}
        {debouncedQuery ? (
          <div className="mb-8 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Search size={16} className="text-cyan-400" />
                <span>Search Results for "{debouncedQuery}"</span>
              </h2>
              {isSearching && (
                <span className="text-[11px] text-cyan-400 animate-pulse flex items-center gap-1 font-mono">
                  Searching YouTube...
                </span>
              )}
            </div>

            {searchError && (
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400 mb-4">
                {searchError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {searchResults.map((track) => {
                const isPlayingThis = playerState.isPlaying && playerState.currentTrack?.id === track.id;
                const isLiked = musicService.isLiked(track.id);

                return (
                  <div
                    key={track.id}
                    onClick={() => handlePlayTrack(track)}
                    className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                      isPlayingThis
                        ? 'bg-cyan-950/40 border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                        : 'bg-[#0B101D] border-slate-800/80 hover:border-slate-700 hover:bg-[#10172A]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-slate-900 border border-slate-800">
                        <img
                          src={track.thumbnail}
                          alt={track.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        {isPlayingThis && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="w-1.5 h-4 bg-cyan-400 animate-pulse rounded-full" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <h4 className={`text-xs md:text-sm font-semibold truncate ${
                          isPlayingThis ? 'text-cyan-400' : 'text-white group-hover:text-cyan-300'
                        }`}>
                          {track.title}
                        </h4>
                        <p className="text-[11px] text-slate-400 truncate">
                          {track.artist}
                        </p>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {track.duration || '3:30'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleToggleLike(track, e)}
                        className={`p-2 rounded-xl transition-all ${
                          isLiked ? 'text-rose-500' : 'text-slate-500 hover:text-slate-200'
                        }`}
                        title={isLiked ? 'Liked' : 'Like'}
                      >
                        <Heart size={16} className={isLiked ? 'fill-rose-500' : ''} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          musicService.addToQueue(track);
                          showToast(`Added "${track.title}" to queue`);
                        }}
                        className="p-2 rounded-xl text-slate-400 hover:text-cyan-400 transition-all"
                        title="Add to queue"
                      >
                        <ListPlus size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* If Playlist is selected, show Playlist Details View */}
        {selectedPlaylist ? (
          <div className="mb-8 animate-fade-in">
            {/* Back Button */}
            <button
              type="button"
              onClick={() => setSelectedPlaylist(null)}
              className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-all group"
            >
              <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to Home</span>
            </button>

            {/* Playlist Header Deck */}
            <div className="p-5 md:p-6 rounded-3xl bg-gradient-to-b from-[#111A2E] to-[#0A0F1D] border border-cyan-500/20 shadow-2xl mb-6 flex flex-col md:flex-row items-center gap-5">
              <div className="w-36 h-36 md:w-44 md:h-44 rounded-2xl overflow-hidden shadow-2xl shrink-0 border border-slate-800 bg-slate-900">
                <img
                  src={selectedPlaylist.artwork}
                  alt={selectedPlaylist.title}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 text-center md:text-left min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-full inline-block mb-2">
                  Playlist
                </span>
                <h2 className="text-xl md:text-2xl font-bold text-white mb-1 truncate">
                  {selectedPlaylist.title}
                </h2>
                <p className="text-xs text-slate-400 mb-4">
                  {selectedPlaylist.description} • {selectedPlaylist.tracks.length} songs
                </p>

                {/* Actions */}
                <div className="flex items-center justify-center md:justify-start gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={(e) => handlePlayPlaylist(selectedPlaylist, false, e)}
                    className="px-5 py-2.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/25 active:scale-95 transition-all"
                  >
                    <Play size={16} className="fill-slate-950" />
                    <span>Play All</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handlePlayPlaylist(selectedPlaylist, true, e)}
                    className="px-4 py-2.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white font-medium text-xs flex items-center gap-2 border border-slate-700 transition-all"
                  >
                    <Shuffle size={14} className="text-cyan-400" />
                    <span>Shuffle</span>
                  </button>

                  {selectedPlaylist.isCustom && (
                    <button
                      type="button"
                      onClick={() => {
                        musicService.deletePlaylist(selectedPlaylist.id);
                        setSelectedPlaylist(null);
                        showToast(`Deleted playlist`);
                      }}
                      className="p-2.5 rounded-full text-slate-400 hover:text-red-400 hover:bg-slate-800/80 transition-all"
                      title="Delete playlist"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Playlist Track List */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Tracks ({selectedPlaylist.tracks.length})
              </h3>

              {selectedPlaylist.tracks.length === 0 ? (
                <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-500">
                  This playlist has no songs yet. Search any song to add it!
                </div>
              ) : (
                selectedPlaylist.tracks.map((track, idx) => {
                  const isPlayingThis = playerState.isPlaying && playerState.currentTrack?.id === track.id;
                  const isLiked = musicService.isLiked(track.id);

                  return (
                    <div
                      key={`${track.id}_${idx}`}
                      onClick={() => handlePlayTrack(track)}
                      className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                        isPlayingThis
                          ? 'bg-cyan-950/40 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                          : 'bg-[#0B101D] border-slate-800/60 hover:border-slate-700 hover:bg-[#10172A]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-mono text-slate-500 w-5 text-center">
                          {idx + 1}
                        </span>
                        <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-slate-900 border border-slate-800">
                          <img
                            src={track.thumbnail}
                            alt={track.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <h4 className={`text-xs md:text-sm font-semibold truncate ${
                            isPlayingThis ? 'text-cyan-400' : 'text-white'
                          }`}>
                            {track.title}
                          </h4>
                          <p className="text-[11px] text-slate-400 truncate">
                            {track.artist}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                          {track.duration || '3:30'}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => handleToggleLike(track, e)}
                          className={`p-1.5 transition-all ${
                            isLiked ? 'text-rose-500' : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          <Heart size={16} className={isLiked ? 'fill-rose-500' : ''} />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTrackMenu(track);
                          }}
                          className="p-1.5 text-slate-500 hover:text-slate-300 transition-all"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* Main Dashboard Sections matching reference image */
          <div className="space-y-7">
            {/* 1. Made for You Section */}
            <section>
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-cyan-400 fill-cyan-400/20" />
                  <div>
                    <h2 className="text-sm md:text-base font-bold text-white tracking-tight">
                      Made for You
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Playlists crafted just for you
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenPlaylist(madeForYouPlaylists[0])}
                  className="text-xs text-slate-400 hover:text-cyan-300 flex items-center gap-0.5 transition-all"
                >
                  <span>See all</span>
                  <span>&gt;</span>
                </button>
              </div>

              {/* Horizontal Scroll Cards */}
              <div className="flex items-stretch gap-3.5 overflow-x-auto pb-2 no-scrollbar">
                {madeForYouPlaylists.map((pl) => (
                  <div
                    key={pl.id}
                    onClick={() => handleOpenPlaylist(pl)}
                    className="w-36 md:w-44 shrink-0 rounded-2xl bg-[#0C1220] border border-slate-800/80 hover:border-slate-700 p-2.5 transition-all group cursor-pointer flex flex-col justify-between"
                  >
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-2.5 bg-slate-900 shadow-md">
                      <img
                        src={pl.artwork}
                        alt={pl.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {/* Heart Like button on top-right of playlist */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (pl.tracks.length > 0) {
                            handleToggleLike(pl.tracks[0], e);
                          }
                        }}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-md"
                        title="Like"
                      >
                        <Heart
                          size={14}
                          className={pl.tracks.length > 0 && musicService.isLiked(pl.tracks[0].id) ? 'fill-rose-500 text-rose-500' : 'text-white/80'}
                        />
                      </button>
                      {/* White circular play button in bottom-right */}
                      <button
                        type="button"
                        onClick={(e) => handlePlayPlaylist(pl, false, e)}
                        className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-white text-slate-950 flex items-center justify-center shadow-lg active:scale-95 transition-transform hover:scale-105"
                        title="Play playlist"
                      >
                        <Play size={16} className="fill-slate-950 ml-0.5" />
                      </button>
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <h3 className="text-xs md:text-sm font-bold text-white truncate group-hover:text-cyan-300 transition-colors">
                          {pl.title}
                        </h3>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPlaylist(pl);
                          }}
                          className="text-slate-500 hover:text-slate-300 p-0.5"
                        >
                          <MoreVertical size={13} />
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">
                        {pl.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 2. Recommended for today Section */}
            <section>
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <Flame size={18} className="text-orange-500 fill-orange-500/20" />
                  <div>
                    <h2 className="text-sm md:text-base font-bold text-white tracking-tight">
                      Recommended for today
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Based on your listening
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSearchQuery('Bollywood Romantic')}
                  className="text-xs text-slate-400 hover:text-cyan-300 flex items-center gap-0.5 transition-all"
                >
                  <span>See all</span>
                  <span>&gt;</span>
                </button>
              </div>

              {/* Horizontal Scroll Tracks */}
              <div className="flex items-stretch gap-3.5 overflow-x-auto pb-2 no-scrollbar">
                {recommendedTracks.map((track) => {
                  const isPlayingThis = playerState.isPlaying && playerState.currentTrack?.id === track.id;
                  const isLiked = musicService.isLiked(track.id);

                  return (
                    <div
                      key={track.id}
                      onClick={() => handlePlayTrack(track)}
                      className={`w-36 md:w-44 shrink-0 rounded-2xl bg-[#0C1220] border p-2.5 transition-all group cursor-pointer flex flex-col justify-between ${
                        isPlayingThis
                          ? 'border-cyan-500/50 bg-[#0E172C]'
                          : 'border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-2.5 bg-slate-900 shadow-md">
                        <img
                          src={track.thumbnail}
                          alt={track.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {isPlayingThis && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="w-2 h-5 bg-cyan-400 rounded-full animate-pulse" />
                          </div>
                        )}
                        {/* Floating Heart Button on Top-Right */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleLike(track, e)}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-md"
                          title={isLiked ? 'Liked' : 'Like'}
                        >
                          <Heart size={14} className={isLiked ? 'fill-rose-500 text-rose-500' : 'text-white/80'} />
                        </button>
                      </div>

                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <h3 className={`text-xs md:text-sm font-bold truncate ${
                            isPlayingThis ? 'text-cyan-400' : 'text-white group-hover:text-cyan-300'
                          }`}>
                            {track.title}
                          </h3>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveTrackMenu(track);
                            }}
                            className="text-slate-500 hover:text-slate-300 p-0.5"
                          >
                            <MoreVertical size={13} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[11px] text-slate-400 truncate flex-1">
                            {track.artist}
                          </p>
                          <button
                            type="button"
                            onClick={(e) => handleToggleLike(track, e)}
                            className={`p-1 rounded-full transition-all hover:scale-110 active:scale-95 ${
                              isLiked ? 'text-rose-500' : 'text-slate-500 hover:text-slate-300'
                            }`}
                            title={isLiked ? 'Liked' : 'Like'}
                          >
                            <Heart size={16} className={isLiked ? 'fill-rose-500 text-rose-500' : ''} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Dedicated Liked Songs / Liked Music Section ("Mujhe Pasand Aaye Gaane") */}
            <section className="animate-fade-in">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                    <Heart size={16} className="text-rose-500 fill-rose-500" />
                  </div>
                  <div>
                    <h2 className="text-sm md:text-base font-bold text-white tracking-tight flex items-center gap-2">
                      <span>Liked Songs</span>
                      <span className="text-[10px] font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full">
                        {playerState.likedTracks.length}
                      </span>
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Mujhe pasand aaye gaane · Liked by you
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenPlaylist(likedSongsPlaylist)}
                  className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-0.5 transition-all"
                >
                  <span>See all</span>
                  <span>&gt;</span>
                </button>
              </div>

              {/* Horizontal Scroll Tracks for Liked Songs */}
              {playerState.likedTracks.length === 0 ? (
                <div
                  onClick={() => handleOpenPlaylist(likedSongsPlaylist)}
                  className="p-5 rounded-2xl bg-[#0C1220]/70 border border-slate-800 text-center cursor-pointer hover:border-slate-700 transition-all"
                >
                  <Heart size={28} className="text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-300 font-semibold mb-0.5">
                    Abhi tak koi gaana like nahi kiya gaya hai
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Kisi bhi gaane par ❤️ dabakar yahan save karein!
                  </p>
                </div>
              ) : (
                <div className="flex items-stretch gap-3.5 overflow-x-auto pb-2 no-scrollbar">
                  {playerState.likedTracks.map((track) => {
                    const isPlayingThis = playerState.isPlaying && playerState.currentTrack?.id === track.id;

                    return (
                      <div
                        key={`liked_sec_${track.id}`}
                        onClick={() => handlePlayTrack(track)}
                        className={`w-36 md:w-44 shrink-0 rounded-2xl bg-[#0C1220] border p-2.5 transition-all group cursor-pointer flex flex-col justify-between ${
                          isPlayingThis
                            ? 'border-rose-500/50 bg-[#160E1A]'
                            : 'border-slate-800/80 hover:border-slate-700'
                        }`}
                      >
                        <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-2.5 bg-slate-900 shadow-md">
                          <img
                            src={track.thumbnail}
                            alt={track.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          {isPlayingThis && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <span className="w-2 h-5 bg-rose-500 rounded-full animate-pulse" />
                            </div>
                          )}
                          {/* Floating Red Heart Badge on Thumbnail */}
                          <button
                            type="button"
                            onClick={(e) => handleToggleLike(track, e)}
                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 backdrop-blur-md flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-md"
                            title="Unlike"
                          >
                            <Heart size={14} className="fill-rose-500 text-rose-500" />
                          </button>
                        </div>

                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <h3 className={`text-xs md:text-sm font-bold truncate ${
                              isPlayingThis ? 'text-rose-400' : 'text-white group-hover:text-rose-300'
                            }`}>
                              {track.title}
                            </h3>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveTrackMenu(track);
                              }}
                              className="text-slate-500 hover:text-slate-300 p-0.5"
                            >
                              <MoreVertical size={13} />
                            </button>
                          </div>

                          <div className="flex items-center justify-between mt-1">
                            <p className="text-[11px] text-slate-400 truncate flex-1">
                              {track.artist}
                            </p>
                            <button
                              type="button"
                              onClick={(e) => handleToggleLike(track, e)}
                              className="p-1 rounded-full text-rose-500 hover:scale-110 active:scale-95 transition-all"
                              title="Unlike"
                            >
                              <Heart size={16} className="fill-rose-500 text-rose-500" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 3. Recently played Section */}
            <section>
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <Clock size={18} className="text-cyan-400" />
                  <div>
                    <h2 className="text-sm md:text-base font-bold text-white tracking-tight">
                      Recently played
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (playerState.recentlyPlayed.length > 0) {
                      musicService.playPlaylist({
                        id: 'pl_recent',
                        title: 'Recently Played',
                        description: 'Your listening history',
                        artwork: playerState.recentlyPlayed[0]?.thumbnail || '',
                        createdAt: '',
                        isCustom: false,
                        tracks: playerState.recentlyPlayed
                      });
                      showToast('Playing Recently Played history');
                    }
                  }}
                  className="text-xs text-slate-400 hover:text-cyan-300 flex items-center gap-0.5 transition-all"
                >
                  <span>See all</span>
                  <span>&gt;</span>
                </button>
              </div>

              {/* Horizontal Scroll Tracks */}
              <div className="flex items-stretch gap-3.5 overflow-x-auto pb-2 no-scrollbar">
                {recentlyPlayedList.map((track) => {
                  const isPlayingThis = playerState.isPlaying && playerState.currentTrack?.id === track.id;
                  const isLiked = musicService.isLiked(track.id);

                  return (
                    <div
                      key={`recent_${track.id}`}
                      onClick={() => handlePlayTrack(track)}
                      className={`w-36 md:w-44 shrink-0 rounded-2xl bg-[#0C1220] border p-2.5 transition-all group cursor-pointer flex flex-col justify-between ${
                        isPlayingThis
                          ? 'border-cyan-500/50 bg-[#0E172C]'
                          : 'border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-2.5 bg-slate-900 shadow-md">
                        <img
                          src={track.thumbnail}
                          alt={track.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {isPlayingThis && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="w-2 h-5 bg-cyan-400 rounded-full animate-pulse" />
                          </div>
                        )}
                        {/* Floating Heart Button */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleLike(track, e)}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-md"
                          title={isLiked ? 'Liked' : 'Like'}
                        >
                          <Heart size={14} className={isLiked ? 'fill-rose-500 text-rose-500' : 'text-white/80'} />
                        </button>
                      </div>

                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <h3 className={`text-xs md:text-sm font-bold truncate ${
                            isPlayingThis ? 'text-cyan-400' : 'text-white group-hover:text-cyan-300'
                          }`}>
                            {track.title}
                          </h3>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveTrackMenu(track);
                            }}
                            className="text-slate-500 hover:text-slate-300 p-0.5"
                          >
                            <MoreVertical size={13} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[11px] text-slate-400 truncate flex-1">
                            {track.artist}
                          </p>
                          <button
                            type="button"
                            onClick={(e) => handleToggleLike(track, e)}
                            className={`p-1 rounded-full transition-all hover:scale-110 active:scale-95 ${
                              isLiked ? 'text-rose-500' : 'text-slate-500 hover:text-slate-300'
                            }`}
                            title={isLiked ? 'Liked' : 'Like'}
                          >
                            <Heart size={16} className={isLiked ? 'fill-rose-500 text-rose-500' : ''} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 4. Popular playlists Section */}
            <section>
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <Star size={18} className="text-cyan-400 fill-cyan-400/20" />
                  <div>
                    <h2 className="text-sm md:text-base font-bold text-white tracking-tight">
                      Popular playlists
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenPlaylist(popularPlaylists[0])}
                  className="text-xs text-slate-400 hover:text-cyan-300 flex items-center gap-0.5 transition-all"
                >
                  <span>See all</span>
                  <span>&gt;</span>
                </button>
              </div>

              {/* Horizontal Scroll Playlists */}
              <div className="flex items-stretch gap-3.5 overflow-x-auto pb-2 no-scrollbar">
                {popularPlaylists.map((pl) => (
                  <div
                    key={pl.id}
                    onClick={() => handleOpenPlaylist(pl)}
                    className="w-36 md:w-44 shrink-0 rounded-2xl bg-[#0C1220] border border-slate-800/80 hover:border-slate-700 p-2.5 transition-all group cursor-pointer flex flex-col justify-between"
                  >
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-2.5 bg-slate-900 shadow-md">
                      <img
                        src={pl.artwork}
                        alt={pl.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {/* Floating Heart Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (pl.tracks.length > 0) {
                            handleToggleLike(pl.tracks[0], e);
                          }
                        }}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-md"
                        title="Like"
                      >
                        <Heart
                          size={14}
                          className={pl.tracks.length > 0 && musicService.isLiked(pl.tracks[0].id) ? 'fill-rose-500 text-rose-500' : 'text-white/80'}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handlePlayPlaylist(pl, false, e)}
                        className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center shadow-lg active:scale-95 transition-transform hover:scale-105"
                        title="Play"
                      >
                        <Play size={16} className="fill-slate-950 ml-0.5" />
                      </button>
                    </div>

                    <div>
                      <h3 className="text-xs md:text-sm font-bold text-white truncate group-hover:text-cyan-300 transition-colors">
                        {pl.title}
                      </h3>
                      <p className="text-[11px] text-slate-400 truncate">
                        {pl.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 5. Your playlists Section matching reference image */}
            <section>
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <ListMusic size={18} className="text-cyan-400" />
                  <div>
                    <h2 className="text-sm md:text-base font-bold text-white tracking-tight">
                      Your playlists
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreatePlaylistModal(true)}
                  className="text-xs text-slate-400 hover:text-cyan-300 flex items-center gap-0.5 transition-all"
                >
                  <span>See all</span>
                  <span>&gt;</span>
                </button>
              </div>

              {/* Horizontal Scroll Cards for Your Playlists */}
              <div className="flex items-stretch gap-3.5 overflow-x-auto pb-2 no-scrollbar">
                {/* Liked Songs Card (Gradient with White Heart) */}
                <div
                  onClick={() => handleOpenPlaylist(likedSongsPlaylist)}
                  className="w-36 md:w-44 shrink-0 rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 p-2.5 transition-all group cursor-pointer flex flex-col justify-between shadow-lg shadow-indigo-900/20 hover:scale-[1.02]"
                >
                  <div className="aspect-square w-full rounded-xl bg-black/20 backdrop-blur-md flex items-center justify-center mb-2.5">
                    <Heart size={38} className="fill-white text-white drop-shadow" />
                  </div>
                  <div>
                    <h3 className="text-xs md:text-sm font-bold text-white truncate">
                      Liked Songs
                    </h3>
                    <p className="text-[11px] text-slate-200 truncate">
                      {playerState.likedTracks.length || 124} songs
                    </p>
                  </div>
                </div>

                {/* Custom User Playlists ("My Favorites", "Study Mix", etc.) */}
                {playerState.playlists.map((pl) => (
                  <div
                    key={pl.id}
                    onClick={() => handleOpenPlaylist(pl)}
                    className="w-36 md:w-44 shrink-0 rounded-2xl bg-[#0C1220] border border-slate-800/80 hover:border-slate-700 p-2.5 transition-all group cursor-pointer flex flex-col justify-between"
                  >
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-2.5 bg-slate-900 shadow-md">
                      <img
                        src={pl.artwork}
                        alt={pl.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div>
                      <h3 className="text-xs md:text-sm font-bold text-white truncate group-hover:text-cyan-300 transition-colors">
                        {pl.title}
                      </h3>
                      <p className="text-[11px] text-slate-400 truncate">
                        {pl.tracks.length} songs
                      </p>
                    </div>
                  </div>
                ))}

                {/* "+ Create Playlist" Button Card */}
                <div
                  onClick={() => setShowCreatePlaylistModal(true)}
                  className="w-36 md:w-44 shrink-0 rounded-2xl bg-[#0C1220]/60 border-2 border-dashed border-slate-800 hover:border-cyan-400/50 p-2.5 transition-all group cursor-pointer flex flex-col items-center justify-center text-center hover:bg-[#0E1528]"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-800/80 group-hover:bg-cyan-500/20 text-slate-400 group-hover:text-cyan-400 flex items-center justify-center mb-2 transition-all">
                    <Plus size={22} />
                  </div>
                  <h3 className="text-xs md:text-sm font-bold text-slate-300 group-hover:text-white transition-colors">
                    Create Playlist
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Build custom mix
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* =========================================================================
          FLOATING MINI-PLAYER BAR (VISIBLE ONLY INSIDE MUSIC SECTION)
          MATCHING REFERENCE IMAGE: Artwork, Title, Artist, Progress, ❤️, ⏮, ⏯, ⏭, 𝄤
          ========================================================================= */}
      {currentTrack && (
        <div className="fixed bottom-[64px] md:bottom-4 left-3 right-3 md:left-6 md:right-6 z-40 bg-[#0A101D]/95 border border-cyan-400/40 backdrop-blur-2xl rounded-2xl shadow-2xl p-2.5 transition-all select-none max-w-4xl mx-auto">
          {/* Micro Progress Bar on Top */}
          <div className="absolute top-0 left-3 right-3 h-[2px] bg-slate-800/80 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            {/* Left Track Info (Clicking opens Full Player modal) */}
            <div
              onClick={() => setShowFullPlayer(true)}
              className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer group"
            >
              <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-slate-900 border border-slate-700/80">
                <img
                  src={currentTrack.thumbnail}
                  alt={currentTrack.title}
                  className={`w-full h-full object-cover transition-transform group-hover:scale-105 ${
                    playerState.isPlaying ? 'animate-pulse' : ''
                  }`}
                />
                {playerState.isPlaying && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center gap-0.5">
                    <span className="w-0.5 h-3 bg-cyan-400 animate-[bounce_1s_infinite_100ms]" />
                    <span className="w-0.5 h-4 bg-cyan-400 animate-[bounce_1s_infinite_300ms]" />
                    <span className="w-0.5 h-2 bg-cyan-400 animate-[bounce_1s_infinite_200ms]" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="text-xs md:text-sm font-semibold text-white truncate group-hover:text-cyan-300 transition-colors">
                  {currentTrack.title}
                </h4>
                <p className="text-[11px] text-slate-400 truncate">
                  {currentTrack.artist}
                </p>
                {/* Thin timeline with timestamps */}
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                  <span>{formatSecs(playerState.currentTime)}</span>
                  <div className="flex-1 h-[2px] bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-400"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <span>{formatSecs(playerState.duration || 289)}</span>
                </div>
              </div>
            </div>

            {/* Right Controls: Heart, Previous, Play/Pause, Next, Queue */}
            <div className="flex items-center gap-1.5 md:gap-2.5 shrink-0">
              {/* Heart toggle */}
              <button
                type="button"
                onClick={(e) => handleToggleLike(currentTrack, e)}
                className={`p-1.5 rounded-full transition-all ${
                  musicService.isLiked(currentTrack.id)
                    ? 'text-rose-500'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={musicService.isLiked(currentTrack.id) ? 'Liked' : 'Like'}
              >
                <Heart
                  size={18}
                  className={musicService.isLiked(currentTrack.id) ? 'fill-rose-500' : ''}
                />
              </button>

              {/* Previous Track Button */}
              <button
                type="button"
                onClick={() => musicService.previous()}
                className="w-8 h-8 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center active:scale-95 transition-all"
                title="Previous Track"
              >
                <SkipBack size={16} />
              </button>

              {/* Glowing Cyan Play/Pause Button */}
              <button
                type="button"
                onClick={() => musicService.togglePlay()}
                className="w-10 h-10 rounded-full bg-cyan-400 hover:bg-cyan-300 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-cyan-400/30 active:scale-95 transition-all"
                title={playerState.isPlaying ? 'Pause' : 'Play'}
              >
                {playerState.isPlaying ? (
                  <Pause size={19} className="fill-slate-950" />
                ) : (
                  <Play size={19} className="fill-slate-950 ml-0.5" />
                )}
              </button>

              {/* Next Track Button */}
              <button
                type="button"
                onClick={() => musicService.next()}
                className="w-8 h-8 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center active:scale-95 transition-all"
                title="Next Track"
              >
                <SkipForward size={16} />
              </button>

              {/* Queue Button */}
              <button
                type="button"
                onClick={() => {
                  setShowFullPlayer(true);
                  setShowQueueDrawer(true);
                }}
                className="w-8 h-8 rounded-full text-slate-400 hover:text-white hover:bg-slate-800/80 flex items-center justify-center transition-all"
                title="View Queue"
              >
                <ListMusic size={17} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          EXPANDABLE FULL PLAYER MODAL
          Large Artwork / Video stream, Scrubber, Shuffle, Repeat, Volume & Queue
          ========================================================================= */}
      {showFullPlayer && (
        <div className="fixed inset-0 z-50 bg-[#060913]/98 backdrop-blur-2xl flex flex-col justify-between p-4 md:p-8 animate-fade-in select-none">
          {/* Top Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-900 shrink-0">
            <button
              type="button"
              onClick={() => setShowFullPlayer(false)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition-all"
              title="Minimize Player"
            >
              <ChevronDown size={22} />
            </button>

            <div className="text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center justify-center gap-1">
                <Radio size={10} className={playerState.isPlaying ? 'animate-pulse' : ''} />
                Now Playing
              </span>
              <p className="text-xs text-slate-400 truncate max-w-[200px] sm:max-w-md">
                {currentTrack.album || currentTrack.artist}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveTrackMenu(currentTrack)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition-all"
              title="More options"
            >
              <MoreVertical size={20} />
            </button>
          </div>

          {/* Center: Artwork OR Video Host */}
          <div className="flex-1 my-4 flex items-center justify-center relative min-h-0">
            {showVideo ? (
              <div className="w-full max-w-2xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-cyan-500/20 relative flex items-center justify-center">
                <div
                  ref={fullPlayerVideoRef}
                  className="w-full h-full flex items-center justify-center bg-black"
                />
              </div>
            ) : (
              <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 bg-slate-900 group">
                <img
                  src={currentTrack.thumbnail}
                  alt={currentTrack.title}
                  className={`w-full h-full object-cover transition-transform duration-500 ${
                    playerState.isPlaying ? 'scale-105' : ''
                  }`}
                />
                {/* Visualizer pulses on artwork */}
                {playerState.isPlaying && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-center p-4 gap-1 pointer-events-none">
                    <span className="w-1.5 h-6 bg-cyan-400 rounded-full animate-[bounce_1s_infinite_100ms]" />
                    <span className="w-1.5 h-10 bg-cyan-400 rounded-full animate-[bounce_1s_infinite_300ms]" />
                    <span className="w-1.5 h-4 bg-cyan-400 rounded-full animate-[bounce_1s_infinite_200ms]" />
                    <span className="w-1.5 h-8 bg-cyan-400 rounded-full animate-[bounce_1s_infinite_400ms]" />
                  </div>
                )}
              </div>
            )}

            {/* Video Toggle & Fullscreen Toggle Floating Pills */}
            <div className="absolute top-2 right-4 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowVideo(!showVideo)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-all backdrop-blur-md ${
                  showVideo
                    ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300'
                    : 'bg-black/60 border-white/10 text-slate-300 hover:text-white'
                }`}
                title="Toggle Video / Audio Mode"
              >
                {showVideo ? <TvMinimal size={13} /> : <Tv size={13} />}
                <span>{showVideo ? 'Audio' : 'Video'}</span>
              </button>
            </div>
          </div>

          {/* Bottom Deck: Track Info, Scrubber, Controls, Volume */}
          <div className="w-full max-w-xl mx-auto space-y-4 shrink-0">
            {/* Title, Artist & Heart */}
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-white truncate">
                  {currentTrack.title}
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 truncate">
                  {currentTrack.artist}
                </p>
              </div>

              <button
                type="button"
                onClick={(e) => handleToggleLike(currentTrack, e)}
                className={`p-2 rounded-full transition-all ${
                  musicService.isLiked(currentTrack.id)
                    ? 'text-rose-500'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Heart
                  size={24}
                  className={musicService.isLiked(currentTrack.id) ? 'fill-rose-500' : ''}
                />
              </button>
            </div>

            {/* Scrubbable Timeline */}
            <div className="space-y-1.5">
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
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full relative"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                <span>{formatSecs(playerState.currentTime)}</span>
                <span>{formatSecs(playerState.duration || 289)}</span>
              </div>
            </div>

            {/* Controls: Shuffle, Previous, Play/Pause, Next, Repeat */}
            <div className="flex items-center justify-between px-2">
              {/* Shuffle toggle */}
              <button
                type="button"
                onClick={() => musicService.toggleShuffle()}
                className={`p-2 rounded-full transition-all ${
                  playerState.isShuffle ? 'text-cyan-400 bg-cyan-950/40' : 'text-slate-500 hover:text-slate-300'
                }`}
                title={`Shuffle: ${playerState.isShuffle ? 'On' : 'Off'}`}
              >
                <Shuffle size={18} />
              </button>

              {/* Previous */}
              <button
                type="button"
                onClick={() => musicService.previous()}
                className="p-2.5 rounded-full text-slate-200 hover:text-white hover:bg-slate-900 active:scale-95 transition-all"
                title="Previous"
              >
                <SkipBack size={22} />
              </button>

              {/* Large Play/Pause */}
              <button
                type="button"
                onClick={() => musicService.togglePlay()}
                className="w-14 h-14 rounded-full bg-cyan-400 hover:bg-cyan-300 text-slate-950 flex items-center justify-center font-bold shadow-xl shadow-cyan-400/30 active:scale-95 transition-all"
                title={playerState.isPlaying ? 'Pause' : 'Play'}
              >
                {playerState.isPlaying ? (
                  <Pause size={26} className="fill-slate-950" />
                ) : (
                  <Play size={26} className="fill-slate-950 ml-1" />
                )}
              </button>

              {/* Next */}
              <button
                type="button"
                onClick={() => musicService.next()}
                className="p-2.5 rounded-full text-slate-200 hover:text-white hover:bg-slate-900 active:scale-95 transition-all"
                title="Next"
              >
                <SkipForward size={22} />
              </button>

              {/* Repeat mode */}
              <button
                type="button"
                onClick={() => musicService.toggleRepeat()}
                className={`p-2 rounded-full transition-all ${
                  playerState.repeatMode !== 'off'
                    ? 'text-cyan-400 bg-cyan-950/40'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
                title={`Repeat: ${playerState.repeatMode}`}
              >
                {playerState.repeatMode === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
              </button>
            </div>

            {/* Volume & Queue Drawer Toggle */}
            <div className="flex items-center justify-between gap-4 pt-1">
              {/* Volume Slider */}
              <div className="flex items-center gap-2 max-w-[140px] w-full">
                {playerState.volume === 0 ? (
                  <VolumeX
                    size={16}
                    className="text-slate-500 cursor-pointer"
                    onClick={() => musicService.setVolume(70)}
                  />
                ) : (
                  <Volume2
                    size={16}
                    className="text-slate-400 cursor-pointer"
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

              {/* Toggle Queue Drawer */}
              <button
                type="button"
                onClick={() => setShowQueueDrawer(!showQueueDrawer)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-all ${
                  showQueueDrawer
                    ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <ListMusic size={14} />
                <span>Queue ({playerState.queue.length})</span>
              </button>
            </div>

            {/* Collapsible Queue View inside Full Player */}
            {showQueueDrawer && (
              <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 max-h-48 overflow-y-auto no-scrollbar space-y-1.5 animate-fade-in">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-xs text-slate-400">
                  <span>Up Next</span>
                  <button
                    type="button"
                    onClick={() => musicService.clearQueue()}
                    className="text-slate-500 hover:text-red-400 transition-colors"
                  >
                    Clear
                  </button>
                </div>
                {playerState.queue.map((t, idx) => (
                  <div
                    key={`${t.id}_${idx}`}
                    onClick={() => musicService.play(t)}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/60 cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <img src={t.thumbnail} alt={t.title} className="w-7 h-7 rounded-lg object-cover" />
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate">{t.title}</p>
                        <p className="text-[10px] text-slate-400 truncate">{t.artist}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">{t.duration || '3:30'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          CREATE PLAYLIST MODAL
          ========================================================================= */}
      {showCreatePlaylistModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#0D1527] border border-cyan-500/30 p-6 shadow-2xl animate-fade-in">
            <h3 className="text-base font-bold text-white mb-1">Create Playlist</h3>
            <p className="text-xs text-slate-400 mb-4">Build your personal Life AI mix</p>

            <form onSubmit={handleCreatePlaylistSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400 uppercase font-semibold block mb-1">
                  Playlist Name
                </label>
                <input
                  type="text"
                  required
                  value={newPlaylistTitle}
                  onChange={(e) => setNewPlaylistTitle(e.target.value)}
                  placeholder="e.g. Late Night Vibes"
                  className="w-full bg-[#080E1A] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 uppercase font-semibold block mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={newPlaylistDesc}
                  onChange={(e) => setNewPlaylistDesc(e.target.value)}
                  placeholder="e.g. Chill acoustic and lo-fi beats"
                  className="w-full bg-[#080E1A] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreatePlaylistModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          ADD TO PLAYLIST MODAL
          ========================================================================= */}
      {showAddToPlaylistModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#0D1527] border border-slate-800 p-5 shadow-2xl animate-fade-in">
            <h3 className="text-base font-bold text-white mb-1">Add to Playlist</h3>
            <p className="text-xs text-slate-400 mb-4 truncate">"{showAddToPlaylistModal.title}"</p>

            <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar mb-4">
              {playerState.playlists.map((pl) => (
                <div
                  key={pl.id}
                  onClick={() => handleAddTrackToPlaylist(pl.id, showAddToPlaylistModal)}
                  className="p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-800 cursor-pointer flex items-center justify-between text-xs"
                >
                  <span className="font-semibold text-white">{pl.title}</span>
                  <span className="text-[10px] text-slate-500">{pl.tracks.length} songs</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowAddToPlaylistModal(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          TRACK 3-DOT ACTION MENU MODAL
          ========================================================================= */}
      {activeTrackMenu && (
        <div
          onClick={() => setActiveTrackMenu(null)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[#0D1527] border border-cyan-500/20 p-5 shadow-2xl animate-fade-in space-y-3"
          >
            {/* Header info */}
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <img
                src={activeTrackMenu.thumbnail}
                alt={activeTrackMenu.title}
                className="w-12 h-12 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <h4 className="text-xs sm:text-sm font-bold text-white truncate">{activeTrackMenu.title}</h4>
                <p className="text-[11px] text-slate-400 truncate">{activeTrackMenu.artist}</p>
              </div>
            </div>

            {/* Menu options */}
            <div className="space-y-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  handlePlayTrack(activeTrackMenu);
                  setActiveTrackMenu(null);
                }}
                className="w-full p-2.5 rounded-xl hover:bg-slate-800 flex items-center gap-3 text-slate-200 hover:text-white"
              >
                <Play size={16} className="text-cyan-400" />
                <span>Play Now</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  musicService.addToQueue(activeTrackMenu);
                  showToast(`Added to queue`);
                  setActiveTrackMenu(null);
                }}
                className="w-full p-2.5 rounded-xl hover:bg-slate-800 flex items-center gap-3 text-slate-200 hover:text-white"
              >
                <ListPlus size={16} className="text-cyan-400" />
                <span>Add to Queue</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleToggleLike(activeTrackMenu);
                  setActiveTrackMenu(null);
                }}
                className="w-full p-2.5 rounded-xl hover:bg-slate-800 flex items-center gap-3 text-slate-200 hover:text-white"
              >
                <Heart size={16} className={musicService.isLiked(activeTrackMenu.id) ? 'fill-rose-500 text-rose-500' : 'text-slate-400'} />
                <span>{musicService.isLiked(activeTrackMenu.id) ? 'Unlike Track' : 'Like Track'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const tr = activeTrackMenu;
                  setActiveTrackMenu(null);
                  setShowAddToPlaylistModal(tr);
                }}
                className="w-full p-2.5 rounded-xl hover:bg-slate-800 flex items-center gap-3 text-slate-200 hover:text-white"
              >
                <Plus size={16} className="text-cyan-400" />
                <span>Add to Playlist...</span>
              </button>

              {activeTrackMenu.videoId && (
                <a
                  href={`https://www.youtube.com/watch?v=${activeTrackMenu.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full p-2.5 rounded-xl hover:bg-slate-800 flex items-center gap-3 text-slate-200 hover:text-white"
                >
                  <ExternalLink size={16} className="text-red-400" />
                  <span>Watch on YouTube</span>
                </a>
              )}
            </div>

            <button
              type="button"
              onClick={() => setActiveTrackMenu(null)}
              className="w-full py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 mt-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
