import React, { useEffect, useState, useMemo } from 'react';
import { CalendarEvent, DailySchedule, PeriodizationContext, WorkoutPostponeOverride, AdaptiveWorkoutOverride, AdaptiveWorkoutAction } from './types/calendar';
import { GarminActivity, GarminSyncState, ActivityComparison } from './types/garmin';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { CalendarView } from './components/CalendarView';
import { ComparisonDashboard } from './components/ComparisonDashboard';
import { AccountModal, AccountModalTab } from './components/AccountModal';
import { QMTPlanOverview } from './components/QMTPlanOverview';
import { StatsDashboard } from './components/StatsDashboard';
import { MobileNav } from './components/MobileNav';
import { buildCompleteCalendar, parseICSString, RawIcsEvent } from './services/icsParser';
import { formatDateKey, getMondayOfWeek } from './services/dateUtils';
import { getPeriodizationContext, GLOBAL_APP_CONFIG, setAppConfigOverrides } from './services/periodizationEngine';
import { loadGarminCredentials, loadGarminCredentialsAsync, loadGarminSyncState, loadStoredGarminActivities, saveGarminActivities, saveGarminCredentials, saveGarminSyncState, syncWithGarminAPI } from './services/garminService';
import { App as CapacitorApp } from '@capacitor/app';
import { compareWorkoutsWithGarmin, computeWeeklyTelemetry } from './services/comparisonEngine';
import { applyPostponements, cancelPostponeWorkout, loadPostponeOverrides, postponeWorkout } from './services/postponeService';
import { applyAdaptiveModifications, buildOverridesFromActions, clearAdaptiveOverrides, loadAdaptiveOverrides, saveAdaptiveOverrides } from './services/adaptivePlanEngine';
import { DEFAULT_WEEKLY_TARGETS, computeFullStatsReport } from './services/statsEngine';
import { isTrailOrRunning } from './services/activityClassifier';
import { Activity, BarChart3, Calendar, TrendingUp } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { syncActivitiesToCloud, fetchActivitiesFromCloud, syncWellnessToCloud, fetchWellnessFromCloud, syncPairsToCloud, fetchPairsFromCloud, fetchPublicSharedData } from './services/supabaseClient';
import { saveWellnessData, loadWellnessHistory } from './services/readinessEngine';
import { getApiUrl } from './services/apiConfig';
import { syncCurrentWeekWorkoutsToGarmin } from './services/garminAutoSyncService';
import { STORAGE_KEYS, storageGet, storageSet, storageGetRaw, storageSetRaw } from './services/storageService';

function loadManualPairs(): Record<string, string> {
  return storageGet<Record<string, string>>(STORAGE_KEYS.GARMIN_MANUAL_PAIRS, {});
}

function saveManualPairs(pairs: Record<string, string>): void {
  storageSet(STORAGE_KEYS.GARMIN_MANUAL_PAIRS, pairs);
}



