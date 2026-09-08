"use client";

import React, { useState, useEffect } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

function formatTotalSize(size) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

export default function BackupPage() {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [filter, setFilter] = useState("Semua");
  const [term, setTerm] = useState("");
  const [notice, setNotice] = useState(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ total: 0, totalSizeBytes: 0, successCount: 0, latest: null });

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const showNotice = (message, type = "success") =>
    setNotice({ message, type });

  const fetchPage = (targetPage, t, f) => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(targetPage), limit: "10" });
    if (t) p.set("search", t);
    if (f !== "Semua") p.set("type", f);
    fetch(`${API}/api/admin/backup?${p.toString()}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((r) => {
        setRows(r.data || []);
        setTotal(r.total || 0);
        setTotalPages(r.totalPages || 1);
        setSummary(r.summary || { total: 0, totalSizeBytes: 0, successCount: 0, latest: null });
        const safe = Math.min(targetPage, r.totalPages || 1);
        setPage(Math.max(1, safe));
      })
      .catch((e) => {
        console.error("Gagal muat backup", e);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPage(1, "", "Semua");
  }, []);

  const onTerm = (v) => {
    setTerm(v);
    fetchPage(1, v, filter);
  };
  const onFilter = (v) => {
    setFilter(v);
    fetchPage(1, term, v);
  };
  const gotoPage = (t) => fetchPage(t, term, filter);
  const refresh = () => fetchPage(page, term, filter);

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const token = getToken();
      const res = await fetch(`${API}/api/admin/backup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ createdBy: getUsername() }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice(data.message || "Gagal membuat backup", "error");
        return;
      }
      await refresh();
      showNotice(`Backup berhasil dibuat: ${data.fileName}`);
    } catch {
      showNotice("Tidak dapat terhubung ke server", "error");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleDownload = async (b) => {
    try {
      const res = await fetch(`${API}/api/admin/backup/${b.id}/download`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        showNotice("Gagal mengunduh backup", "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = b.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      showNotice("Tidak dapat terhubung ke server", "error");
    }
  };

  const handleRestore = async (b) => {
    if (!window.confirm(`Pulihkan database dari "${b.fileName}"? Data saat ini akan ditimpa.`)) return;
    setBusyId(b.id);
    try {
      const res = await fetch(`${API}/api/admin/backup/${b.id}/restore`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice(data.message || "Gagal memulihkan database", "error");
        return;
      }
      showNotice(data.message || "Database berhasil dipulihkan");
    } catch {
      showNotice("Tidak dapat terhubung ke server", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (b) => {
    if (!window.confirm(`Hapus backup "${b.fileName}"?`)) return;
    setBusyId(b.id);
    try {
      const res = await fetch(`${API}/api/admin/backup/${b.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice(data.message || "Gagal menghapus backup", "error");
        return;
      }
      await refresh();
      showNotice("Backup dihapus");
    } catch {
      showNotice("Tidak dapat terhubung ke server", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {notice && (
        <div
          role="status"
          className={`px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 border ${
            notice.type === "success"
              ? "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30"
              : "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30"
          }`}
        >
          {notice.type === "success" ? (
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          )}
          {notice.message}
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-red-600/25">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold">Backup Database</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 max-w-xl">
                Buat salinan cadangan seluruh data pengguna, tim, proyek, konten, dan aktivitas. Simpan file backup secara manual kapan saja atau unduh/ pulihkan dari riwayat.
              </p>
              <div className="mt-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 text-xs font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Server terhubung
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <button
              onClick={handleBackup}
              disabled={isBackingUp}
              className={`px-5 py-3 rounded-xl font-semibold text-sm transition inline-flex items-center justify-center gap-2 ${
                isBackingUp
                  ? "bg-red-400 text-white cursor-not-allowed"
                  : "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/25"
              }`}
            >
              {isBackingUp ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Membuat backup...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  Buat Backup Sekarang
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Backup Terakhir"
          value={summary.latest ? "Ada" : "Belum ada"}
          change={summary.latest || "-"}
          color="text-red-600"
          icon={<span className="text-xl">🗓️</span>}
        />
        <StatCard
          label="Total Backup"
          value={`${summary.total}`}
          change={`${summary.successCount} berhasil`}
          color="text-violet-600"
          icon={<span className="text-xl">📦</span>}
        />
        <StatCard
          label="Ukuran Total"
          value={formatTotalSize(summary.totalSizeBytes)}
          change={`${summary.total} file`}
          color="text-green-600"
          icon={<span className="text-xl">💾</span>}
        />
        <StatCard
          label="Backup Otomatis"
          value="-"
          change="Belum dijadwalkan"
          color="text-cyan-600"
          icon={<span className="text-xl">🔄</span>}
        />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-bold text-lg">Riwayat Backup</h2>
            <p className="text-sm text-gray-400 dark:text-gray-500">File backup tersimpan di database</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <input
                value={term}
                onChange={(e) => onTerm(e.target.value)}
                placeholder="Cari file, pembuat, status..."
                className="w-56 pl-9 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition"
              />
              <span className="absolute left-2.5 top-2 text-gray-400">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-gray-400">Tampilkan:</div>
              <select
                value={filter}
                onChange={(e) => onFilter(e.target.value)}
                className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option>Semua</option>
                <option>Manual</option>
                <option>Otomatis</option>
              </select>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 text-left text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="px-6 py-3 font-semibold">Nama File</th>
                <th className="px-6 py-3 font-semibold">Tipe</th>
                <th className="px-6 py-3 font-semibold">Ukuran</th>
                <th className="px-6 py-3 font-semibold">Record</th>
                <th className="px-6 py-3 font-semibold">Dibuat Oleh</th>
                <th className="px-6 py-3 font-semibold">Tanggal</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-gray-400 dark:text-gray-500">Memuat backup...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-gray-400 dark:text-gray-500">Belum ada backup. Klik "Buat Backup Sekarang".</td>
                </tr>
              ) : (
                rows.map((b) => (
                  <tr key={b.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                        </span>
                        <span className="font-mono text-xs font-medium">{b.fileName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${b.type === "Manual" ? "bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300" : "bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300"}`}>
                        {b.type}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-gray-600 dark:text-gray-300">{b.size}</td>
                    <td className="px-6 py-3.5 text-gray-600 dark:text-gray-300">{b.records}</td>
                    <td className="px-6 py-3.5 text-gray-600 dark:text-gray-300">{b.user}</td>
                    <td className="px-6 py-3.5 text-gray-600 dark:text-gray-300 text-xs">{b.createdAt}</td>
                    <td className="px-6 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${b.status === "Berhasil" ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300" : "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300"}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDownload(b)}
                          disabled={b.status !== "Berhasil" || busyId === b.id}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-500 dark:text-gray-400 disabled:opacity-40"
                          title="Unduh"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleRestore(b)}
                          disabled={b.status !== "Berhasil" || busyId === b.id}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-500 dark:text-gray-400 disabled:opacity-40"
                          title="Pulihkan"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(b)}
                          disabled={busyId === b.id}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition text-gray-500 dark:text-gray-400 hover:text-red-600 disabled:opacity-40"
                          title="Hapus"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} onChange={gotoPage} />
      </div>
    </div>
  );
}

function StatCard({ label, value, change, icon, color, sub }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm hover:shadow-md transition">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
          {change && <p className={`mt-1 text-xs font-semibold ${color}`}>{change}</p>}
          {sub && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color} bg-opacity-10`}>
          <span className={color}>{icon}</span>
        </div>
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, total, onChange }) {
  if (!totalPages || totalPages <= 1) return null;
  const pages = [];
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  for (let i = start; i <= end; i++) pages.push(i);
  const btnCls = "w-8 h-8 flex items-center justify-center rounded-lg text-sm transition";
  return (
    <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
      <p className="text-sm text-gray-400 dark:text-gray-500">
        Menampilkan <span className="font-semibold text-gray-600 dark:text-gray-300">{total}</span> data · halaman {page} dari {totalPages}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className={`${btnCls} ${page <= 1 ? "text-gray-300 dark:text-gray-600 cursor-not-allowed" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
          aria-label="Halaman sebelumnya"
        >
          ‹
        </button>
        {start > 1 && <span className="px-1 text-gray-400">…</span>}
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={`${btnCls} ${p === page ? "bg-red-600 text-white font-semibold" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
          >
            {p}
          </button>
        ))}
        {end < totalPages && <span className="px-1 text-gray-400">…</span>}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className={`${btnCls} ${page >= totalPages ? "text-gray-300 dark:text-gray-600 cursor-not-allowed" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
          aria-label="Halaman berikutnya"
        >
          ›
        </button>
      </div>
    </div>
  );
}

function getToken() {
  try {
    const raw = localStorage.getItem("creator-agency-auth");
    if (raw) return JSON.parse(raw).token || "";
  } catch {}
  return "";
}

function getUsername() {
  try {
    const raw = localStorage.getItem("creator-agency-auth");
    if (raw) return JSON.parse(raw).username || null;
  } catch {}
  return null;
}
