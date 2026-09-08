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
} from "lucide-react";
import UsersPage from "@/pages/admin/users-page";
import ManageAccessPage from "@/pages/admin/manage-access-page";
import ActivityLogPage from "@/pages/admin/activity-log-page";
import TeamsPage from "@/pages/admin/teams-page";
import ProjectsPage from "@/pages/admin/projects-page";
import ScriptsPage from "@/pages/admin/scripts-page";
import ContentsPage from "@/pages/admin/contents-page";
import BackupPage from "@/pages/admin/backup-page";
import ChatPanel from "@/components/ui/chat-panel";
import ProfilePage from "@/pages/admin/profile-page";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const navItems = [
  { Icon: Home, title: "Dashboard", path: "/dashboard" },
  { Icon: Users, title: "Users", path: "/dashboard/users" },
  { Icon: Layers, title: "Teams", path: "/dashboard/teams" },
  { Icon: FolderKanban, title: "Projects", path: "/dashboard/projects" },
  { Icon: FileText, title: "Scripts", path: "/dashboard/scripts" },
  { Icon: FileVideo2, title: "Contents", path: "/dashboard/contents" },
  { Icon: Shield, title: "Manage Access", path: "/dashboard/manage-access" },
  { Icon: Activity, title: "Activity Log", path: "/dashboard/activity-log" },
  { Icon: Database, title: "Backup Database", path: "/dashboard/backup" },
];

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

const Sidebar = () => {
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
      className={`sticky top-0 h-screen shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-2 shadow-sm transition-all duration-300 ease-in-out ${
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

      <div className="space-y-1 mb-8">
        {navItems.map((item) => (
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
            title="Menu profil"
          >
            <div className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center shrink-0">
              <User className="h-4 w-4" />
            </div>
            {open && (
              <>
                <div className="text-left flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{user?.username ?? "Admin"}</p>
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
                    navigate("/dashboard/profile");
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  Profil
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

const DashboardLayout = () => {
  const location = useLocation();
  const [copilotOpen, setCopilotOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const getPageTitle = () => {
    const item = navItems.find(
      (n) => n.path === location.pathname || (n.path !== "/dashboard" && location.pathname.startsWith(n.path))
    );
    return item?.title || "Dashboard";
  };

  return (
    <div className="flex min-h-screen w-full">
      <div className="flex w-full bg-background text-foreground">
        <Sidebar />
        <div className="flex-1 p-6">
          <header className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold">{getPageTitle()}</h1>
            </div>
          </header>
          <Routes>
            <Route index element={<DashboardOverview />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="teams" element={<TeamsPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="scripts" element={<ScriptsPage />} />
            <Route path="contents" element={<ContentsPage />} />
            <Route path="manage-access" element={<ManageAccessPage />} />
            <Route path="activity-log" element={<ActivityLogPage />} />
            <Route path="backup" element={<BackupPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
        <ChatPanel open={copilotOpen} onToggle={() => setCopilotOpen((v) => !v)} />
      </div>
    </div>
  );
};

export default DashboardLayout;