import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User, AuthResponse } from '../types';
import { api, probeServerHealth } from '../services/api';
import { storage, hydrateStorage } from '../services/storage';

export type AuthState =
  | 'INITIALIZING'
  | 'RESTORING_SESSION'
  | 'AUTHENTICATED'
  | 'UNAUTHENTICATED'
  | 'REFRESHING'
  | 'NETWORK_UNAVAILABLE'
  | 'SERVER_UNAVAILABLE'
  | 'AUTH_EXPIRED';

interface AuthContextType {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  authState: AuthState;
  isAuthenticated: boolean;
  isLoading: boolean;
  isOffline: boolean;
  serverStatus: 'online' | 'cold_start' | 'offline';
  login: (data: { username_or_email: string; password: string }) => Promise<void>;
  register: (data: { email: string; username: string; password: string; full_name?: string }) => Promise<any>;
  verifyOtp: (data: { email: string; otp: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  retryConnection: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => storage.getToken());
  const [refreshToken, setRefreshToken] = useState<string | null>(() => storage.getRefreshToken());
  const [user, setUser] = useState<User | null>(() => storage.getUser());
  const [authState, setAuthState] = useState<AuthState>('INITIALIZING');
  const [serverStatus, setServerStatus] = useState<'online' | 'cold_start' | 'offline'>('online');
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const reconnectTimerRef = useRef<any>(null);

  // Checks and synchronizes user session against server
  const verifyOrRefreshSession = useCallback(async (existingToken: string, existingRefresh: string | null) => {
    try {
      console.log('[AUTH] Verifying user session with backend...');
      const currentUser = await api.getMe();
      setUser(currentUser);
      await storage.setUser(currentUser);
      setAuthState('AUTHENTICATED');
      setIsOffline(false);
      setServerStatus('online');
      console.log('[AUTH] Session confirmed. User:', currentUser.username || currentUser.email);
    } catch (err: any) {
      console.warn('[AUTH] Session verification note:', err?.message || err);

      // Case 1: 401 Unauthorized -> Access token expired
      if (err.response?.status === 401) {
        if (existingRefresh) {
          try {
            console.log('[AUTH] Access token expired. Attempting refresh token exchange...');
            setAuthState('REFRESHING');
            const res = await api.refreshToken(existingRefresh);
            await storage.setToken(res.access_token);
            if (res.refresh_token) {
              await storage.setRefreshToken(res.refresh_token);
              setRefreshToken(res.refresh_token);
            }
            setToken(res.access_token);

            const reloadedUser = await api.getMe();
            setUser(reloadedUser);
            await storage.setUser(reloadedUser);
            setAuthState('AUTHENTICATED');
            setIsOffline(false);
            console.log('[AUTH] Session successfully refreshed with new token.');
            return;
          } catch (refreshErr) {
            console.warn('[AUTH] Refresh token also invalid or revoked. Session expired.', refreshErr);
            setAuthState('AUTH_EXPIRED');
            await storage.clearSession();
            setToken(null);
            setRefreshToken(null);
            setUser(null);
            return;
          }
        } else {
          // No refresh token available, session expired
          console.warn('[AUTH] No refresh token available. Session expired.');
          setAuthState('AUTH_EXPIRED');
          await storage.clearSession();
          setToken(null);
          setRefreshToken(null);
          setUser(null);
          return;
        }
      }

      // Case 2: Network failure, timeout, cold start, 502/503
      // CRITICAL DATA PRESERVATION: NEVER log out user on network/server unreachability!
      console.warn('[AUTH] Network or server unavailable. Preserving local user session.');
      setIsOffline(true);
      setAuthState('SERVER_UNAVAILABLE');

      // Probe health in background with cold-start awareness
      probeServerHealth(undefined, 10000).then((health) => {
        setServerStatus(health.status);
      });
    }
  }, []);

  // App Startup Initialization Loop
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      console.log('[AUTH] App startup: hydrating secure storage...');
      await hydrateStorage();

      const curToken = storage.getToken();
      const curRefresh = storage.getRefreshToken();
      const cachedUser = storage.getUser();

      if (!isMounted) return;

      if (!curToken && !curRefresh) {
        console.log('[AUTH] No stored credentials found. State: UNAUTHENTICATED.');
        setAuthState('UNAUTHENTICATED');
        setUser(null);
        setToken(null);
        setRefreshToken(null);
        return;
      }

      // If cached user exists, immediately present authenticated shell
      if (cachedUser) {
        console.log('[AUTH] Cached user profile restored from storage:', cachedUser.username || cachedUser.email);
        setUser(cachedUser);
        setToken(curToken);
        setRefreshToken(curRefresh);
        setAuthState('AUTHENTICATED');
      } else {
        setAuthState('RESTORING_SESSION');
      }

      // Verify or refresh in background without flashing login
      if (curToken) {
        await verifyOrRefreshSession(curToken, curRefresh);
      } else if (curRefresh) {
        // Only refresh token exists, perform exchange
        try {
          const res = await api.refreshToken(curRefresh);
          await storage.setToken(res.access_token);
          if (res.refresh_token) {
            await storage.setRefreshToken(res.refresh_token);
            setRefreshToken(res.refresh_token);
          }
          setToken(res.access_token);
          const currentUser = await api.getMe();
          setUser(currentUser);
          await storage.setUser(currentUser);
          setAuthState('AUTHENTICATED');
        } catch {
          setAuthState('AUTH_EXPIRED');
          await storage.clearSession();
        }
      }
    };

