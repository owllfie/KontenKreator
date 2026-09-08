"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, Plus, Edit2, Trash2, RotateCcw } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { AdminModal } from "@/components/ui/admin-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function ContentsPage() {
  const [contents, setContents] = useState([]);
  const [projects, setProjects] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [loading, setLoading] = useState(true);

  const [editModal, setEditModal] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [editContent, setEditContent] = useState(null);
  const [form, setForm] = useState({ judulKonten: "", idProject: 0, statusKonten: "draft", urlVideo: "" });

  const [deleteDialog, setDeleteDialog] = useState({ open: false, contentItem: null, type: "soft" });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchContents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "10",
      search,
      showDeleted: String(showDeleted),
    });
    try {
      const res = await fetch(`${API}/api/admin/contents?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      setContents(json.data?.rows || []);
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
    fetchContents();
  }, [fetchContents]);

  useEffect(() => {
    setPage(1);
  }, [search, showDeleted]);

  const openEdit = (item) => {
    setEditContent(item);
    setForm({
      judulKonten: item.judulKonten,
      idProject: item.idProject || 0,
      statusKonten: item.statusKonten || "draft",
      urlVideo: item.urlVideo || "",
    });
    setEditModal(true);
  };

  const openCreate = () => {
    setEditContent(null);
    setForm({ judulKonten: "", idProject: projects[0]?.idProject || 0, statusKonten: "draft", urlVideo: "" });
    setCreateModal(true);
  };

  const handleSave = async () => {
    if (!form.judulKonten.trim()) return;
    setActionLoading(true);
    try {
      if (editContent) {
        await fetch(`${API}/api/admin/contents/${editContent.idContent}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify(form),
        });
        setEditModal(false);
      } else {
        await fetch(`${API}/api/admin/contents`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify(form),
        });
        setCreateModal(false);
      }
      fetchContents();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.contentItem) return;
    setActionLoading(true);
    try {
      const endpoint =
        deleteDialog.type === "permanent"
          ? `${API}/api/admin/contents/${deleteDialog.contentItem.idContent}/permanent`
          : `${API}/api/admin/contents/${deleteDialog.contentItem.idContent}/soft-delete`;
      await fetch(endpoint, {
        method: deleteDialog.type === "permanent" ? "DELETE" : "PUT",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setDeleteDialog({ open: false, contentItem: null, type: "soft" });
      fetchContents();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async (item) => {
    try {
      await fetch(`${API}/api/admin/contents/${item.idContent}/restore`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      fetchContents();
    } catch (e) {
      console.error(e);
    }
  };

  const columns = [
    { key: "judulKonten", label: "Content Title" },
    { key: "namaProjek", label: "Project" },
    {
      key: "statusKonten",
      label: "Status",
      render: (row) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 capitalize">
          {row.statusKonten}
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
                onClick={() => setDeleteDialog({ open: true, contentItem: row, type: "soft" })}
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                title="Soft Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setDeleteDialog({ open: true, contentItem: row, type: "permanent" })}
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
          <h1 className="text-2xl font-bold">Contents</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage video contents</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Content
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search contents..."
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
        data={contents}
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        loading={loading}
      />

      <AdminModal
        open={editModal}
        onClose={() => setEditModal(false)}
        title="Edit Content"
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
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Content Title</label>
            <input
              type="text"
              value={form.judulKonten}
              onChange={(e) => setForm({ ...form, judulKonten: e.target.value })}
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
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Status</label>
            <select
              value={form.statusKonten}
              onChange={(e) => setForm({ ...form, statusKonten: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            >
              <option value="draft">Draft</option>
              <option value="review">Review</option>
              <option value="approved">Approved</option>
              <option value="published">Published</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Video URL</label>
            <input
              type="text"
              value={form.urlVideo}
              onChange={(e) => setForm({ ...form, urlVideo: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            />
          </div>
        </div>
      </AdminModal>

      <AdminModal
        open={createModal}
        onClose={() => setCreateModal(false)}
        title="Add Content"
        footer={
          <>
            <button onClick={() => setCreateModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">
              Cancel
            </button>
            <button onClick={handleSave} disabled={actionLoading} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white disabled:opacity-50">
              {actionLoading ? "Creating..." : "Create Content"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Content Title</label>
            <input
              type="text"
              value={form.judulKonten}
              onChange={(e) => setForm({ ...form, judulKonten: e.target.value })}
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
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Status</label>
            <select
              value={form.statusKonten}
              onChange={(e) => setForm({ ...form, statusKonten: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            >
              <option value="draft">Draft</option>
              <option value="review">Review</option>
              <option value="approved">Approved</option>
              <option value="published">Published</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Video URL</label>
            <input
              type="text"
              value={form.urlVideo}
              onChange={(e) => setForm({ ...form, urlVideo: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            />
          </div>
        </div>
      </AdminModal>

      <ConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, contentItem: null, type: "soft" })}
        onConfirm={handleDelete}
        title={deleteDialog.type === "permanent" ? "Delete Permanently?" : "Soft Delete Content?"}
        message={
          deleteDialog.type === "permanent"
            ? `This will permanently remove "${deleteDialog.contentItem?.judulKonten}".`
            : `This will soft-delete "${deleteDialog.contentItem?.judulKonten}".`
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
