import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import '@/index.css';
import { AuthProvider, useAuth } from '@/lib/auth';
import LandingPage from '@/components/demo';
import Dashboard from '@/components/ui/dashboard-with-collapsible-sidebar';
import NonAdminLayout from '@/components/ui/non-admin-layout';
import TeamPage from '@/pages/user/team-page';
import ProjectPage from '@/pages/user/project-page';
import ScriptDetailPage from '@/pages/user/script-detail-page';
import ContentDetailPage from '@/pages/user/content-detail-page';

const isAdminRole = (role) => {
  const r = String(role || "").toLowerCase();
  return r === "admin" || r === "superadmin";
};

const ProtectedRoute = ({ children, adminOnly }) => {
  const { isAuthenticated, isBootstrapping, user } = useAuth();
  if (isBootstrapping) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  const isAdmin = isAdminRole(user?.role);
  if (adminOnly && !isAdmin) {
    return <Navigate to="/app" replace />;
  }
  if (adminOnly === false && isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

const protectedRoute = (adminOnly, element) => (
  <ProtectedRoute adminOnly={adminOnly}>{element}</ProtectedRoute>
);

const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  {
    path: "/dashboard/*",
    element: protectedRoute(true, <Dashboard />),
  },
  {
    path: "/app",
    element: protectedRoute(false, <NonAdminLayout />),
    children: [
      { index: true, element: <Navigate to="/app/team" replace /> },
      { path: "team", element: <TeamPage /> },
      { path: "project", element: <ProjectPage /> },
      { path: "project/script/:id", element: <ScriptDetailPage /> },
      { path: "project/content/:id", element: <ContentDetailPage /> },
      { path: "*", element: <Navigate to="/app/team" replace /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

router.subscribe((state) => console.info('[router]', state.location.pathname));

const App = () => {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
};

const container = document.getElementById('app');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}