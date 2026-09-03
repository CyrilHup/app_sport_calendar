import React, { useEffect, useState } from 'react';
import { CalendarEvent, DailySchedule, PeriodizationContext } from './types/calendar';
import { GarminActivity, GarminSyncState, ActivityComparison } from './types/garmin';
import { Header } from './components/Header';
import { CalendarView } from './components/CalendarView';
import { ComparisonDashboard } from './components/ComparisonDashboard';
import { TrainingLoadCard } from './components/TrainingLoadCard';
import { GarminModal } from './components/GarminModal';
import { GoogleCalendarModal } from './components/GoogleCalendarModal';
import { QMTPlanOverview } from './components/QMTPlanOverview';
import { MobileNav } from './components/MobileNav';
import { buildCompleteCalendar, parseICSString, RawIcsEvent } from './services/icsParser';
import { getPeriodizationContext } from './services/periodizationEngine';
import { loadGarminSyncState, loadStoredGarminActivities, saveGarminActivities, saveGarminSyncState } from './services/garminService';
import { compareWorkoutsWithGarmin, computeWeeklyTelemetry } from './services/comparisonEngine';
import { Activity, Calendar, TrendingUp } from 'lucide-react';

const DATE_MODE_STORAGE_KEY = 'app_date_mode';
const MANUAL_PAIRS_STORAGE_KEY = 'garmin_manual_pairs';

