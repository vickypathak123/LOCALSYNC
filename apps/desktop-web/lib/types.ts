export type {
  Agent,
  AgentStatus,
  AccountStatus,
  Task,
  TaskStatus,
  TaskPriority,
  RoadRoute,
  TaskDelayStatus,
} from '../../../packages/shared-types';
export { computeTaskDelayStatus, DELAY_GRACE_PERIOD_MINUTES } from '../../../packages/shared-types';
import type { Task } from '../../../packages/shared-types';

// Client-side view of a task, extended with the live distance/ETA figures that
// only exist transiently on socket broadcasts (the backend never persists them).
export interface TaskUI extends Task {
  distance?: number;
  eta?: number;
}
