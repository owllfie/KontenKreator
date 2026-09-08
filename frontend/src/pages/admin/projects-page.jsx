"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, Plus, Edit2, Trash2, RotateCcw } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { AdminModal } from "@/components/ui/admin-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [loading, setLoading] = useState(true);

  const [editModal, setEditModal] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [form, setForm] = useState({ namaProjek: "", idTeam: 0, deadline: "" });

  const [deleteDialog, setDeleteDialog] = useState({ open: false, project: null, type: "soft" });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "10",
      search,
      showDeleted: String(showDeleted),
    });
    try {
      const res = await fetch(`${API}/api/admin/projects?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      setProjects(json.data?.rows || []);
      setTotal(json.data?.total || 0);
      setTotalPages(json.data?.totalPages || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, search, showDeleted]);

  const fetchTeams = async () => {
    try {
      const res = await fetch(`${API}/api/admin/teams?limit=100`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      setTeams(json.data?.rows || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    setPage(1);
  }, [search, showDeleted]);

  const openEdit = (project) => {
    setEditProject(project);
    setForm({
      namaProjek: project.namaProjek,
      idTeam: project.idTeam || 0,
      deadline: project.deadline ? project.deadline.split("T")[0] : "",
    });
    setEditModal(true);
  };

  const openCreate = () => {
    setEditProject(null);
    setForm({ namaProjek: "", idTeam: teams[0]?.idTeam || 0, deadline: "" });
    setCreateModal(true);
  };

  const handleSave = async () => {
    if (!form.namaProjek.trim()) return;
    setActionLoading(true);
    try {
      if (editProject) {
        await fetch(`${API}/api/admin/projects/${editProject.idProject}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify(form),
        });
        setEditModal(false);
      } else {
        await fetch(`${API}/api/admin/projects`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify(form),
        });
        setCreateModal(false);
      }
      fetchProjects();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.project) return;
    setActionLoading(true);
    try {
      const endpoint =
        deleteDialog.type === "permanent"
          ? `${API}/api/admin/projects/${deleteDialog.project.idProject}/permanent`
          : `${API}/api/admin/projects/${deleteDialog.project.idProject}/soft-delete`;
      await fetch(endpoint, {
        method: deleteDialog.type === "permanent" ? "DELETE" : "PUT",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setDeleteDialog({ open: false, project: null, type: "soft" });
      fetchProjects();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async (project) => {
    try {
      await fetch(`${API}/api/admin/projects/${project.idProject}/restore`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      fetchProjects();
    } catch (e) {
      console.error(e);
    }
  };

  const columns = [
    { key: "namaProjek", label: "Project Name" },
    { key: "namaTim", label: "Team" },
    {
      key: "deadline",
      label: "Deadline",
      render: (row) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {row.deadline ? new Date(row.deadline).toLocaleDateString() : "—"}
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
                onClick={() => setDeleteDialog({ open: true, project: row, type: "soft" })}
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                title="Soft Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setDeleteDialog({ open: true, project: row, type: "permanent" })}
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
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage projects</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Project
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search projects..."
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
        data={projects}
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        loading={loading}
      />

      <AdminModal
        open={editModal}
        onClose={() => setEditModal(false)}
        title="Edit Project"
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
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Project Name</label>
            <input
              type="text"
              value={form.namaProjek}
              onChange={(e) => setForm({ ...form, namaProjek: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Team</label>
            <select
              value={form.idTeam}
              onChange={(e) => setForm({ ...form, idTeam: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            >
              <option value={0}>Select Team</option>
              {teams.map((t) => (
                <option key={t.idTeam} value={t.idTeam}>
                  {t.namaTim}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Deadline</label>
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            />
          </div>
        </div>
      </AdminModal>

      <AdminModal
        open={createModal}
        onClose={() => setCreateModal(false)}
        title="Add Project"
        footer={
          <>
            <button onClick={() => setCreateModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">
              Cancel
            </button>
            <button onClick={handleSave} disabled={actionLoading} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white disabled:opacity-50">
              {actionLoading ? "Creating..." : "Create Project"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Project Name</label>
            <input
              type="text"
              value={form.namaProjek}
              onChange={(e) => setForm({ ...form, namaProjek: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Team</label>
            <select
              value={form.idTeam}
              onChange={(e) => setForm({ ...form, idTeam: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            >
              <option value={0}>Select Team</option>
              {teams.map((t) => (
                <option key={t.idTeam} value={t.idTeam}>
                  {t.namaTim}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Deadline</label>
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            />
          </div>
        </div>
      </AdminModal>

      <ConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, project: null, type: "soft" })}
        onConfirm={handleDelete}
        title={deleteDialog.type === "permanent" ? "Delete Permanently?" : "Soft Delete Project?"}
        message={
          deleteDialog.type === "permanent"
            ? `This will permanently remove "${deleteDialog.project?.namaProjek}".`
            : `This will soft-delete "${deleteDialog.project?.namaProjek}".`
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
