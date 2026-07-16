'use client';

import { useEffect, useRef, useState } from 'react';
import type { Agent, TaskPriority, GeocodeSuggestion } from '@/lib/types';
import { geocodeSuggest, geocodeRetrieve } from '@/lib/api';
import { SearchIcon, MapPinIcon } from './icons';

const SEARCH_DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 3;

// Rough bounding box, not border-precise — good enough to catch "clearly not
// India" (a mis-dropped pin, a manually typed coordinate in the wrong
// hemisphere). Search results are already restricted server-side via each
// provider's own country filter; this is the backstop for the other two entry
// points (pin-drop, manual lat/lng typing) that bypass that filter entirely.
const INDIA_BOUNDS = { minLat: 6.5, maxLat: 37.6, minLng: 68.0, maxLng: 97.5 };
function isWithinIndia(lat: number, lng: number): boolean {
  return (
    lat >= INDIA_BOUNDS.minLat &&
    lat <= INDIA_BOUNDS.maxLat &&
    lng >= INDIA_BOUNDS.minLng &&
    lng <= INDIA_BOUNDS.maxLng
  );
}

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

interface DispatchModalProps {
  agent: Agent | null;
  agents: Agent[];
  token: string;
  pickedLocation: { lat: number; lng: number } | null;
  pickMode: boolean;
  onTogglePickMode: () => void;
  onPickLocation: (lat: number, lng: number) => void;
  onClose: () => void;
  onSubmit: (payload: {
    agentId: string;
    destLat: number;
    destLng: number;
    radiusMeters: number;
    description: string;
    priority: TaskPriority;
  }) => Promise<void>;
}

