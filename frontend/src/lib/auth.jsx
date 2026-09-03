"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

const STORAGE_KEY = "creator-agency-auth";
const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

function readStoredUser() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.token) return parsed;
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return null;
}

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readStoredUser);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const logout = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage unavailable
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const validate = async () => {
      const stored = readStoredUser();
      if (!stored) {
        setUser(null);
        setIsBootstrapping(false);
        return;
      }

      try {
        const res = await fetch(`${API}/api/auth/me`, {
          headers: { Authorization: `Bearer ${stored.token}` },
        });
        if (!res.ok) {
          throw new Error("invalid token");
        }
        const json = await res.json();
        if (cancelled) return;
        if (json?.status === "ok") {
          setUser((prev) => ({
            ...(prev || stored),
            id_users: json.data.id_users,
            username: json.data.username,
            email: json.data.email,
            id_role: json.data.id_role,
          }));
        } else {
          logout();
        }
      } catch {
        if (cancelled) return;
        logout();
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    };

    validate();
    return () => {
      cancelled = true;
    };
  }, [logout]);

  const login = (nextUser) => {
    setUser(nextUser);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
    } catch {
      // storage unavailable
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isBootstrapping,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};