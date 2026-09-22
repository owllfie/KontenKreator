"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, Plus, Edit2, Trash2, KeyRound, RotateCcw, Eye, EyeOff } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { AdminModal } from "@/components/ui/admin-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdminNotice, useAdminNotice } from "@/components/ui/admin-notice";

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
  const [loading, setLoading] = useState(true);

  const [editModal, setEditModal] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({
    username: "",
    namaLengkap: "",
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

  const [selected, setSelected] = useState(new Set());
  const [bulkDialog, setBulkDialog] = useState({ open: false, type: "selected" });
  const [bulkLoading, setBulkLoading] = useState(false);

  const { notice, setNotice, showNotice } = useAdminNotice();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "10",
      search,
      status: statusFilter,
      role: roleFilter,
    });
    try {
      const res = await fetch(`${API}/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      const rows = (json.data?.rows || []).filter(
        (r) => (r.roleName || "").toLowerCase() !== "superadmin"
      );
      setUsers(rows);
      setTotal(json.data?.total || 0);
      setTotalPages(json.data?.totalPages || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, roleFilter]);

  const fetchRoles = async () => {
    try {
      const res = await fetch(`${API}/api/admin/roles`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      const list = (json.data || []).filter(
        (r) => (r.role || "").toLowerCase() !== "superadmin"
      );
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
  }, [search, statusFilter, roleFilter]);

  useEffect(() => {
    const pageIds = new Set(users.map((u) => u.idUsers));
    setSelected((prev) => {
      const next = new Set();
      prev.forEach((id) => {
        if (pageIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [users]);

  const openEdit = (user) => {
    setEditUser(user);
    setForm({
      username: user.username,
      namaLengkap: user.namaLengkap || "",
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
    setForm({ username: "", namaLengkap: "", email: "", password: "", noTelp: "", idRole: 0, status: "active" });
    setCreateModal(true);
  };

  const handleSave = async () => {
    setActionLoading(true);
    try {
      if (!form.username.trim() || !form.email.trim()) {
        showNotice("Username and email are required", "error");
        return;
      }
      if (!form.idRole) {
        showNotice("Please select a role", "error");
        return;
      }
      if (!editUser && !form.password.trim()) {
        showNotice("Password is required for a new user", "error");
        return;
      }
      const endpoint = editUser
        ? `${API}/api/admin/users/${editUser.idUsers}`
        : `${API}/api/admin/users`;
      const res = await fetch(endpoint, {
        method: editUser ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          username: form.username,
          namaLengkap: form.namaLengkap,
          email: form.email,
          password: form.password || null,
          noTelp: form.noTelp,
          idRole: Number(form.idRole),
          status: form.status,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || `Failed to save user (${res.status})`);
      setEditModal(false);
      setCreateModal(false);
      showNotice(editUser ? "User updated successfully" : "User created successfully");
      fetchUsers();
    } catch (e) {
      console.error(e);
      showNotice(e.message || "Failed to save user", "error");
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
      showNotice(defaultMessage("User", "deleted"));
      fetchUsers();
    } catch (e) {
      console.error(e);
      showNotice("Failed to delete user", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetDialog.user) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/users/${resetDialog.user.idUsers}/reset-password`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showNotice(data.message || "Failed to reset password", "error");
        return;
      }
      setResetDialog({ open: false, user: null });
      showNotice(`Password for "${resetDialog.user.namaLengkap || resetDialog.user.username}" has been reset successfully`);
      fetchUsers();
    } catch {
      showNotice("Cannot connect to the server", "error");
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
      showNotice(defaultMessage("User", "restored"));
      fetchUsers();
    } catch (e) {
      console.error(e);
    }
  };

  const handleBulkDelete = async () => {
    setBulkLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/users/${bulkDialog.type === "all" ? "delete-all" : "bulk-delete"}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: bulkDialog.type === "all" ? undefined : JSON.stringify({ ids: Array.from(selected) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || "Failed to delete users");
      setBulkDialog({ open: false, type: "selected" });
      setSelected(new Set());
      showNotice(json.message || "Users deleted successfully");
      fetchUsers();
    } catch (e) {
      console.error(e);
      showNotice(e.message || "Failed to delete users", "error");
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

  const toggleAll = (pageIds) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = pageIds.every((id) => next.has(id));
      if (allSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const columns = [
    {
      key: "idUsers",
      label: "User ID",
      render: (row) => (
        <span className="font-mono text-xs text-gray-500 dark:text-gray-400 tabular-nums">
          {row.idUsers}
        </span>
      ),
    },
    {
      key: "username",
      label: "Username",
      render: (row) => (
        <span className="font-medium text-gray-900 dark:text-white">{row.username}</span>
      ),
    },
    {
      key: "namaLengkap",
      label: "Full Name",
      render: (row) => (
        <span className="text-gray-900 dark:text-white">
          {row.namaLengkap || "—"}
        </span>
      ),
    },
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
                title="Delete"
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

      <AdminNotice notice={notice} onClose={() => setNotice(null)} />

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
        <button
          onClick={() => selected.size > 0 && setBulkDialog({ open: true, type: "selected" })}
          disabled={selected.size === 0}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Delete Selected ({selected.size})
        </button>
        <button
          onClick={() => setBulkDialog({ open: true, type: "all" })}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
        >
          Delete All
        </button>
      </div>

      <DataTable
        columns={columns}
        data={users}
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        loading={loading}
        selectable
        selected={selected}
        onToggleRow={toggleRow}
        onToggleAll={toggleAll}
        getRowId={(row) => row.idUsers}
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
          <InputField label="Full Name" value={form.namaLengkap} onChange={(v) => setForm({ ...form, namaLengkap: v })} />
          <InputField label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
          <InputField label="Phone" value={form.noTelp} onChange={(v) => setForm({ ...form, noTelp: v })} />
          <SelectField label="Role" placeholder="Select Role" value={String(form.idRole)} onChange={(v) => setForm({ ...form, idRole: Number(v) })} options={roles.map((r) => ({ value: String(r.idRole), label: r.role }))} />
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
          <InputField label="Full Name" value={form.namaLengkap} onChange={(v) => setForm({ ...form, namaLengkap: v })} />
          <InputField label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
          <InputField label="Password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} type="password" />
          <InputField label="Phone" value={form.noTelp} onChange={(v) => setForm({ ...form, noTelp: v })} />
          <SelectField label="Role" placeholder="Select Role" value={String(form.idRole)} onChange={(v) => setForm({ ...form, idRole: Number(v) })} options={roles.map((r) => ({ value: String(r.idRole), label: r.role }))} />
          <SelectField label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "suspended", label: "Suspended" }]} />
        </div>
      </AdminModal>

      <ConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, user: null, type: "soft" })}
        onConfirm={handleDelete}
        title={deleteDialog.type === "permanent" ? "Delete Permanently?" : "Delete User?"}
        message={
          deleteDialog.type === "permanent"
            ? `This will permanently remove "${deleteDialog.user?.username}". This action cannot be undone.`
            : `This will delete "${deleteDialog.user?.username}". The user can be restored later.`
        }
        confirmLabel={deleteDialog.type === "permanent" ? "Delete Permanently" : "Delete"}
        variant="danger"
        loading={actionLoading}
      />

      <ConfirmDialog
        open={bulkDialog.open}
        onClose={() => setBulkDialog({ open: false, type: "selected" })}
        onConfirm={handleBulkDelete}
        title={bulkDialog.type === "all" ? "Delete All Users?" : "Delete Selected Users?"}
        message={
          bulkDialog.type === "all"
            ? `This will delete all users (${total} total). The Superadmin account is never affected. Are you sure?`
            : `This will delete ${selected.size} selected user(s). Are you sure?`
        }
        confirmLabel="Delete"
        variant="danger"
        loading={bulkLoading}
      />

      <ConfirmDialog
        open={resetDialog.open}
        onClose={() => setResetDialog({ open: false, user: null })}
        onConfirm={handleResetPassword}
        title="Reset Password?"
        message={`Reset "${resetDialog.user?.username}"'s password? They will be able to log in with the new password.`}
        confirmLabel="Reset Password"
        variant="warning"
        loading={actionLoading}
      />
    </div>
  );
}

function defaultMessage(item, action) {
  return `${item} ${action} successfully`;
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

function SelectField({ label, value, onChange, options, placeholder }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
      >
        {placeholder && <option value="">{placeholder}</option>}
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