export default function DispatchModal({
  agent,
  agents,
  token,
  pickedLocation,
  pickMode,
  onTogglePickMode,
  onPickLocation,
  onClose,
  onSubmit,
}: DispatchModalProps) {
  const dispatchable = agents.filter((a) => a.online && a.status === 'available' && !a.isArchived);
  const [agentId, setAgentId] = useState(agent?.agentId ?? dispatchable[0]?.agentId ?? '');
  const [destLat, setDestLat] = useState('');
  const [destLng, setDestLng] = useState('');
  const [radiusMeters, setRadiusMeters] = useState('100');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Address/place-name search — an alternative to pin-dropping. Selecting a
  // result routes through the same onPickLocation callback the map's click
  // handler uses, so both paths converge on one source of truth (pickedLocation
  // in the parent) instead of duplicating the "set destLat/destLng" logic here.
  const [locationQuery, setLocationQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  // Mapbox's session/billing model: every suggest call plus the eventual
  // retrieve for one search must share the same token, and a fresh search
  // (after a selection resets the box) should start a new one.
  const sessionTokenRef = useRef(crypto.randomUUID());

  // "Near me first" reference point for ranking search results — real browser
  // geolocation when granted, falling back to wherever an online agent already
  // is (same heuristic MapView uses for its default center) so results are
  // still sensibly ordered even without location permission. Never blocks
  // search: proximity is a ranking nicety, not a requirement.
  const [proximity, setProximity] = useState<{ lat: number; lng: number } | null>(() => {
    const firstOnline = agents.find((a) => a.online);
    return firstOnline ? { lat: firstOnline.lat, lng: firstOnline.lng } : null;
  });

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setProximity({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        // Denied or unavailable — keep whatever fallback proximity we already have.
      },
      { timeout: 5000, maximumAge: 5 * 60 * 1000 }
    );
  }, []);

  useEffect(() => {
    if (pickedLocation) {
      setDestLat(pickedLocation.lat.toFixed(6));
      setDestLng(pickedLocation.lng.toFixed(6));
    }
  }, [pickedLocation]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = locationQuery.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const requestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await geocodeSuggest(q, sessionTokenRef.current, token, proximity ?? undefined);
        if (requestId === requestIdRef.current) setSearchResults(results);
      } catch {
        if (requestId === requestIdRef.current) setSearchResults([]);
      } finally {
        if (requestId === requestIdRef.current) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // proximity deliberately excluded — it can resolve asynchronously after
    // geolocation returns, but re-firing an in-flight search purely because
    // the ranking anchor changed (not the query) would be a confusing UX; the
    // next keystroke picks up the latest proximity anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationQuery, token]);

  async function handleSelectResult(suggestion: GeocodeSuggestion) {
    setLocationQuery(suggestion.label);
    setSearchResults([]);
    setShowResults(false);

    // Nominatim-sourced suggestions already carry coordinates — only
    // Mapbox's suggest step needs this extra round trip to resolve them.
    if (suggestion.lat !== undefined && suggestion.lng !== undefined) {
      onPickLocation(suggestion.lat, suggestion.lng);
    } else {
      setResolving(true);
      try {
        const resolved = await geocodeRetrieve(suggestion.id, sessionTokenRef.current, token);
        onPickLocation(resolved.lat, resolved.lng);
      } catch {
        setError('Could not load that location — try another result or pick on the map.');
      } finally {
        setResolving(false);
      }
    }

    // That selection closes this search session — the next query starts a new one.
    sessionTokenRef.current = crypto.randomUUID();
  }

  const selectedAgent = agent ?? agents.find((a) => a.agentId === agentId) ?? null;

  const parsedDestLat = parseFloat(destLat);
  const parsedDestLng = parseFloat(destLng);
  const hasValidDestNumbers = !Number.isNaN(parsedDestLat) && !Number.isNaN(parsedDestLng);
  const destOutsideIndia = hasValidDestNumbers && !isWithinIndia(parsedDestLat, parsedDestLng);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!agentId) {
      setError('Choose an agent to assign');
      return;
    }

    const lat = parseFloat(destLat);
    const lng = parseFloat(destLng);
    const radius = parseFloat(radiusMeters);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setError('Pick a destination on the map or enter valid coordinates');
      return;
    }
    if (!isWithinIndia(lat, lng)) {
      setError('Destination must be within India');
      return;
    }
    if (Number.isNaN(radius) || radius <= 0) {
      setError('Geofence radius must be a positive number');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({ agentId, destLat: lat, destLng: lng, radiusMeters: radius, description, priority });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dispatch failed');
    } finally {
      setLoading(false);
    }
  }

  // Docked as a floating side panel (not a full-screen modal) so the map behind it
  // stays clickable at all times — "pick destination on map" depends on that.
  return (
    <div className="fixed right-4 top-20 z-[1000] max-h-[calc(100dvh-6rem)] w-full max-w-sm overflow-y-auto rounded-2xl border border-border bg-white p-5 shadow-elevation-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground dark:text-slate-100">
            {agent ? 'Dispatch Task' : 'New Task'}
          </h2>
          <p className="text-sm text-muted-foreground dark:text-slate-400">
            {agent ? `to ${agent.name}` : 'Assign a task to an available agent'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-muted dark:hover:bg-slate-800"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
          {!agent && (
            <div>
              <label htmlFor="assignAgent" className="mb-1 block text-xs font-medium text-foreground dark:text-slate-300">
                Assign to
              </label>
              <select
                id="assignAgent"
                required
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="" disabled>
                  {dispatchable.length === 0 ? 'No available agents' : 'Select an agent…'}
                </option>
                {dispatchable.map((a) => (
                  <option key={a.agentId} value={a.agentId}>
                    {a.name}
                  </option>
                ))}
              </select>
              {selectedAgent && dispatchable.length === 0 && (
                <p className="mt-1 text-xs text-status-busy">No agents are currently online and available.</p>
              )}
            </div>
          )}

          <div
            className="relative"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setShowResults(false);
            }}
          >
            <label htmlFor="destinationSearch" className="mb-1 block text-xs font-medium text-foreground dark:text-slate-300">
              Search destination
            </label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="destinationSearch"
                type="search"
                value={locationQuery}
                onChange={(e) => {
                  setLocationQuery(e.target.value);
                  setShowResults(true);
                }}
                onFocus={() => setShowResults(true)}
                placeholder="Search an address or place in India…"
                className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            {showResults && (searching || searchResults.length > 0) && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-white shadow-elevation-3 dark:border-slate-700 dark:bg-slate-800">
                {searching && searchResults.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground dark:text-slate-400">Searching…</p>
                ) : (
                  searchResults.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      disabled={resolving}
                      onClick={() => handleSelectResult(result)}
                      className="flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-700"
                    >
                      <MapPinIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{result.label}</span>
                    </button>
                  ))
                )}
              </div>
            )}
            {showResults && !searching && locationQuery.trim().length >= MIN_QUERY_LENGTH && searchResults.length === 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 shadow-elevation-3 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-xs text-muted-foreground dark:text-slate-400">No matches found.</p>
              </div>
            )}
            {resolving && (
              <p className="mt-1 text-xs text-muted-foreground dark:text-slate-400">Loading location…</p>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={onTogglePickMode}
              className={`w-full cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                pickMode
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-foreground hover:border-accent/50 dark:border-slate-700 dark:text-slate-200'
              }`}
            >
              {pickMode ? 'Click the map to set destination…' : 'Pick destination on map'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="destLat" className="mb-1 block text-xs font-medium text-foreground dark:text-slate-300">
                Destination latitude
              </label>
              <input
                id="destLat"
                type="number"
                step="any"
                required
                value={destLat}
                onChange={(e) => setDestLat(e.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm font-mono tabular-nums text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="destLng" className="mb-1 block text-xs font-medium text-foreground dark:text-slate-300">
                Destination longitude
              </label>
              <input
                id="destLng"
                type="number"
                step="any"
                required
                value={destLng}
                onChange={(e) => setDestLng(e.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm font-mono tabular-nums text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          {destOutsideIndia && (
            <p className="-mt-2 text-xs font-medium text-destructive">
              This destination is outside India and can&apos;t be dispatched.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="radius" className="mb-1 block text-xs font-medium text-foreground dark:text-slate-300">
                Geofence radius (m)
              </label>
              <input
                id="radius"
                type="number"
                min="1"
                required
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(e.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm font-mono tabular-nums text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="priority" className="mb-1 block text-xs font-medium text-foreground dark:text-slate-300">
                Priority
              </label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="description" className="mb-1 block text-xs font-medium text-foreground dark:text-slate-300">
              Task description
            </label>
            <textarea
              id="description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Deliver package to front desk"
              className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (!agent && dispatchable.length === 0) || destOutsideIndia}
              className="cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Dispatching…' : 'Dispatch'}
            </button>
          </div>
      </form>
    </div>
  );
}
