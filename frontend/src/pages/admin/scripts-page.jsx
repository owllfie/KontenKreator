"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, Plus, Edit2, Trash2, RotateCcw } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { AdminModal } from "@/components/ui/admin-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function ScriptsPage() {
  const [scripts, setScripts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [loading, setLoading] = useState(true);

  const [editModal, setEditModal] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [editScript, setEditScript] = useState(null);
  const [form, setForm] = useState({ judulNaskah: "", idProject: 0, isiNaskah: "" });

  const [deleteDialog, setDeleteDialog] = useState({ open: false, script: null, type: "soft" });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchScripts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "10",
      search,
      showDeleted: String(showDeleted),
    });
    try {
      const res = await fetch(`${API}/api/admin/scripts?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      setScripts(json.data?.rows || []);
      setTotal(json.data?.total || 0);
      setTotalPages(json.data?.totalPages || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, search, showDeleted]);

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API}/api/admin/projects?limit=100`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      setProjects(json.data?.rows || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  useEffect(() => {
    setPage(1);
  }, [search, showDeleted]);

  const openEdit = (script) => {
    setEditScript(script);
    setForm({
      judulNaskah: script.judulNaskah,
      idProject: script.idProject || 0,
      isiNaskah: script.isiNaskah || "",
    });
    setEditModal(true);
  };

  const openCreate = () => {
    setEditScript(null);
    setForm({ judulNaskah: "", idProject: projects[0]?.idProject || 0, isiNaskah: "" });
    setCreateModal(true);
  };

  const handleSave = async () => {
    if (!form.judulNaskah.trim()) return;
    setActionLoading(true);
    try {
      if (editScript) {
        await fetch(`${API}/api/admin/scripts/${editScript.idScript}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify(form),
        });
        setEditModal(false);
      } else {
        await fetch(`${API}/api/admin/scripts`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify(form),
        });
        setCreateModal(false);
      }
      fetchScripts();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.script) return;
    setActionLoading(true);
    try {
      const endpoint =
        deleteDialog.type === "permanent"
          ? `${API}/api/admin/scripts/${deleteDialog.script.idScript}/permanent`
          : `${API}/api/admin/scripts/${deleteDialog.script.idScript}/soft-delete`;
      await fetch(endpoint, {
        method: deleteDialog.type === "permanent" ? "DELETE" : "PUT",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setDeleteDialog({ open: false, script: null, type: "soft" });
      fetchScripts();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async (script) => {
    try {
      await fetch(`${API}/api/admin/scripts/${script.idScript}/restore`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      fetchScripts();
    } catch (e) {
      console.error(e);
    }
  };

  const columns = [
    { key: "judulNaskah", label: "Script Title" },
    { key: "namaProjek", label: "Project" },
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
                onClick={() => setDeleteDialog({ open: true, script: row, type: "soft" })}
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                title="Soft Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setDeleteDialog({ open: true, script: row, type: "permanent" })}
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
          <h1 className="text-2xl font-bold">Scripts</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage video scripts</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Script
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search scripts..."
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
        data={scripts}
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        loading={loading}
      />

      <AdminModal
        open={editModal}
        onClose={() => setEditModal(false)}
        title="Edit Script"
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
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Script Title</label>
            <input
              type="text"
              value={form.judulNaskah}
              onChange={(e) => setForm({ ...form, judulNaskah: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Project</label>
            <select
              value={form.idProject}
              onChange={(e) => setForm({ ...form, idProject: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            >
              <option value={0}>Select Project</option>
              {projects.map((p) => (
                <option key={p.idProject} value={p.idProject}>
                  {p.namaProjek}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Script Content</label>
            <textarea
              rows={5}
              value={form.isiNaskah}
              onChange={(e) => setForm({ ...form, isiNaskah: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            />
          </div>
        </div>
      </AdminModal>

      <AdminModal
        open={createModal}
        onClose={() => setCreateModal(false)}
        title="Add Script"
        footer={
          <>
            <button onClick={() => setCreateModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">
              Cancel
            </button>
            <button onClick={handleSave} disabled={actionLoading} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white disabled:opacity-50">
              {actionLoading ? "Creating..." : "Create Script"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Script Title</label>
            <input
              type="text"
              value={form.judulNaskah}
              onChange={(e) => setForm({ ...form, judulNaskah: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Project</label>
            <select
              value={form.idProject}
              onChange={(e) => setForm({ ...form, idProject: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            >
              <option value={0}>Select Project</option>
              {projects.map((p) => (
                <option key={p.idProject} value={p.idProject}>
                  {p.namaProjek}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Script Content</label>
            <textarea
              rows={5}
              value={form.isiNaskah}
              onChange={(e) => setForm({ ...form, isiNaskah: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            />
          </div>
        </div>
      </AdminModal>

      <ConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, script: null, type: "soft" })}
        onConfirm={handleDelete}
        title={deleteDialog.type === "permanent" ? "Delete Permanently?" : "Soft Delete Script?"}
        message={
          deleteDialog.type === "permanent"
            ? `This will permanently remove "${deleteDialog.script?.judulNaskah}".`
            : `This will soft-delete "${deleteDialog.script?.judulNaskah}".`
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
