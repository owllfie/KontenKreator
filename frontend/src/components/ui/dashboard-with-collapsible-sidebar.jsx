"use client";

import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import {
  Home,
  Users,
  Shield,
  Activity,
  Database,
  Layers,
  ChevronDown,
  ChevronsRight,
  User,
  LogOut,
  Search,
  FolderKanban,
  FileText,
  FileVideo2,
  Edit2,
  Trash2,
} from "lucide-react";
import UsersPage from "@/pages/admin/users-page";
import ManageAccessPage from "@/pages/admin/manage-access-page";
import ActivityLogPage from "@/pages/admin/activity-log-page";
import TeamsPage from "@/pages/admin/teams-page";
import BackupPage from "@/pages/admin/backup-page";
import ChatPanel from "@/components/ui/chat-panel";
import ProfileModal from "@/pages/admin/profile-page";
import SidebarDateTime from "@/components/ui/sidebar-datetime";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const mainNavItems = [
  { Icon: Home, title: "Dashboard", path: "/dashboard", perm: "view_dashboard" },
  { Icon: Users, title: "Users", path: "/dashboard/users", perm: "view_users" },
  { Icon: Layers, title: "Teams", path: "/dashboard/teams", perm: "view_teams" },
  { Icon: Shield, title: "Manage Access", path: "/dashboard/manage-access", superadmin: true },
];

const tailNavItems = [
  { Icon: Database, title: "Backup Database", path: "/dashboard/backup", perm: "view_backup", superadmin: true },
];

const logSubItems = [
  { Icon: FileText, title: "Insert Log", path: "/dashboard/activity-log/insert" },
  { Icon: Edit2, title: "Update Log", path: "/dashboard/activity-log/update" },
  { Icon: Trash2, title: "Delete Log", path: "/dashboard/activity-log/delete" },
];

function isSuperadmin(user) {
  return (user?.role || "").toLowerCase() === "superadmin";
}

function hasPerm(user, code) {
  if (isSuperadmin(user)) return true;
  if (!Array.isArray(user?.permissions)) return true;
  return user.permissions.includes(code);
}

const isNavVisible = (user, item) =>
  (!item.perm || hasPerm(user, item.perm)) && (!item.superadmin || isSuperadmin(user));

const TitleSection = ({ open }) => (
  <div
    className={`flex items-center gap-2 mb-8 ${
      open ? "justify-between" : "justify-center"
    }`}
  >
    {open && (
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-red-500 flex items-center justify-center text-white">
          <Layers className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">Creator Studio</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Agency CMS</p>
        </div>
      </div>
    )}
  </div>
);

