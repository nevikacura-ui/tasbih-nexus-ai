import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { api } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const bootstrapping = useRef(false);

  const checkAuth = useCallback(async () => {
    try {
      const r = await api.get("/auth/me");
      setUser(r.data);
      return r.data;
    } catch (_) {
      setUser(null);
      return null;
    }
  }, []);

  const ensureGuest = useCallback(async () => {
    if (bootstrapping.current) return null;
    bootstrapping.current = true;
    try {
      const r = await api.post("/auth/guest");
      setUser(r.data.user);
      return r.data.user;
    } catch (_) {
      return null;
    } finally {
      bootstrapping.current = false;
    }
  }, []);

  useEffect(() => {
    // CRITICAL: skip /me check if returning from OAuth callback — AuthCallback handles it first.
    if (window.location.hash?.includes("session_id=")) {
      setLoading(false);
      return;
    }
    (async () => {
      const existing = await checkAuth();
      // Auto-create a silent guest session if user is not on /login and has no session.
      // This lets visitors skip the login wall while keeping /login reachable for Google sign-in.
      if (!existing && window.location.pathname !== "/login") {
        await ensureGuest();
      }
      setLoading(false);
    })();
  }, [checkAuth, ensureGuest]);

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch (_) {}
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, setUser, loading, checkAuth, ensureGuest, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
