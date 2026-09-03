"use client";

import React, { useState, useEffect } from "react";
import { Eye, EyeOff, Save, CheckCircle2, AlertCircle } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

function getToken(): string {
  try {
    const raw = localStorage.getItem("creator-agency-auth");
    if (raw) return JSON.parse(raw).token || "";
  } catch {}
  return "";
}

export default function ProfilePage() {
  const [form, setForm] = useState({ username: "", email: "", noTelp: "" });
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API}/api/auth/me`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const json = await res.json();
        if (json?.status === "ok") {
          setForm({
            username: json.data.username || "",
            email: json.data.email || "",
            noTelp: json.data.no_telp || "",
          });
        }
      } catch (e) {
        setMessage({ type: "error", text: "Gagal memuat data profil." });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/api/auth/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ username: form.username, email: form.email, noTelp: form.noTelp }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Gagal menyimpan");
      setMessage({ type: "success", text: "Profil berhasil diperbarui." });
    } catch (e) {
      setMessage({ type: "error", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    setSaving(true);
    setMessage(null);
    if (password.newPassword !== password.confirmPassword) {
      setMessage({ type: "error", text: "Konfirmasi password tidak cocok." });
      setSaving(false);
      return;
    }
    if (password.newPassword && password.newPassword.length < 6) {
      setMessage({ type: "error", text: "Password minimal 6 karakter." });
      setSaving(false);
      return;
    }
    try {
      const res = await fetch(`${API}/api/auth/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          username: form.username,
          email: form.email,
          noTelp: form.noTelp,
          currentPassword: password.currentPassword,
          newPassword: password.newPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Gagal mengubah password");
      setPassword({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setMessage({ type: "success", text: "Password berhasil diubah." });
    } catch (e) {
      setMessage({ type: "error", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="h-6 w-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Profil</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Kelola data akun Anda</p>
      </div>

      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 border ${
            message.type === "success"
              ? "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30"
              : "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30"
          }`}
        >
          {message.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* Informasi pribadi */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="font-semibold">Informasi Pribadi</h2>
        </div>
        <div className="p-6 space-y-4">
          <InputField label="Username" value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
          <InputField label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
          <InputField label="No. Telepon" value={form.noTelp} onChange={(v) => setForm({ ...form, noTelp: v })} placeholder="Opsional" />
          <div className="pt-2">
            <button
              onClick={saveProfile}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> Simpan Perubahan
            </button>
          </div>
        </div>
      </div>

      {/* Ganti password */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="font-semibold">Ganti Password</h2>
        </div>
        <div className="p-6 space-y-4">
          <InputField label="Password Saat Ini" value={password.currentPassword} onChange={(v) => setPassword({ ...password, currentPassword: v })} type="password" />
          <InputField label="Password Baru" value={password.newPassword} onChange={(v) => setPassword({ ...password, newPassword: v })} type="password" />
          <InputField label="Konfirmasi Password Baru" value={password.confirmPassword} onChange={(v) => setPassword({ ...password, confirmPassword: v })} type="password" />
          <div className="pt-2">
            <button
              onClick={changePassword}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> Ubah Password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
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