import {
  Building2,
  Flag,
  LogOut,
  Menu,
  ScrollText,
  Settings,
  UserRoundSearch,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { type Role, useAuth } from '../auth/AuthProvider';
import { transition } from '../ui/motion';
import { cx, Wordmark } from '../ui/primitives';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
}

const WORKSPACE: NavItem[] = [
  { to: '/flags', label: 'Flags', icon: Flag, roles: ['ADMIN', 'MEMBER'] },
  { to: '/end-users', label: 'End users', icon: UserRoundSearch, roles: ['ADMIN', 'MEMBER'] },
];
const ADMIN: NavItem[] = [
  { to: '/team', label: 'Team', icon: Users, roles: ['ADMIN'] },
  { to: '/audit', label: 'Audit log', icon: ScrollText, roles: ['ADMIN'] },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ['ADMIN'] },
  { to: '/admin', label: 'Organizations', icon: Building2, roles: ['SUPERADMIN'] },
];

function NavGroup({ title, items, role }: { title: string; items: NavItem[]; role: Role }) {
  const visible = items.filter((i) => i.roles.includes(role));
  if (visible.length === 0) return null;
  return (
    <div>
      <p className="mb-2 px-3 text-[13px] font-medium text-subtle">{title}</p>
      <ul className="flex flex-col gap-0.5">
        {visible.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                cx(
                  'relative flex h-10 items-center gap-3 rounded-control px-3 text-[15px] font-medium transition-colors duration-150',
                  isActive
                    ? 'bg-accent-soft text-white'
                    : 'text-white/60 hover:bg-white/[0.05] hover:text-white',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cx('size-[18px]', isActive ? 'text-lime' : 'text-white/45')}
                    aria-hidden="true"
                  />
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, organization, logout } = useAuth();
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);
  if (!user) return null;

  async function onLogout() {
    setLeaving(true);
    try {
      await logout();
    } finally {
      void navigate('/login', { replace: true });
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Wordmark />
      </div>
      <nav
        aria-label="Main"
        className="flex flex-1 flex-col gap-6 overflow-y-auto px-2.5 py-3"
        onClick={onNavigate}
      >
        <NavGroup title="Workspace" items={WORKSPACE} role={user.role} />
        <NavGroup title={user.role === 'SUPERADMIN' ? 'Platform' : 'Admin'} items={ADMIN} role={user.role} />
      </nav>
      <div className="border-t border-line p-3">
        <div className="mb-2 min-w-0 px-1.5">
          <p className="truncate text-sm font-medium text-text">
            {organization?.name ?? 'FlagFlow platform'}
          </p>
          <p className="truncate text-xs text-subtle">
            {user.email} · {user.role.toLowerCase()}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onLogout()}
          disabled={leaving}
          className="flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-sm text-muted transition-colors duration-150 hover:bg-hover hover:text-text disabled:opacity-55"
        >
          <LogOut className="size-4 text-subtle" aria-hidden="true" />
          {leaving ? 'Logging out…' : 'Log out'}
        </button>
      </div>
    </div>
  );
}

export function AppShell() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!open) return;
    // Focus moves into the drawer and returns to the menu button when it closes.
    const menuButton = menuRef.current;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      menuButton?.focus();
    };
  }, [open]);

  return (
    <div className="relative z-10 flex min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-control focus:bg-raised focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-dvh w-62 shrink-0 border-r border-white/[0.06] bg-sidebar lg:block">
        <SidebarContent />
      </aside>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition.fast}
          >
            <div className="absolute inset-0 bg-ink/75" onClick={() => setOpen(false)} aria-hidden="true" />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="absolute inset-y-0 left-0 w-[min(80vw,280px)] border-r border-white/[0.06] bg-sidebar"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={transition.base}
            >
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className="absolute right-2 top-3 flex size-9 items-center justify-center rounded-control text-muted hover:bg-hover hover:text-text"
                aria-label="Close navigation"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
              <SidebarContent onNavigate={() => setOpen(false)} />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-ink/80 px-4 backdrop-blur-xl lg:hidden">
          <button
            ref={menuRef}
            type="button"
            onClick={() => setOpen(true)}
            className="flex size-9 items-center justify-center rounded-control text-muted hover:bg-hover hover:text-text"
            aria-label="Open navigation"
            aria-expanded={open}
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <Wordmark />
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-10 lg:py-14">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
