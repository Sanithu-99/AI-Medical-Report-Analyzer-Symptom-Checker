import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api, { clearSession, ensureDeviceFingerprint, getRefreshToken, setSessionTokens } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | ready

  const loadUser = useCallback(async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (!token) {
      setUser(null);
      setStatus("ready");
      return;
    }

    try {
      setStatus("loading");
      const response = await api.get("/api/auth/me");
      setUser(response.data);
      setStatus("ready");
    } catch (error) {
      console.warn("Failed to load user profile", error);
      clearSession();
      setUser(null);
      setStatus("ready");
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(
    async (tokenPayload) => {
      setSessionTokens(tokenPayload);
      await loadUser();
    },
    [loadUser]
  );

  const logout = useCallback(async () => {
    try {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        await api.post("/api/auth/logout", { refresh_token: refreshToken, device_fingerprint: ensureDeviceFingerprint() });
      }
    } catch (error) {
      console.warn("Failed to revoke session", error);
    } finally {
      clearSession();
      setUser(null);
      setStatus("ready");
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: Boolean(user),
      plan: user?.plan ?? "individual",
      role: user?.role ?? "user",
      login,
      logout,
      refresh: loadUser,
    }),
    [user, status, login, logout, loadUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
