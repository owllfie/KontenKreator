"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  Users,
  ChevronRight,
  FolderKanban,
} from "lucide-react";
import { AdminModal } from "@/components/ui/admin-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdminNotice, useAdminNotice } from "@/components/ui/admin-notice";
import { useAuth } from "@/lib/auth";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function TeamsPage() {
  const { user } = useAuth();
  const isSuperadmin = (user?.role || "").toLowerCase() === "superadmin";
  const [teams, setTeams] = useState([]);
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [expandedTeams, setExpandedTeams] = useState(new Set());

  const [editModal, setEditModal] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [modalType, setModalType] = useState("team");
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({});

  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    type: "soft",
    entity: null,
    endpoint: "",
    name: "",
    entityType: null,
  });
  const [actionLoading, setActionLoading] = useState(false);

  const [selected, setSelected] = useState(new Set());
  const [bulkDialog, setBulkDialog] = useState({ open: false, type: "selected" });
  const [bulkLoading, setBulkLoading] = useState(false);

  const { notice, setNotice, showNotice } = useAdminNotice();

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: "1",
      limit: "1000",
      search,
    });
    try {
      const res = await fetch(`${API}/api/admin/teams?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      setTeams(json.data?.rows || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  const fetchProjects = useCallback(async () => {
    const params = new URLSearchParams({
      page: "1",
      limit: "1000",
      search: "",
    });
    try {
      const res = await fetch(`${API}/api/admin/projects?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      setProjects(json.data?.rows || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
    fetchProjects();
  }, [fetchTeams, fetchProjects]);

  useEffect(() => {
    setExpandedTeams(new Set());
  }, [search]);

  useEffect(() => {
    const pageIds = new Set(teams.map((t) => t.idTeam));
    setSelected((prev) => {
      const next = new Set();
      prev.forEach((id) => {
        if (pageIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [teams]);

  const projectsByTeam = (idTeam) =>
    projects.filter((p) => p.idTeam === idTeam);

  const projectCountByTeam = (idTeam) =>
    projects.filter((p) => p.idTeam === idTeam).length;

  const toggleTeam = (team) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(team.idTeam)) next.delete(team.idTeam);
      else next.add(team.idTeam);
      return next;
    });
  };

  const openCreate = (type, parent) => {
    setModalType(type);
    setEditId(null);
    if (type === "team") setForm({ namaTim: "" });
    else if (type === "project")
      setForm({ namaProjek: "", idTeam: parent?.idTeam || 0, deadline: "" });
    setCreateModal(true);
  };

  const openEdit = (type, row) => {
    setModalType(type);
    setEditId(row.idTeam || row.idProject);
    if (type === "team") setForm({ namaTim: row.namaTim });
    else if (type === "project")
      setForm({
        namaProjek: row.namaProjek,
        idTeam: row.idTeam || 0,
        deadline: row.deadline ? row.deadline.split("T")[0] : "",
      });
    setEditModal(true);
  };

  const handleSave = async () => {
    setActionLoading(true);
    try {
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      };
      const isEdit = editId != null;

      if (modalType === "team") {
        if (!form.namaTim?.trim()) return;
        const ep = isEdit
          ? `${API}/api/admin/teams/${editId}`
          : `${API}/api/admin/teams`;
        await fetch(ep, {
          method: isEdit ? "PUT" : "POST",
          headers,
          body: JSON.stringify({ namaTim: form.namaTim }),
        });
        await fetchTeams();
        showNotice(`Team ${isEdit ? "updated" : "created"} successfully`);
      } else if (modalType === "project") {
        if (!form.namaProjek?.trim()) return;
        const ep = isEdit
          ? `${API}/api/admin/projects/${editId}`
          : `${API}/api/admin/projects`;
        await fetch(ep, {
          method: isEdit ? "PUT" : "POST",
          headers,
          body: JSON.stringify({
            namaProjek: form.namaProjek,
            idTeam: Number(form.idTeam),
            deadline: form.deadline || null,
          }),
        });
        await fetchProjects();
        showNotice(`Project ${isEdit ? "updated" : "created"} successfully`);
      }

      setEditModal(false);
      setCreateModal(false);
    } catch (e) {
      console.error(e);
      showNotice("Failed to save", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const openDelete = (type, row, deleteType = "soft") => {
    let entity = {};
    let endpoint = "";
    let name = "";

    if (type === "team") {
      entity = row;
      endpoint = `${API}/api/admin/teams/${row.idTeam}`;
      name = row.namaTim;
    } else if (type === "project") {
      entity = row;
      endpoint = `${API}/api/admin/projects/${row.idProject}`;
      name = row.namaProjek;
    }

    setDeleteDialog({ open: true, type: deleteType, entity, endpoint, name, entityType: type });
  };

  const handleDelete = async () => {
    if (!deleteDialog.entity || !deleteDialog.endpoint) return;
    setActionLoading(true);
    try {
      const method = deleteDialog.type === "permanent" ? "DELETE" : "PUT";
      await fetch(
        `${deleteDialog.endpoint}/${
          deleteDialog.type === "permanent" ? "permanent" : "soft-delete"
        }`,
        { method, headers: { Authorization: `Bearer ${getToken()}` } }
      );
      if (deleteDialog.entityType === "team") await fetchTeams();
      else if (deleteDialog.entityType === "project") await fetchProjects();
      setDeleteDialog({ open: false, type: "soft", entity: null, endpoint: "", name: "", entityType: null });
      showNotice(`${deleteDialog.entityType === "team" ? "Team" : "Project"} deleted successfully`);
    } catch (e) {
      console.error(e);
      showNotice("Failed to delete", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async (type, row) => {
    try {
      if (type === "team")
        await fetch(`${API}/api/admin/teams/${row.idTeam}/restore`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${getToken()}` },
        });
      else if (type === "project")
        await fetch(`${API}/api/admin/projects/${row.idProject}/restore`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${getToken()}` },
        });

      if (type === "team") await fetchTeams();
      else if (type === "project") await fetchProjects();
      showNotice(`${type === "team" ? "Team" : "Project"} restored successfully`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleBulkDelete = async () => {
    setBulkLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/teams/${bulkDialog.type === "all" ? "delete-all" : "bulk-delete"}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: bulkDialog.type === "all" ? undefined : JSON.stringify({ ids: Array.from(selected) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || "Failed to delete teams");
      setBulkDialog({ open: false, type: "selected" });
      setSelected(new Set());
      showNotice(json.message || "Teams deleted successfully");
      await fetchTeams();
      await fetchProjects();
    } catch (e) {
      console.error(e);
      showNotice(e.message || "Failed to delete teams", "error");
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

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = teams.every((t) => next.has(t.idTeam));
      if (allSelected) teams.forEach((t) => next.delete(t.idTeam));
      else teams.forEach((t) => next.add(t.idTeam));
      return next;
    });
  };

  const ChevronToggle = ({ open, onClick }) => (
    <button
      onClick={onClick}
      className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      aria-label={open ? "Collapse" : "Expand"}
    >
      <ChevronRight
        className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`}
      />
    </button>
  );

  const ActionButtons = ({ entityType, row }) => (
    <div className="flex items-center gap-1">
      {row.deletedAt ? (
        <button
          onClick={() => handleRestore(entityType, row)}
          className="p-1.5 rounded-lg text-green-500 hover:bg-green-500/10 transition-colors"
          title="Restore"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      ) : (
        <>
          {!isSuperadmin && (
            <button
              onClick={() => openEdit(entityType, row)}
              className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-500/10 transition-colors"
              title="Edit"
            >
              <Edit2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => openDelete(entityType, row, "soft")}
            className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {!isSuperadmin && (
            <button
              onClick={() => openDelete(entityType, row, "permanent")}
              className="p-1.5 rounded-lg text-red-700 hover:bg-red-700/10 transition-colors"
              title="Delete Permanently"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </>
      )}
    </div>
  );

  const renderRows = () => {
    const rows = [];
    teams.forEach((team) => {
      const isTeamOpen = expandedTeams.has(team.idTeam);
      const teamProjects = projectsByTeam(team.idTeam);

      rows.push(
        <tr
          key={`team-${team.idTeam}`}
          className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <td className="px-4 py-3">
            <input
              type="checkbox"
              checked={selected.has(team.idTeam)}
              onChange={() => toggleRow(team.idTeam)}
              className="h-4 w-4 rounded border-gray-300 dark:border-gray-700 text-red-600 focus:ring-red-500"
            />
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              <ChevronToggle
                open={isTeamOpen}
                onClick={() => toggleTeam(team)}
              />
              <span className="font-medium text-gray-900 dark:text-white">
                {team.namaTim}
              </span>
            </div>
          </td>
          <td className="px-4 py-3">
            <span className="inline-flex items-center gap-1 text-sm">
              <Users className="h-3.5 w-3.5 text-gray-400" />
              {team.memberCount}
            </span>
          </td>
          <td className="px-4 py-3">
            <span className="inline-flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
              {team.leaderName || "—"}
            </span>
          </td>
          <td className="px-4 py-3">
            <span className="inline-flex items-center gap-1 text-sm">
              <FolderKanban className="h-3.5 w-3.5 text-gray-400" />
              {projectCountByTeam(team.idTeam)}
            </span>
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center gap-1">
              {!isSuperadmin && (
                <button
                  onClick={() => openCreate("project", { idTeam: team.idTeam })}
                  className="p-1.5 rounded-lg text-green-500 hover:bg-green-500/10 transition-colors"
                  title="Add Project"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
              <ActionButtons entityType="team" row={team} />
            </div>
          </td>
        </tr>
      );

      if (isTeamOpen) {
        if (teamProjects.length === 0) {
          rows.push(
            <tr key={`no-project-${team.idTeam}`}>
              <td
                colSpan={6}
                className="px-4 py-3 pl-12 text-sm text-gray-400 italic"
              >
                No projects for this team.
              </td>
            </tr>
          );
        } else {
          teamProjects.forEach((project) => {
            rows.push(
              <tr
                key={`project-${project.idProject}`}
                className="bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors"
              >
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 pl-8">
                    <FolderKanban className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-700 dark:text-gray-300">
                      {project.namaProjek}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {project.deadline
                    ? new Date(project.deadline).toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <ActionButtons entityType="project" row={project} />
                </td>
              </tr>
            );
          });
        }
      }
    });
    return rows;
  };

  const modalOpen = editModal || createModal;
  const modalTitle = (() => {
    const prefix = editModal ? "Edit" : "Add";
    const name = modalType === "team" ? "Team" : "Project";
    return `${prefix} ${name}`;
  })();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Teams</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage teams and their projects
          </p>
        </div>
        <button
          onClick={() => openCreate("team")}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Team
        </button>
      </div>

      <AdminNotice notice={notice} onClose={() => setNotice(null)} />

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
        <button
          onClick={() => selected.size > 0 && setBulkDialog({ open: true, type: "selected" })}
          disabled={selected.size === 0}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Delete Selected ({selected.size})
        </button>
        <button
          onClick={() => setBulkDialog({ open: true, type: "all" })}
          disabled={teams.length === 0}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Delete All
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={teams.length > 0 && teams.every((t) => selected.has(t.idTeam))}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-700 text-red-600 focus:ring-red-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Members
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Leader
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Projects
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : teams.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    No data available
                  </td>
                </tr>
              ) : (
                renderRows()
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AdminModal
        open={modalOpen}
        onClose={() => {
          setEditModal(false);
          setCreateModal(false);
        }}
        title={modalTitle}
        footer={
          <>
            <button
              onClick={() => {
                setEditModal(false);
                setCreateModal(false);
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={actionLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
            >
              {actionLoading ? "Saving..." : "Save"}
            </button>
          </>
        }
      >
        {modalType === "team" && (
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Team Name
            </label>
            <input
              type="text"
              value={form.namaTim || ""}
              onChange={(e) => setForm({ ...form, namaTim: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
              placeholder="Enter team name"
            />
          </div>
        )}

        {modalType === "project" && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Project Name
              </label>
              <input
                type="text"
                value={form.namaProjek || ""}
                onChange={(e) => setForm({ ...form, namaProjek: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Team
              </label>
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
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Deadline
              </label>
              <input
                type="date"
                value={form.deadline || ""}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
              />
            </div>
          </div>
        )}
      </AdminModal>

      <ConfirmDialog
        open={deleteDialog.open}
        onClose={() =>
          setDeleteDialog({ open: false, type: "soft", entity: null, endpoint: "", name: "", entityType: null })
        }
        onConfirm={handleDelete}
        title={deleteDialog.type === "permanent" ? "Delete Permanently?" : "Delete?"}
        message={
          deleteDialog.type === "permanent"
            ? `This will permanently remove "${deleteDialog.name}". This action cannot be undone.`
            : `This will delete "${deleteDialog.name}". It can be restored later if needed.`
        }
        confirmLabel={deleteDialog.type === "permanent" ? "Delete Permanently" : "Delete"}
        variant="danger"
        loading={actionLoading}
      />

      <ConfirmDialog
        open={bulkDialog.open}
        onClose={() => setBulkDialog({ open: false, type: "selected" })}
        onConfirm={handleBulkDelete}
        title={bulkDialog.type === "all" ? "Delete All Teams?" : "Delete Selected Teams?"}
        message={
          bulkDialog.type === "all"
            ? `This will delete all teams (${teams.length} total). Their projects will also be deleted. Are you sure?`
            : `This will delete ${selected.size} selected team(s). Their projects will also be deleted. Are you sure?`
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