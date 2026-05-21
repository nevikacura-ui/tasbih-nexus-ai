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
import ModerationPage from "./pages/Moderation";
import MentorsPage from "./pages/Mentors";
import KhidmahPage from "./pages/Khidmah";

function Protected({ children }) {
  const { user, loading, ensureGuest } = useAuth();
  const [retrying, setRetrying] = useState(false);
  const [retryErr, setRetryErr] = useState(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="auth-loading">
        <div className="h-10 w-10 rounded-full bg-gold-gradient animate-breathe shadow-glow noor-ring" />
      </div>
    );
  }

  if (!user) {
    const tryAgain = async () => {
      setRetrying(true);
      setRetryErr(null);
      try {
        const u = await ensureGuest();
        if (!u) setRetryErr("Could not open a session. Please try once more or sign in with Google.");
      } catch (e) {
        setRetryErr(e?.message || "Network error. Try again.");
      } finally {
        setRetrying(false);
      }
    };
    return (
      <div className="min-h-screen flex items-center justify-center px-8" data-testid="auth-stuck">
        <div className="text-center max-w-xs">
          <div className="mx-auto h-12 w-12 rounded-full bg-gold-gradient shadow-glow" />
          <p className="mt-5 font-display text-xl text-deep">A quiet pause</p>
          <p className="mt-2 text-sm text-deep/65">
            We couldn't open your session. Tap below to try again.
          </p>
          {retryErr && (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[11px] text-red-700" data-testid="auth-retry-err">
              {retryErr}
            </p>
          )}
          <button
            data-testid="auth-retry"
            onClick={tryAgain}
            disabled={retrying}
            className="bg-emerald-gradient text-ivory shadow-elegant mt-5 rounded-full px-5 py-2.5 text-sm font-medium tap-scale disabled:opacity-60"
          >
            {retrying ? "Opening…" : "Continue as guest"}
          </button>
          <a
            href="/login"
            className="mt-3 block text-xs text-deep/55"
          >
            Or sign in with Google →
          </a>
        </div>
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
      <Route path="/moderation" element={<Protected><ModerationPage /></Protected>} />
      <Route path="/mentors" element={<Protected><MentorsPage /></Protected>} />
      <Route path="/khidmah" element={<Protected><KhidmahPage /></Protected>} />
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
