"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search, FolderKanban, ChevronRight, FileText, FileVideo2, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AdminModal } from "@/components/ui/admin-modal";

export default function ProjectPage() {
  const { user } = useAuth();
  const currentUserId = Number(user?.id_users);
  const [teams, setTeams] = useState([]);
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ teamId: "", namaProjek: "", deadline: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState(null);

  const [expanded, setExpanded] = useState(new Set());
  const [scriptsByProject, setScriptsByProject] = useState({});
  const [contentsByProject, setContentsByProject] = useState({});

  const [scriptModal, setScriptModal] = useState({ open: false, project: null });
  const [contentModal, setContentModal] = useState({ open: false, project: null });
  const [sform, setSform] = useState({ judulScript: "", script: "" });
  const [cform, setCform] = useState({ judulKonten: "", fileDraft: "", catatan: "" });
  const [itemSaving, setItemSaving] = useState(false);
  const [itemError, setItemError] = useState("");

  const fetchMyProjects = useCallback(async () => {
    setLoading(true);
    try {
      const json = await api("/api/me/team");
      const teamList = json.data || [];
      setTeams(teamList);
      const allProjects = teamList.flatMap((team) => [...(team.projects || [])]);
      setProjects(allProjects);
      const scriptsMap = {};
      const contentsMap = {};
      allProjects.forEach((p) => {
        scriptsMap[p.idProject] = p.scripts || [];
        contentsMap[p.idProject] = p.contents || [];
      });
      setScriptsByProject(scriptsMap);
      setContentsByProject(contentsMap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyProjects();
  }, [fetchMyProjects]);

  const manageableTeams = useMemo(
    () =>
      teams.filter((t) =>
        (t.members || []).some(
          (m) =>
            Number(m.idUser) === currentUserId &&
            ["leader", "vice leader"].includes(m.job)
        )
      ),
    [teams, currentUserId]
  );

  useEffect(() => {
    if (manageableTeams.length === 1 && !form.teamId) {
      setForm((f) => (f.teamId ? f : { ...f, teamId: String(manageableTeams[0].idTeam) }));
    }
  }, [manageableTeams, form.teamId]);

  const handleCreate = async () => {
    if (!form.teamId || !form.namaProjek.trim()) {
      setFormError("Team and project name are required");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await api(`/api/me/team/${form.teamId}/projects`, {
        method: "POST",
        body: JSON.stringify({
          namaProjek: form.namaProjek.trim(),
          deadline: form.deadline || null,
        }),
      });
      setForm({ teamId: "", namaProjek: "", deadline: "" });
      setAddOpen(false);
      setNotice({ ok: true, message: "Project created successfully." });
      fetchMyProjects();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateScript = async () => {
    if (!scriptModal.project || !sform.judulScript.trim()) {
      setItemError("Script title is required");
      return;
    }
    setItemSaving(true);
    setItemError("");
    try {
      await api(
        `/api/me/team/${scriptModal.project.idTeam}/projects/${scriptModal.project.idProject}/scripts`,
        {
          method: "POST",
          body: JSON.stringify({ judulScript: sform.judulScript.trim(), script: sform.script }),
        }
      );
      setSform({ judulScript: "", script: "" });
      setScriptModal({ open: false, project: null });
      setNotice({ ok: true, message: "Script submitted successfully." });
      fetchMyProjects();
    } catch (e) {
      setItemError(e.message);
    } finally {
      setItemSaving(false);
    }
  };

  const handleCreateContent = async () => {
    if (!contentModal.project || !cform.judulKonten.trim()) {
      setItemError("Content title is required");
      return;
    }
    setItemSaving(true);
    setItemError("");
    try {
      await api(
        `/api/me/team/${contentModal.project.idTeam}/projects/${contentModal.project.idProject}/contents`,
        {
          method: "POST",
          body: JSON.stringify({
            judulKonten: cform.judulKonten.trim(),
            fileDraft: cform.fileDraft || null,
            catatan: cform.catatan || null,
          }),
        }
      );
      setCform({ judulKonten: "", fileDraft: "", catatan: "" });
      setContentModal({ open: false, project: null });
      setNotice({ ok: true, message: "Content submitted successfully." });
      fetchMyProjects();
    } catch (e) {
      setItemError(e.message);
    } finally {
      setItemSaving(false);
    }
  };

  useEffect(() => {
    setExpanded(new Set());
  }, [search]);

  const handleDeleteScript = async (idScript) => {
    if (!window.confirm("Delete this script? This cannot be undone.")) return;
    try {
      await api(`/api/me/scripts/${idScript}`, { method: "DELETE" });
      setNotice({ ok: true, message: "Script deleted." });
      fetchMyProjects();
    } catch (e) {
      setNotice({ ok: false, message: e.message });
    }
  };

  const handleDeleteContent = async (idContent) => {
    if (!window.confirm("Delete this content? This cannot be undone.")) return;
    try {
      await api(`/api/me/contents/${idContent}`, { method: "DELETE" });
      setNotice({ ok: true, message: "Content deleted." });
      fetchMyProjects();
    } catch (e) {
      setNotice({ ok: false, message: e.message });
    }
  };

  const toggleProject = (project) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(project.idProject)) next.delete(project.idProject);
      else next.add(project.idProject);
      return next;
    });
  };

  const filtered = projects.filter((p) =>
    (p.namaProjek || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
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
        {manageableTeams.length > 0 && (
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Project
          </button>
        )}
      </div>

      {notice && (
        <div
          className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium border ${
            notice.ok
              ? "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30"
              : "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30"
          }`}
        >
          {notice.message}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Project
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Team
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Deadline
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Detail
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 4 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    No data available
                  </td>
                </tr>
              ) : (
                filtered.flatMap((p) => {
                  const isOpen = expanded.has(p.idProject);
                  const rows = [
                    <tr
                      key={`project-${p.idProject}`}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleProject(p)}
                            className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            aria-label={isOpen ? "Collapse" : "Expand"}
                          >
                            <ChevronRight
                              className={`h-4 w-4 transition-transform ${
                                isOpen ? "rotate-90" : ""
                              }`}
                            />
                          </button>
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10 text-green-500">
                            <FolderKanban className="h-4 w-4" />
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {p.namaProjek}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {p.namaTim || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {p.deadline ? new Date(p.deadline).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {(scriptsByProject[p.idProject] || []).length} scripts ·{" "}
                        {(contentsByProject[p.idProject] || []).length} contents
                      </td>
                    </tr>,
                  ];

                  if (isOpen) {
                    const scripts = scriptsByProject[p.idProject] || [];
                    const contents = contentsByProject[p.idProject] || [];

                    rows.push(
                      <tr key={`add-items-${p.idProject}`}>
                        <td colSpan={4} className="px-4 py-2 pl-14">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setItemError("");
                                setSform({
                                  judulScript: `Script ${(scriptsByProject[p.idProject] || []).length + 1}`,
                                  script: "",
                                });
                                setScriptModal({ open: true, project: p });
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 text-xs font-medium transition-colors"
                            >
                              <FileText className="h-3.5 w-3.5" /> Add Script
                            </button>
                            <button
                              onClick={() => {
                                setItemError("");
                                setCform({
                                  judulKonten: `Content ${(contentsByProject[p.idProject] || []).length + 1}`,
                                  fileDraft: "",
                                  catatan: "",
                                });
                                setContentModal({ open: true, project: p });
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-pink-500/40 text-pink-600 dark:text-pink-400 hover:bg-pink-500/10 text-xs font-medium transition-colors"
                            >
                              <FileVideo2 className="h-3.5 w-3.5" /> Add Content
                            </button>
                          </div>
                        </td>
                      </tr>
                    );

                    if (scripts.length === 0 && contents.length === 0) {
                      rows.push(
                        <tr key={`no-item-${p.idProject}`}>
                          <td
                            colSpan={4}
                            className="px-4 py-3 pl-14 text-sm text-gray-400 italic"
                          >
                            No scripts or contents for this project.
                          </td>
                        </tr>
                      );
                    }

                    scripts.forEach((s) => {
                      rows.push(
                        <tr
                          key={`script-${s.idScript}`}
                          className="bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors"
                        >
                          <td colSpan={4} className="px-4 py-2 pl-14">
                            <div className="flex items-center gap-3">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-medium">
                                <FileText className="h-3 w-3" /> Script
                              </span>
                              <Link
                                to={`/app/project/script/${s.idScript}`}
                                className="text-gray-700 dark:text-gray-300 text-sm hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                              >
                                {s.judulScript}
                              </Link>
                              <span className="text-xs text-gray-500">
                                by {s.writerName || "—"}
                              </span>
                              {s.lastRevisorName && (
                                <span className="text-xs text-gray-500">
                                  · revisi {s.lastRevisorName}
                                  {s.lastRevisionAt ? ` (${new Date(s.lastRevisionAt).toLocaleDateString()})` : ""}
                                </span>
                              )}
                              <span className="text-xs text-gray-500">
                                {s.createdAt
                                  ? new Date(s.createdAt).toLocaleDateString()
                                  : "—"}
                              </span>
                              <button
                                onClick={() => handleDeleteScript(s.idScript)}
                                title="Delete script"
                                className="ml-auto inline-flex items-center justify-center p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    });

                    contents.forEach((c) => {
                      rows.push(
                        <tr
                          key={`content-${c.idContent}`}
                          className="bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors"
                        >
                          <td colSpan={4} className="px-4 py-2 pl-14">
                            <div className="flex items-center gap-3">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-pink-500/10 text-pink-600 dark:text-pink-400 text-[10px] font-medium">
                                <FileVideo2 className="h-3 w-3" /> Content
                              </span>
                              <Link
                                to={`/app/project/content/${c.idContent}`}
                                className="text-gray-700 dark:text-gray-300 text-sm hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                              >
                                {c.judulKonten}
                              </Link>
                              <span className="text-xs text-gray-500">
                                by {c.uploaderName || "—"}
                              </span>
                              {c.lastRevisorName && (
                                <span className="text-xs text-gray-500">
                                  · revisi {c.lastRevisorName}
                                  {c.lastRevisionAt ? ` (${new Date(c.lastRevisionAt).toLocaleDateString()})` : ""}
                                </span>
                              )}
                              <span className="text-xs text-gray-500">
                                {c.createdAt
                                  ? new Date(c.createdAt).toLocaleDateString()
                                  : "—"}
                              </span>
                              <button
                                onClick={() => handleDeleteContent(c.idContent)}
                                title="Delete content"
                                className="ml-auto inline-flex items-center justify-center p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  }

                  return rows;
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AdminModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Project"
        footer={
          <>
            <button
              onClick={() => setAddOpen(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Create Project"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Team
            </label>
            <select
              value={form.teamId}
              onChange={(e) => setForm({ ...form, teamId: e.target.value })}
              disabled={manageableTeams.length === 1}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm disabled:opacity-60"
            >
              {manageableTeams.length === 1 ? (
                <option value={form.teamId}>{manageableTeams[0].namaTim}</option>
              ) : (
                <>
                  <option value="">Select team...</option>
                  {manageableTeams.map((t) => (
                    <option key={t.idTeam} value={t.idTeam}>
                      {t.namaTim}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Project Name
            </label>
            <input
              type="text"
              value={form.namaProjek}
              onChange={(e) => setForm({ ...form, namaProjek: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
              placeholder="e.g. Q2 Brand Campaign"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Deadline
            </label>
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
        open={scriptModal.open}
        onClose={() => setScriptModal({ open: false, project: null })}
        title={`Add Script — ${scriptModal.project?.namaProjek || ""}`}
        footer={
          <>
            <button
              onClick={() => setScriptModal({ open: false, project: null })}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateScript}
              disabled={itemSaving}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50"
            >
              {itemSaving ? "Saving..." : "Submit Script"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {itemError && (
            <p className="text-sm text-red-600 dark:text-red-400">{itemError}</p>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Script Title
            </label>
            <input
              type="text"
              value={sform.judulScript}
              onChange={(e) => setSform({ ...sform, judulScript: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
              placeholder="Script title"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Script Content
            </label>
            <textarea
              value={sform.script}
              onChange={(e) => setSform({ ...sform, script: e.target.value })}
              rows={5}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
              placeholder="Write the script..."
            />
          </div>
        </div>
      </AdminModal>

      <AdminModal
        open={contentModal.open}
        onClose={() => setContentModal({ open: false, project: null })}
        title={`Add Content — ${contentModal.project?.namaProjek || ""}`}
        footer={
          <>
            <button
              onClick={() => setContentModal({ open: false, project: null })}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateContent}
              disabled={itemSaving}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-pink-500 hover:bg-pink-600 text-white disabled:opacity-50"
            >
              {itemSaving ? "Saving..." : "Submit Content"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {itemError && (
            <p className="text-sm text-red-600 dark:text-red-400">{itemError}</p>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Content Title
            </label>
            <input
              type="text"
              value={cform.judulKonten}
              onChange={(e) => setCform({ ...cform, judulKonten: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
              placeholder="Content title"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              File Draft
            </label>
            <input
              type="text"
              value={cform.fileDraft}
              onChange={(e) => setCform({ ...cform, fileDraft: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
              placeholder="e.g. URL or drive link"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Note
            </label>
            <textarea
              value={cform.catatan}
              onChange={(e) => setCform({ ...cform, catatan: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
              placeholder="Write a note..."
            />
          </div>
        </div>
      </AdminModal>
    </div>
  );
}