function loadManualPairs(): Record<string, string> {
  try {
    const raw = localStorage.getItem(MANUAL_PAIRS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveManualPairs(pairs: Record<string, string>): void {
  localStorage.setItem(MANUAL_PAIRS_STORAGE_KEY, JSON.stringify(pairs));
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0=Monday, ..., 6=Sunday
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export const App: React.FC = () => {
  const [dateMode, setDateMode] = useState<'live' | 'demo'>(() => {
    return (localStorage.getItem(DATE_MODE_STORAGE_KEY) as 'live' | 'demo') || 'demo';
  });

  const [schedules, setSchedules] = useState<DailySchedule[]>([]);
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [garminActivities, setGarminActivities] = useState<GarminActivity[]>([]);
  const [garminState, setGarminState] = useState<GarminSyncState>(loadGarminSyncState());
  const [manualPairs, setManualPairs] = useState<Record<string, string>>(loadManualPairs());
  const [comparisons, setComparisons] = useState<ActivityComparison[]>([]);
  const [activeTab, setActiveTab] = useState<'calendar' | 'compare' | 'periodization'>('calendar');
  const [isRecharging, setIsRecharging] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toISOString());
  const [isGarminModalOpen, setIsGarminModalOpen] = useState<boolean>(false);
  const [isGoogleCalendarModalOpen, setIsGoogleCalendarModalOpen] = useState<boolean>(false);

  // Dynamic reference date based on dateMode
  const referenceDate = dateMode === 'live' ? new Date() : new Date('2026-09-02T12:00:00');
  const currentPeriodContext = getPeriodizationContext(referenceDate);

  const toggleDateMode = () => {
    const nextMode = dateMode === 'demo' ? 'live' : 'demo';
    setDateMode(nextMode);
    localStorage.setItem(DATE_MODE_STORAGE_KEY, nextMode);
  };

  // Function to recharge both ÉTS iCal and Garmin Connect
  const autoRechargeAll = async () => {
    setIsRecharging(true);
    let rawCourses: RawIcsEvent[] = [];

    // 1. Fetch ÉTS iCal feed via proxy
    try {
      const res = await fetch('/api/ets-ical');
      if (res.ok) {
        const icsText = await res.text();
        rawCourses = parseICSString(icsText);
      }
    } catch (err) {
      console.warn("Could not fetch from proxy, using fallback", err);
    }

    // Fallback if needed
    if (rawCourses.length === 0) {
      rawCourses = [
        {
          uid: "577948-1",
          summary: "MGL869-01 (C)",
          description: "MGL869 - Special Topics in Software Engineering - Class",
          location: "A-1540",
          startDate: new Date("2026-09-03T18:00:00"),
          endDate: new Date("2026-09-03T21:30:00")
        },
        {
          uid: "563197-1",
          summary: "MTR801-55 (C)",
          description: "MTR801 - Research Project Planning in Engineering - Class",
          location: "Online (Home)",
          startDate: new Date("2026-09-04T08:30:00"),
          endDate: new Date("2026-09-04T17:00:00")
        },
        {
          uid: "563197-2",
          summary: "MTR801-55 (C)",
          description: "MTR801 - Research Project Planning in Engineering - Class",
          location: "Online (Home)",
          startDate: new Date("2026-09-05T09:00:00"),
          endDate: new Date("2026-09-05T17:30:00")
        }
      ];
    }

    // Start calendar exactly on Monday of current week
    const calendarStartMonday = getMondayOfWeek(referenceDate);
    const { schedules: builtSchedules, allEvents: builtEvents } = buildCompleteCalendar(
      rawCourses,
      calendarStartMonday,
      42 // 6 full weeks
    );

    setSchedules(builtSchedules);
    setAllEvents(builtEvents);

    // 2. Load stored real Garmin activities or attempt auto-sync via .env credentials
    let loadedActivities = loadStoredGarminActivities();
    if (loadedActivities.length === 0) {
      try {
        const garminRes = await fetch('/api/garmin-sync');
        if (garminRes.ok) {
          const garminData = await garminRes.json();
          if (garminData.activities && garminData.activities.length > 0) {
            loadedActivities = garminData.activities;
            saveGarminActivities(loadedActivities);
          }
        }
      } catch {
        // Not configured in .env; remains empty until user connects
      }
    }

    setGarminActivities(loadedActivities);

    const compResults = compareWorkoutsWithGarmin(builtEvents, loadedActivities, manualPairs, referenceDate);
    setComparisons(compResults);

    const nowIso = new Date().toISOString();
    setLastSyncTime(nowIso);

    const updatedGarminState: GarminSyncState = {
      ...garminState,
      connected: loadedActivities.length > 0,
      lastSyncTime: loadedActivities.length > 0 ? nowIso : undefined,
      activitiesCount: loadedActivities.length,
      isSyncing: false
    };
    setGarminState(updatedGarminState);
    saveGarminSyncState(updatedGarminState);

    setIsRecharging(false);
  };

  useEffect(() => {
    autoRechargeAll();
  }, [dateMode]);

  const handleUpdateGarminState = (newState: GarminSyncState) => {
    setGarminState(newState);
    saveGarminSyncState(newState);
  };

  const handleActivitiesSynced = (newActivities: GarminActivity[]) => {
    setGarminActivities(newActivities);
    saveGarminActivities(newActivities);
    if (allEvents.length > 0) {
      setComparisons(compareWorkoutsWithGarmin(allEvents, newActivities, manualPairs, referenceDate));
    }
  };

  const handleManualPair = (planId: string, garminActivityId: string) => {
    const updated = { ...manualPairs, [planId]: garminActivityId };
    setManualPairs(updated);
    saveManualPairs(updated);
    if (allEvents.length > 0) {
      setComparisons(compareWorkoutsWithGarmin(allEvents, garminActivities, updated, referenceDate));
    }
  };

  const handleManualUnpair = (planId: string) => {
    const updated = { ...manualPairs };
    delete updated[planId];
    setManualPairs(updated);
    saveManualPairs(updated);
    if (allEvents.length > 0) {
      setComparisons(compareWorkoutsWithGarmin(allEvents, garminActivities, updated, referenceDate));
    }
  };

  // Compute full current week's targets for accurate microcycle telemetry progress
  const calendarStartMonday = getMondayOfWeek(referenceDate);
  const weekStartStr = calendarStartMonday.toISOString().slice(0, 10);
  const weekEndDate = new Date(calendarStartMonday);
  weekEndDate.setDate(calendarStartMonday.getDate() + 6);
  const weekEndStr = weekEndDate.toISOString().slice(0, 10);

  const currentWeekSchedules = schedules.slice(0, 7);
  const plannedDurationMin = currentWeekSchedules.reduce((acc, s) => acc + (s.sportSession?.durationMinutes || 0), 0);
  const plannedElevationM = currentWeekSchedules.reduce((acc, s) => acc + (s.sportSession?.metadata?.targetElevationM || 0), 0);
  const weeklyStats = computeWeeklyTelemetry(
    comparisons,
    { start: weekStartStr, end: weekEndStr },
    {
      plannedDurationMin: plannedDurationMin || 285,
      plannedElevationM: plannedElevationM || 780
    }
  );

  return (
    <div className="app-container">
      {/* Top Header with Fused Telemetry HUD */}
      <Header
        periodContext={currentPeriodContext}
        garminState={garminState}
        weeklyStats={weeklyStats}
        onOpenGarmin={() => setIsGarminModalOpen(true)}
        onOpenGoogleCalendar={() => setIsGoogleCalendarModalOpen(true)}
        onRefreshAll={autoRechargeAll}
        isRecharging={isRecharging}
        lastSyncTime={lastSyncTime}
        onSelectPeriodizationTab={() => setActiveTab('periodization')}
        dateMode={dateMode}
        onToggleDateMode={toggleDateMode}
      />

      {/* Navigation Tabs (Desktop) */}
      <div className="nav-tabs" style={{ marginBottom: '14px' }}>
        <button
          className={`nav-tab-btn ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendar')}
        >
          <Calendar size={15} /> Planning
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'compare' ? 'active' : ''}`}
          onClick={() => setActiveTab('compare')}
        >
          <Activity size={15} /> Télémétrie Garmin
          {comparisons.length > 0 && (
            <span
              style={{
                fontSize: '0.68rem',
                padding: '1px 6px',
                borderRadius: 9999,
                background: 'var(--primary-subtle)',
                color: 'var(--primary)',
                fontWeight: 700
              }}
            >
              {comparisons.length}
            </span>
          )}
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'periodization' ? 'active' : ''}`}
          onClick={() => setActiveTab('periodization')}
        >
          <TrendingUp size={15} /> Plan QMT-80
        </button>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'calendar' && (
        <CalendarView
          schedules={schedules}
          allEvents={allEvents}
          onOpenGoogleCalendar={() => setIsGoogleCalendarModalOpen(true)}
          referenceDateStr={referenceDate.toISOString().slice(0, 10)}
        />
      )}

      {activeTab === 'compare' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <TrainingLoadCard
            weeklyStats={weeklyStats}
            comparisons={comparisons}
          />
          <ComparisonDashboard
            comparisons={comparisons}
            garminState={garminState}
            onOpenGarminSync={() => setIsGarminModalOpen(true)}
            availableGarminActivities={garminActivities}
            manualPairs={manualPairs}
            onManualPair={handleManualPair}
            onManualUnpair={handleManualUnpair}
          />
        </div>
      )}

      {activeTab === 'periodization' && (
        <QMTPlanOverview currentContext={currentPeriodContext} />
      )}

      {/* Garmin Connect Modal */}
      <GarminModal
        isOpen={isGarminModalOpen}
        onClose={() => setIsGarminModalOpen(false)}
        garminState={garminState}
        onUpdateState={handleUpdateGarminState}
        onActivitiesSynced={handleActivitiesSynced}
      />

      {/* Google Calendar Sync Modal */}
      <GoogleCalendarModal
        isOpen={isGoogleCalendarModalOpen}
        onClose={() => setIsGoogleCalendarModalOpen(false)}
        events={allEvents}
      />

      {/* Mobile Bottom Navigation Bar */}
      <MobileNav
        currentTab={activeTab}
        onChangeTab={tab => setActiveTab(tab)}
      />
    </div>
  );
};
