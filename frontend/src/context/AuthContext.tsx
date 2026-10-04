import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, AuthResponse } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: { username_or_email: string; password: string }) => Promise<void>;
  register: (data: { email: string; username: string; password: string; full_name?: string }) => Promise<any>;
  verifyOtp: (data: { email: string; otp: string }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const getStoredToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('life_token') || localStorage.getItem('jeet_token');
  };

  const [token, setToken] = useState<string | null>(getStoredToken());
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    const curToken = getStoredToken();
    if (!curToken) {
      setUser(null);
      return;
    }
    try {
      const currentUser = await api.getMe();
      setUser(currentUser);
    } catch (err: any) {
      console.warn('Could not refresh user session:', err);
      // If 401 Unauthorized, token has expired or is invalid
      if (err.response?.status === 401) {
        localStorage.removeItem('life_token');
        localStorage.removeItem('jeet_token');
        setToken(null);
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      const curToken = getStoredToken();
      if (!curToken) {
        if (isMounted) {
          setToken(null);
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const currentUser = await api.getMe();
        if (isMounted) {
          setUser(currentUser);
          setToken(curToken);
        }
      } catch (err: any) {
        console.warn('Stored token is invalid or backend unreachable:', err);
        // Clear invalid tokens on 401
        if (err.response?.status === 401) {
          localStorage.removeItem('life_token');
          localStorage.removeItem('jeet_token');
          if (isMounted) {
            setToken(null);
            setUser(null);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (data: { username_or_email: string; password: string }) => {
    setIsLoading(true);
    try {
      const res = await api.login(data);
      localStorage.setItem('life_token', res.access_token);
      localStorage.setItem('jeet_token', res.access_token);
      setToken(res.access_token);
      const currentUser = await api.getMe();
      setUser(currentUser);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: { email: string; username: string; password: string; full_name?: string }) => {
    setIsLoading(true);
    try {
      // Register creates a pending unverified account and dispatches 6-digit OTP
      return await api.register(data);
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (data: { email: string; otp: string }) => {
    setIsLoading(true);
    try {
      const res = await api.verifyOtp(data);
      localStorage.setItem('life_token', res.access_token);
      localStorage.setItem('jeet_token', res.access_token);
      setToken(res.access_token);
      const currentUser = await api.getMe();
      setUser(currentUser);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('life_token');
    localStorage.removeItem('jeet_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        register,
        verifyOtp,
        logout,
        refreshUser
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
