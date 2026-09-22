"use client";

import React, { useState, useEffect } from "react";
import { Eye, EyeOff, Save, CheckCircle2, AlertCircle } from "lucide-react";
import { AdminModal } from "@/components/ui/admin-modal";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

function getToken() {
  try {
    const raw = localStorage.getItem("creator-agency-auth");
    if (raw) return JSON.parse(raw).token || "";
  } catch {}
  return "";
}

export default function ProfileModal({ open, onClose }) {
  const [form, setForm] = useState({ username: "", namaLengkap: "", email: "", noTelp: "" });
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setMessage(null);
    setPassword({ currentPassword: "", newPassword: "", confirmPassword: "" });
    const load = async () => {
      try {
        const res = await fetch(`${API}/api/auth/me`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const json = await res.json();
        if (!cancelled && json?.status === "ok") {
          setForm({
            username: json.data.username || "",
            namaLengkap: json.data.namaLengkap || "",
            email: json.data.email || "",
            noTelp: json.data.no_telp || "",
          });
        }
      } catch (e) {
        if (!cancelled) setMessage({ type: "error", text: "Failed to load profile data." });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const saveProfile = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/api/auth/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ username: form.username, namaLengkap: form.namaLengkap, email: form.email, noTelp: form.noTelp }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Failed to save");
      setMessage({ type: "success", text: "Profile updated successfully." });
    } catch (e) {
      setMessage({ type: "error", text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    setSaving(true);
    setMessage(null);
    if (password.newPassword !== password.confirmPassword) {
      setMessage({ type: "error", text: "Password confirmation does not match." });
      setSaving(false);
      return;
    }
    if (password.newPassword && password.newPassword.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters." });
      setSaving(false);
      return;
    }
    try {
      const res = await fetch(`${API}/api/auth/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          username: form.username,
          namaLengkap: form.namaLengkap,
          email: form.email,
          noTelp: form.noTelp,
          currentPassword: password.currentPassword,
          newPassword: password.newPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Failed to change password");
      setPassword({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setMessage({ type: "success", text: "Password changed successfully." });
    } catch (e) {
      setMessage({ type: "error", text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    if (!saving) onClose();
  };

  return (
    <AdminModal open={open} onClose={close} title="Profile" wide>
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {message && (
            <div
              className={`px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 border ${
                message.type === "success"
                  ? "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30"
                  : "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30"
              }`}
            >
              {message.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {message.text}
            </div>
          )}

          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800">
              <h2 className="font-semibold">Personal Information</h2>
            </div>
            <div className="p-5 space-y-4">
              <InputField label="Username" value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
              <InputField label="Full Name" value={form.namaLengkap} onChange={(v) => setForm({ ...form, namaLengkap: v })} />
              <InputField label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
              <InputField label="Phone Number" value={form.noTelp} onChange={(v) => setForm({ ...form, noTelp: v })} placeholder="Optional" />
              <div className="pt-1">
                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
                >
                  <Save className="h-4 w-4" /> Save Changes
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800">
              <h2 className="font-semibold">Change Password</h2>
            </div>
            <div className="p-5 space-y-4">
              <InputField label="Current Password" value={password.currentPassword} onChange={(v) => setPassword({ ...password, currentPassword: v })} type="password" />
              <InputField label="New Password" value={password.newPassword} onChange={(v) => setPassword({ ...password, newPassword: v })} type="password" />
              <InputField label="Confirm New Password" value={password.confirmPassword} onChange={(v) => setPassword({ ...password, confirmPassword: v })} type="password" />
              <div className="pt-1">
                <button
                  onClick={changePassword}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
                >
                  <Save className="h-4 w-4" /> Change Password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminModal>
  );
}

function InputField({ label, value, onChange, type = "text", placeholder }) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={isPassword && !show ? "password" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}