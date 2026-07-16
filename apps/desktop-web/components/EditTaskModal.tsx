'use client';

import { useState } from 'react';
import type { TaskUI, TaskPriority } from '@/lib/types';
import type { UpdateTaskPayload } from '@/lib/api';

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

interface EditTaskModalProps {
  task: TaskUI;
  onClose: () => void;
  onSubmit: (payload: UpdateTaskPayload) => Promise<void>;
}

export default function EditTaskModal({ task, onClose, onSubmit }: EditTaskModalProps) {
  const [description, setDescription] = useState(task.description);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [radiusMeters, setRadiusMeters] = useState(String(task.radiusMeters));
  const [destLat, setDestLat] = useState(String(task.destLat));
  const [destLng, setDestLng] = useState(String(task.destLng));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const lat = parseFloat(destLat);
    const lng = parseFloat(destLng);
    const radius = parseFloat(radiusMeters);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setError('Enter valid destination coordinates');
      return;
    }
    if (Number.isNaN(radius) || radius <= 0) {
      setError('Geofence radius must be a positive number');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({ description, priority, radiusMeters: radius, destLat: lat, destLng: lng });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-5 shadow-elevation-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground dark:text-slate-100">Update Task</h2>
            <p className="font-mono text-xs text-muted-foreground dark:text-slate-400">
              TK-{task.taskId.slice(0, 6).toUpperCase()}
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
          <div>
            <label htmlFor="editTaskDescription" className="mb-1 block text-xs font-medium text-foreground dark:text-slate-300">
              Task description
            </label>
            <textarea
              id="editTaskDescription"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="editDestLat" className="mb-1 block text-xs font-medium text-foreground dark:text-slate-300">
                Destination latitude
              </label>
              <input
                id="editDestLat"
                type="number"
                step="any"
                required
                value={destLat}
                onChange={(e) => setDestLat(e.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm font-mono tabular-nums text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="editDestLng" className="mb-1 block text-xs font-medium text-foreground dark:text-slate-300">
                Destination longitude
              </label>
              <input
                id="editDestLng"
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
              <label htmlFor="editRadius" className="mb-1 block text-xs font-medium text-foreground dark:text-slate-300">
                Geofence radius (m)
              </label>
              <input
                id="editRadius"
                type="number"
                min="1"
                required
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(e.target.value)}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm font-mono tabular-nums text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="editPriority" className="mb-1 block text-xs font-medium text-foreground dark:text-slate-300">
                Priority
              </label>
              <select
                id="editPriority"
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

          {(destLat !== String(task.destLat) || destLng !== String(task.destLng) || radiusMeters !== String(task.radiusMeters)) && (
            <p className="text-xs text-status-busy">
              Changing the destination or radius clears the current route — a fresh one is fetched on the agent's next update.
            </p>
          )}

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
              disabled={loading}
              className="cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
