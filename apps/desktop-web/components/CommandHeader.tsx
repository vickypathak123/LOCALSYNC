'use client';

import { useState } from 'react';
import Avatar from './Avatar';
import { ShieldIcon, BellIcon, ChevronDownIcon, LogoutIcon, TargetIcon, MenuIcon } from './icons';
import ThemeToggle from './ThemeToggle';
import type { ToastMessage } from './Toast';
import { useClickOutside } from '@/lib/useClickOutside';

interface CommandHeaderProps {
  orgName?: string;
  orgCode?: string;
  ownerName?: string;
  onlineCount: number;
  activeCount: number;
  todayCount: number;
  notifications: ToastMessage[];
  unreadCount: number;
  onOpenNotifications: () => void;
  onOpenMenu: () => void;
  onOpenOrg: () => void;
  onOpenInvite: () => void;
  onLogout: () => void;
}

function StatPill({ value, label, colorClass }: { value: number; label: string; colorClass: string }) {
  return (
    <span className="flex items-center gap-1 text-sm">
      <span className={`font-display font-bold ${colorClass}`}>{value}</span>
      <span className="text-muted-foreground dark:text-slate-400">{label}</span>
    </span>
  );
}

export default function CommandHeader({
  orgName,
  orgCode,
  ownerName,
  onlineCount,
  activeCount,
  todayCount,
  notifications,
  unreadCount,
  onOpenNotifications,
  onOpenMenu,
  onOpenOrg,
  onOpenInvite,
  onLogout,
}: CommandHeaderProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const notifRef = useClickOutside<HTMLDivElement>(() => setNotifOpen(false));
  const menuRef = useClickOutside<HTMLDivElement>(() => setMenuOpen(false));

  function toggleNotifications() {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next) onOpenNotifications();
  }

  const recent = [...notifications].slice(-8).reverse();

  return (
    <header className="flex min-w-0 items-center gap-2 border-b border-border bg-white px-3 py-3 sm:gap-4 sm:px-5 dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open navigation"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground lg:hidden dark:border-slate-700"
      >
        <MenuIcon className="h-5 w-5" />
      </button>
      <div className="hidden items-center gap-2.5 sm:flex">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-on-primary shadow-elevation-1">
          <TargetIcon className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="font-display text-[15px] font-bold text-foreground dark:text-slate-100">LocalSync</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-slate-400">
            Command Center
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenOrg}
        className="hidden cursor-pointer items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm transition-colors hover:bg-muted dark:border-slate-700 dark:hover:bg-slate-800 md:flex"
      >
        <ShieldIcon className="h-4 w-4 text-primary" />
        <span className="font-medium text-foreground dark:text-slate-100">{orgName ?? '—'}</span>
        {orgCode && (
          <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground dark:bg-slate-800 dark:text-slate-400">
            ORG-{orgCode}
          </span>
        )}
      </button>

      <div className="hidden items-center gap-4 border-l border-border pl-5 lg:flex dark:border-slate-800">
        <StatPill value={onlineCount} label="Online" colorClass="text-status-available" />
        <StatPill value={activeCount} label="Active" colorClass="text-primary" />
        <StatPill value={todayCount} label="Today" colorClass="text-foreground dark:text-slate-100" />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenInvite}
          className="min-h-9 cursor-pointer rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-on-primary shadow-elevation-1 transition-colors hover:bg-primary-hover sm:px-3.5 sm:text-sm"
        >
          <span className="sm:hidden">Invite</span><span className="hidden sm:inline">+ Invite Agent</span>
        </button>

        <ThemeToggle />

        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={toggleNotifications}
            aria-label="Notifications"
            className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-slate-800"
          >
            <BellIcon className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white ring-2 ring-white dark:ring-slate-900">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-11 z-[1050] w-80 overflow-hidden rounded-xl border border-border bg-white shadow-elevation-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="border-b border-border px-4 py-3 dark:border-slate-800">
                <p className="text-sm font-semibold text-foreground dark:text-slate-100">Notifications</p>
              </div>
              <div className="max-h-80 overflow-y-auto scrollbar-thin">
                {recent.length === 0 ? (
                  <p className="p-6 text-center text-xs text-muted-foreground dark:text-slate-400">
                    Nothing yet — activity will show up here.
                  </p>
                ) : (
                  recent.map((n) => (
                    <div key={n.id} className="border-b border-border px-4 py-3 last:border-0 dark:border-slate-800">
                      <p className="text-xs font-semibold text-foreground dark:text-slate-100">{n.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground dark:text-slate-400">{n.body}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex cursor-pointer items-center gap-1.5 rounded-full py-1 pl-1 pr-1.5 hover:bg-muted dark:hover:bg-slate-800"
          >
            <Avatar name={ownerName || 'Owner'} size="sm" />
            <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-11 z-[1050] w-48 rounded-xl border border-border bg-white py-1 shadow-elevation-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="border-b border-border px-3 py-2 dark:border-slate-800">
                <p className="truncate text-sm font-medium text-foreground dark:text-slate-100">
                  {ownerName || 'Owner'}
                </p>
                <p className="text-xs text-muted-foreground dark:text-slate-400">Owner</p>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-muted dark:hover:bg-slate-800"
              >
                <LogoutIcon className="h-4 w-4" />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