const NavOption = ({
  Icon,
  title,
  path,
  currentPath,
  navigate,
  open,
}) => {
  const isActive = currentPath === path || (path !== "/dashboard" && currentPath.startsWith(path));
  return (
    <button
      onClick={() => navigate(path)}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 ${
        isActive
          ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium"
          : ""
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {open && <span className="flex-1 text-left truncate">{title}</span>}
    </button>
  );
};

const LogsDropdown = ({ currentPath, navigate, open }) => {
  const [dropOpen, setDropOpen] = useState(false);
  const isActive = currentPath.startsWith("/dashboard/activity-log");
  return (
    <div className="relative">
      <button
        onClick={() => setDropOpen((v) => !v)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 ${
          isActive ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium" : ""
        }`}
      >
        <Activity className="h-4 w-4 shrink-0" />
        {open && (
          <>
            <span className="flex-1 text-left truncate">Activity Log</span>
            <ChevronDown
              className={`h-4 w-4 text-gray-400 transition-transform ${dropOpen ? "rotate-180" : ""}`}
            />
          </>
        )}
      </button>

      {dropOpen && (open ? (
        <div className="pb-1">
          {logSubItems.map((item) => {
            const itemActive = currentPath === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 pl-11 pr-3 py-2 ml-2 text-sm text-left rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${
                  itemActive
                    ? "bg-red-500/10 text-red-600 dark:text-red-400 font-medium"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                <item.Icon className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
                {item.title}
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setDropOpen(false)} />
          <div className="absolute z-20 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg left-1/2 -translate-x-1/2 mt-1 min-w-[150px]">
            {logSubItems.map((item) => {
              const itemActive = currentPath === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-800 ${
                    itemActive
                      ? "bg-red-500/10 text-red-600 dark:text-red-400 font-medium"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  <item.Icon className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
                  {item.title}
                </button>
              );
            })}
          </div>
        </>
      ))}
    </div>
  );
};

const Sidebar = ({ onOpenProfile }) => {
  const [open, setOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <nav
      className={`relative h-full shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-2 shadow-sm transition-all duration-300 ease-in-out ${
        open ? "w-64" : "w-16"
      }`}
    >
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2 p-2 mb-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 ${
          open ? "justify-end" : "justify-center"
        }`}
        title={open ? "Collapse" : "Expand"}
      >
        <ChevronsRight
          className={`h-5 w-5 transition-transform ${!open ? "rotate-180" : ""}`}
        />
      </button>

      <TitleSection open={open} />

      <SidebarDateTime open={open} />

      <div className="space-y-1 mb-8">
        {mainNavItems.filter((item) => isNavVisible(user, item)).map((item) => (
          <NavOption
            key={item.path}
            Icon={item.Icon}
            title={item.title}
            path={item.path}
            currentPath={location.pathname}
            navigate={navigate}
            open={open}
          />
        ))}
        {isSuperadmin(user) && (
          <LogsDropdown
            currentPath={location.pathname}
            navigate={navigate}
            open={open}
          />
        )}
        {tailNavItems.filter((item) => isNavVisible(user, item)).map((item) => (
          <NavOption
            key={item.path}
            Icon={item.Icon}
            title={item.title}
            path={item.path}
            currentPath={location.pathname}
            navigate={navigate}
            open={open}
          />
        ))}
      </div>

      <div className="absolute bottom-3 left-2 right-2">
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className={`w-full flex items-center gap-3 p-2 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 ${
              open ? "" : "justify-center"
            }`}
            title="User menu"
          >
            <div className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center shrink-0">
              <User className="h-4 w-4" />
            </div>
            {open && (
              <>
                <div className="text-left flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{user?.namaLengkap || user?.username || "Admin"}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                    {user?.email ?? "admin@studio.com"}
                  </p>
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
              </>
            )}
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div
                className={`absolute z-20 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg ${
                  open ? "left-2 right-2 bottom-full mb-2" : "left-1/2 -translate-x-1/2 bottom-full mb-2"
                }`}
              >
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenProfile();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  Profile
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

const DashboardOverview = () => {
  const [stats, setStats] = useState({
    activeUsers: 0,
    totalProjects: 0,
    totalTeams: 0,
    totalScripts: 0,
    totalContents: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/dashboard`)
      .then((r) => r.json())
      .then((json) => {
        setStats({
          activeUsers: json?.data?.activeUsers ?? 0,
          totalProjects: json?.data?.totalProjects ?? 0,
          totalTeams: json?.data?.totalTeams ?? 0,
          totalScripts: json?.data?.totalScripts ?? 0,
          totalContents: json?.data?.totalContents ?? 0,
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="w-3/4">
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2">
        <StatCard label="Active Users" value={stats.activeUsers} icon={Users} accent="bg-blue-500/10 text-blue-500" loading={loading} />
        <StatCard label="Total Teams" value={stats.totalTeams} icon={Layers} accent="bg-purple-500/10 text-purple-500" loading={loading} />
        <StatCard label="Projects" value={stats.totalProjects} icon={FolderKanban} accent="bg-green-500/10 text-green-500" loading={loading} />
        <StatCard label="Scripts" value={stats.totalScripts} icon={FileText} accent="bg-amber-500/10 text-amber-500" loading={loading} />
        <StatCard label="Contents" value={stats.totalContents} icon={FileVideo2} accent="bg-pink-500/10 text-pink-500" loading={loading} />
      </div>
    </div>
  );
};

const StatCard = ({
  label,
  value,
  icon: Icon,
  accent,
  loading,
}) => (
  <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        {loading ? (
          <div className="mt-2 h-9 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        ) : (
          <p className="mt-2 text-3xl font-bold">{value}</p>
        )}
      </div>
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${accent}`}>
        <Icon className="h-6 w-6" />
      </div>
    </div>
  </div>
);

const RequireSuperadmin = ({ children }) => {
  const { user } = useAuth();
  if (isSuperadmin(user)) return children;
  return <Navigate to="/dashboard" replace />;
};

const RequirePerm = ({ code, children }) => {
  const { user } = useAuth();
  if (hasPerm(user, code)) return children;
  return <Navigate to="/dashboard" replace />;
};

const DashboardLayout = () => {
  const location = useLocation();
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const getPageTitle = () => {
    const p = location.pathname;
    if (p.startsWith("/dashboard/activity-log/insert")) return "Insert Log";
    if (p.startsWith("/dashboard/activity-log/update")) return "Update Log";
    if (p.startsWith("/dashboard/activity-log/delete")) return "Delete Log";
    if (p.startsWith("/dashboard/activity-log")) return "Activity Log";
    const item = [...mainNavItems, ...tailNavItems].find(
      (n) => n.path === p || (n.path !== "/dashboard" && p.startsWith(n.path))
    );
    return item?.title || "Dashboard";
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <div className="flex w-full bg-background text-foreground overflow-hidden">
        <Sidebar onOpenProfile={() => setProfileOpen(true)} />
        <div className="flex-1 p-6 overflow-y-auto min-h-0">
          <header className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold">{getPageTitle()}</h1>
            </div>
          </header>
          <Routes>
            <Route index element={<DashboardOverview />} />
            <Route path="users" element={<RequirePerm code="view_users"><UsersPage /></RequirePerm>} />
            <Route path="teams" element={<RequirePerm code="view_teams"><TeamsPage /></RequirePerm>} />
            <Route path="manage-access" element={<RequireSuperadmin><ManageAccessPage /></RequireSuperadmin>} />
            <Route path="activity-log" element={<RequireSuperadmin><ActivityLogPage /></RequireSuperadmin>} />
            <Route path="activity-log/insert" element={<RequireSuperadmin><ActivityLogPage logFilter="insert" /></RequireSuperadmin>} />
            <Route path="activity-log/update" element={<RequireSuperadmin><ActivityLogPage logFilter="update" /></RequireSuperadmin>} />
            <Route path="activity-log/delete" element={<RequireSuperadmin><ActivityLogPage logFilter="delete" /></RequireSuperadmin>} />
            <Route path="backup" element={<RequireSuperadmin><BackupPage /></RequireSuperadmin>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
        <ChatPanel open={copilotOpen} onToggle={() => setCopilotOpen((v) => !v)} />
        <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      </div>
    </div>
  );
};

export default DashboardLayout;