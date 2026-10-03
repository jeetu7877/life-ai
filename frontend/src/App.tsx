import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { VoiceProvider } from './context/VoiceContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { ProtectedRoute } from './components/ProtectedRoute';

import { HomeVoicePage } from './pages/HomeVoicePage';
import { ChatPage } from './pages/ChatPage';
import { MemoryPage } from './pages/MemoryPage';
import { TimelinePage } from './pages/TimelinePage';
import { DocumentsPage } from './pages/DocumentsPage';
import { ProfilePage } from './pages/ProfilePage';
import { VaultPage } from './pages/VaultPage';
import { SettingsPage } from './pages/SettingsPage';
import { AuthPage } from './pages/AuthPage';
import { MobileBottomNav } from './components/MobileBottomNav';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <VoiceProvider>
          <div className="h-[100dvh] max-h-screen bg-[#0a0a0c] text-gray-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] overflow-hidden">
            <Navbar />
            <div className="flex-1 flex overflow-hidden min-h-0">
              <Sidebar />
              <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
                <Routes>
                  <Route path="/" element={<HomeVoicePage />} />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/memories" element={<MemoryPage />} />
                  <Route path="/timeline" element={<TimelinePage />} />
                  <Route path="/documents" element={<DocumentsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/vault" element={<VaultPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </div>
            <MobileBottomNav />
          </div>
        </VoiceProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
