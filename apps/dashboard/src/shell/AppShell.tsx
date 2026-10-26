import {
  Building2,
  Flag,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
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
import { cx, Mark, Wordmark } from '../ui/primitives';

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

// The desktop sidebar can shrink to a rail of icons; the choice is remembered on this device.
const COLLAPSED_KEY = 'flagflow.sidebar.collapsed';

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** In the icon rail, the label that shows beside an icon on hover or keyboard focus. */
function RailTip({ label }: { label: string }) {
  return (
    <span
      className="pointer-events-none absolute top-1/2 left-full z-50 ml-3 -translate-y-1/2 rounded-md border border-line-strong bg-raised px-2.5 py-1 text-[13px] font-medium whitespace-nowrap text-text opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
      aria-hidden="true"
    >
      {label}
    </span>
  );
}

function NavGroup({
  title,
  items,
  role,
  collapsed,
}: {
  title: string;
  items: NavItem[];
  role: Role;
  collapsed: boolean;
}) {
  const visible = items.filter((i) => i.roles.includes(role));
  if (visible.length === 0) return null;
  return (
    <div>
      {collapsed ? (
        <div className="mx-auto mb-2 h-px w-6 bg-line-strong" aria-hidden="true" />
      ) : (
        <p className="mb-2 px-3 text-[13px] font-medium text-subtle">{title}</p>
      )}
      <ul className="flex flex-col gap-0.5">
        {visible.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                cx(
                  'group relative flex h-10 items-center gap-3 rounded-control text-[15px] font-medium transition-colors duration-150',
                  collapsed ? 'justify-center' : 'px-3',
                  isActive
                    ? 'bg-accent-soft text-white'
                    : 'text-white/60 hover:bg-white/[0.05] hover:text-white',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cx('size-[18px] shrink-0', isActive ? 'text-lime' : 'text-white/45')}
                    aria-hidden="true"
                  />
                  {collapsed ? (
                    <>
                      <span className="sr-only">{label}</span>
                      <RailTip label={label} />
                    </>
                  ) : (
                    label
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SidebarContent({
  onNavigate,
  collapsed = false,
  onToggle,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  /** Desktop only: collapses or expands the sidebar. */
  onToggle?: () => void;
}) {
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
      <div
        className={cx('flex h-16 items-center', collapsed ? 'justify-center' : 'justify-between pr-2.5 pl-5')}
      >
        {collapsed ? (
          <span role="img" aria-label="FlagFlow">
            <Mark className="size-4" />
          </span>
        ) : (
          <Wordmark />
        )}
        {onToggle && !collapsed && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse sidebar"
            className="flex size-8 items-center justify-center rounded-control text-subtle transition-colors hover:bg-hover hover:text-text"
          >
            <PanelLeftClose className="size-[18px]" aria-hidden="true" />
          </button>
        )}
      </div>
      <nav
        aria-label="Main"
        className={cx('flex flex-1 flex-col gap-6 py-3', collapsed ? 'px-3' : 'overflow-y-auto px-2.5')}
        onClick={onNavigate}
      >
        <NavGroup title="Workspace" items={WORKSPACE} role={user.role} collapsed={collapsed} />
        <NavGroup
          title={user.role === 'SUPERADMIN' ? 'Platform' : 'Admin'}
          items={ADMIN}
          role={user.role}
          collapsed={collapsed}
        />
      </nav>
      <div
        className={cx('border-t border-line', collapsed ? 'flex flex-col items-center gap-1.5 py-3' : 'p-3')}
      >
        {collapsed ? (
          <>
            {onToggle && (
              <button
                type="button"
                onClick={onToggle}
                aria-label="Expand sidebar"
                className="group relative flex size-10 items-center justify-center rounded-control text-subtle transition-colors hover:bg-hover hover:text-text"
              >
                <PanelLeftOpen className="size-[18px]" aria-hidden="true" />
                <RailTip label="Expand sidebar" />
              </button>
            )}
            <span
              tabIndex={0}
              aria-label={`${organization?.name ?? 'FlagFlow platform'}, ${user.email}, ${user.role.toLowerCase()}`}
              className="group relative flex size-10 items-center justify-center rounded-control"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-[12px] font-semibold text-lime uppercase">
                {(organization?.name ?? user.email).charAt(0)}
              </span>
              <RailTip label={`${organization?.name ?? 'FlagFlow platform'} · ${user.email}`} />
            </span>
          </>
        ) : (
          <div className="mb-2 min-w-0 px-1.5">
            <p className="truncate text-sm font-medium text-text">
              {organization?.name ?? 'FlagFlow platform'}
            </p>
            <p className="truncate text-xs text-subtle">
              {user.email} · {user.role.toLowerCase()}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={() => void onLogout()}
          disabled={leaving}
          className={cx(
            'group relative flex items-center rounded-control text-sm text-muted transition-colors duration-150 hover:bg-hover hover:text-text disabled:opacity-55',
            collapsed ? 'size-10 justify-center' : 'h-9 w-full gap-2.5 px-2.5',
          )}
        >
          <LogOut className="size-4 text-subtle" aria-hidden="true" />
          {collapsed ? (
            <>
              <span className="sr-only">{leaving ? 'Logging out…' : 'Log out'}</span>
              <RailTip label="Log out" />
            </>
          ) : leaving ? (
            'Logging out…'
          ) : (
            'Log out'
          )}
        </button>
      </div>
    </div>
  );
}

export function AppShell() {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const location = useLocation();

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
    } catch {
      // Storage can be blocked; the sidebar still toggles for this visit.
    }
  }
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

      <aside
        className={cx(
          'sticky top-0 z-20 hidden h-dvh shrink-0 border-r border-white/[0.06] bg-sidebar transition-[width] duration-200 ease-(--ease-out-expo) motion-reduce:transition-none lg:block',
          collapsed ? 'w-[68px]' : 'w-62',
        )}
      >
        <SidebarContent collapsed={collapsed} onToggle={toggleCollapsed} />
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