    init();

    return () => {
      isMounted = false;
      if (reconnectTimerRef.current) clearInterval(reconnectTimerRef.current);
    };
  }, [verifyOrRefreshSession]);

  // Periodic background re-check if temporarily offline
  useEffect(() => {
    if (authState === 'SERVER_UNAVAILABLE' || authState === 'NETWORK_UNAVAILABLE') {
      reconnectTimerRef.current = setInterval(async () => {
        const curToken = storage.getToken();
        const curRefresh = storage.getRefreshToken();
        if (curToken) {
          const health = await probeServerHealth(undefined, 5000);
          if (health.ok) {
            console.log('[AUTH] Server came back online! Re-syncing session...');
            clearInterval(reconnectTimerRef.current);
            await verifyOrRefreshSession(curToken, curRefresh);
          }
        }
      }, 12000);
    } else {
      if (reconnectTimerRef.current) clearInterval(reconnectTimerRef.current);
    }

    return () => {
      if (reconnectTimerRef.current) clearInterval(reconnectTimerRef.current);
    };
  }, [authState, verifyOrRefreshSession]);

  const retryConnection = async () => {
    const curToken = storage.getToken();
    const curRefresh = storage.getRefreshToken();
    if (curToken) {
      await verifyOrRefreshSession(curToken, curRefresh);
    }
  };

  const refreshUser = useCallback(async () => {
    const curToken = storage.getToken();
    const curRefresh = storage.getRefreshToken();
    if (curToken) {
      await verifyOrRefreshSession(curToken, curRefresh);
    }
  }, [verifyOrRefreshSession]);

  const login = async (data: { username_or_email: string; password: string }) => {
    setAuthState('RESTORING_SESSION');
    try {
      const res = await api.login(data);
      await storage.setToken(res.access_token);
      if (res.refresh_token) {
        await storage.setRefreshToken(res.refresh_token);
        setRefreshToken(res.refresh_token);
      }
      setToken(res.access_token);

      const currentUser = await api.getMe();
      setUser(currentUser);
      await storage.setUser(currentUser);
      setAuthState('AUTHENTICATED');
      setIsOffline(false);
      setServerStatus('online');
    } catch (err) {
      setAuthState('UNAUTHENTICATED');
      throw err;
    }
  };

  const register = async (data: { email: string; username: string; password: string; full_name?: string }) => {
    return await api.register(data);
  };

  const verifyOtp = async (data: { email: string; otp: string }) => {
    setAuthState('RESTORING_SESSION');
    try {
      const res = await api.verifyOtp(data);
      await storage.setToken(res.access_token);
      if (res.refresh_token) {
        await storage.setRefreshToken(res.refresh_token);
        setRefreshToken(res.refresh_token);
      }
      setToken(res.access_token);

      const currentUser = await api.getMe();
      setUser(currentUser);
      await storage.setUser(currentUser);
      setAuthState('AUTHENTICATED');
      setIsOffline(false);
      setServerStatus('online');
    } catch (err) {
      setAuthState('UNAUTHENTICATED');
      throw err;
    }
  };

  const logout = async () => {
    console.log('[AUTH] User initiated sign out.');
    await storage.clearSession();
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    setAuthState('UNAUTHENTICATED');
  };

  const isLoading = authState === 'INITIALIZING' || authState === 'RESTORING_SESSION';
  const isAuthenticated =
    (authState === 'AUTHENTICATED' || authState === 'SERVER_UNAVAILABLE' || authState === 'NETWORK_UNAVAILABLE') &&
    !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        refreshToken,
        authState,
        isAuthenticated,
        isLoading,
        isOffline,
        serverStatus,
        login,
        register,
        verifyOtp,
        logout,
        refreshUser,
        retryConnection
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
