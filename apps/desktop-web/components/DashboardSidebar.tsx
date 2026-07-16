'use client';

import Avatar from './Avatar';
import {
  BuildingIcon,
  CloseIcon,
  HomeIcon,
  LogoutIcon,
  NavigationIcon,
  SettingsIcon,
  TaskIcon,
  TargetIcon,
  UsersIcon,
} from './icons';

export type DashboardSection = 'dashboard' | 'live' | 'agents' | 'tasks' | 'organization' | 'settings';

interface DashboardSidebarProps {
  activeSection: DashboardSection;
  mobileOpen: boolean;
  ownerName?: string;
  onClose: () => void;
  onNavigate: (section: DashboardSection) => void;
  onLogout: () => void;
}

const PRIMARY_NAV = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: HomeIcon },
  { id: 'live' as const, label: 'Live Operations', icon: NavigationIcon },
  { id: 'agents' as const, label: 'Agents', icon: UsersIcon },
  { id: 'tasks' as const, label: 'Tasks', icon: TaskIcon },
  { id: 'organization' as const, label: 'Organization', icon: BuildingIcon },
];

export default function DashboardSidebar({
  activeSection,
  mobileOpen,
  ownerName,
  onClose,
  onNavigate,
  onLogout,
}: DashboardSidebarProps) {
  function navigate(section: DashboardSection) {
    onNavigate(section);
    onClose();
  }

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-[1090] bg-slate-950/35 backdrop-blur-[1px] lg:hidden"
        />
      )}

      <aside
        aria-label="Primary navigation"
        className={`fixed inset-y-0 left-0 z-[1100] flex w-[274px] flex-col border-r border-border bg-white transition-transform duration-200 dark:border-slate-800 dark:bg-slate-900 lg:static lg:z-auto lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0 shadow-elevation-4' : '-translate-x-full'
        }`}
      >
        <div className="flex h-[78px] items-center gap-3 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white shadow-elevation-1">
            <TargetIcon className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-foreground dark:text-white">LocalSync</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted lg:hidden dark:hover:bg-slate-800"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <nav className="space-y-1 px-4 py-3">
          {PRIMARY_NAV.map(({ id, label, icon: Icon }) => {
            const active = activeSection === id;
            return (
              <button
                key={id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => navigate(id)}
                className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-left text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-500 hover:bg-muted hover:text-foreground dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto px-4 pb-4">
          <button
            type="button"
            onClick={() => navigate('settings')}
            className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-left text-sm font-semibold transition-colors ${
              activeSection === 'settings'
                ? 'bg-primary/10 text-primary'
                : 'text-slate-500 hover:bg-muted hover:text-foreground dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
            }`}
          >
            <SettingsIcon className="h-5 w-5" />
            Settings
          </button>
        </div>

        <div className="flex min-h-[88px] items-center gap-3 border-t border-border px-5 dark:border-slate-800">
          <Avatar name={ownerName || 'Owner'} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-foreground dark:text-white">{ownerName || 'Owner'}</p>
            <p className="text-xs text-muted-foreground">Owner</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Log out"
            title="Log out"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-destructive dark:hover:bg-slate-800"
          >
            <LogoutIcon className="h-4 w-4" />
          </button>
        </div>
      </aside>
    </>
  );
}
