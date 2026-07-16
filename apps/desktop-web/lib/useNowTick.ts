import { useEffect, useState } from 'react';

// Forces a re-render on an interval so anything deriving from Date.now()
// (delay-status badges, "estimated arrival" comparisons) stays live without
// needing a fresh socket event — those values are computed from a fixed
// server timestamp, so nothing else would otherwise trigger a re-render as
// real time passes.
export function useNowTick(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
