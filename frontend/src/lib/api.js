import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const TOKEN_KEY = "tasbih_session_token";

export const setStoredToken = (t) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (_) {}
};
export const getStoredToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch (_) { return null; }
};

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

// Attach Authorization header from localStorage as a fallback when cookies fail
// (some mobile browsers strip httpOnly/samesite=none cookies in webview contexts).
api.interceptors.request.use((config) => {
  const t = getStoredToken();
  if (t) {
    config.headers = config.headers || {};
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${t}`;
    }
  }
  return config;
});
