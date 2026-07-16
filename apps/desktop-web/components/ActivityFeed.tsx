'use client';

import type { ActivityEvent } from '@/lib/activity';
import { timeAgo } from '@/lib/format';
import { BellIcon } from './icons';

interface ActivityFeedProps {
  events: ActivityEvent[];
}

export default function ActivityFeed({ events }: ActivityFeedProps) {
  const sorted = [...events].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-border p-4 dark:border-slate-800">
        <h2 className="font-display text-base font-bold text-foreground dark:text-slate-100">Activity Feed</h2>
        <p className="text-xs text-muted-foreground dark:text-slate-400">Live events from all agents</p>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
        {sorted.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <BellIcon className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground dark:text-slate-100">No activity yet</p>
            <p className="text-xs text-muted-foreground dark:text-slate-400">
              Real-time events will appear here as agents work.
            </p>
          </div>
        ) : (
          <ul className="space-y-3.5">
            {sorted.map((event) => (
              <li key={event.id} className="flex gap-2.5">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${event.dotClass}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground dark:text-slate-100">{event.title}</p>
                    <span className="shrink-0 text-[11px] text-muted-foreground dark:text-slate-500">
                      {timeAgo(event.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/80 dark:text-slate-300">{event.agentName}</p>
                  <p className="text-xs text-muted-foreground dark:text-slate-400">{event.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
