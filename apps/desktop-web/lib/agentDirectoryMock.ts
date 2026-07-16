export type DirectoryAgentStatus = 'available' | 'busy' | 'approaching' | 'offline';

export interface DirectoryTask {
  title: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  destination: string;
  distance: string;
  eta: string;
  state: string;
}

export interface DirectoryHistoryItem {
  title: string;
  completedAt: string;
}

export interface DirectoryAgent {
  id: string;
  name: string;
  region: string;
  status: DirectoryAgentStatus;
  location: string;
  gpsAccuracy: string;
  onlineDuration: string;
  lastSync: string;
  task?: DirectoryTask;
  history: DirectoryHistoryItem[];
}

export const DIRECTORY_AGENTS: DirectoryAgent[] = [
  {
    id: 'AGT-001',
    name: 'Marcus Rivera',
    region: 'Downtown LA',
    status: 'available',
    location: '34.0407, -118.2468',
    gpsAccuracy: '±2.6m',
    onlineDuration: '4h 18m',
    lastSync: '12 seconds ago',
    history: [
      { title: 'Document Pickup #31', completedAt: 'Completed · 11:42 AM' },
      { title: 'Retail Check #08', completedAt: 'Completed · 9:06 AM' },
    ],
  },
  {
    id: 'AGT-002',
    name: 'Sarah Chen',
    region: 'Santa Monica',
    status: 'busy',
    location: '34.0195, -118.4912',
    gpsAccuracy: '±3.1m',
    onlineDuration: '3h 2m',
    lastSync: '30 seconds ago',
    task: {
      title: 'Deliver Package #4892',
      priority: 'High',
      destination: 'Santa Monica Pier',
      distance: '2.3 km',
      eta: '12 min',
      state: 'In Progress',
    },
    history: [
      { title: 'Warehouse Audit #12', completedAt: 'Completed · 10:28 AM' },
      { title: 'Supply Drop B7', completedAt: 'Completed · 9:15 AM' },
    ],
  },
  {
    id: 'AGT-003',
    name: 'James Park',
    region: 'Mid-Wilshire',
    status: 'approaching',
    location: '34.0618, -118.3081',
    gpsAccuracy: '±4.0m',
    onlineDuration: '2h 47m',
    lastSync: '8 seconds ago',
    task: {
      title: 'Site Inspection #204',
      priority: 'Medium',
      destination: 'Wilshire Center',
      distance: '380 m',
      eta: '3 min',
      state: 'Approaching',
    },
    history: [{ title: 'Inventory Check C4', completedAt: 'Completed · 8:54 AM' }],
  },
  {
    id: 'AGT-004',
    name: 'Elena Vasquez',
    region: 'Beverly Hills',
    status: 'available',
    location: '34.0736, -118.4004',
    gpsAccuracy: '±2.9m',
    onlineDuration: '5h 10m',
    lastSync: '18 seconds ago',
    history: [{ title: 'Client Handoff #16', completedAt: 'Completed · 11:05 AM' }],
  },
  {
    id: 'AGT-005',
    name: 'David Kim',
    region: 'LAX Area',
    status: 'busy',
    location: '33.9416, -118.4085',
    gpsAccuracy: '±3.7m',
    onlineDuration: '1h 56m',
    lastSync: '22 seconds ago',
    task: {
      title: 'Airport Transfer #77',
      priority: 'Urgent',
      destination: 'Terminal 4',
      distance: '1.8 km',
      eta: '9 min',
      state: 'In Progress',
    },
    history: [{ title: 'Cargo Check #09', completedAt: 'Completed · 9:38 AM' }],
  },
  {
    id: 'AGT-006',
    name: 'Priya Sharma',
    region: 'Hollywood',
    status: 'offline',
    location: '34.0928, -118.3287',
    gpsAccuracy: 'Unavailable',
    onlineDuration: '—',
    lastSync: '2 hours ago',
    history: [{ title: 'Venue Survey #42', completedAt: 'Completed · Yesterday' }],
  },
  {
    id: 'AGT-007',
    name: 'Tom Wilson',
    region: 'West Hollywood',
    status: 'available',
    location: '34.0900, -118.3617',
    gpsAccuracy: '±2.4m',
    onlineDuration: '4h 44m',
    lastSync: '14 seconds ago',
    history: [{ title: 'Equipment Return #19', completedAt: 'Completed · 10:47 AM' }],
  },
  {
    id: 'AGT-008',
    name: 'Aisha Johnson',
    region: 'East LA',
    status: 'offline',
    location: '34.0239, -118.1720',
    gpsAccuracy: 'Unavailable',
    onlineDuration: '—',
    lastSync: 'Yesterday',
    history: [{ title: 'Store Visit #63', completedAt: 'Completed · Yesterday' }],
  },
];
