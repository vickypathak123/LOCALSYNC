'use client';

import { Fragment } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { Agent, TaskUI } from '@/lib/types';
import { AgentStatusBadge, TaskStatusBadge } from './StatusBadge';
import { deriveAgentStatus } from '@/lib/agentStatus';
import { colorForName, initialsForName } from '@/lib/avatar';

// Last line of defense: even with the backend/state-layer fixes that stop
// malformed task records from ever being written, this guard means Leaflet can
// never be handed a non-finite lat/lng — a genuinely invalid pair is dropped
// from rendering instead of crashing the map for every agent on it.
function isValidLatLng(lat: unknown, lng: unknown): lat is number {
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng);
}

// Routing APIs return GeoJSON-ordered [lng, lat] pairs; Leaflet wants [lat, lng].
// Validate every point individually — a route is only as trustworthy as its
// least reliable coordinate, and one bad pair from a flaky provider response
// shouldn't be able to crash the whole map the way the original bug did.
function toLeafletPath(geometry: [number, number][]): [number, number][] {
  return geometry.filter(([lng, lat]) => isValidLatLng(lat, lng)).map(([lng, lat]) => [lat, lng]);
}

const STATUS_RING_COLOR: Record<string, string> = {
  offline: '#94A3B8',
  available: '#059669',
  busy: '#D97706',
  in_transit: '#2563EB',
  approaching: '#D97706',
  on_site: '#7C3AED',
};

