import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, SkipForward, X, Music, Volume2 } from 'lucide-react';
import { musicService, PlayerState } from '../services/musicService';

export const NowPlayingBar: React.FC = () => {
  const [playerState, setPlayerState] = useState<PlayerState>(musicService.getState());
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = musicService.addListener((state) => {
      setPlayerState(state);
      if (state.currentTrack) {
        setIsVisible(true);
      }
    });
    return unsubscribe;
  }, []);

  const track = playerState.currentTrack;
  if (!track || !isVisible) {
    return null;
  }

  const formatSecs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = playerState.duration > 0
    ? Math.min(100, (playerState.currentTime / playerState.duration) * 100)
    : 0;

  return (
    <div className="fixed bottom-[60px] md:bottom-3 left-2 right-2 md:left-64 md:right-6 z-40 bg-[#0F172A]/95 border border-[#38BDF8]/30 backdrop-blur-xl rounded-2xl shadow-2xl p-2.5 transition-all select-none">
      {/* Top micro progress bar */}
      <div className="absolute top-0 left-3 right-3 h-[2px] bg-slate-700/60 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        {/* Track Info (clickable to open full Music Page) */}
        <div
          onClick={() => navigate('/music')}
          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer group"
        >
          <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-slate-800 border border-slate-700/70">
            {track.thumbnail ? (
              <img
                src={track.thumbnail}
                alt={track.title}
                className={`w-full h-full object-cover transition-transform group-hover:scale-105 ${
                  playerState.isPlaying ? 'animate-pulse' : ''
                }`}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-cyan-400">
                <Music size={20} />
              </div>
            )}
            {playerState.isPlaying && (
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center gap-0.5">
                <span className="w-0.5 h-3 bg-cyan-400 animate-[bounce_1s_infinite_100ms]" />
                <span className="w-0.5 h-4 bg-cyan-400 animate-[bounce_1s_infinite_300ms]" />
                <span className="w-0.5 h-2 bg-cyan-400 animate-[bounce_1s_infinite_200ms]" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="text-xs md:text-sm font-semibold text-white truncate group-hover:text-cyan-400 transition-colors">
              {track.title}
            </h4>
            <p className="text-[11px] text-slate-400 truncate">
              {track.artist}
            </p>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
            {formatSecs(playerState.currentTime)} / {formatSecs(playerState.duration)}
          </span>

          <button
            onClick={() => musicService.togglePlay()}
            className="w-9 h-9 rounded-full bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-cyan-500/25 transition-all"
            title={playerState.isPlaying ? 'Pause' : 'Play'}
          >
            {playerState.isPlaying ? <Pause size={17} /> : <Play size={17} className="ml-0.5" />}
          </button>

          <button
            onClick={() => musicService.next()}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 flex items-center justify-center border border-slate-700 transition-all"
            title="Next Track"
          >
            <SkipForward size={15} />
          </button>

          <button
            onClick={() => {
              musicService.pause();
              setIsVisible(false);
            }}
            className="w-7 h-7 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-all ml-1"
            title="Close Player Bar"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
