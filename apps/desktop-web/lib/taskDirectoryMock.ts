export type DirectoryTaskStatus = 'in_progress' | 'approaching' | 'accepted' | 'completed' | 'rejected';
export type DirectoryTaskPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export interface DirectoryTimelineItem {
  label: string;
  time: string;
  state: 'complete' | 'current' | 'pending';
}

export interface DirectoryTaskItem {
  id: string;
  title: string;
  agent: { id: string; name: string };
  priority: DirectoryTaskPriority;
  status: DirectoryTaskStatus;
  distance: string;
  eta: string;
  created: string;
  createdPeriod: 'today' | 'yesterday';
  destination: string;
  address: string;
  coordinates: string;
  geofence: string;
  timeline: DirectoryTimelineItem[];
  geoVerification: { status: 'Pending' | 'Verified' | 'Not Verified'; method: string; accuracy: string };
}

const pendingTimeline = (assigned: string, accepted: string, progress: string): DirectoryTimelineItem[] => [
  { label: 'Assigned', time: assigned, state: 'complete' },
  { label: 'Accepted', time: accepted, state: 'complete' },
  { label: 'In Progress', time: progress, state: 'current' },
  { label: 'Destination Reached', time: 'Pending', state: 'pending' },
  { label: 'Completed', time: 'Pending', state: 'pending' },
];

export const DIRECTORY_TASKS: DirectoryTaskItem[] = [
  {
    id: 'TSK-101', title: 'Deliver Package #4892', agent: { id: 'AGT-002', name: 'Sarah Chen' }, priority: 'High', status: 'in_progress', distance: '2.3 km', eta: '12 min', created: '9:00 AM', createdPeriod: 'today', destination: 'Santa Monica Pier', address: '200 Santa Monica Pier, CA 90401', coordinates: '34.0094, -118.4973', geofence: '100m', timeline: pendingTimeline('9:00 AM', '9:02 AM', '9:05 AM'), geoVerification: { status: 'Pending', method: 'GPS + Geofence', accuracy: '±10m' },
  },
  {
    id: 'TSK-102', title: 'Site Inspection #204', agent: { id: 'AGT-003', name: 'James Park' }, priority: 'Medium', status: 'approaching', distance: '0.4 km', eta: '3 min', created: '8:30 AM', createdPeriod: 'today', destination: 'Wilshire Center', address: '3600 Wilshire Blvd, Los Angeles, CA', coordinates: '34.0618, -118.3081', geofence: '75m', timeline: pendingTimeline('8:30 AM', '8:33 AM', '8:36 AM'), geoVerification: { status: 'Pending', method: 'GPS + Geofence', accuracy: '±10m' },
  },
  {
    id: 'TSK-103', title: 'Airport Transfer #77', agent: { id: 'AGT-005', name: 'David Kim' }, priority: 'Critical', status: 'accepted', distance: '5.1 km', eta: '18 min', created: '10:00 AM', createdPeriod: 'today', destination: 'LAX Terminal 4', address: '1 World Way, Los Angeles, CA 90045', coordinates: '33.9416, -118.4085', geofence: '150m', timeline: [{ label: 'Assigned', time: '10:00 AM', state: 'complete' }, { label: 'Accepted', time: '10:03 AM', state: 'current' }, { label: 'In Progress', time: 'Pending', state: 'pending' }, { label: 'Destination Reached', time: 'Pending', state: 'pending' }, { label: 'Completed', time: 'Pending', state: 'pending' }], geoVerification: { status: 'Pending', method: 'GPS + Geofence', accuracy: '±10m' },
  },
  {
    id: 'TSK-098', title: 'Document Pickup #31', agent: { id: 'AGT-001', name: 'Marcus Rivera' }, priority: 'Medium', status: 'completed', distance: '—', eta: '—', created: '8:00 AM', createdPeriod: 'today', destination: 'Downtown Records Office', address: '200 N Spring St, Los Angeles, CA', coordinates: '34.0537, -118.2428', geofence: '100m', timeline: [{ label: 'Assigned', time: '8:00 AM', state: 'complete' }, { label: 'Accepted', time: '8:02 AM', state: 'complete' }, { label: 'In Progress', time: '8:05 AM', state: 'complete' }, { label: 'Destination Reached', time: '8:21 AM', state: 'complete' }, { label: 'Completed', time: '8:24 AM', state: 'complete' }], geoVerification: { status: 'Verified', method: 'GPS + Geofence', accuracy: '±6m' },
  },
  {
    id: 'TSK-095', title: 'Supply Drop B7', agent: { id: 'AGT-002', name: 'Sarah Chen' }, priority: 'Low', status: 'completed', distance: '—', eta: '—', created: '7:30 AM', createdPeriod: 'today', destination: 'Santa Monica Depot', address: '1437 4th St, Santa Monica, CA', coordinates: '34.0161, -118.4956', geofence: '75m', timeline: [{ label: 'Assigned', time: '7:30 AM', state: 'complete' }, { label: 'Accepted', time: '7:31 AM', state: 'complete' }, { label: 'In Progress', time: '7:34 AM', state: 'complete' }, { label: 'Destination Reached', time: '7:52 AM', state: 'complete' }, { label: 'Completed', time: '7:55 AM', state: 'complete' }], geoVerification: { status: 'Verified', method: 'GPS + Geofence', accuracy: '±8m' },
  },
  {
    id: 'TSK-091', title: 'Equipment Return #19', agent: { id: 'AGT-007', name: 'Tom Wilson' }, priority: 'High', status: 'rejected', distance: '—', eta: '—', created: 'Yesterday', createdPeriod: 'yesterday', destination: 'West Hollywood Hub', address: '8300 Santa Monica Blvd, CA', coordinates: '34.0900, -118.3617', geofence: '100m', timeline: [{ label: 'Assigned', time: 'Yesterday', state: 'complete' }, { label: 'Rejected', time: 'Yesterday', state: 'current' }], geoVerification: { status: 'Not Verified', method: 'GPS + Geofence', accuracy: '—' },
  },
];