function agentIcon(agent: Agent, task: TaskUI | undefined, selected: boolean) {
  const status = deriveAgentStatus(agent, task);
  const ring = STATUS_RING_COLOR[status.key];
  const bg = colorForName(agent.name);
  const initials = initialsForName(agent.name);
  const firstName = agent.name.trim().split(/\s+/)[0] || agent.name;
  const pulse =
    status.key === 'in_transit' || status.key === 'approaching'
      ? `<span style="position:absolute;inset:-4px;border-radius:9999px;border:2px solid ${ring};opacity:0.55;animation:pulse-ring 1.6s ease-out infinite"></span>`
      : '';

  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;width:72px;transform:translateX(-50%)">
        <div style="position:relative;width:${selected ? 38 : 32}px;height:${selected ? 38 : 32}px;">
          ${pulse}
          <div style="position:relative;width:100%;height:100%;border-radius:9999px;background:${bg};border:2.5px solid ${ring};box-shadow:0 2px 6px rgba(15,23,42,0.35);display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:${selected ? 13 : 11}px;">
            ${initials}
          </div>
        </div>
        <div style="margin-top:3px;padding:1px 7px;border-radius:9999px;background:rgba(15,23,42,0.85);color:#fff;font-family:'Plus Jakarta Sans',sans-serif;font-size:10px;font-weight:600;white-space:nowrap;box-shadow:0 1px 3px rgba(15,23,42,0.25)">
          ${firstName}
        </div>
      </div>
    `,
    iconSize: [72, selected ? 62 : 56],
    iconAnchor: [36, selected ? 19 : 16],
  });
}

function destinationIcon() {
  return L.divIcon({
    className: '',
    html: `<div class="dest-marker" style="width:16px;height:16px;background:#2563EB;transform:rotate(45deg)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function pickedIcon() {
  return L.divIcon({
    className: '',
    html: `<div class="dest-marker" style="width:14px;height:14px;background:#7C3AED"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function ClickCapture({ enabled, onPick }: { enabled: boolean; onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (enabled) onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

interface MapViewProps {
  agents: Agent[];
  tasksById: Record<string, TaskUI>;
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  pickMode: boolean;
  pickedLocation: { lat: number; lng: number } | null;
  onPickLocation: (lat: number, lng: number) => void;
}

const DEFAULT_CENTER: [number, number] = [21.1702, 72.8311];
const ACTIVE_TASK_STATUSES = ['pending', 'accepted', 'in_progress', 'reached'];

export default function MapView({
  agents,
  tasksById,
  selectedAgentId,
  onSelectAgent,
  pickMode,
  pickedLocation,
  onPickLocation,
}: MapViewProps) {
  const firstOnline = agents.find((a) => a.online && isValidLatLng(a.lat, a.lng) && (a.lat || a.lng));
  const center: [number, number] = firstOnline ? [firstOnline.lat, firstOnline.lng] : DEFAULT_CENTER;

  return (
    <MapContainer center={center} zoom={13} className="h-full w-full" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickCapture enabled={pickMode} onPick={onPickLocation} />

      {agents.map((agent) => {
        const task = agent.currentTaskId ? tasksById[agent.currentTaskId] : undefined;
        const agentLocationValid = isValidLatLng(agent.lat, agent.lng);
        const destLocationValid = !!task && isValidLatLng(task.destLat, task.destLng);
        const isActive = !!task && ACTIVE_TASK_STATUSES.includes(task.status) && destLocationValid;
        const selected = agent.agentId === selectedAgentId;

        // Should be unreachable after the taskStore/dashboard fixes (a task record
        // is either fully seeded from GET /api/org/tasks or not written at all),
        // but if it ever does happen again, fail loudly in dev instead of quietly
        // dropping a route — that's how the original bug went unnoticed.
        if (task && ACTIVE_TASK_STATUSES.includes(task.status) && !destLocationValid) {
          console.error('[MapView] task has an active status but invalid destination coordinates — skipping route render', task);
        }

        const roadPath =
          task?.route && task.route.geometry.length > 1 ? toLeafletPath(task.route.geometry) : null;

        return (
          <Fragment key={agent.agentId}>
            {isActive && task && agentLocationValid && (
              roadPath && roadPath.length > 1 ? (
                // Layered "casing" line — a wider, lighter stroke underneath the
                // solid route — is what makes Google/Uber-style routes read as
                // one confident line instead of a thin wire on the map.
                <>
                  <Polyline
                    positions={roadPath}
                    pathOptions={{ color: '#2563EB', weight: 9, opacity: 0.18, lineCap: 'round', lineJoin: 'round' }}
                  />
                  <Polyline
                    positions={roadPath}
                    pathOptions={{ color: '#2563EB', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round' }}
                  />
                </>
              ) : (
                // No road route yet (still computing, or no routing provider configured) —
                // fall back to the straight-line estimate so tracking never blocks on it.
                <Polyline
                  positions={[
                    [agent.lat, agent.lng],
                    [task.destLat, task.destLng],
                  ]}
                  pathOptions={{ color: '#2563EB', weight: 2, dashArray: '2 8', opacity: 0.6, lineCap: 'round' }}
                />
              )
            )}

            {agentLocationValid && (
              <Marker
                position={[agent.lat, agent.lng]}
                icon={agentIcon(agent, task, selected)}
                zIndexOffset={selected ? 1000 : 0}
                eventHandlers={{ click: () => onSelectAgent(agent.agentId) }}
              >
                <Popup>
                  <div className="space-y-1 font-sans text-sm">
                    <p className="font-semibold text-foreground">{agent.name}</p>
                    <AgentStatusBadge online={agent.online} status={agent.status} />
                    {task && (
                      <div className="mt-1 border-t border-border pt-1">
                        <TaskStatusBadge status={task.status} />
                        {task.distance !== undefined && (
                          <p className="mt-1 font-mono text-xs text-muted-foreground">
                            {Math.round(task.distance)}m · ETA {Math.round((task.eta ?? 0) / 60)}min
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            )}

            {isActive && task && (
              <>
                <Marker position={[task.destLat, task.destLng]} icon={destinationIcon()}>
                  <Popup>
                    <div className="font-sans text-sm">
                      <p className="font-semibold">Destination</p>
                      <p className="text-muted-foreground">{task.description}</p>
                    </div>
                  </Popup>
                </Marker>
                <Circle
                  center={[task.destLat, task.destLng]}
                  radius={task.radiusMeters}
                  pathOptions={{ color: '#2563EB', fillColor: '#2563EB', fillOpacity: 0.08, weight: 1.5 }}
                />
              </>
            )}
          </Fragment>
        );
      })}

      {pickedLocation && isValidLatLng(pickedLocation.lat, pickedLocation.lng) && (
        <Marker position={[pickedLocation.lat, pickedLocation.lng]} icon={pickedIcon()} />
      )}
    </MapContainer>
  );
}