export const App: React.FC = () => {
  const [baseCalendar, setBaseCalendar] = useState<{ schedules: DailySchedule[]; allEvents: CalendarEvent[] }>({ schedules: [], allEvents: [] });
  const [schedules, setSchedules] = useState<DailySchedule[]>([]);
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [postponeOverrides, setPostponeOverrides] = useState<Record<string, WorkoutPostponeOverride>>(loadPostponeOverrides());
  const [adaptiveOverrides, setAdaptiveOverrides] = useState<Record<string, AdaptiveWorkoutOverride>>(loadAdaptiveOverrides());
  const [garminActivities, setGarminActivities] = useState<GarminActivity[]>([]);
  const [garminState, setGarminState] = useState<GarminSyncState>(loadGarminSyncState());
  const [manualPairs, setManualPairs] = useState<Record<string, string>>(loadManualPairs());
  const [comparisons, setComparisons] = useState<ActivityComparison[]>([]);
  const [activeTab, setActiveTab] = useState<'calendar' | 'compare' | 'periodization' | 'stats'>('calendar');
  const [isRecharging, setIsRecharging] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toISOString());
  const [accountModal, setAccountModal] = useState<{ isOpen: boolean; tab: AccountModalTab }>({
    isOpen: false,
    tab: 'profile'
  });
  const [spectatorData, setSpectatorData] = useState<{ profile: any; activities: GarminActivity[] } | null>(null);

  const handleOpenAccountModal = (tab: AccountModalTab = 'profile') => {
    setAccountModal({ isOpen: true, tab });
  };

  const { user, profile, saveCloudGarminCredentials } = useAuth();

  // Apply user profile overrides to periodization & transit engine
  useEffect(() => {
    if (profile) {
      setAppConfigOverrides({
        homeAddress: profile.homeAddress,
        campusAddress: profile.campusAddress,
        trailAddress: profile.trailAddress,
        fcMax: profile.fcMax
      });
    }
  }, [profile]);

  // Check for spectator share mode in URL (?share=slug)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareSlug = params.get('share');
    if (shareSlug) {
      fetchPublicSharedData(shareSlug).then(data => {
        if (data) {
          setSpectatorData(data);
          if (data.activities.length > 0) {
            setGarminActivities(data.activities);
          }
        }
      });
    }
  }, []);

  // Bidirectional sync for activities, credentials, and manual pairs when user logs in with Google / Supabase
  useEffect(() => {
    if (user?.id) {
      (async () => {
        // Auto-link cloud Garmin credentials if present in user Google account
        const cloudGarminEmail = user.user_metadata?.garmin_email;
        const cloudGarminPassword = user.user_metadata?.garmin_password;
        const localCreds = await loadGarminCredentialsAsync();

        if (cloudGarminEmail && cloudGarminPassword) {
          if (!localCreds?.email || !localCreds?.password || localCreds.email !== cloudGarminEmail) {
            saveGarminCredentials({ email: cloudGarminEmail, password: cloudGarminPassword });
          }
        } else if (localCreds?.email && localCreds?.password) {
          // Automatically save existing local credentials to user's Google cloud account
          saveCloudGarminCredentials(localCreds.email, localCreds.password);
        }

        const localActs = loadStoredGarminActivities();
        const cloudActs = await fetchActivitiesFromCloud(user.id);
        const actMap = new Map<string, GarminActivity>();
        for (const a of (cloudActs || [])) actMap.set(a.activityId, a);
        for (const a of (localActs || [])) actMap.set(a.activityId, a);
        const mergedActs = Array.from(actMap.values()).sort(
          (a, b) => new Date(b.startTimeLocal).getTime() - new Date(a.startTimeLocal).getTime()
        );

        if (mergedActs.length > 0) {
          setGarminActivities(mergedActs);
          saveGarminActivities(mergedActs);
          // Push any merged activities that weren't yet on cloud
          await syncActivitiesToCloud(user.id, mergedActs);
        }

        // Synchronize wellness history (resting HR, HRV, sleep)
        try {
          const cloudWellness = await fetchWellnessFromCloud(user.id);
          if (cloudWellness && cloudWellness.length > 0) {
            for (const cw of cloudWellness) saveWellnessData(cw);
          }
          const localWellness = Object.values(loadWellnessHistory());
          if (localWellness.length > 0) {
            syncWellnessToCloud(user.id, localWellness);
          }
        } catch {}

        const localPairs = loadManualPairs();
        const cloudPairs = await fetchPairsFromCloud(user.id);
        if (cloudPairs && Object.keys(cloudPairs).length > 0) {
          setManualPairs(cloudPairs);
          saveManualPairs(cloudPairs);
        } else if (localPairs && Object.keys(localPairs).length > 0) {
          await syncPairsToCloud(user.id, localPairs);
        }

        // Immediate full recharge: ÉTS calendar + Garmin Connect live sync
        await autoRechargeAll();
      })();
    }
  }, [user?.id]);

  // Live real date (always current)
  const referenceDate = new Date();
  const currentPeriodContext = getPeriodizationContext(referenceDate);

  // Function to recharge both ÉTS iCal and Garmin Connect (Mobile & Web)
  const autoRechargeAll = async () => {
    setIsRecharging(true);
    let rawCourses: RawIcsEvent[] = [];

    // 1. Fetch ÉTS iCal feed via proxy (custom profile URL or default proxy)
    try {
      const customUrlParam = profile?.icalUrl ? `?url=${encodeURIComponent(profile.icalUrl)}` : '';
      const endpoint = getApiUrl(`/api/ets-ical${customUrlParam}`);
      const res = await fetch(endpoint);
      if (res.ok) {
        const icsText = await res.text();
        if (icsText && icsText.includes('BEGIN:VCALENDAR')) {
          storageSetRaw(STORAGE_KEYS.CACHED_ETS_ICS, icsText);
          rawCourses = parseICSString(icsText);
        }
      }
    } catch (err) {
      console.warn("Could not fetch ÉTS iCal from proxy, checking local cache", err);
    }

    // Offline / Network fallback for calendar courses
    if (rawCourses.length === 0) {
      const cachedIcs = storageGetRaw(STORAGE_KEYS.CACHED_ETS_ICS, '');
      if (cachedIcs) {
        try {
          rawCourses = parseICSString(cachedIcs);
        } catch {}
      }
    }

    // Start calendar on Monday of the training plan start week (2026-08-31)
    // to preserve Week 1 (from 1er sept.), past microcycles, history, and telemetry reconciliation
    const planStartMonday = getMondayOfWeek(new Date(GLOBAL_APP_CONFIG.SPORT_START_DATE + 'T00:00:00'));
    const currentMonday = getMondayOfWeek(referenceDate);
    const calendarStartMonday = planStartMonday.getTime() < currentMonday.getTime() ? planStartMonday : currentMonday;
    const { schedules: builtSchedules, allEvents: builtEvents } = buildCompleteCalendar(
      rawCourses,
      calendarStartMonday,
      84 // 12 full weeks (covers Week 1 to late November)
    );

    setBaseCalendar({ schedules: builtSchedules, allEvents: builtEvents });

    // 1. Appliquer les reports de séances enregistrés
    const { schedules: postponedSchedules, allEvents: postponedEvents } = applyPostponements(
      builtSchedules,
      builtEvents,
      postponeOverrides
    );

    // 2. Appliquer les adaptations intelligentes anti-blessure
    const { schedules: transformedSchedules, allEvents: transformedEvents } = applyAdaptiveModifications(
      postponedSchedules,
      postponedEvents,
      adaptiveOverrides
    );

    setSchedules(transformedSchedules);
    setAllEvents(transformedEvents);

    // 2. Load stored real Garmin activities and attempt sync for latest activities
    let loadedActivities = loadStoredGarminActivities();
    const asyncLocalCreds = await loadGarminCredentialsAsync();
    const creds = asyncLocalCreds || (
      user?.user_metadata?.garmin_email && user?.user_metadata?.garmin_password
        ? { email: user.user_metadata.garmin_email, password: user.user_metadata.garmin_password }
        : null
    );

    if (creds?.email && creds?.password) {
      saveGarminCredentials(creds);
    }

    try {
      if (creds?.email && creds?.password) {
        const result = await syncWithGarminAPI(creds);
        if (result.success && result.activities.length > 0) {
          loadedActivities = result.activities;
        }
      } else {
        const garminEndpoint = getApiUrl('/api/garmin-sync');
        const garminRes = await fetch(garminEndpoint);
        if (garminRes.ok) {
          try {
            const garminData = await garminRes.json();
            if (garminData.activities && Array.isArray(garminData.activities) && garminData.activities.length > 0) {
              loadedActivities = garminData.activities;
              saveGarminActivities(loadedActivities);
            }
          } catch {
            // Ignore non-json response
          }
        }
      }
    } catch {
      // Offline, dev server not running, or credentials prompt needed
    }

    // Preserve existing activities if sync failed to avoid clearing calendar
    if (loadedActivities.length === 0 && garminActivities.length > 0) {
      loadedActivities = garminActivities;
    }

    setGarminActivities(loadedActivities);

    // Automatically persist fresh activities and wellness to Supabase cloud if authenticated
    if (user?.id && loadedActivities.length > 0) {
      syncActivitiesToCloud(user.id, loadedActivities);
      try {
        const localWellness = Object.values(loadWellnessHistory());
        if (localWellness.length > 0) {
          syncWellnessToCloud(user.id, localWellness);
        }
      } catch {}
    }

    const compResults = compareWorkoutsWithGarmin(transformedEvents, loadedActivities, manualPairs, referenceDate);
    setComparisons(compResults);

    const nowIso = new Date().toISOString();
    setLastSyncTime(nowIso);

    const isGarminConnected = loadedActivities.length > 0 || Boolean(creds?.email);
    const updatedGarminState: GarminSyncState = {
      ...garminState,
      connected: isGarminConnected,
      accountEmail: creds?.email || garminState.accountEmail || (user ? 'Compte Garmin lié à Google' : 'Compte Garmin'),
      lastSyncTime: loadedActivities.length > 0 ? nowIso : (garminState.lastSyncTime || nowIso),
      activitiesCount: loadedActivities.length,
      isSyncing: false
    };
    setGarminState(updatedGarminState);
    saveGarminSyncState(updatedGarminState);

    // Automatically ensure current week workouts are synced to Garmin (signature checks prevent duplicates)
    syncCurrentWeekWorkoutsToGarmin(transformedEvents, referenceDate).catch(() => {});

    setIsRecharging(false);
  };

  useEffect(() => {
    autoRechargeAll();
  }, [profile?.icalUrl]);

  // Automatic sync on mobile app resume, tab visibility change, focus, and periodic interval
  useEffect(() => {
    let lastAutoSyncAt = Date.now();

    const triggerThrottledSync = () => {
      const now = Date.now();
      // Throttle: don't sync if last sync was less than 2 minutes ago
      if (now - lastAutoSyncAt < 120_000) {
        return;
      }
      lastAutoSyncAt = now;
      autoRechargeAll();
    };

    // 1. Mobile native resume listener (Capacitor App state)
    let appStateListener: any = null;
    try {
      CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          triggerThrottledSync();
        }
      }).then(l => { appStateListener = l; }).catch(() => {});
    } catch {}

    // 2. Web visibility change listener (browser tab returned to foreground)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerThrottledSync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 3. Web window focus listener
    window.addEventListener('focus', triggerThrottledSync);

    // 4. Periodic background refresh every 15 minutes when app is active
    const periodicInterval = setInterval(() => {
      triggerThrottledSync();
    }, 15 * 60 * 1000);

    return () => {
      if (appStateListener && typeof appStateListener.remove === 'function') {
        appStateListener.remove();
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', triggerThrottledSync);
      clearInterval(periodicInterval);
    };
  }, []);


  const handleUpdateGarminState = (newState: GarminSyncState) => {
    setGarminState(newState);
    saveGarminSyncState(newState);
  };

  const handleActivitiesSynced = (newActivities: GarminActivity[]) => {
    setGarminActivities(newActivities);
    saveGarminActivities(newActivities);
    if (user?.id) {
      syncActivitiesToCloud(user.id, newActivities);
    }
    if (allEvents.length > 0) {
      setComparisons(compareWorkoutsWithGarmin(allEvents, newActivities, manualPairs, referenceDate));
    }
  };

  const handleManualPair = (planId: string, garminActivityId: string) => {
    const updated = { ...manualPairs, [planId]: garminActivityId };
    setManualPairs(updated);
    saveManualPairs(updated);
    if (user?.id) {
      syncPairsToCloud(user.id, updated);
    }
    if (allEvents.length > 0) {
      setComparisons(compareWorkoutsWithGarmin(allEvents, garminActivities, updated, referenceDate));
    }
  };

  const handleManualUnpair = (planId: string) => {
    const updated = { ...manualPairs };
    delete updated[planId];
    setManualPairs(updated);
    saveManualPairs(updated);
    if (user?.id) {
      syncPairsToCloud(user.id, updated);
    }
    if (allEvents.length > 0) {
      setComparisons(compareWorkoutsWithGarmin(allEvents, garminActivities, updated, referenceDate));
    }
  };

  const applyAllTransforms = (
    baseSched: DailySchedule[],
    baseEv: CalendarEvent[],
    postpones: Record<string, WorkoutPostponeOverride>,
    adaptations: Record<string, AdaptiveWorkoutOverride>
  ) => {
    const { schedules: postponedSched, allEvents: postponedEv } = applyPostponements(
      baseSched,
      baseEv,
      postpones
    );
    return applyAdaptiveModifications(
      postponedSched,
      postponedEv,
      adaptations
    );
  };

  const recomputeAndSyncCalendar = (
    postpones: Record<string, WorkoutPostponeOverride>,
    adaptations: Record<string, AdaptiveWorkoutOverride>
  ) => {
    if (baseCalendar.schedules.length === 0) return;
    const { schedules: newSched, allEvents: newEv } = applyAllTransforms(
      baseCalendar.schedules,
      baseCalendar.allEvents,
      postpones,
      adaptations
    );
    setSchedules(newSched);
    setAllEvents(newEv);
    setComparisons(compareWorkoutsWithGarmin(newEv, garminActivities, manualPairs, referenceDate));
    syncCurrentWeekWorkoutsToGarmin(newEv, referenceDate).catch(() => {});
  };

  const handlePostponeWorkout = (
    eventId: string,
    originalDate: string,
    targetDate: string,
    reason?: string,
    targetStartTime?: string
  ) => {
    const updated = postponeWorkout(postponeOverrides, eventId, originalDate, targetDate, reason, targetStartTime);
    setPostponeOverrides(updated);
    recomputeAndSyncCalendar(updated, adaptiveOverrides);
  };

  const handleCancelPostpone = (eventId: string) => {
    const updated = cancelPostponeWorkout(postponeOverrides, eventId);
    setPostponeOverrides(updated);
    recomputeAndSyncCalendar(updated, adaptiveOverrides);
  };

  const handleApplyAdaptivePlan = (actions: AdaptiveWorkoutAction[]) => {
    const overrides = buildOverridesFromActions(actions);
    setAdaptiveOverrides(overrides);
    saveAdaptiveOverrides(overrides);
    recomputeAndSyncCalendar(postponeOverrides, overrides);
  };

  const handleRevertAdaptivePlan = () => {
    setAdaptiveOverrides({});
    clearAdaptiveOverrides();
    recomputeAndSyncCalendar(postponeOverrides, {});
  };

  // Compute full current week's targets for accurate microcycle telemetry progress
  const currentMonday = getMondayOfWeek(referenceDate);
  const weekStartStr = formatDateKey(currentMonday);
  const weekEndDate = new Date(currentMonday);
  weekEndDate.setDate(currentMonday.getDate() + 6);
  const weekEndStr = formatDateKey(weekEndDate);

  const refDateKey = formatDateKey(referenceDate);
  const todayIdx = schedules.findIndex(s => s.date === refDateKey);
  const currentWeekStartIdx = todayIdx >= 0 ? Math.floor(todayIdx / 7) * 7 : 0;
  const currentWeekSchedules = schedules.slice(currentWeekStartIdx, currentWeekStartIdx + 7);
  const plannedDurationMin = currentWeekSchedules.reduce((acc, s) => acc + (s.sportSession && isTrailOrRunning(s.sportSession) ? (s.sportSession.durationMinutes || 0) : 0), 0);
  const plannedElevationM = currentWeekSchedules.reduce((acc, s) => acc + (s.sportSession && isTrailOrRunning(s.sportSession) ? (s.sportSession.metadata?.targetElevationM || 0) : 0), 0);
  const weeklyStats = computeWeeklyTelemetry(
    comparisons,
    { start: weekStartStr, end: weekEndStr },
    {
      plannedDurationMin: plannedDurationMin || DEFAULT_WEEKLY_TARGETS.plannedDurationMin,
      plannedElevationM: plannedElevationM || DEFAULT_WEEKLY_TARGETS.plannedElevationM
    }
  );

  const statsReport = useMemo(() => {
    return computeFullStatsReport(
      garminActivities,
      comparisons,
      allEvents,
      'plan',
      referenceDate,
      true
    );
  }, [garminActivities, comparisons, allEvents, referenceDate]);

  return (
    <div className="app-shell">
      {/* Desktop Left Sidebar */}
      <Sidebar
        currentTab={activeTab}
        onChangeTab={(tab) => setActiveTab(tab)}
        periodContext={currentPeriodContext}
        garminState={garminState}
        weeklyStats={weeklyStats}
        comparisons={comparisons}
        garminActivities={garminActivities}
        referenceDate={referenceDate}
        onOpenAccountModal={handleOpenAccountModal}
        onRefreshAll={autoRechargeAll}
        isRecharging={isRecharging}
        lastSyncTime={lastSyncTime}
        userDisplayName={profile?.displayName}
        userAvatarUrl={profile?.avatarUrl || user?.user_metadata?.avatar_url || user?.user_metadata?.picture}
        isLoggedIn={Boolean(user)}
      />

      {/* Main Content Area */}
      <div className="app-main-content">
        {/* Spectator Mode Banner if accessing via public friend link */}
        {spectatorData && (
          <div
            style={{
              background: 'linear-gradient(90deg, rgba(255, 87, 34, 0.15), rgba(245, 158, 11, 0.15))',
              border: '1px solid rgba(255, 87, 34, 0.35)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 16px',
              marginBottom: '14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.82rem'
            }}
          >
            <div>
              👁️ <strong>Mode Spectateur :</strong> Vous suivez la préparation QMT-80 de{' '}
              <span style={{ color: 'var(--primary)', fontWeight: 800 }}>{spectatorData.profile.displayName}</span>
            </div>
            <button
              className="btn-secondary"
              style={{ fontSize: '0.74rem', padding: '4px 10px' }}
              onClick={() => {
                window.location.href = window.location.origin;
              }}
            >
              Quitter la vue spectateur
            </button>
          </div>
        )}

        {/* Top Header */}
        <Header
          currentTab={activeTab}
          periodContext={currentPeriodContext}
          garminState={garminState}
          weeklyStats={weeklyStats}
          comparisons={comparisons}
          onOpenAccountModal={handleOpenAccountModal}
          onRefreshAll={autoRechargeAll}
          isRecharging={isRecharging}
          lastSyncTime={lastSyncTime}
          onSelectPeriodizationTab={() => setActiveTab('periodization')}
          userDisplayName={profile?.displayName}
          userAvatarUrl={profile?.avatarUrl || user?.user_metadata?.avatar_url || user?.user_metadata?.picture}
          isLoggedIn={Boolean(user)}
        />

      {/* Main Tab Content */}
      {activeTab === 'calendar' && (
        <CalendarView
          schedules={schedules}
          allEvents={allEvents}
          referenceDateStr={formatDateKey(referenceDate)}
          referenceDate={referenceDate}
          onPostponeWorkout={handlePostponeWorkout}
          onCancelPostponeWorkout={handleCancelPostpone}
          comparisons={comparisons}
          garminActivities={garminActivities}
          adaptiveOverrides={adaptiveOverrides}
          onApplyAdaptivePlan={handleApplyAdaptivePlan}
          onRevertAdaptivePlan={handleRevertAdaptivePlan}
          onOpenGarminSync={() => handleOpenAccountModal('garmin')}
        />
      )}

      {activeTab === 'compare' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <ComparisonDashboard
            comparisons={comparisons}
            garminState={garminState}
            onOpenGarminSync={() => handleOpenAccountModal('garmin')}
            availableGarminActivities={garminActivities}
            manualPairs={manualPairs}
            onManualPair={handleManualPair}
            onManualUnpair={handleManualUnpair}
            onPostponeWorkout={handlePostponeWorkout}
            referenceDateStr={formatDateKey(referenceDate)}
          />
        </div>
      )}

      {activeTab === 'stats' && (
        <StatsDashboard
          garminActivities={garminActivities}
          comparisons={comparisons}
          allEvents={allEvents}
          referenceDate={referenceDate}
          onOpenGarminSync={() => handleOpenAccountModal('garmin')}
        />
      )}

      {activeTab === 'periodization' && (
        <QMTPlanOverview
          currentContext={currentPeriodContext}
          qmtPrediction={statsReport.qmtPrediction}
        />
      )}

      {/* Mobile Bottom Navigation Bar */}
      <MobileNav
        currentTab={activeTab}
        onChangeTab={tab => setActiveTab(tab)}
      />

        {/* Unified Athlete Hub Modal */}
        <AccountModal
          isOpen={accountModal.isOpen}
          onClose={() => setAccountModal(prev => ({ ...prev, isOpen: false }))}
          initialTab={accountModal.tab}
          garminState={garminState}
          onUpdateGarminState={handleUpdateGarminState}
          onActivitiesSynced={handleActivitiesSynced}
          calendarEvents={allEvents}
          onRefreshAll={autoRechargeAll}
          isRecharging={isRecharging}
          lastSyncTime={lastSyncTime}
        />
      </div>
    </div>
  );
};
