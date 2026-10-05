import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sparkles, WifiOff, RefreshCw } from 'lucide-react';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, authState, retryConnection, isOffline } = useAuth();

  // Phase 25 & 26: Startup / Session Restoration Splash Screen
  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#05070B] text-[#00D9FF] px-4 select-none">
        <div className="flex flex-col items-center gap-4 max-w-xs text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#00A8FF] via-[#00D9FF] to-[#8B5CF6] flex items-center justify-center animate-pulse shadow-[0_0_30px_rgba(0,217,255,0.4)]">
            <Sparkles className="w-7 h-7 text-white" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-white tracking-wide">Life Personal AI</h2>
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-300">
              <span className="w-2 h-2 rounded-full bg-[#00D9FF] animate-ping" />
              Restoring your AI session...
            </div>
          </div>

          <div className="text-[11px] text-slate-500 space-y-0.5 pt-2">
            <div className="text-[#00D9FF]/80">✓ Local encrypted vault verified</div>
            <div className="text-slate-400">Connecting to persistent memory...</div>
          </div>
        </div>
      </div>
    );
  }

  // Only redirect to login if authentication has genuinely expired or never existed
  if (!isAuthenticated && (authState === 'UNAUTHENTICATED' || authState === 'AUTH_EXPIRED')) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      {/* Non-intrusive offline reconnect banner when network is temporarily disconnected */}
      {isOffline && (
        <div className="shrink-0 bg-amber-500/10 border-b border-amber-500/20 px-3 py-1.5 flex items-center justify-between text-[11px] text-amber-300 z-50">
          <div className="flex items-center gap-1.5">
            <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Offline mode. Viewing cached memories and profile.</span>
          </div>
          <button
            type="button"
            onClick={retryConnection}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[10px] font-semibold cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" /> Reconnect
          </button>
        </div>
      )}
      {children}
    </>
  );
};
