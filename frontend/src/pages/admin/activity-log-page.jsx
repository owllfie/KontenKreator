"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, Activity, FileText, Pencil, Trash2, RotateCcw } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdminNotice, useAdminNotice } from "@/components/ui/admin-notice";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

const ACTION_MAP = {
  insert: "CREATE",
  update: "UPDATE",
  delete: "DELETE",
};

const aksiIcons = {
  CREATE: FileText,
  UPDATE: Pencil,
  DELETE: Trash2,
  RESTORE: RotateCcw,
};

const aksiColors = {
  CREATE: "bg-green-500/10 text-green-600 dark:text-green-400",
  UPDATE: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  DELETE: "bg-red-500/10 text-red-600 dark:text-red-400",
  RESTORE: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

export default function ActivityLogPage({ logFilter }) {
  const lockedAksi = logFilter ? ACTION_MAP[logFilter] || "" : "";
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [aksiFilter, setAksiFilter] = useState(lockedAksi);
  const [tabelFilter, setTabelFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState(new Set());
  const [bulkDialog, setBulkDialog] = useState({ open: false, type: "selected" });
  const [bulkLoading, setBulkLoading] = useState(false);

  const { notice, setNotice, showNotice } = useAdminNotice();

  useEffect(() => {
    setAksiFilter(lockedAksi);
  }, [logFilter]);

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

  useEffect(() => {
    const pageIds = new Set(logs.map((l) => l.idLog));
    setSelected((prev) => {
      const next = new Set();
      prev.forEach((id) => {
        if (pageIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [logs]);

  const handleBulkDelete = async () => {
    setBulkLoading(true);
    try {
      const body =
        bulkDialog.type === "all"
          ? JSON.stringify({ aksi: aksiFilter, namaTabel: tabelFilter })
          : JSON.stringify({ ids: Array.from(selected) });
      const res = await fetch(`${API}/api/admin/activity-logs/${bulkDialog.type === "all" ? "all" : "bulk"}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || "Failed to delete logs");
      setBulkDialog({ open: false, type: "selected" });
      setSelected(new Set());
      showNotice(json.message || "Activity logs deleted successfully");
      fetchLogs();
    } catch (e) {
      console.error(e);
      showNotice(e.message || "Failed to delete logs", "error");
    } finally {
      setBulkLoading(false);
    }
  };

  const toggleRow = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (pageIds) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = pageIds.every((id) => next.has(id));
      if (allSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const columns = [
    {
      key: "aksi",
      label: "Action",
      render: (row) => {
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
      render: (row) => (
        <span className="font-mono text-xs">{row.ipAddress || "—"}</span>
      ),
    },
    {
      key: "createdAt",
      label: "Timestamp",
      render: (row) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}
        </span>
      ),
    },
  ];

  const pageTitle =
    logFilter === "insert"
      ? "Insert Log"
      : logFilter === "update"
      ? "Update Log"
      : logFilter === "delete"
      ? "Delete Log"
      : "Activity Log";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{pageTitle}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Track all system activities</p>
      </div>

      <AdminNotice notice={notice} onClose={() => setNotice(null)} />

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
        {!logFilter && (
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
          </select>
        )}
        <select
          value={tabelFilter}
          onChange={(e) => setTabelFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
        >
          <option value="">All Tables</option>
          <option value="users">Users</option>
          <option value="team">Team</option>
          <option value="team_member">Team Member</option>
          <option value="project">Project</option>
          <option value="content">Content</option>
          <option value="script">Script</option>
          <option value="role">Role</option>
          <option value="backup_history">Backup</option>
        </select>
        <button
          onClick={() => selected.size > 0 && setBulkDialog({ open: true, type: "selected" })}
          disabled={selected.size === 0}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Delete Selected ({selected.size})
        </button>
        <button
          onClick={() => setBulkDialog({ open: true, type: "all" })}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
        >
          Delete All
        </button>
      </div>

      <DataTable
        columns={columns}
        data={logs}
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        loading={loading}
        selectable
        selected={selected}
        onToggleRow={toggleRow}
        onToggleAll={toggleAll}
        getRowId={(row) => row.idLog}
      />

      <ConfirmDialog
        open={bulkDialog.open}
        onClose={() => setBulkDialog({ open: false, type: "selected" })}
        onConfirm={handleBulkDelete}
        title={bulkDialog.type === "all" ? "Delete All Logs?" : "Delete Selected Logs?"}
        message={
          bulkDialog.type === "all"
            ? `This will delete all activity logs (${total} total). This cannot be undone. Are you sure?`
            : `This will delete ${selected.size} selected log(s). This cannot be undone. Are you sure?`
        }
        confirmLabel="Delete"
        variant="danger"
        loading={bulkLoading}
      />
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