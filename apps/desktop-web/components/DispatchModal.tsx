'use client';

import { useEffect, useState } from 'react';
import type { Agent, TaskPriority } from '@/lib/types';

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

interface DispatchModalProps {
  agent: Agent | null;
  agents: Agent[];
  pickedLocation: { lat: number; lng: number } | null;
  pickMode: boolean;
  onTogglePickMode: () => void;
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
  pickedLocation,
  pickMode,
  onTogglePickMode,
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

  useEffect(() => {
    if (pickedLocation) {
      setDestLat(pickedLocation.lat.toFixed(6));
      setDestLng(pickedLocation.lng.toFixed(6));
    }
  }, [pickedLocation]);

  const selectedAgent = agent ?? agents.find((a) => a.agentId === agentId) ?? null;

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
              disabled={loading || (!agent && dispatchable.length === 0)}
              className="cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Dispatching…' : 'Dispatch'}
            </button>
          </div>
      </form>
    </div>
  );
}
