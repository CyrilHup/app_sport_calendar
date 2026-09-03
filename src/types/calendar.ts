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
    setsAndReps?: string;
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
  };
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
