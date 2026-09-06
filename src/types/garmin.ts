import { CalendarEvent } from './calendar';

export type GarminActivityType =
  | 'RUNNING'
  | 'TRAIL_RUNNING'
  | 'STRENGTH_TRAINING'
  | 'CYCLING'
  | 'WALKING'
  | 'FITNESS_EQUIPMENT'
  | 'CLIMBING'
  | 'OTHER';

export interface GarminActivity {
  activityId: string;
  activityName: string;
  activityType: GarminActivityType;
  startTimeLocal: string; // ISO
  durationMinutes: number;
  distanceKm?: number;
  elevationGainM?: number;
  elevationLossM?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgCadence?: number;
  avgPaceMinKm?: string;
  calories?: number;
  aerobicTrainingEffect?: number;
  anaerobicTrainingEffect?: number;
  trainingLoad?: number; // Firstbeat EPOC load score
  trainingEffectLabel?: string; // e.g. "BASE", "TEMPO", "VO2_MAX", "RECOVERY"
  elapsedDurationMinutes?: number; // Total gross elapsed time including pauses
  movingDurationMinutes?: number; // Net moving time
  vo2MaxValue?: number;
  garminTypeKey?: string; // Native Garmin Connect typeKey (e.g. "trail_running", "bouldering")
  source: 'GARMIN_CONNECT' | 'GPX_IMPORT';
}

export type ComparisonStatus = 'COMPLIANT' | 'PARTIAL' | 'MISSED' | 'UNPLANNED' | 'PENDING';

export interface ActivityComparison {
  id: string;
  date: string; // YYYY-MM-DD
  status: ComparisonStatus;
  plannedEvent?: CalendarEvent;
  actualActivity?: GarminActivity;
  durationDeltaMinutes: number; // actual - planned
  elevationDeltaM?: number;
  heartRateCompliance: 'OPTIMAL' | 'TOO_HIGH' | 'TOO_LOW' | 'N/A';
  complianceScore: number; // 0 to 100%
  inferredType?: string; // For activities logged as 'OTHER'
  feedbackNotes: string[];
  isPostponedCatchup?: boolean;
  scheduledDate?: string;
  executedDate?: string;
}

export interface GarminSyncState {
  connected: boolean;
  lastSyncTime?: string;
  accountEmail?: string;
  activitiesCount: number;
  isSyncing: boolean;
}
