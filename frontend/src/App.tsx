import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { VoiceProvider } from './context/VoiceContext';
import { ToastProvider } from './components/ui/Toast';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { ProtectedRoute } from './components/ProtectedRoute';

import { HomeVoicePage } from './pages/HomeVoicePage';
import { ChatPage } from './pages/ChatPage';
import { GoalsPage } from './pages/GoalsPage';
import { StudyPage } from './pages/StudyPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { MemoryPage } from './pages/MemoryPage';
import { TimelinePage } from './pages/TimelinePage';
import { DocumentsPage } from './pages/DocumentsPage';
import { ProfilePage } from './pages/ProfilePage';
import { VaultPage } from './pages/VaultPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuthPage } from './pages/AuthPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { LifeMapPage } from './pages/LifeMapPage';
import { WhatIfPage } from './pages/WhatIfPage';
import { JournalPage } from './pages/JournalPage';
import { MobileBottomNav } from './components/MobileBottomNav';

const AppShell: React.FC = () => {
  const location = useLocation();
  const isAuthRoute = ['/login', '/register', '/auth', '/verify-email'].includes(location.pathname);

  // Dedicated full-viewport layout for Auth / Registration / OTP screens:
  // Zero top navbar clipping, zero fixed-height issues, fully scrollable and responsive.
  if (isAuthRoute) {
    return (
      <div className="min-h-[100dvh] w-full bg-[#05070B] text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] overflow-x-hidden">
        <Routes>
          <Route path="/login" element={<AuthPage initialMode="login" />} />
          <Route path="/register" element={<AuthPage initialMode="register" />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    );
  }

  // Main Authenticated Application Layout (Full Desktop Width, Virtual Companion Hero)
  return (
    <div className="h-[100dvh] max-h-screen bg-[#05070B] text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] overflow-hidden">
      <Navbar />
      <div className="flex-1 flex overflow-hidden min-h-0">
        <Sidebar />
        <main className="flex-1 flex flex-col min-h-0 overflow-y-auto relative">
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <HomeVoicePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <ChatPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/life-map"
              element={
                <ProtectedRoute>
                  <LifeMapPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/what-if"
              element={
                <ProtectedRoute>
                  <WhatIfPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/journal"
              element={
                <ProtectedRoute>
                  <JournalPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/goals"
              element={
                <ProtectedRoute>
                  <GoalsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/study"
              element={
                <ProtectedRoute>
                  <StudyPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <AnalyticsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/memories"
              element={
                <ProtectedRoute>
                  <MemoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/timeline"
              element={
                <ProtectedRoute>
                  <TimelinePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/documents"
              element={
                <ProtectedRoute>
                  <DocumentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/vault"
              element={
                <ProtectedRoute>
                  <VaultPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />

            {/* Default fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <VoiceProvider>
            <AppShell />
          </VoiceProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
