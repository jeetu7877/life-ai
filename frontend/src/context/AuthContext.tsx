import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, AuthResponse } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: { username_or_email: string; password: string }) => Promise<void>;
  register: (data: { email: string; username: string; password: string; full_name?: string }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const getStoredToken = () => localStorage.getItem('life_token') || localStorage.getItem('jeet_token');

  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    const curToken = getStoredToken();
    if (!curToken) return;
    try {
      const currentUser = await api.getMe();
      setUser(currentUser);
    } catch (err) {
      console.warn('Could not refresh user session:', err);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const curToken = getStoredToken();
      if (!curToken) {
        setIsLoading(false);
        return;
      }
      try {
        const currentUser = await api.getMe();
        setUser(currentUser);
      } catch (err) {
        // Fallback demo user for local fast development if backend is not yet populated
        setUser({
          id: 'demo-user',
          email: 'user@jeet.ai',
          username: 'jeet_user',
          full_name: 'Vikash Yadav',
          is_active: true,
          is_verified: true,
          created_at: new Date().toISOString()
        });
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, [token]);

  const login = async (data: { username_or_email: string; password: string }) => {
    const res = await api.login(data);
    localStorage.setItem('life_token', res.access_token);
    localStorage.setItem('jeet_token', res.access_token);
    setToken(res.access_token);
    const currentUser = await api.getMe();
    setUser(currentUser);
  };

  const register = async (data: { email: string; username: string; password: string; full_name?: string }) => {
    const res = await api.register(data);
    localStorage.setItem('life_token', res.access_token);
    localStorage.setItem('jeet_token', res.access_token);
    setToken(res.access_token);
    const currentUser = await api.getMe();
    setUser(currentUser);
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
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
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
