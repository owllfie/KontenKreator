import React, { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const error = searchParams.get("error");
    const token = searchParams.get("token");

    if (error) {
      navigate("/?error=" + encodeURIComponent(error), { replace: true });
      return;
    }

    if (!token) {
      navigate("/?error=missing_token", { replace: true });
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();

        if (!res.ok || json.status !== "ok") {
          throw new Error(json.message || "Failed to fetch user");
        }

        const u = json.data;
        login({
          id_users: u.id_users,
          username: u.username,
          email: u.email,
          id_role: u.id_role,
          token,
        });
        navigate("/dashboard", { replace: true });
      } catch (e) {
        navigate("/?error=" + encodeURIComponent(e.message), {
          replace: true,
        });
      }
    })();
  }, [searchParams, navigate, login]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
        <p className="text-sm text-muted-foreground">Signing you in...</p>
      </div>
    </div>
  );
};