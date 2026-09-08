export type EventCategory = 'sport' | 'course' | 'trajet' | 'mobility';

export type SportType =
  | 'TRAIL_LONG'
  | 'TRAIL_INTENSE'
  | 'RUN_EASY'
  | 'CALISTHENICS'
  | 'GYM_FORCE'
  | 'MOBILITY'
  | 'TRAVEL'
  | 'RACE_DAY';

export interface CalendarEvent {
  id: string;
  category: EventCategory;
  sportType?: SportType;
  title: string;
  startDate: string; // ISO string
  endDate: string;   // ISO string
  location: string;
  description: string;
  emoji: string;
  colorId: string;
  colorHex: string;
  durationMinutes: number;
  metadata?: {
    courseCode?: string;
    room?: string;
    targetHeartRate?: string;
    targetHeartRateRange?: [number, number];
    targetCadence?: string;
    targetElevationM?: number;
    nutritionAdvice?: string;
    chainedAfterCourse?: boolean;
    transitFrom?: string;
    transitTo?: string;
    commuteAller?: {
      departureTime: string;
      arrivalTime: string;
      durationMinutes: number;
    };
    commuteRetour?: {
      departureTime: string;
      arrivalTime: string;
      durationMinutes: number;
    };
    isDistanciel?: boolean;
    isExam?: boolean;
    conflictRescheduled?: boolean;
    conflictReason?: string;
    isPostponed?: boolean;
    originalDate?: string;
    postponedToDate?: string;
    postponedReason?: string;
    isPostponedPlaceholder?: boolean;
    isAdapted?: boolean;
    adaptationReason?: string;
    originalTitle?: string;
    originalDurationMinutes?: number;
  };
}

export interface WorkoutPostponeOverride {
  originalEventId: string;
  originalDate: string;      // YYYY-MM-DD
  targetDate: string;        // YYYY-MM-DD
  targetStartTime?: string;  // HH:mm or ISO string
  targetEndTime?: string;
  reason?: string;
  createdAt: string;
}

export interface AdaptiveWorkoutOverride {
  eventId: string;
  date: string;
  originalTitle: string;
  adaptedTitle: string;
  originalDurationMinutes: number;
  adaptedDurationMinutes: number;
  adaptationReason: string;
  coachingCue: string;
  adaptedDescription?: string;
  targetHeartRate?: string;
  targetHeartRateRange?: [number, number];
  adaptedLocation?: string;
  adaptedElevationM?: number;
  adaptedSportType?: SportType;
  createdAt: string;
}

export interface AdaptiveWorkoutAction {
  eventId: string;
  date: string;
  originalTitle: string;
  adaptedTitle: string;
  originalDurationMinutes: number;
  adaptedDurationMinutes: number;
  actionType: 'LIGHTEN' | 'POSTPONE' | 'MAINTAIN';
  reason: string;
  coachingCue: string;
  adaptedDescription?: string;
  targetHeartRate?: string;
  targetHeartRateRange?: [number, number];
  adaptedLocation?: string;
  adaptedElevationM?: number;
  adaptedSportType?: SportType;
}

export interface AdaptivePlanStatus {
  injuryRiskLevel: 'SAFE' | 'MODERATE' | 'HIGH';
  trailAcwrRatio: number;
  trailAcwrStatus: 'UNDERLOAD' | 'OPTIMAL' | 'MODERATE_RISK' | 'DANGER_HIGH_RISK' | 'CALIBRATING';
  headline: string;
  explanation: string;
  trailAcuteLoad7d: number;
  trailChronicWeeklyAvg: number;
  calisthenicsAcuteLoad7d: number;
  calisthenicsSessionsCount7d: number;
  recommendedActions: AdaptiveWorkoutAction[];
  hasActiveAdaptations: boolean;
}

export interface PeriodizationContext {
  phase: string;
  weekNumber: number;
  isDeload: boolean;
  volumeFactor: number;
  label: string;
  daysToRace: number;
  description: string;
}

export interface DailySchedule {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0=Lundi, ..., 6=Dimanche
  periodContext: PeriodizationContext;
  events: CalendarEvent[];
  sportSession?: CalendarEvent;
  hasCourse: boolean;
  hasIntensiveCourse: boolean;
}

