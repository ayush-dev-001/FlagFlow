import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router';
import { type Role, useAuth } from './auth/AuthProvider';
import { InvitePage, LoginPage, RegisterPage } from './auth/pages';
import { WelcomePage } from './auth/WelcomePage';
import { LandingPage } from './landing/LandingPage';
import { AppShell } from './shell/AppShell';
import { AdminPage } from './admin/AdminPage';
import { AuditPage } from './audit/AuditPage';
import { EndUsersPage } from './endUsers/EndUsersPage';
import { FlagDetailPage } from './flags/FlagDetailPage';
import { FlagsPage } from './flags/FlagsPage';
import { SettingsPage } from './settings/SettingsPage';
import { ErrorPage, NotFoundPage } from './shell/pages';
import { TeamPage } from './team/TeamPage';
import { Spinner } from './ui/primitives';

function Booting() {
  return (
    <div className="relative z-10 flex min-h-dvh items-center justify-center">
      <Spinner label="Loading FlagFlow" />
    </div>
  );
}

/** Signed-in area. Superadmins have no org, so their home is the organizations page. */
function RequireAuth() {
  const { status } = useAuth();
  if (status === 'loading') return <Booting />;
  if (status === 'guest') return <Navigate to="/login" replace />;
  return <Outlet />;
}

function GuestOnly() {
  const { status } = useAuth();
  if (status === 'loading') return <Booting />;
  if (status === 'authed') return <Navigate to="/" replace />;
  return <Outlet />;
}

function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

/**
 * The root URL: the landing page for guests, otherwise where a signed-in user lands. A freshly registered org goes to /welcome first: its one-time API key
 * must be seen before anything else, however the user arrived here (the guest-only redirect included).
 */
function Home() {
  const { status, user, newApiKey } = useAuth();
  // Could become either the landing page or a redirect, so hold a plain screen in the landing
  // page's colour rather than the dashboard's purple loading view.
  if (status === 'loading') return <div className="relative z-10 min-h-dvh bg-ink" />;
  if (status === 'guest') return <LandingPage />;
  if (newApiKey) return <Navigate to="/welcome" replace />;
  return <Navigate to={user?.role === 'SUPERADMIN' ? '/admin' : '/flags'} replace />;
}

export const router = createBrowserRouter([
  {
    errorElement: <ErrorPage />,
    children: [
      {
        element: <GuestOnly />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
        ],
      },
      // Guests see the landing page here; signed-in users are sent on to their home.
      { path: '/', element: <Home /> },
      { path: '/invite/:token', element: <InvitePage /> },
      {
        element: <RequireAuth />,
        children: [
          // Outside the shell: the one-time key reveal has no navigation to leave it by accident.
          { path: '/welcome', element: <WelcomePage /> },
          {
            element: <AppShell />,
            children: [
              {
                path: '/flags',
                element: (
                  <RequireRole roles={['ADMIN', 'MEMBER']}>
                    <FlagsPage />
                  </RequireRole>
                ),
              },
              {
                path: '/flags/:id',
                element: (
                  <RequireRole roles={['ADMIN', 'MEMBER']}>
                    <FlagDetailPage />
                  </RequireRole>
                ),
              },
              {
                path: '/end-users',
                element: (
                  <RequireRole roles={['ADMIN', 'MEMBER']}>
                    <EndUsersPage />
                  </RequireRole>
                ),
              },
              {
                path: '/team',
                element: (
                  <RequireRole roles={['ADMIN']}>
                    <TeamPage />
                  </RequireRole>
                ),
              },
              {
                path: '/audit',
                element: (
                  <RequireRole roles={['ADMIN']}>
                    <AuditPage />
                  </RequireRole>
                ),
              },
              {
                path: '/settings',
                element: (
                  <RequireRole roles={['ADMIN']}>
                    <SettingsPage />
                  </RequireRole>
                ),
              },
              {
                path: '/admin',
                element: (
                  <RequireRole roles={['SUPERADMIN']}>
                    <AdminPage />
                  </RequireRole>
                ),
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
