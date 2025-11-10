import axios from "axios";

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const FINGERPRINT_KEY = "device_fingerprint";

export const ensureDeviceFingerprint = () => {
  if (typeof window === "undefined") return "server";
  let fingerprint = localStorage.getItem(FINGERPRINT_KEY);
  if (!fingerprint) {
    const entropy = window.crypto?.getRandomValues(new Uint32Array(4)) || [];
    fingerprint = btoa(`${navigator.userAgent}:${Date.now()}:${Array.from(entropy).join("-")}`);
    localStorage.setItem(FINGERPRINT_KEY, fingerprint);
  }
  return fingerprint;
};

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000",
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      typeof window !== "undefined" &&
      localStorage.getItem(REFRESH_TOKEN_KEY)
    ) {
      originalRequest._retry = true;
      refreshPromise =
        refreshPromise ||
        api
          .post("/api/auth/token/refresh", {
            refresh_token: localStorage.getItem(REFRESH_TOKEN_KEY),
            device_fingerprint: ensureDeviceFingerprint(),
          })
          .then((response) => {
            setSessionTokens(response.data);
            refreshPromise = null;
            return response.data.access_token;
          })
          .catch((refreshError) => {
            clearSession();
            refreshPromise = null;
            throw refreshError;
          });

      const newToken = await refreshPromise;
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    }
    throw error;
  }
);

export const setSessionTokens = (tokenPayload) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS_TOKEN_KEY, tokenPayload.access_token);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokenPayload.refresh_token);
  api.defaults.headers.common.Authorization = `Bearer ${tokenPayload.access_token}`;
};

export const clearSession = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
  delete api.defaults.headers.common.Authorization;
};

export const getRefreshToken = () =>
  typeof window !== "undefined" ? localStorage.getItem(REFRESH_TOKEN_KEY) : null;

export default api;
