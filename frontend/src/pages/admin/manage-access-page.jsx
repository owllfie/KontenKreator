"use client";

import React, { useState, useEffect } from "react";
import { Shield, ChevronDown, ChevronRight, Loader2 } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function ManageAccessPage() {
  const [roles, setRoles] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [expandedRole, setExpandedRole] = useState(null);
  const [rolePermissions, setRolePermissions] = useState({});
  const [selected, setSelected] = useState({});
  const [loadingPerms, setLoadingPerms] = useState({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await fetch(`${API}/api/admin/roles`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const json = await res.json();
        setRoles((json.data || []).filter((r) => (r.role || "").toLowerCase() !== "superadmin"));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    const fetchAllPermissions = async () => {
      try {
        const res = await fetch(`${API}/api/admin/roles/permissions`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const json = await res.json();
        setAllPermissions(json.data || []);
      } catch (e) {
        console.error(e);
      }
    };

    fetchRoles();
    fetchAllPermissions();
  }, []);

  const permissionGroups = () => {
    const map = {};
    (allPermissions || []).forEach((p) => {
      const key = p.fitur || "Lainnya";
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    return Object.entries(map);
  };

  const toggleRole = async (roleId) => {
    if (expandedRole === roleId) {
      setExpandedRole(null);
      return;
    }
    setExpandedRole(roleId);
    if (!rolePermissions[roleId]) {
      setLoadingPerms((prev) => ({ ...prev, [roleId]: true }));
      try {
        const res = await fetch(`${API}/api/admin/roles/${roleId}/permissions`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const json = await res.json();
        const perms = json.data || [];
        setRolePermissions((prev) => ({ ...prev, [roleId]: perms }));
        setSelected((prev) => ({
          ...prev,
          [roleId]: new Set(perms.map((p) => p.idPermission)),
        }));
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingPerms((prev) => ({ ...prev, [roleId]: false }));
      }
    }
    setNotice(null);
  };

  const togglePerm = (roleId, permId) => {
    setSelected((prev) => {
      const nextSet = new Set(prev[roleId] || []);
      if (nextSet.has(permId)) nextSet.delete(permId);
      else nextSet.add(permId);
      return { ...prev, [roleId]: nextSet };
    });
  };

  const savePermissions = async (roleId) => {
    setSaving(true);
    setNotice(null);
    try {
      const ids = Array.from(selected[roleId] || []);
      const res = await fetch(`${API}/api/admin/roles/${roleId}/permissions`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ permissions: ids }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to save permissions");
      setRolePermissions((prev) => ({
        ...prev,
        [roleId]: allPermissions.filter((p) => ids.includes(p.idPermission)),
      }));
      const roleName = roles.find((r) => r.idRole === roleId)?.role || "Role";
      setNotice({ ok: true, message: `Permissions saved for "${roleName}"` });
    } catch (e) {
      setNotice({ ok: false, message: e.message || "Failed to save permissions" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Manage Access</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Manage role permissions. Click a role to see every module and enable the permissions you want.
        </p>
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-8" />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Permissions</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={4} className="px-4 py-4">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : roles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-gray-400">No roles found</td>
                </tr>
              ) : (
                roles.map((role) => (
                  <React.Fragment key={role.idRole}>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => toggleRole(role.idRole)}>
                      <td className="px-4 py-3">
                        {expandedRole === role.idRole ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-red-500" />
                          <span className="font-medium">{role.role}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {rolePermissions[role.idRole]
                          ? `${rolePermissions[role.idRole].length} permissions`
                          : "Click to expand"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {role.createdAt ? new Date(role.createdAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                    {expandedRole === role.idRole && (
                      <tr>
                        <td colSpan={4} className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50">
                          <div className="pl-8 pr-4 py-2">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-sm font-semibold">
                                Permissions for <span className="text-red-600">{role.role}</span>
                              </h3>
                              <button
                                onClick={() => savePermissions(role.idRole)}
                                disabled={saving}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-50 inline-flex items-center gap-1.5"
                              >
                                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                Save Changes
                              </button>
                            </div>

                            {loadingPerms[role.idRole] ? (
                              <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                                <Loader2 className="h-4 w-4 animate-spin" /> Loading permissions...
                              </div>
                            ) : allPermissions.length === 0 ? (
                              <p className="text-sm text-gray-400 py-2">No modules available</p>
                            ) : (
                              <div className="space-y-5">
                                {permissionGroups().map(([fitur, perms]) => (
                                  <div key={fitur}>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                                      {fitur}
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                      {perms.map((perm) => (
                                        <label
                                          key={perm.idPermission}
                                          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 cursor-pointer hover:border-red-300 dark:hover:border-red-500/40 transition"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={selected[role.idRole]?.has(perm.idPermission) || false}
                                            onChange={() => togglePerm(role.idRole, perm.idPermission)}
                                            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                                          />
                                          <span className="text-sm text-gray-700 dark:text-gray-300">
                                            {perm.namaPermission}
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
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