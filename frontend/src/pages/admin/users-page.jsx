"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, Plus, Edit2, Trash2, KeyRound, RotateCcw, Eye, EyeOff } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { AdminModal } from "@/components/ui/admin-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [loading, setLoading] = useState(true);

  const [editModal, setEditModal] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    noTelp: "",
    idRole: 0,
    status: "active",
  });

  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    user: null,
    type: "soft",
  });
  const [resetDialog, setResetDialog] = useState({
    open: false,
    user: null,
  });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "10",
      search,
      status: statusFilter,
      role: roleFilter,
      showDeleted: String(showDeleted),
    });
    try {
      const res = await fetch(`${API}/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      const rows = (json.data?.rows || []).filter((r) => r.roleName !== "superadmin");
      setUsers(rows);
      setTotal(json.data?.total || 0);
      setTotalPages(json.data?.totalPages || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, roleFilter, showDeleted]);

  const fetchRoles = async () => {
    try {
      const res = await fetch(`${API}/api/admin/roles`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      const list = (json.data || []).filter((r) => r.role !== "superadmin");
      setRoles(list);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, roleFilter, showDeleted]);

  const openEdit = (user) => {
    setEditUser(user);
    setForm({
      username: user.username,
      email: user.email,
      password: "",
      noTelp: user.noTelp || "",
      idRole: user.idRole,
      status: user.status,
    });
    setEditModal(true);
  };

  const openCreate = () => {
    setEditUser(null);
    setForm({ username: "", email: "", password: "", noTelp: "", idRole: 0, status: "active" });
    setCreateModal(true);
  };

  const handleSave = async () => {
    setActionLoading(true);
    try {
      if (editUser) {
        await fetch(`${API}/api/admin/users/${editUser.idUsers}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ username: form.username, email: form.email, noTelp: form.noTelp, idRole: form.idRole, status: form.status }),
        });
        setEditModal(false);
      } else {
        await fetch(`${API}/api/admin/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify(form),
        });
        setCreateModal(false);
      }
      fetchUsers();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.user) return;
    setActionLoading(true);
    try {
      const endpoint =
        deleteDialog.type === "permanent"
          ? `${API}/api/admin/users/${deleteDialog.user.idUsers}/permanent`
          : `${API}/api/admin/users/${deleteDialog.user.idUsers}/soft-delete`;
      await fetch(endpoint, {
        method: deleteDialog.type === "permanent" ? "DELETE" : "PUT",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setDeleteDialog({ open: false, user: null, type: "soft" });
      fetchUsers();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetDialog.user) return;
    setActionLoading(true);
    try {
      await fetch(`${API}/api/admin/users/${resetDialog.user.idUsers}/reset-password`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setResetDialog({ open: false, user: null });
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async (user) => {
    try {
      await fetch(`${API}/api/admin/users/${user.idUsers}/restore`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      fetchUsers();
    } catch (e) {
      console.error(e);
    }
  };

  const columns = [
    { key: "username", label: "Username" },
    { key: "email", label: "Email" },
    { key: "noTelp", label: "Phone" },
    {
      key: "roleName",
      label: "Role",
      render: (row) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
          {row.roleName}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => {
        const colors = {
          active: "bg-green-500/10 text-green-600 dark:text-green-400",
          inactive: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
          suspended: "bg-red-500/10 text-red-600 dark:text-red-400",
        };
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[row.status] || colors.inactive}`}>
            {row.status}
          </span>
        );
      },
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
                onClick={() => setResetDialog({ open: true, user: row })}
                className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-500/10 transition-colors"
                title="Reset Password"
              >
                <KeyRound className="h-4 w-4" />
              </button>
              <button
                onClick={() => setDeleteDialog({ open: true, user: row, type: "soft" })}
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                title="Soft Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setDeleteDialog({ open: true, user: row, type: "permanent" })}
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
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage user accounts</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" /> Add User
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
        >
          <option value="">All Roles</option>
          {roles.map((r) => (
            <option key={r.idRole} value={r.idRole}>
              {r.role}
            </option>
          ))}
        </select>
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
        data={users}
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        loading={loading}
      />

      <AdminModal
        open={editModal}
        onClose={() => setEditModal(false)}
        title="Edit User"
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
          <InputField label="Username" value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
          <InputField label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
          <InputField label="Phone" value={form.noTelp} onChange={(v) => setForm({ ...form, noTelp: v })} />
          <SelectField label="Role" value={String(form.idRole)} onChange={(v) => setForm({ ...form, idRole: Number(v) })} options={roles.map((r) => ({ value: String(r.idRole), label: r.role }))} />
          <SelectField label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "suspended", label: "Suspended" }]} />
        </div>
      </AdminModal>

      <AdminModal
        open={createModal}
        onClose={() => setCreateModal(false)}
        title="Add User"
        footer={
          <>
            <button onClick={() => setCreateModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">
              Cancel
            </button>
            <button onClick={handleSave} disabled={actionLoading} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white disabled:opacity-50">
              {actionLoading ? "Creating..." : "Create User"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <InputField label="Username" value={form.username} onChange={(v) => setForm({ ...form, username: v })} />
          <InputField label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
          <InputField label="Password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} type="password" />
          <InputField label="Phone" value={form.noTelp} onChange={(v) => setForm({ ...form, noTelp: v })} />
          <SelectField label="Role" value={String(form.idRole)} onChange={(v) => setForm({ ...form, idRole: Number(v) })} options={roles.map((r) => ({ value: String(r.idRole), label: r.role }))} />
          <SelectField label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "suspended", label: "Suspended" }]} />
        </div>
      </AdminModal>

      <ConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, user: null, type: "soft" })}
        onConfirm={handleDelete}
        title={deleteDialog.type === "permanent" ? "Delete Permanently?" : "Soft Delete User?"}
        message={
          deleteDialog.type === "permanent"
            ? `This will permanently remove "${deleteDialog.user?.username}". This action cannot be undone.`
            : `This will soft-delete "${deleteDialog.user?.username}". The user can be restored later.`
        }
        confirmLabel={deleteDialog.type === "permanent" ? "Delete Permanently" : "Soft Delete"}
        variant="danger"
        loading={actionLoading}
      />

      <ConfirmDialog
        open={resetDialog.open}
        onClose={() => setResetDialog({ open: false, user: null })}
        onConfirm={handleResetPassword}
        title="Reset Password?"
        message={`Reset "${resetDialog.user?.username}"'s password to the default "password"?`}
        confirmLabel="Reset Password"
        variant="warning"
        loading={actionLoading}
      />
    </div>
  );
}

function InputField({ label, value, onChange, type = "text" }) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={isPassword && !show ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
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
