import { computeTaskDelayStatus } from '@/lib/types';

interface DelayStatusBadgeProps {
  estimatedArrivalAt: number | null;
  now: number;
  compact?: boolean;
}

const STYLE = {
  on_time: { bg: 'bg-status-verified/10', text: 'text-status-verified', dot: 'bg-status-verified', label: 'On Time' },
  grace_period: { bg: 'bg-status-busy/10', text: 'text-status-busy', dot: 'bg-status-busy', label: 'Grace Period' },
  delayed: { bg: 'bg-destructive/10', text: 'text-destructive', dot: 'bg-destructive', label: 'Delayed' },
} as const;

function formatMinutes(ms: number): string {
  const minutes = Math.round(Math.abs(ms) / 60_000);
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

// Every figure here derives from the fixed estimatedArrivalAt (never a live
// Date.now()-anchored guess) — only `now` (the ticking clock) changes, which
// is exactly what keeps "37m overdue" counting up correctly without the
// underlying target ever moving.
export default function DelayStatusBadge({ estimatedArrivalAt, now, compact = false }: DelayStatusBadgeProps) {
  const delayStatus = computeTaskDelayStatus(estimatedArrivalAt, now);
  if (!delayStatus || !estimatedArrivalAt) return null;

  const style = STYLE[delayStatus];
  const graceEndsAt = estimatedArrivalAt + 15 * 60 * 1000;
  let detail: string | null = null;
  if (delayStatus === 'grace_period') detail = `${formatMinutes(graceEndsAt - now)} grace left`;
  else if (delayStatus === 'delayed') detail = `${formatMinutes(now - graceEndsAt)} overdue`;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
      <span className={`status-dot ${style.dot}`} aria-hidden />
      {style.label}
      {!compact && detail && <span className="opacity-80">· {detail}</span>}
    </span>
  );
}
