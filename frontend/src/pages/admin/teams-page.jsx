"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, Plus, Edit2, Trash2, RotateCcw, Users } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { AdminModal } from "@/components/ui/admin-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function TeamsPage() {
  const [teams, setTeams] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [loading, setLoading] = useState(true);

  const [editModal, setEditModal] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [editTeam, setEditTeam] = useState(null);
  const [formName, setFormName] = useState("");

  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    team: null,
    type: "soft",
  });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "10",
      search,
      showDeleted: String(showDeleted),
    });
    try {
      const res = await fetch(`${API}/api/admin/teams?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      setTeams(json.data?.rows || []);
      setTotal(json.data?.total || 0);
      setTotalPages(json.data?.totalPages || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, search, showDeleted]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  useEffect(() => {
    setPage(1);
  }, [search, showDeleted]);

  const openEdit = (team) => {
    setEditTeam(team);
    setFormName(team.namaTim);
    setEditModal(true);
  };

  const openCreate = () => {
    setEditTeam(null);
    setFormName("");
    setCreateModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setActionLoading(true);
    try {
      if (editTeam) {
        await fetch(`${API}/api/admin/teams/${editTeam.idTeam}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ namaTim: formName }),
        });
        setEditModal(false);
      } else {
        await fetch(`${API}/api/admin/teams`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ namaTim: formName }),
        });
        setCreateModal(false);
      }
      fetchTeams();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.team) return;
    setActionLoading(true);
    try {
      const endpoint =
        deleteDialog.type === "permanent"
          ? `${API}/api/admin/teams/${deleteDialog.team.idTeam}/permanent`
          : `${API}/api/admin/teams/${deleteDialog.team.idTeam}/soft-delete`;
      await fetch(endpoint, {
        method: deleteDialog.type === "permanent" ? "DELETE" : "PUT",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setDeleteDialog({ open: false, team: null, type: "soft" });
      fetchTeams();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async (team) => {
    try {
      await fetch(`${API}/api/admin/teams/${team.idTeam}/restore`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      fetchTeams();
    } catch (e) {
      console.error(e);
    }
  };

  const columns = [
    { key: "namaTim", label: "Team Name" },
    {
      key: "memberCount",
      label: "Members",
      render: (row) => (
        <span className="inline-flex items-center gap-1 text-sm">
          <Users className="h-3.5 w-3.5 text-gray-400" />
          {row.memberCount}
        </span>
      ),
    },
    {
      key: "createdAt",
      label: "Created",
      render: (row) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => (
        <div className="flex items-center gap-1">
          {row.deletedAt ? (
            <button
              onClick={() => handleRestore(row)}
              className="p-1.5 rounded-lg text-green-500 hover:bg-green-500/10 transition-colors"
              title="Restore"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          ) : (
            <>
              <button
                onClick={() => openEdit(row)}
                className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-500/10 transition-colors"
                title="Edit"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setDeleteDialog({ open: true, team: row, type: "soft" })}
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                title="Soft Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setDeleteDialog({ open: true, team: row, type: "permanent" })}
                className="p-1.5 rounded-lg text-red-700 hover:bg-red-700/10 transition-colors"
                title="Delete Permanently"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Teams</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage teams</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Team
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search teams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
          />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(e) => setShowDeleted(e.target.checked)}
            className="rounded border-gray-300"
          />
          Show deleted
        </label>
      </div>

      <DataTable
        columns={columns}
        data={teams}
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        loading={loading}
      />

      <AdminModal
        open={editModal}
        onClose={() => setEditModal(false)}
        title="Edit Team"
        footer={
          <>
            <button onClick={() => setEditModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">
              Cancel
            </button>
            <button onClick={handleSave} disabled={actionLoading} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white disabled:opacity-50">
              {actionLoading ? "Saving..." : "Save Changes"}
            </button>
          </>
        }
      >
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Team Name</label>
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
            placeholder="Enter team name"
          />
        </div>
      </AdminModal>

      <AdminModal
        open={createModal}
        onClose={() => setCreateModal(false)}
        title="Add Team"
        footer={
          <>
            <button onClick={() => setCreateModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">
              Cancel
            </button>
            <button onClick={handleSave} disabled={actionLoading} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white disabled:opacity-50">
              {actionLoading ? "Creating..." : "Create Team"}
            </button>
          </>
        }
      >
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Team Name</label>
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
            placeholder="Enter team name"
          />
        </div>
      </AdminModal>

      <ConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, team: null, type: "soft" })}
        onConfirm={handleDelete}
        title={deleteDialog.type === "permanent" ? "Delete Permanently?" : "Soft Delete Team?"}
        message={
          deleteDialog.type === "permanent"
            ? `This will permanently remove "${deleteDialog.team?.namaTim}". This action cannot be undone.`
            : `This will soft-delete "${deleteDialog.team?.namaTim}". The team can be restored later.`
        }
        confirmLabel={deleteDialog.type === "permanent" ? "Delete Permanently" : "Soft Delete"}
        variant="danger"
        loading={actionLoading}
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
