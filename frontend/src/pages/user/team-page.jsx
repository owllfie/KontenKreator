"use client";

import React, { useState, useEffect } from "react";
import { Layers, Users, Search, Mail, UserPlus, LogOut, Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AdminModal } from "@/components/ui/admin-modal";

const MEMBER_JOBS = ["vice leader", "member", "talent"];

const jobClass = (job) => {
  const map = {
    leader: "bg-red-500/10 text-red-600 dark:text-red-400",
    "vice leader": "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    member: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    talent: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  };
  return map[job?.toLowerCase()] || "bg-gray-500/10 text-gray-600 dark:text-gray-400";
};

export default function TeamPage() {
  const { user } = useAuth();
  const currentUserId = Number(user?.id_users);

  const [teams, setTeams] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [addModal, setAddModal] = useState({ open: false, teamId: null });
  const [roleModal, setRoleModal] = useState({ open: false, teamId: null, member: null });
  const [roleJob, setRoleJob] = useState("member");
  const [editModal, setEditModal] = useState({ open: false, team: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, team: null });

  const [memberIdInput, setMemberIdInput] = useState("");
  const [selectedJob, setSelectedJob] = useState("member");

  const [editNamaTim, setEditNamaTim] = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [leaveLoading, setLeaveLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const json = await api("/api/me/team");
      setTeams(json.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAddMember = (teamId) => {
    setModalError("");
    setMemberIdInput("");
    setSelectedJob("member");
    setAddModal({ open: true, teamId });
  };

  const handleAddMember = async () => {
    setModalError("");
    const idUser = Number(memberIdInput.trim());
    if (!memberIdInput.trim() || !Number.isInteger(idUser) || idUser <= 0) {
      setModalError("Please enter a valid user ID");
      return;
    }
    setModalLoading(true);
    try {
      await api(`/api/me/team/${addModal.teamId}/members`, {
        method: "POST",
        body: JSON.stringify({ idUser, job: selectedJob }),
      });
      setAddModal({ open: false, teamId: null });
      await load();
    } catch (e) {
      setModalError(e.message);
    } finally {
      setModalLoading(false);
    }
  };

  const openRoleChange = (member, teamId) => {
    setModalError("");
    setRoleJob(member.job);
    setRoleModal({ open: true, teamId, member });
  };

  const handleRoleChange = async () => {
    setModalError("");
    if (!roleModal.member) return;
    setModalLoading(true);
    try {
      await api(
        `/api/me/team/${roleModal.teamId}/members/${roleModal.member.idMember}`,
        {
          method: "PUT",
          body: JSON.stringify({ job: roleJob }),
        }
      );
      setRoleModal({ open: false, teamId: null, member: null });
      await load();
    } catch (e) {
      setModalError(e.message);
    } finally {
      setModalLoading(false);
    }
  };

  const openEdit = (team) => {
    setModalError("");
    setEditNamaTim(team.namaTim || "");
    setEditModal({ open: true, team });
  };

  const handleEdit = async () => {
    setModalError("");
    if (!editNamaTim.trim()) {
      setModalError("Team name is required");
      return;
    }
    setModalLoading(true);
    try {
      await api(`/api/me/team/${editModal.team.idTeam}`, {
        method: "PUT",
        body: JSON.stringify({ namaTim: editNamaTim.trim() }),
      });
      setEditModal({ open: false, team: null });
      await load();
    } catch (e) {
      setModalError(e.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async () => {
    setModalError("");
    setModalLoading(true);
    try {
      await api(`/api/me/team/${deleteModal.team.idTeam}`, { method: "DELETE" });
      setDeleteModal({ open: false, team: null });
      window.location.reload();
    } catch (e) {
      setModalError(e.message);
      setModalLoading(false);
    }
  };

  const handleLeave = async () => {
    setLeaveLoading(true);
    try {
      await api("/api/me/team/leave", { method: "POST" });
      window.location.reload();
    } catch (e) {
      alert(e.message);
      setLeaveLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />
    );
  }

  if (teams.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-14 text-center text-gray-400">
        You are not a member of any team yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {teams.map((team) => {
        const members = team.members || [];
        const myMember = members.find(
          (m) => Number(m.idUser) === currentUserId
        );
        const myRole = myMember?.job || "";
        const canManage =
          myRole === "leader" || myRole === "vice leader";

        const filtered = members.filter((m) => {
          const q = search.toLowerCase();
          return (
            (m.username || "").toLowerCase().includes(q) ||
            (m.email || "").toLowerCase().includes(q) ||
            (m.job || "").toLowerCase().includes(q)
          );
        });

        return (
          <div
            key={team.idTeam}
            className="w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden"
          >
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
                    <Layers className="h-6 w-6" />
                  </span>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {team.namaTim}
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Created{" "}
                      {team.createdAt
                        ? new Date(team.createdAt).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {team.kodeTim && (
                    <span className="inline-flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Team Code
                      </span>
                      <span className="font-mono text-sm font-semibold tracking-widest text-gray-900 dark:text-white">
                        {team.kodeTim}
                      </span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium">
                    <Users className="h-3.5 w-3.5" />
                    {team.memberCount} Members
                  </span>
                </div>
              </div>
              {myRole && (
                <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  You are a{" "}
                  <span
                    className={`font-medium capitalize ${jobClass(myRole)}`}
                  >
                    {myRole}
                  </span>
                </p>
              )}
            </div>

            <div className="p-4">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search members..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
                  />
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  {canManage && (
                    <button
                      onClick={() => openAddMember(team.idTeam)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
                    >
                      <UserPlus className="h-4 w-4" />
                      Add Member
                    </button>
                  )}
                  <button
                    onClick={handleLeave}
                    disabled={leaveLoading}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {leaveLoading ? (
                      <div className="h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <LogOut className="h-4 w-4" />
                    )}
                    Leave Team
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Member
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Role
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {filtered.length === 0 ? (
                        <tr>
                          <td
                            colSpan={2}
                            className="px-4 py-12 text-center text-gray-400"
                          >
                            No data available
                          </td>
                        </tr>
                      ) : (
                        filtered.map((m) => (
                          <tr
                            key={m.idMember}
                            className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-300 dark:bg-gray-700">
                                  <Mail className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                </span>
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-white">
                                    {m.namaLengkap || m.username || "—"}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    ID {m.idUser ?? "—"} · {m.email || "—"}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${jobClass(
                                    m.job
                                  )}`}
                                >
                                  {m.job || "—"}
                                </span>
                                {canManage && m.job !== "leader" && (
                                  <button
                                    onClick={() => openRoleChange(m, team.idTeam)}
                                    title="Change role"
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {canManage && (
              <div className="px-4 pb-5">
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => openEdit(team)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit Team
                  </button>
                  <button
                    onClick={() => setDeleteModal({ open: true, team })}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Team
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <AdminModal
        open={addModal.open}
        onClose={() => setAddModal({ open: false, teamId: null })}
        title="Add Member"
        footer={
          <>
            <button
              onClick={() => setAddModal({ open: false, teamId: null })}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleAddMember}
              disabled={modalLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50"
            >
              {modalLoading ? "Saving..." : "Add Member"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {modalError && (
            <p className="text-sm text-red-600 dark:text-red-400">{modalError}</p>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              User ID
            </label>
            <input
              type="number"
              min="0"
              value={memberIdInput}
              onChange={(e) => setMemberIdInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              placeholder="e.g. 69000015"
            />
<p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Enter the 8-digit user ID of the member to add. You can find it in the Users page, under the "User ID" column.
              </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Role
            </label>
            <select
              value={selectedJob}
              onChange={(e) => setSelectedJob(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            >
              {MEMBER_JOBS.map((job) => (
                <option key={job} value={job}>
                  {job.replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
        </div>
      </AdminModal>

      <AdminModal
        open={roleModal.open}
        onClose={() => setRoleModal({ open: false, teamId: null, member: null })}
        title="Change Role"
        footer={
          <>
            <button
              onClick={() => setRoleModal({ open: false, teamId: null, member: null })}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleRoleChange}
              disabled={modalLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50"
            >
              {modalLoading ? "Saving..." : "Save"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {modalError && (
            <p className="text-sm text-red-600 dark:text-red-400">{modalError}</p>
          )}
          {roleModal.member && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Member
              </label>
              <p className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white">
                {roleModal.member.namaLengkap || roleModal.member.username || "—"}
                <span className="text-gray-400">
                  {" "}
                  · ID {roleModal.member.idUser ?? "—"}
                </span>
              </p>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Role
            </label>
            <select
              value={roleJob}
              onChange={(e) => setRoleJob(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            >
              {MEMBER_JOBS.map((job) => (
                <option key={job} value={job}>
                  {job.replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
        </div>
      </AdminModal>

      <AdminModal
        open={editModal.open}
        onClose={() => setEditModal({ open: false, team: null })}
        title="Edit Team"
        footer={
          <>
            <button
              onClick={() => setEditModal({ open: false, team: null })}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleEdit}
              disabled={modalLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
            >
              {modalLoading ? "Saving..." : "Save"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {modalError && (
            <p className="text-sm text-red-600 dark:text-red-400">{modalError}</p>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Team Name
            </label>
            <input
              type="text"
              value={editNamaTim}
              onChange={(e) => setEditNamaTim(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
              placeholder="Enter team name"
            />
          </div>
        </div>
      </AdminModal>

      <AdminModal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, team: null })}
        title="Delete Team"
        footer={
          <>
            <button
              onClick={() => setDeleteModal({ open: false, team: null })}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={modalLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
            >
              {modalLoading ? "Deleting..." : "Delete"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {modalError && (
            <p className="text-sm text-red-600 dark:text-red-400">{modalError}</p>
          )}
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Delete team{" "}
            <span className="font-semibold">{deleteModal.team?.namaTim}</span>?
            This will delete the team and remove all its members from it. Members
            are not deleted. This action cannot be undone.
          </p>
        </div>
      </AdminModal>
    </div>
  );
}