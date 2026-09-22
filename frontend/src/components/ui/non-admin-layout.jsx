"use client";

import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Outlet, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import {
  Layers,
  ChevronDown,
  ChevronsRight,
  User,
  LogOut,
  FolderKanban,
  ShieldCheck,
} from "lucide-react";
import GetStartedTeam from "@/components/ui/get-started-team";
import ChatPanel from "@/components/ui/chat-panel";
import SidebarDateTime from "@/components/ui/sidebar-datetime";

const navItems = [
  { Icon: ShieldCheck, title: "Team", path: "/app/team" },
  { Icon: FolderKanban, title: "Projects", path: "/app/project" },
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
          <p className="text-xs text-gray-500 dark:text-gray-400">Member Area</p>
        </div>
      </div>
    )}
  </div>
);

const NavOption = ({ Icon, title, path, currentPath, open }) => {
  const isActive =
    currentPath === path ||
    (path !== "/app" && currentPath.startsWith(path));
  return (
    <Link
      to={path}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 ${
        isActive
          ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium"
          : ""
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {open && <span className="flex-1 text-left truncate">{title}</span>}
    </Link>
  );
};

const Sidebar = ({ items }) => {
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

      {items.length > 0 && (
        <div className="space-y-1 mb-8">
          {items.map((item) => (
            <NavOption
              key={item.path}
              Icon={item.Icon}
              title={item.title}
              path={item.path}
              currentPath={location.pathname}
              open={open}
            />
          ))}
        </div>
      )}

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
                  <p className="text-xs font-medium truncate">
                    {user?.namaLengkap || user?.username || "Member"}
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                    {user?.email ?? "member@studio.com"}
                  </p>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-gray-400 transition-transform ${
                    menuOpen ? "rotate-180" : ""
                  }`}
                />
              </>
            )}
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div
                className={`absolute z-20 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg ${
                  open
                    ? "left-2 right-2 bottom-full mb-2"
                    : "left-1/2 -translate-x-1/2 bottom-full mb-2"
                }`}
              >
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

const NonAdminLayout = () => {
  const location = useLocation();
  const [myTeams, setMyTeams] = useState(null);
  const [copilotOpen, setCopilotOpen] = useState(false);

  const reloadTeams = async () => {
    try {
      const json = await api("/api/me/team");
      setMyTeams(json.data || []);
    } catch (e) {
      console.error(e);
      setMyTeams([]);
    }
  };

  useEffect(() => {
    reloadTeams();
  }, []);

  const loading = myTeams === null;
  const hasTeam = (myTeams?.length ?? 0) > 0;

  const getPageTitle = () => {
    const item = navItems.find(
      (n) => n.path === location.pathname || (n.path !== "/app" && location.pathname.startsWith(n.path))
    );
    return item?.title || "Member Area";
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <div className="flex w-full bg-background text-foreground overflow-hidden">
        <Sidebar items={hasTeam ? navItems : []} />
        <div className="flex-1 p-6 overflow-y-auto min-h-0">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse"
                />
              ))}
            </div>
          ) : hasTeam ? (
            <>
              <header className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{getPageTitle()}</h1>
                </div>
              </header>
              <Outlet />
            </>
          ) : (
            <GetStartedTeam onJoined={reloadTeams} />
          )}
        </div>
        <ChatPanel open={copilotOpen} onToggle={() => setCopilotOpen((v) => !v)} />
      </div>
    </div>
  );
};

export default NonAdminLayout;