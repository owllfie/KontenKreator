"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, Activity, FileText, LogIn, Pencil, Trash2, RotateCcw } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

interface LogRow {
  idLog: number;
  idUser: number;
  aksi: string;
  namaTabel: string;
  idReferensi: number;
  keterangan: string | null;
  oldValues: string | null;
  newValues: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  username: string | null;
}

const aksiIcons: Record<string, typeof Activity> = {
  CREATE: FileText,
  UPDATE: Pencil,
  DELETE: Trash2,
  RESTORE: RotateCcw,
  LOGIN: LogIn,
};

const aksiColors: Record<string, string> = {
  CREATE: "bg-green-500/10 text-green-600 dark:text-green-400",
  UPDATE: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  DELETE: "bg-red-500/10 text-red-600 dark:text-red-400",
  RESTORE: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  LOGIN: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [aksiFilter, setAksiFilter] = useState("");
  const [tabelFilter, setTabelFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "10",
      search,
      aksi: aksiFilter,
      namaTabel: tabelFilter,
    });
    try {
      const res = await fetch(`${API}/api/admin/activity-logs?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      setLogs(json.data?.rows || []);
      setTotal(json.data?.total || 0);
      setTotalPages(json.data?.totalPages || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, search, aksiFilter, tabelFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPage(1);
  }, [search, aksiFilter, tabelFilter]);

  const columns = [
    {
      key: "aksi",
      label: "Action",
      render: (row: LogRow) => {
        const Icon = aksiIcons[row.aksi] || Activity;
        const color = aksiColors[row.aksi] || "bg-gray-500/10 text-gray-600";
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
            <Icon className="h-3 w-3" />
            {row.aksi}
          </span>
        );
      },
    },
    { key: "username", label: "User" },
    { key: "namaTabel", label: "Table" },
    { key: "keterangan", label: "Description" },
    {
      key: "ipAddress",
      label: "IP Address",
      render: (row: LogRow) => (
        <span className="font-mono text-xs">{row.ipAddress || "—"}</span>
      ),
    },
    {
      key: "createdAt",
      label: "Timestamp",
      render: (row: LogRow) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Activity Log</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Track all system activities</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
          />
        </div>
        <select
          value={aksiFilter}
          onChange={(e) => setAksiFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
        >
          <option value="">All Actions</option>
          <option value="CREATE">Create</option>
          <option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option>
          <option value="RESTORE">Restore</option>
          <option value="LOGIN">Login</option>
        </select>
        <select
          value={tabelFilter}
          onChange={(e) => setTabelFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
        >
          <option value="">All Tables</option>
          <option value="users">Users</option>
          <option value="team">Team</option>
          <option value="project">Project</option>
          <option value="content">Content</option>
          <option value="script">Script</option>
          <option value="role">Role</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={logs}
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        loading={loading}
      />
    </div>
  );
}

function getToken(): string {
  try {
    const raw = localStorage.getItem("creator-agency-auth");
    if (raw) return JSON.parse(raw).token || "";
  } catch {}
  return "";
}
