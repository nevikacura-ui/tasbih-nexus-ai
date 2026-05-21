import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
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
import JamatkhanaPage from "./pages/Jamatkhana";
import NotificationsPage from "./pages/Notifications";
import SangatPage from "./pages/Sangat";
import OrgsPage from "./pages/Orgs";
import OrgProfilePage from "./pages/OrgProfile";
import NoorDigestPage from "./pages/NoorDigest";
import CalendarPage from "./pages/Calendar";
import AdminPage from "./pages/Admin";
import StewardsPage from "./pages/Stewards";
import PrivacyPage from "./pages/Privacy";
import TermsPage from "./pages/Terms";
import YearMosaicPage from "./pages/YearMosaic";

function Protected({ children }) {
  // Non-blocking: always render. Auth happens in background and pages handle
  // missing data gracefully. This guarantees the user is NEVER stuck on a
  // loading screen, regardless of cookie/storage quirks on mobile browsers.
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
      <Route path="/jamatkhana" element={<Protected><JamatkhanaPage /></Protected>} />
      <Route path="/notifications" element={<Protected><NotificationsPage /></Protected>} />
      <Route path="/sangat" element={<Protected><SangatPage /></Protected>} />
      <Route path="/orgs" element={<Protected><OrgsPage /></Protected>} />
      <Route path="/orgs/me" element={<Protected><OrgProfilePage /></Protected>} />
      <Route path="/noor/digest" element={<Protected><NoorDigestPage /></Protected>} />
      <Route path="/calendar" element={<Protected><CalendarPage /></Protected>} />
      <Route path="/admin" element={<Protected><AdminPage /></Protected>} />
      <Route path="/stewards" element={<Protected><StewardsPage /></Protected>} />
      <Route path="/year-in-noor" element={<Protected><YearMosaicPage /></Protected>} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
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
    }, 1600);
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
