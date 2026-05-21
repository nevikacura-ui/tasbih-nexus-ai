import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import SplashScreen from "./components/SplashScreen";
import ReminderToaster from "./components/ReminderToaster";
import AuthCallback from "./pages/AuthCallback";
import LoginPage from "./pages/Login";
import OnboardingPage from "./pages/Onboarding";
import HomePage from "./pages/Home";
import NoorPage from "./pages/Noor";
import TasbihPage from "./pages/Tasbih";
import JournalPage from "./pages/Journal";
import CommunitiesPage from "./pages/Communities";
import CommunityChatPage from "./pages/CommunityChat";
import EventsPage from "./pages/Events";
import ProfilePage from "./pages/Profile";
import InvitesPage from "./pages/Invites";
import QuranPage, { RamadanPage } from "./pages/Quran";
import RemindersPage from "./pages/Reminders";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="auth-loading">
        <div className="h-10 w-10 rounded-full bg-gold-gradient animate-breathe shadow-glow noor-ring" />
      </div>
    );
  }
  return children;
}

function Router() {
  const loc = useLocation();
  if (loc.hash?.includes("session_id=")) return <AuthCallback />;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboarding" element={<Protected><OnboardingPage /></Protected>} />
      <Route path="/" element={<Protected><HomePage /></Protected>} />
      <Route path="/noor" element={<Protected><NoorPage /></Protected>} />
      <Route path="/tasbih" element={<Protected><TasbihPage /></Protected>} />
      <Route path="/journal" element={<Protected><JournalPage /></Protected>} />
      <Route path="/quran" element={<Protected><QuranPage /></Protected>} />
      <Route path="/ramadan" element={<Protected><RamadanPage /></Protected>} />
      <Route path="/reminders" element={<Protected><RemindersPage /></Protected>} />
      <Route path="/circles" element={<Protected><CommunitiesPage /></Protected>} />
      <Route path="/circles/:id/chat" element={<Protected><CommunityChatPage /></Protected>} />
      <Route path="/events" element={<Protected><EventsPage /></Protected>} />
      <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />
      <Route path="/invites" element={<Protected><InvitesPage /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(() => {
    try { return sessionStorage.getItem("tasbih_splash_shown") !== "1"; }
    catch { return true; }
  });
  useEffect(() => {
    if (!showSplash) return;
    const t = setTimeout(() => {
      try { sessionStorage.setItem("tasbih_splash_shown", "1"); } catch {}
      setShowSplash(false);
    }, 2400);
    return () => clearTimeout(t);
  }, [showSplash]);

  return (
    <AuthProvider>
      {showSplash && <SplashScreen />}
      <ReminderToaster />
      <Router />
    </AuthProvider>
  );
}
