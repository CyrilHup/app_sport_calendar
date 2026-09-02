import React, { useEffect, useState } from 'react';
import { CalendarEvent, DailySchedule, PeriodizationContext } from './types/calendar';
import { GarminActivity, GarminSyncState, ActivityComparison } from './types/garmin';
import { Header } from './components/Header';
import { PeriodizationBar } from './components/PeriodizationBar';
import { CalendarView } from './components/CalendarView';
import { ComparisonDashboard } from './components/ComparisonDashboard';
import { GarminModal } from './components/GarminModal';
import { GoogleCalendarModal } from './components/GoogleCalendarModal';
import { QMTPlanOverview } from './components/QMTPlanOverview';
import { MobileNav } from './components/MobileNav';
import { buildCompleteCalendar, parseICSString, RawIcsEvent } from './services/icsParser';
import { getPeriodizationContext } from './services/periodizationEngine';
import { loadGarminSyncState, loadStoredGarminActivities, saveGarminActivities, saveGarminSyncState, getSampleGarminActivities } from './services/garminService';
import { compareWorkoutsWithGarmin, computeWeeklyTelemetry } from './services/comparisonEngine';
import { Activity, Calendar, TrendingUp } from 'lucide-react';

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0=Monday, ..., 6=Sunday
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export const App: React.FC = () => {
  const [schedules, setSchedules] = useState<DailySchedule[]>([]);
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [garminActivities, setGarminActivities] = useState<GarminActivity[]>([]);
  const [garminState, setGarminState] = useState<GarminSyncState>(loadGarminSyncState());
  const [comparisons, setComparisons] = useState<ActivityComparison[]>([]);
  const [activeTab, setActiveTab] = useState<'calendar' | 'compare' | 'periodization'>('calendar');
  const [isRecharging, setIsRecharging] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toISOString());
  const [isGarminModalOpen, setIsGarminModalOpen] = useState<boolean>(false);
  const [isGoogleCalendarModalOpen, setIsGoogleCalendarModalOpen] = useState<boolean>(false);

  // Reference date: 2026-09-02 (Wednesday)
  const referenceDate = new Date('2026-09-02T00:00:00');
  const currentPeriodContext = getPeriodizationContext(referenceDate);

  // Function to recharge both ÉTS iCal and Garmin Connect (only on page load or manual button click)
  const autoRechargeAll = async () => {
    setIsRecharging(true);
    let rawCourses: RawIcsEvent[] = [];

    // 1. Fetch ÉTS iCal feed
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

    // Start calendar exactly on Monday of the current week (Monday August 31, 2026)
    const calendarStartMonday = getMondayOfWeek(referenceDate);
    const { schedules: builtSchedules, allEvents: builtEvents } = buildCompleteCalendar(
      rawCourses,
      calendarStartMonday,
      42 // 6 full weeks (Mon-Sun)
    );

    setSchedules(builtSchedules);
    setAllEvents(builtEvents);

    // 2. Load Garmin activities & evaluate comparisons
    const storedActivities = loadStoredGarminActivities();
    setGarminActivities(storedActivities);

    const compResults = compareWorkoutsWithGarmin(builtEvents, storedActivities, undefined, referenceDate);
    setComparisons(compResults);

    const nowIso = new Date().toISOString();
    setLastSyncTime(nowIso);

    const updatedGarminState: GarminSyncState = {
      ...garminState,
      connected: true,
      lastSyncTime: nowIso,
      activitiesCount: storedActivities.length,
      isSyncing: false
    };
    setGarminState(updatedGarminState);
    saveGarminSyncState(updatedGarminState);

    setIsRecharging(false);
  };

  // Only sync once when the page loads (NOT on window focus / alt-tab)
  useEffect(() => {
    autoRechargeAll();
  }, []);

  const handleUpdateGarminState = (newState: GarminSyncState) => {
    setGarminState(newState);
    saveGarminSyncState(newState);
  };

  const handleAddGarminActivities = (newActivities: GarminActivity[]) => {
    const updated = [...newActivities, ...garminActivities];
    setGarminActivities(updated);
    saveGarminActivities(updated);
    if (allEvents.length > 0) {
      setComparisons(compareWorkoutsWithGarmin(allEvents, updated, undefined, referenceDate));
    }
  };

  const handleReloadSamples = () => {
    const samples = getSampleGarminActivities();
    setGarminActivities(samples);
    saveGarminActivities(samples);
    if (allEvents.length > 0) {
      setComparisons(compareWorkoutsWithGarmin(allEvents, samples, undefined, referenceDate));
    }
  };

  const weeklyStats = computeWeeklyTelemetry(comparisons, 7);

  return (
    <div className="app-container">
      {/* Top Header */}
      <Header
        periodContext={currentPeriodContext}
        garminState={garminState}
        weeklyStats={weeklyStats}
        onOpenGarmin={() => setIsGarminModalOpen(true)}
        onOpenGoogleCalendar={() => setIsGoogleCalendarModalOpen(true)}
        onRefreshAll={autoRechargeAll}
        isRecharging={isRecharging}
        lastSyncTime={lastSyncTime}
      />

      {/* Periodization Progress Bar */}
      <PeriodizationBar context={currentPeriodContext} />

      {/* Navigation Tabs (Desktop) */}
      <div className="nav-tabs" style={{ marginBottom: '16px' }}>
        <button
          className={`nav-tab-btn ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendar')}
        >
          <Calendar size={15} /> Schedule
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'compare' ? 'active' : ''}`}
          onClick={() => setActiveTab('compare')}
        >
          <Activity size={15} /> Garmin Telemetry
          {comparisons.length > 0 && (
            <span
              style={{
                fontSize: '0.68rem',
                padding: '1px 6px',
                borderRadius: 9999,
                background: 'rgba(0, 242, 254, 0.2)',
                color: 'var(--cyan)'
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
          <TrendingUp size={15} /> QMT-80 Plan
        </button>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'calendar' && (
        <CalendarView
          schedules={schedules}
          allEvents={allEvents}
          onOpenGoogleCalendar={() => setIsGoogleCalendarModalOpen(true)}
        />
      )}

      {activeTab === 'compare' && (
        <ComparisonDashboard
          comparisons={comparisons}
          garminState={garminState}
          onOpenGarminSync={() => setIsGarminModalOpen(true)}
        />
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
        onAddActivities={handleAddGarminActivities}
        onReloadSamples={handleReloadSamples}
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
