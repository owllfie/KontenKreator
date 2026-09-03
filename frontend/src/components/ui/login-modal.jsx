import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { X, Lock, User, LogIn, UserPlus, Mail, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { GoogleLoginButton } from "../google-login-button";
import { Recaptcha } from "../recaptcha";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export const LoginModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recaptchaToken, setRecaptchaToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const recaptchaKeyRef = useRef(0);

  const bumpRecaptcha = () => {
    recaptchaKeyRef.current += 1;
    setRecaptchaToken("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!recaptchaToken) {
      setError("Please complete the reCAPTCHA verification.");
      return;
    }

    setLoading(true);
    try {
      const endpoint = isSignUp ? "/api/auth/register" : "/api/auth/login";
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isSignUp
            ? { username, email, password, recaptchaToken }
            : { username, password, recaptchaToken }
        ),
      });

      const json = await res.json();

      if (!res.ok || json.status !== "ok" || !json.data) {
        throw new Error(json.message || "Request failed");
      }

      login({
        id_users: json.data.user.id_users,
        username: json.data.user.username,
        email: json.data.user.email,
        id_role: json.data.user.id_role,
        token: json.data.token,
      });

      onClose();
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Something went wrong");
      bumpRecaptcha();
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError(null);
    setRecaptchaToken("");
    bumpRecaptcha();
  };

  if (!isOpen) return null;

  const inputClass =
    "w-full rounded-xl border border-border bg-background/50 pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 transition-all";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-2xl text-card-foreground"
        >
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex flex-col items-center text-center mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-500 mb-3 border border-red-500/20">
              {isSignUp ? <UserPlus className="h-6 w-6" /> : <LogIn className="h-6 w-6" />}
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              {isSignUp ? "Create an Account" : "Welcome Back"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {isSignUp ? "Sign up to manage your creator agency" : "Sign in to the Content Creator Agency System"}
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-500"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  required
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex justify-center py-1">
              <Recaptcha
                key={recaptchaKeyRef.current}
                onChange={(token) => setRecaptchaToken(token)}
                onExpire={() => setRecaptchaToken("")}
              />
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-red-500 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-75 cursor-pointer mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading
                ? "Please wait..."
                : isSignUp
                  ? "Sign Up"
                  : "Sign In"}
            </motion.button>
          </form>

          <div className="mt-4 text-center text-sm">
            <span className="text-muted-foreground">
              {isSignUp ? "Already have an account? " : "Don't have an account? "}
            </span>
            <button
              type="button"
              onClick={toggleMode}
              className="font-semibold text-red-500 hover:underline cursor-pointer"
            >
              {isSignUp ? "Sign in" : "Sign up"}
            </button>
          </div>

          <div className="relative my-4 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <span className="relative bg-card px-3 text-xs uppercase text-muted-foreground">
              Or continue with
            </span>
          </div>

          <GoogleLoginButton isSignUp={isSignUp} />
        </motion.div>
      </div>
    </AnimatePresence>
  );
};