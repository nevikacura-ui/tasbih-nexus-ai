import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import SplashScreen from "./components/SplashScreen";
import ReminderToaster from "./components/ReminderToaster";
import InstallAppBanner from "./components/InstallAppBanner";
import LoginRequired from "./components/LoginRequired";
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
import GinanPage from "./pages/Ginan";
import DuaPage from "./pages/Dua";
import FamilyPage from "./pages/Family";

function Protected({ children }) {
  return children;
}

// Show the page only to non-guest users. Guests see a friendly Sign-in CTA.
function MembersOnly({ feature, title, children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-ivory text-deep/40">
        <p className="text-xs uppercase tracking-[0.3em]">Loading…</p>
      </div>
    );
  }
  if (!user || user.status === "guest") {
    return <LoginRequired feature={feature} title={title} />;
  }
  return children;
}

function Router() {
  const loc = useLocation();
  if (loc.hash?.includes("session_id=")) return <AuthCallback />;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />

      {/* ── Open to everyone (guest-friendly) ─────────────────── */}
      <Route path="/" element={<HomePage />} />
      <Route path="/noor" element={<NoorPage />} />
      <Route path="/dua" element={<DuaPage />} />
      <Route path="/ginan" element={<GinanPage />} />
      <Route path="/quran" element={<QuranPage />} />
      <Route path="/ramadan" element={<RamadanPage />} />
      <Route path="/jamatkhana" element={<JamatkhanaPage />} />
      <Route path="/calendar" element={<CalendarPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />

      {/* ── Members only (guests see a Sign-in CTA) ──────────── */}
      <Route path="/circles" element={<MembersOnly feature="circles" title="Sign in to join Circles"><CommunitiesPage /></MembersOnly>} />
      <Route path="/circles/:id/chat" element={<MembersOnly feature="circle chats" title="Sign in to chat"><CommunityChatPage /></MembersOnly>} />
      <Route path="/events" element={<MembersOnly feature="events" title="Sign in to view events"><EventsPage /></MembersOnly>} />
      <Route path="/profile" element={<MembersOnly feature="your profile" title="Sign in to view your profile"><ProfilePage /></MembersOnly>} />
      <Route path="/invites" element={<MembersOnly feature="invites" title="Sign in to invite others"><InvitesPage /></MembersOnly>} />
      <Route path="/journal" element={<MembersOnly feature="your journal" title="Sign in to journal"><JournalPage /></MembersOnly>} />
      <Route path="/tasbih" element={<MembersOnly feature="your tasbih counter" title="Sign in to count your tasbih"><TasbihPage /></MembersOnly>} />
      <Route path="/notifications" element={<MembersOnly feature="notifications"><NotificationsPage /></MembersOnly>} />
      <Route path="/sangat" element={<MembersOnly feature="My Sangat"><SangatPage /></MembersOnly>} />
      <Route path="/mentors" element={<MembersOnly feature="mentorship"><MentorsPage /></MembersOnly>} />
      <Route path="/khidmah" element={<MembersOnly feature="khidmah"><KhidmahPage /></MembersOnly>} />
      <Route path="/orgs" element={<MembersOnly feature="organisations"><OrgsPage /></MembersOnly>} />
      <Route path="/orgs/me" element={<MembersOnly feature="your organisation"><OrgProfilePage /></MembersOnly>} />
      <Route path="/family" element={<MembersOnly feature="Family Corner"><FamilyPage /></MembersOnly>} />
      <Route path="/reminders" element={<MembersOnly feature="reminders"><RemindersPage /></MembersOnly>} />
      <Route path="/moderation" element={<MembersOnly feature="moderation"><ModerationPage /></MembersOnly>} />
      <Route path="/admin" element={<MembersOnly feature="the admin panel"><AdminPage /></MembersOnly>} />
      <Route path="/stewards" element={<MembersOnly feature="stewards"><StewardsPage /></MembersOnly>} />
      <Route path="/year-in-noor" element={<MembersOnly feature="Year in Noor"><YearMosaicPage /></MembersOnly>} />
      <Route path="/noor/digest" element={<MembersOnly feature="your Noor Digest"><NoorDigestPage /></MembersOnly>} />

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
      <InstallAppBanner />
      <Router />
    </AuthProvider>
  );
}
