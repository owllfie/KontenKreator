"use client";

import React, { useState, useEffect } from "react";
import { Shield, ChevronDown, ChevronRight } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function ManageAccessPage() {
  const [roles, setRoles] = useState([]);
  const [expandedRole, setExpandedRole] = useState(null);
  const [rolePermissions, setRolePermissions] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await fetch(`${API}/api/admin/roles`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const json = await res.json();
        setRoles((json.data || []).filter((r) => r.role !== "superadmin"));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchRoles();
  }, []);

  const toggleRole = async (roleId) => {
    if (expandedRole === roleId) {
      setExpandedRole(null);
      return;
    }
    setExpandedRole(roleId);
    if (!rolePermissions[roleId]) {
      try {
        const res = await fetch(`${API}/api/admin/roles/${roleId}/permissions`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const json = await res.json();
        setRolePermissions((prev) => ({ ...prev, [roleId]: json.data || [] }));
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Manage Access</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">View roles and their assigned permissions</p>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
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
                        <div className="pl-8">
                          {(rolePermissions[role.idRole] || []).length === 0 ? (
                            <p className="text-sm text-gray-400 py-2">No permissions assigned</p>
                          ) : (
                            <div className="flex flex-wrap gap-2 py-2">
                              {(rolePermissions[role.idRole] || []).map((perm) => (
                                <span
                                  key={perm.idPermission}
                                  className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                                >
                                  <span className="text-gray-400 mr-1">{perm.fitur}:</span>
                                  {perm.namaPermission}
                                </span>
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
  );
}

function getToken() {
  try {
    const raw = localStorage.getItem("creator-agency-auth");
    if (raw) return JSON.parse(raw).token || "";
  } catch {}
  return "";
}
