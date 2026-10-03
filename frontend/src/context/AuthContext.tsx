import React, { createContext, useContext, useState, useEffect } from 'react';
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('jeet_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const currentUser = await api.getMe();
        setUser(currentUser);
      } catch (err) {
        // Fallback demo user for local fast run
        setUser({
          id: 'demo-user',
          email: 'user@jeet.ai',
          username: 'jeet_user',
          full_name: 'Vikash Yadav',
          is_active: true,
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
    localStorage.setItem('jeet_token', res.access_token);
    setToken(res.access_token);
    const currentUser = await api.getMe();
    setUser(currentUser);
  };

  const register = async (data: { email: string; username: string; password: string; full_name?: string }) => {
    const res = await api.register(data);
    localStorage.setItem('jeet_token', res.access_token);
    setToken(res.access_token);
    const currentUser = await api.getMe();
    setUser(currentUser);
  };

  const logout = () => {
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
        logout
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
