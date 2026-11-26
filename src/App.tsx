import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './styles/appShell.css';
import { CalendarEvent, DailySchedule, PeriodizationContext, WorkoutPostponeOverride, AdaptiveWorkoutOverride, AdaptiveWorkoutAction } from './types/calendar';
import { GarminActivity, GarminSyncState } from './types/garmin';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { AccountModal, AccountModalTab } from './components/AccountModal';
import { MobileNav, type AppTab } from './components/MobileNav';
import { buildTrainingCalendar } from './services/calendarBuilder';
import { formatDateKey, getMondayOfWeek, parseLocalDate } from './services/dateUtils';
import { createAppConfig, getPeriodizationContext } from './services/periodizationEngine';
import { clearGarminCredentials, getDynamicAthleteProfile, hasGarminPersonalApi, loadGarminCredentials, loadGarminCredentialsAsync, loadGarminSyncState, loadStoredGarminActivities, saveGarminActivities, saveGarminSyncState, syncWithGarminAPI } from './services/garminService';
import type { GarminActivitySyncMode, GarminActivitySyncResult, GarminCredentials } from './services/garminService';
import { App as CapacitorApp } from '@capacitor/app';
import { compareWorkoutsWithGarmin } from './services/comparisonEngine';
import { cancelPostponeWorkout, loadPostponeOverrides, postponeWorkout, savePostponeOverrides } from './services/postponeService';
import { buildOverridesFromActions, getPriorWeekPostponedEventIds, isAutoAdaptEnabled, loadAdaptivePlanState, reconcilePostponedAdaptiveOverrides, saveAdaptivePlanState } from './services/adaptivePlanEngine';
import { parseAdaptivePlanState, serializeAdaptivePlanState, WeeklyDecision } from './services/adaptivePlanStore';
import { buildEffectiveCalendar } from './services/calendarPipeline';
import { summarizeCurrentRunWeek } from './services/activityProgress';
import { isTrailOrRunning } from './services/activityClassifier';
import { useAuth } from './contexts/AuthContext';
import { syncActivitiesToCloud, fetchActivitiesFromCloud, syncActivityFeedbackToCloud, fetchActivityFeedbackFromCloud, syncWellnessToCloud, fetchWellnessFromCloud, syncPairsToCloud, fetchPairsFromCloud, fetchPublicSharedData, syncOverridesToCloud, fetchOverridesFromCloud } from './services/supabaseClient';
import { sanitizeManualFeedback } from './services/activityFeedback';
import { ActivityFeedback } from './types/garmin';
import { saveWellnessData, loadWellnessHistory, getBaselineRestingHeartRate, getLatestWellnessData } from './services/readinessEngine';
import { getCalendarBuildWindow } from './services/calendarWindow';
import { mergeGarminActivities } from './services/activityRepository';
import { getLocalSyncTimestamp, markLocalSyncUpdated, setLocalSyncTimestamp, shouldAdoptCloudValue } from './services/syncMetadata';
import { syncCurrentWeekWorkoutsToGarmin } from './services/garminAutoSyncService';
import { STORAGE_KEYS, storageGet, storageSet, storageGetRaw } from './services/storageService';
import { SyncErrorModal, SyncErrorInfo } from './components/SyncErrorModal';
import { createLatestRerunCoordinator, LatestRerunCoordinator, RefreshRequest } from './services/asyncCoordinator';
import { createCloudMutationQueue, type CloudMutationDomain } from './services/cloudMutationQueue';
import { isValidGarminMaxHeartRate } from './services/garminTrainingPolicy';
import { registerAutoRefreshTriggers } from './services/autoRefreshTriggers';
import { ensureLocalAccountOwner } from './services/localAccountScope';
import { canRefreshForAccount, canUseHydratedAccountData } from './services/accountHydration';

const CalendarView = React.lazy(() => import('./components/CalendarView').then(module => ({ default: module.CalendarView })));
const ComparisonDashboard = React.lazy(() => import('./components/ComparisonDashboard').then(module => ({ default: module.ComparisonDashboard })));
const StatsDashboard = React.lazy(() => import('./components/StatsDashboard').then(module => ({ default: module.StatsDashboard })));
const PeriodizationTab = React.lazy(() => import('./components/PeriodizationTab').then(module => ({ default: module.PeriodizationTab })));

function loadManualPairs(): Record<string, string> {
  return storageGet<Record<string, string>>(STORAGE_KEYS.GARMIN_MANUAL_PAIRS, {});
}

function saveManualPairs(pairs: Record<string, string>): void {
  storageSet(STORAGE_KEYS.GARMIN_MANUAL_PAIRS, pairs);
}

export const App: React.FC = () => {
  const shareSlug = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('share') || '';
  }, []);
  const [baseCalendar, setBaseCalendar] = useState<{ schedules: DailySchedule[]; allEvents: CalendarEvent[] }>({ schedules: [], allEvents: [] });
  const [postponeOverrides, setPostponeOverrides] = useState<Record<string, WorkoutPostponeOverride>>(loadPostponeOverrides());
  const [initialAdaptiveState] = useState(loadAdaptivePlanState);
  const [adaptiveOverrides, setAdaptiveOverrides] = useState<Record<string, AdaptiveWorkoutOverride>>(initialAdaptiveState.overrides);
  const [weeklyDecisions, setWeeklyDecisions] = useState<Record<string, WeeklyDecision>>(initialAdaptiveState.weeklyDecisions);
  const [hydratedAdaptiveUserId, setHydratedAdaptiveUserId] = useState<string | null>(null);
  const adaptiveCloudLoadedUserRef = useRef<string | null>(null);
  const profileRefreshReadyUserRef = useRef<string | null>(null);
  const [garminActivities, setGarminActivities] = useState<GarminActivity[]>([]);
  const [garminState, setGarminState] = useState<GarminSyncState>(() =>
    storageGetRaw(STORAGE_KEYS.ACCOUNT_DATA_OWNER)
      ? { connected: false, activitiesCount: 0, isSyncing: false }
      : loadGarminSyncState()
  );
  const [baselineFcRest, setBaselineFcRest] = useState(getBaselineRestingHeartRate());
  const [detectedFcMax, setDetectedFcMax] = useState<number | undefined>(() => {
    const value = Number(storageGetRaw(STORAGE_KEYS.ATHLETE_FC_MAX));
    return isValidGarminMaxHeartRate(value) ? value : undefined;
  });
  const [manualPairs, setManualPairs] = useState<Record<string, string>>(loadManualPairs());
  const [activeTab, setActiveTab] = useState<AppTab>(() =>
    new URLSearchParams(window.location.search).get('view') === 'progress' ? 'stats' : 'calendar'
  );
  const [isRecharging, setIsRecharging] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<SyncErrorInfo | null>(null);
  const [workoutEditSyncStatus, setWorkoutEditSyncStatus] = useState<{
    phase: 'pending' | 'success' | 'error';
    message: string;
  } | null>(null);
  const [cloudSyncIssues, setCloudSyncIssues] = useState<Set<CloudMutationDomain>>(() => new Set());
  const [isRetryingCloud, setIsRetryingCloud] = useState(false);
  const [accountModal, setAccountModal] = useState<{ isOpen: boolean; tab: AccountModalTab }>({
    isOpen: false,
    tab: 'profile'
  });
  const [spectatorData, setSpectatorData] = useState<{ profile: any; activities: GarminActivity[] } | null>(null);
  const pendingGarminFcMaxRefreshRef = useRef<{
    fcMax: number;
    nonFcProfileKey: string;
    spectatorData: typeof spectatorData;
  } | null>(null);
  const hasInitializedProfileRefreshRef = useRef(false);
  const referenceDateKey = formatDateKey(new Date());
  const referenceDate = useMemo(() => parseLocalDate(referenceDateKey), [referenceDateKey]);
  const { schedules, allEvents } = useMemo(
    () => buildEffectiveCalendar(baseCalendar, postponeOverrides, adaptiveOverrides),
    [baseCalendar, postponeOverrides, adaptiveOverrides]
  );
  const baseCalendarRef = useRef(baseCalendar);
  baseCalendarRef.current = baseCalendar;
  const handleOpenAccountModal = (tab: AccountModalTab = 'profile') => {
    setAccountModal({ isOpen: true, tab });
  };

  const { user, profile, saveCloudGarminCredentials, updateProfile, loading: authLoading } = useAuth();
  const previousSignedInUserRef = useRef<string | null>(storageGetRaw(STORAGE_KEYS.ACCOUNT_DATA_OWNER) || null);
  const hydrationUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (authLoading) return;
    if (user?.id) {
      previousSignedInUserRef.current = user.id;
      return;
    }
    if (!previousSignedInUserRef.current) return;
    previousSignedInUserRef.current = null;
    workoutEditEpochRef.current++;
    pendingWorkoutEditIdsRef.current.clear();
    retryWorkoutEditRef.current = false;
    workoutEditSyncPromiseRef.current = null;
    setWorkoutEditSyncStatus(null);
    hydrationUserIdRef.current = null;
    adaptiveCloudLoadedUserRef.current = null;
    profileRefreshReadyUserRef.current = null;
    pendingGarminFcMaxRefreshRef.current = null;
    setHydratedAdaptiveUserId(null);
    clearGarminCredentials();
    const emptyGarminState: GarminSyncState = { connected: false, activitiesCount: 0, isSyncing: false };
    appStateRef.current.garminActivities = [];
    appStateRef.current.garminState = emptyGarminState;
    appStateRef.current.manualPairs = {};
    appStateRef.current.postponeOverrides = {};
    appStateRef.current.adaptiveOverrides = {};
    appStateRef.current.weeklyDecisions = {};
    setGarminActivities([]);
    setGarminState(emptyGarminState);
    setManualPairs({});
    setPostponeOverrides({});
    setAdaptiveOverrides({});
    setWeeklyDecisions({});
    setBaseCalendar({ schedules: [], allEvents: [] });
  }, [user?.id, authLoading]);
  const effectiveProfile = shareSlug ? spectatorData?.profile : profile;
  const appConfig = useMemo(() => createAppConfig({
    homeAddress: effectiveProfile?.homeAddress,
    campusAddress: effectiveProfile?.campusAddress,
    trailAddress: effectiveProfile?.trailAddress,
    fcMax: effectiveProfile?.fcMax ?? detectedFcMax,
    fcRest: baselineFcRest,
    raceName: effectiveProfile?.raceName,
    raceDate: effectiveProfile?.raceDate
  }), [effectiveProfile, baselineFcRest, detectedFcMax]);
  const athleteVitals = useMemo(() => ({
    fcMax: appConfig.ATHLETE_FC_MAX,
    fcRest: appConfig.ATHLETE_FC_REST
  }), [appConfig]);
  const comparisons = useMemo(
    () => compareWorkoutsWithGarmin(allEvents, garminActivities, manualPairs, referenceDate, athleteVitals),
    [allEvents, garminActivities, manualPairs, referenceDate, athleteVitals]
  );
  const appStateRef = useRef({
    user,
    profile,
    garminActivities,
    garminState,
    manualPairs,
    postponeOverrides,
    adaptiveOverrides,
    weeklyDecisions
  });
  appStateRef.current = {
    user,
    profile,
    garminActivities,
    garminState,
    manualPairs,
    postponeOverrides,
    adaptiveOverrides,
    weeklyDecisions
  };
  const nonFcProfileRefreshKey = JSON.stringify([
    profile?.homeAddress,
    profile?.campusAddress,
    profile?.trailAddress,
    profile?.raceName,
    profile?.raceDate
  ]);

  const adaptivePlanPayload = (overrides: Record<string, AdaptiveWorkoutOverride>, decisions: Record<string, WeeklyDecision>) =>
    JSON.parse(serializeAdaptivePlanState({ overrides, weeklyDecisions: decisions })) as Record<string, unknown>;

  const refreshCoordinatorRef = useRef<LatestRerunCoordinator | null>(null);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);
  const pendingWorkoutEditIdsRef = useRef(new Map<string, number>());
  const workoutEditGenerationRef = useRef(0);
  const workoutEditEpochRef = useRef(0);
  const retryWorkoutEditRef = useRef(false);
  const workoutEditSyncPromiseRef = useRef<Promise<void> | null>(null);
  if (!refreshCoordinatorRef.current) {
    refreshCoordinatorRef.current = createLatestRerunCoordinator(async () => {}, {
      onRunningChange: setIsRecharging,
      onError: error => {
        console.error('[Refresh Coordinator Error]', error);
        setSyncError({
          title: 'Erreur de mise à jour',
          message: "L'actualisation des données n'a pas pu se terminer.",
          details: error instanceof Error ? error.message : 'Erreur inconnue.'
        });
      }
    });
  }
  const cloudMutationQueueRef = useRef<ReturnType<typeof createCloudMutationQueue> | null>(null);
  if (!cloudMutationQueueRef.current) {
    cloudMutationQueueRef.current = createCloudMutationQueue((domain, success, error) => {
      if (domain === 'wellness') return; // Cloud wellness remains optional.
      if (!success) console.warn(`[Cloud Mutation Error] ${domain}`, error || 'Write not confirmed');
      setCloudSyncIssues(previous => {
        const next = new Set(previous);
        if (success) next.delete(domain);
        else next.add(domain);
        return next;
      });
    });
  }

  const enqueueCloudMutation = useCallback((
    domain: CloudMutationDomain,
    mutation: () => Promise<boolean>
  ): Promise<boolean> => cloudMutationQueueRef.current!.enqueue(domain, mutation), []);

  const autoRechargeAll = useCallback((request: RefreshRequest = {}): Promise<void> => {
    const refreshPromise = refreshCoordinatorRef.current!.run(request);
    refreshPromiseRef.current = refreshPromise;
    void refreshPromise.finally(() => {
      if (refreshPromiseRef.current === refreshPromise) refreshPromiseRef.current = null;
    }).catch(() => {});
    return refreshPromise;
  }, []);

  const requestGarminActivitySync = useCallback((
    mode: GarminActivitySyncMode,
    credentials?: GarminCredentials
  ): Promise<GarminActivitySyncResult | null> => new Promise(resolve => {
    void autoRechargeAll({
      manual: true,
      garminSyncMode: mode,
      garminCredentials: credentials,
      garminAccountId: appStateRef.current.user?.id ?? null,
      onGarminSyncComplete: resolve
    });
  }), [autoRechargeAll]);

  const retryCloudSync = async () => {
    const userId = appStateRef.current.user?.id;
    if (!userId || isRetryingCloud) return;
    setIsRetryingCloud(true);
    try {
      for (const domain of cloudSyncIssues) {
        if (domain === 'activities') {
          if (appStateRef.current.garminActivities.length > 0) {
            await enqueueCloudMutation(domain, () => syncActivitiesToCloud(userId, appStateRef.current.garminActivities));
          }
        } else if (domain === 'activityFeedback') {
          await enqueueCloudMutation(domain, () => syncActivityFeedbackToCloud(userId, appStateRef.current.garminActivities));
        } else if (domain === 'manualPairs') {
          await enqueueCloudMutation(domain, () => syncPairsToCloud(
            userId,
            appStateRef.current.manualPairs,
            getLocalSyncTimestamp(domain) || markLocalSyncUpdated(domain)
          ));
        } else if (domain === 'adaptiveOverrides') {
          await enqueueCloudMutation(domain, () => syncOverridesToCloud(userId, {
            adaptiveOverrides: adaptivePlanPayload(appStateRef.current.adaptiveOverrides, appStateRef.current.weeklyDecisions),
            adaptiveUpdatedAt: getLocalSyncTimestamp(domain) || markLocalSyncUpdated(domain)
          }));
        } else if (domain === 'postponeOverrides') {
          await enqueueCloudMutation(domain, () => syncOverridesToCloud(userId, {
            postponeOverrides: appStateRef.current.postponeOverrides,
            postponeUpdatedAt: getLocalSyncTimestamp(domain) || markLocalSyncUpdated(domain)
          }));
        }
      }
    } finally {
      setIsRetryingCloud(false);
    }
  };

  const syncPlannedWorkouts = useCallback((
    syncDate: Date,
    vitalsOverride?: { fcMax: number; fcRest: number },
    retryManualReview = false,
    changedEventIds?: readonly string[]
  ) => {
    const accountId = appStateRef.current.user?.id;
    const weekStart = formatDateKey(getMondayOfWeek(syncDate));
    if (!canUseHydratedAccountData(accountId, adaptiveCloudLoadedUserRef.current) ||
        (isAutoAdaptEnabled() && !appStateRef.current.weeklyDecisions[weekStart])) {
      return Promise.resolve({
        success: false,
        pushedCount: 0,
        totalWeekWorkouts: 0,
        alreadyUpToDate: false,
        results: [],
        reason: 'ERROR' as const,
        error: 'Le plan hebdomadaire est en cours de préparation. Réessayez une fois le plan figé.'
      });
    }
    const { allEvents: events } = buildEffectiveCalendar(
      baseCalendarRef.current,
      appStateRef.current.postponeOverrides,
      appStateRef.current.adaptiveOverrides
    );
    const athleteProfile = getDynamicAthleteProfile(appStateRef.current.garminActivities, {
      fcMax: vitalsOverride?.fcMax ?? appConfig.ATHLETE_FC_MAX,
      fcRest: vitalsOverride?.fcRest ?? appConfig.ATHLETE_FC_REST
    });
    const completedEventIds = new Set(compareWorkoutsWithGarmin(
      events,
      appStateRef.current.garminActivities,
      appStateRef.current.manualPairs,
      syncDate
    ).flatMap(comparison => comparison.actualActivity && comparison.plannedEvent
      ? [comparison.plannedEvent.id]
      : []));
    // An explicit user pairing can refer to a workout on a later date, which
    // the day-scoped comparison intentionally does not evaluate yet.
    const activityIds = new Set(appStateRef.current.garminActivities.map(activity => activity.activityId));
    for (const [eventId, activityId] of Object.entries(appStateRef.current.manualPairs)) {
      if (activityIds.has(activityId)) completedEventIds.add(eventId);
    }
    return syncCurrentWeekWorkoutsToGarmin(events, syncDate, {
      athleteProfile,
      userId: accountId,
      completedEventIds: [...completedEventIds],
      retryManualReview,
      changedEventIds
    });
  }, [appConfig]);

  const syncEditedWorkouts = useCallback((eventIds: readonly string[], retryManualReview = false) => {
    for (const eventId of eventIds) {
      pendingWorkoutEditIdsRef.current.set(eventId, ++workoutEditGenerationRef.current);
    }
    retryWorkoutEditRef.current ||= retryManualReview;
    setWorkoutEditSyncStatus({
      phase: 'pending',
      message: 'Enregistré sur cet appareil. Synchronisation Garmin en cours…'
    });
    if (workoutEditSyncPromiseRef.current) return workoutEditSyncPromiseRef.current;

    const epoch = workoutEditEpochRef.current;
    const operation = (async () => {
      if (refreshCoordinatorRef.current?.isRunning() && refreshPromiseRef.current) {
        await refreshPromiseRef.current;
      }
      if (epoch !== workoutEditEpochRef.current) return;
      while (pendingWorkoutEditIdsRef.current.size > 0) {
        const batch = [...pendingWorkoutEditIdsRef.current.entries()];
        const retryBatch = retryWorkoutEditRef.current;
        retryWorkoutEditRef.current = false;
        const result = await syncPlannedWorkouts(new Date(), undefined, retryBatch, batch.map(([id]) => id));
        if (epoch !== workoutEditEpochRef.current) return;
        if (!result.success) {
          const details = result.error || 'Garmin Connect n’a pas confirmé la mise à jour.';
          setWorkoutEditSyncStatus({
            phase: 'error',
            message: `Enregistré sur cet appareil, mais Garmin n’a pas confirmé : ${details}`
          });
          return;
        }
        for (const [eventId, generation] of batch) {
          if (pendingWorkoutEditIdsRef.current.get(eventId) === generation) {
            pendingWorkoutEditIdsRef.current.delete(eventId);
          }
        }
      }
      setWorkoutEditSyncStatus({
        phase: 'success',
        message: 'Garmin Connect a confirmé la mise à jour des séances.'
      });
    })().catch(error => {
      if (epoch !== workoutEditEpochRef.current) return;
      setWorkoutEditSyncStatus({
        phase: 'error',
        message: `Enregistré sur cet appareil, mais la synchronisation Garmin a échoué : ${error instanceof Error ? error.message : 'erreur inconnue'}`
      });
    });
    workoutEditSyncPromiseRef.current = operation;
    void operation.finally(() => {
      if (workoutEditSyncPromiseRef.current === operation) workoutEditSyncPromiseRef.current = null;
    }).catch(() => {});
    return operation;
  }, [syncPlannedWorkouts]);

  // Check for spectator share mode in URL (?share=slug)
  useEffect(() => {
    let cancelled = false;
    if (shareSlug) {
      fetchPublicSharedData(shareSlug).then(data => {
        if (cancelled) return;
        if (data) {
          setSpectatorData(data);
          if (data.activities.length > 0) {
            const sharedActivities = mergeGarminActivities(data.activities);
            appStateRef.current.garminActivities = sharedActivities;
            setGarminActivities(sharedActivities);
          }
        }
      }).catch(error => console.warn('Could not load shared data:', error));
    }
    return () => { cancelled = true; };
  }, [shareSlug]);

  // Bidirectional sync for activities, credentials, and manual pairs when user logs in with Google / Supabase
  useEffect(() => {
    let cancelled = false;
    if (user?.id && !shareSlug) {
      const localAccountChanged = ensureLocalAccountOwner(user.id);
      if (hydrationUserIdRef.current !== user.id || localAccountChanged) {
        workoutEditEpochRef.current++;
        pendingWorkoutEditIdsRef.current.clear();
        retryWorkoutEditRef.current = false;
        workoutEditSyncPromiseRef.current = null;
        setWorkoutEditSyncStatus(null);
        hydrationUserIdRef.current = user.id;
        adaptiveCloudLoadedUserRef.current = null;
        profileRefreshReadyUserRef.current = null;
        pendingGarminFcMaxRefreshRef.current = null;
        setHydratedAdaptiveUserId(null);
      }
      if (localAccountChanged) {
        // Never merge another account's device-local Garmin data or credentials.
        clearGarminCredentials();
        const emptyGarminState = loadGarminSyncState();
        appStateRef.current.garminActivities = [];
        appStateRef.current.garminState = emptyGarminState;
        appStateRef.current.manualPairs = {};
        appStateRef.current.postponeOverrides = {};
        appStateRef.current.adaptiveOverrides = {};
        appStateRef.current.weeklyDecisions = {};
        setGarminActivities([]);
        setGarminState(emptyGarminState);
        setManualPairs({});
        setPostponeOverrides({});
        setAdaptiveOverrides({});
        setWeeklyDecisions({});
        setBaseCalendar({ schedules: [], allEvents: [] });
        setBaselineFcRest(getBaselineRestingHeartRate());
        setDetectedFcMax(undefined);
      }
      void (async () => {
        // Keep only the non-sensitive Garmin account email in cloud metadata.
        // The password is session-only and must be entered again after a full restart.
        const cloudGarminEmail = user.user_metadata?.garmin_email;
        const localCreds = await loadGarminCredentialsAsync();
        if (cancelled) return;

        if (localCreds?.email && localCreds.email !== cloudGarminEmail) {
          await saveCloudGarminCredentials(localCreds.email);
        }

        const localActs = loadStoredGarminActivities();
        const [cloudActs, cloudFeedback] = await Promise.all([
          fetchActivitiesFromCloud(user.id), fetchActivityFeedbackFromCloud(user.id)
        ]);
        if (cancelled) return;
        // The cloud snapshot is fetched after local hydration, so its defined
        // fields win while local-only metrics are preserved.
        const knownActivityIds = new Set([...localActs, ...cloudActs].map(activity => activity.activityId));
        const mergedActs = mergeGarminActivities(localActs || [], cloudActs || [],
          cloudFeedback.filter(feedback => knownActivityIds.has(feedback.activityId)));

        if (mergedActs.length > 0) {
          appStateRef.current.garminActivities = mergedActs;
          setGarminActivities(mergedActs);
          saveGarminActivities(mergedActs);
          // Push any merged activities that weren't yet on cloud
          await enqueueCloudMutation('activities', () => syncActivitiesToCloud(user.id, mergedActs));
          await enqueueCloudMutation('activityFeedback', () => syncActivityFeedbackToCloud(user.id, mergedActs));
        }

        // Synchronize wellness history (resting HR, HRV, sleep)
        try {
          const cloudWellness = await fetchWellnessFromCloud(user.id);
          if (cancelled) return;
          if (cloudWellness && cloudWellness.length > 0) {
            for (const cw of cloudWellness) saveWellnessData(cw);
          }
          const localWellness = Object.values(loadWellnessHistory());
          setBaselineFcRest(getBaselineRestingHeartRate());
          if (localWellness.length > 0) {
            await enqueueCloudMutation('wellness', () => syncWellnessToCloud(user.id, localWellness));
          }
        } catch {}

        const localPairs = loadManualPairs();
        const cloudPairs = await fetchPairsFromCloud(user.id);
        if (cancelled) return;
        const localPairsUpdatedAt = getLocalSyncTimestamp('manualPairs');
        if (cloudPairs && shouldAdoptCloudValue(cloudPairs.updatedAt, localPairsUpdatedAt)) {
          appStateRef.current.manualPairs = cloudPairs.value;
          setManualPairs(cloudPairs.value);
          saveManualPairs(cloudPairs.value);
          if (cloudPairs.updatedAt) setLocalSyncTimestamp('manualPairs', cloudPairs.updatedAt);
        } else if (Object.keys(localPairs).length > 0 || localPairsUpdatedAt) {
          const updatedAt = localPairsUpdatedAt || markLocalSyncUpdated('manualPairs');
          await enqueueCloudMutation('manualPairs', () => syncPairsToCloud(user.id, localPairs, updatedAt));
        }

        // Hydrate and sync overrides (adaptive + postpone) from cloud
        try {
          const cloudOverrides = await fetchOverridesFromCloud(user.id);
          if (cancelled) return;
          const localAdaptive = loadAdaptivePlanState();
          const localPostpones = loadPostponeOverrides();
          const localAdaptiveUpdatedAt = getLocalSyncTimestamp('adaptiveOverrides');
          const localPostponeUpdatedAt = getLocalSyncTimestamp('postponeOverrides');

          if (cloudOverrides && shouldAdoptCloudValue(cloudOverrides.adaptiveOverrides.updatedAt, localAdaptiveUpdatedAt)) {
            const value = parseAdaptivePlanState(cloudOverrides.adaptiveOverrides.value);
            appStateRef.current.adaptiveOverrides = value.overrides;
            appStateRef.current.weeklyDecisions = value.weeklyDecisions;
            setAdaptiveOverrides(value.overrides);
            setWeeklyDecisions(value.weeklyDecisions);
            saveAdaptivePlanState(value);
            if (cloudOverrides.adaptiveOverrides.updatedAt) {
              setLocalSyncTimestamp('adaptiveOverrides', cloudOverrides.adaptiveOverrides.updatedAt);
            }
          } else if (Object.keys(localAdaptive.overrides).length > 0 || Object.keys(localAdaptive.weeklyDecisions).length > 0 || localAdaptiveUpdatedAt) {
            const updatedAt = localAdaptiveUpdatedAt || markLocalSyncUpdated('adaptiveOverrides');
            await enqueueCloudMutation('adaptiveOverrides', () => syncOverridesToCloud(user.id, {
              adaptiveOverrides: adaptivePlanPayload(localAdaptive.overrides, localAdaptive.weeklyDecisions),
              adaptiveUpdatedAt: updatedAt
            }));
          }

          if (cloudOverrides && shouldAdoptCloudValue(cloudOverrides.postponeOverrides.updatedAt, localPostponeUpdatedAt)) {
            const value = cloudOverrides.postponeOverrides.value as Record<string, WorkoutPostponeOverride>;
            appStateRef.current.postponeOverrides = value;
            setPostponeOverrides(value);
            savePostponeOverrides(value);
            if (cloudOverrides.postponeOverrides.updatedAt) {
              setLocalSyncTimestamp('postponeOverrides', cloudOverrides.postponeOverrides.updatedAt);
            }
          } else if (Object.keys(localPostpones).length > 0 || localPostponeUpdatedAt) {
            const updatedAt = localPostponeUpdatedAt || markLocalSyncUpdated('postponeOverrides');
            await enqueueCloudMutation('postponeOverrides', () => syncOverridesToCloud(user.id, {
              postponeOverrides: localPostpones,
              postponeUpdatedAt: updatedAt
            }));
          }
        } catch (e) {
          console.warn('Could not sync cloud overrides:', e);
        }
        if (!cancelled) adaptiveCloudLoadedUserRef.current = user.id;

        // Refresh the training calendar and Garmin Connect history
        if (!cancelled) {
          await autoRechargeAll();
          if (!cancelled) {
            // The profile effect must not launch a second refresh during cloud hydration.
            hasInitializedProfileRefreshRef.current = true;
            profileRefreshReadyUserRef.current = user.id;
            setHydratedAdaptiveUserId(user.id);
          }
        }
      })().catch(error => {
        if (!cancelled) console.warn('Could not hydrate account data:', error);
      });
    }
    return () => { cancelled = true; };
  }, [user?.id, shareSlug]);

  const currentPeriodContext = getPeriodizationContext(referenceDate, appConfig);

  // Refresh Garmin data, rebuild the training calendar, and reconcile Garmin workouts.
  refreshCoordinatorRef.current.setWorker(async ({
    manual: isManualTrigger,
    retryGarminWorkoutSync,
    refreshGarmin,
    garminSyncMode,
    garminCredentials,
    garminAccountId
  }) => {
    const snapshot = appStateRef.current;
    const referenceDate = new Date();
    const { user, profile, garminActivities } = snapshot;
    const syncRequestMatchesAccount = garminAccountId === undefined || garminAccountId === (user?.id ?? null);
    const requestedSyncMode = syncRequestMatchesAccount ? garminSyncMode : undefined;
    const requestedCredentials = syncRequestMatchesAccount ? garminCredentials : undefined;
    const refreshOwner = storageGetRaw(STORAGE_KEYS.ACCOUNT_DATA_OWNER);
    const stillCurrentAccount = () =>
      appStateRef.current.user?.id === user?.id &&
      storageGetRaw(STORAGE_KEYS.ACCOUNT_DATA_OWNER) === refreshOwner;
    if (!user && storageGetRaw(STORAGE_KEYS.ACCOUNT_DATA_OWNER)) return null;
    if (user?.id && profile?.id !== user.id) return null;
    if (!stillCurrentAccount()) return null;

    // 2. Synchronisation Incrémentielle Garmin Connect
    let loadedActivities = shareSlug ? garminActivities : mergeGarminActivities(garminActivities, loadStoredGarminActivities());
    const [creds, personalApi] = shareSlug ? [null, false] : await Promise.all([
      requestedCredentials ?? loadGarminCredentialsAsync(),
      refreshGarmin ? hasGarminPersonalApi() : Promise.resolve(false)
    ]);
    if (!stillCurrentAccount()) return null;

    let garminSyncResult: GarminActivitySyncResult | null = null;
    const canReadGarmin = personalApi || Boolean(creds?.email && creds.password);
    const firstGarminImport = personalApi && !loadedActivities.some(activity => activity.source === 'GARMIN_CONNECT');
    const readMode = requestedSyncMode ?? (firstGarminImport ? 'full' : 'incremental');
    if (refreshGarmin && !shareSlug && !canReadGarmin && !requestedSyncMode) {
      // Si aucun identifiant n'est renseigné et que l'utilisateur a cliqué sur Synchro
      if (isManualTrigger && (garminSyncMode === undefined || syncRequestMatchesAccount)) {
        setSyncError({
          title: 'Compte Garmin non configuré',
          message: 'Aucun identifiant Garmin Connect n\'a été détecté sur cet appareil.',
          details: 'Consultez les réglages Garmin pour configurer l’import de vos activités.',
          isMissingCreds: true
        });
      }
    } else if (refreshGarmin && !shareSlug) {
      try {
        // Both manual history retrieval and automatic incrementals use this one refresh pipeline.
        const result = await syncWithGarminAPI(creds || undefined, { mode: readMode, personalApi });
        garminSyncResult = result;
        if (!stillCurrentAccount()) return null;
        if (result.activities.length > 0) {
          loadedActivities = mergeGarminActivities(loadedActivities, result.activities);
        }
        if (result.success) {
          // Succès : effacement d'un éventuel message d'erreur antérieur
          setSyncError(null);
        } else if (garminSyncMode === undefined) {
          // Échec de la synchronisation retourné par le serveur Garmin Connect
          console.warn('[Garmin Sync Error]', result.error);
          setSyncError({
            title: 'Erreur de synchronisation Garmin',
            message: 'La récupération des activités Garmin a rencontré une erreur.',
            details: result.error || 'Échec de l\'authentification ou de la récupération des activités Garmin.'
          });
        }
      } catch (syncErr: any) {
        console.error('[Garmin Sync Exception]', syncErr);
        garminSyncResult = {
          success: false,
          activities: loadedActivities,
          count: loadedActivities.length,
          error: syncErr?.message || 'Vérifiez votre connexion Internet et réessayez.',
          syncMode: readMode
        };
        if (garminSyncMode === undefined) {
          setSyncError({
            title: 'Erreur de connexion Garmin',
            message: 'Impossible de contacter le serveur de synchronisation Garmin Connect.',
            details: garminSyncResult.error
          });
        }
      }
    }
    if (!stillCurrentAccount()) return null;

    // Préserver les activités existantes si la synchro échoue pour ne pas vider l'application
    if (loadedActivities.length === 0 && garminActivities.length > 0) {
      loadedActivities = garminActivities;
    }

    loadedActivities = mergeGarminActivities(appStateRef.current.garminActivities, loadedActivities);
    const refreshedFcRest = getBaselineRestingHeartRate();
    setBaselineFcRest(refreshedFcRest);
    const cachedFcMax = Number(storageGetRaw(STORAGE_KEYS.ATHLETE_FC_MAX));
    const validCachedFcMax = isValidGarminMaxHeartRate(cachedFcMax) ? cachedFcMax : undefined;
    setDetectedFcMax(validCachedFcMax);
    const detectedSyncFcMax = garminSyncResult?.athleteMaxHr;
    const refreshedFcMax = detectedSyncFcMax ?? appStateRef.current.profile?.fcMax ?? validCachedFcMax ?? appConfig.ATHLETE_FC_MAX;
    if (detectedSyncFcMax && detectedSyncFcMax !== profile?.fcMax && user?.id) {
      pendingGarminFcMaxRefreshRef.current = {
        fcMax: detectedSyncFcMax,
        nonFcProfileKey: nonFcProfileRefreshKey,
        spectatorData
      };
      const saved = await updateProfile({ fcMax: detectedSyncFcMax });
      if (!saved) pendingGarminFcMaxRefreshRef.current = null;
      if (!stillCurrentAccount()) return null;
    }
    appStateRef.current.garminActivities = loadedActivities;
    setGarminActivities(loadedActivities);

    // 3. Build one canonical calendar from the physiological inputs read in
    // this refresh. React state is an output of the pipeline, not a prerequisite
    // for a second refresh with the correct values.
    const refreshedConfig = createAppConfig({
      homeAddress: effectiveProfile?.homeAddress,
      campusAddress: effectiveProfile?.campusAddress,
      trailAddress: effectiveProfile?.trailAddress,
      fcMax: shareSlug ? appConfig.ATHLETE_FC_MAX : refreshedFcMax,
      fcRest: shareSlug ? appConfig.ATHLETE_FC_REST : refreshedFcRest,
      raceName: effectiveProfile?.raceName,
      raceDate: effectiveProfile?.raceDate
    });
    const calendarWindow = getCalendarBuildWindow(referenceDate, refreshedConfig.SPORT_START_DATE);
    const { schedules: builtSchedules, allEvents: builtEvents } = buildTrainingCalendar(
      calendarWindow.startMonday,
      calendarWindow.daysCount,
      refreshedConfig,
      loadedActivities,
      referenceDate
    );
    const freshBaseCalendar = { schedules: builtSchedules, allEvents: builtEvents };
    baseCalendarRef.current = freshBaseCalendar;
    setBaseCalendar(freshBaseCalendar);

    // Automatically persist fresh activities and wellness to Supabase cloud if authenticated
    if (!shareSlug && user?.id && loadedActivities.length > 0) {
      await enqueueCloudMutation('activities', () => syncActivitiesToCloud(user.id, loadedActivities));
      await enqueueCloudMutation('activityFeedback', () => syncActivityFeedbackToCloud(user.id, loadedActivities));
      try {
        const localWellness = Object.values(loadWellnessHistory());
        if (localWellness.length > 0) {
          await enqueueCloudMutation('wellness', () => syncWellnessToCloud(user.id, localWellness));
        }
      } catch {}
    }

    const nowIso = new Date().toISOString();

    const isGarminConnected = loadedActivities.length > 0 || Boolean(creds?.email) || garminSyncResult?.success === true;
    setGarminState(previousState => {
      const updatedState: GarminSyncState = {
        ...previousState,
        connected: isGarminConnected,
        accountEmail: creds?.email || previousState.accountEmail || (user ? 'Compte Garmin lié' : 'Compte Garmin'),
        lastSyncTime: garminSyncResult?.success ? nowIso : previousState.lastSyncTime,
        activitiesCount: loadedActivities.length,
        isSyncing: false
      };
      saveGarminSyncState(updatedState);
      return updatedState;
    });

    const currentWeekStart = formatDateKey(getMondayOfWeek(referenceDate));
    const adaptiveDataReady = canUseHydratedAccountData(user?.id, adaptiveCloudLoadedUserRef.current);
    const weekPlanReady = !isAutoAdaptEnabled() || Boolean(appStateRef.current.weeklyDecisions[currentWeekStart]);
    const hasPublishingAccount = Boolean(creds?.email || user?.user_metadata?.garmin_email);
    if (!shareSlug && user?.id && adaptiveDataReady && weekPlanReady && (!personalApi || hasPublishingAccount)) {
      // Ensure current week workouts are really created AND scheduled before marking them synced.
      const workoutSyncResult = await syncPlannedWorkouts(referenceDate, {
        fcMax: refreshedConfig.ATHLETE_FC_MAX,
        fcRest: refreshedConfig.ATHLETE_FC_REST
      }, retryGarminWorkoutSync);
      if (!workoutSyncResult.success && workoutSyncResult.reason === 'NO_CREDENTIALS') {
        setSyncError({
          title: 'Garmin à reconnecter',
          message: 'Les nouvelles séances ne peuvent pas être envoyées à Garmin Connect.',
          details: 'La session Garmin du serveur a expiré. Ouvrez les réglages Garmin et reconnectez-vous pour reprendre la synchronisation automatique.',
          isMissingCreds: true
        });
      } else if (!workoutSyncResult.success && workoutSyncResult.reason === 'ERROR') {
        console.warn('[Garmin Workout Sync Error]', workoutSyncResult.error);
        if (isManualTrigger) {
          setSyncError({
            title: 'Séances non synchronisées avec Garmin',
            message: 'Garmin Connect n’a pas confirmé la programmation de toutes les séances.',
            details: workoutSyncResult.error || 'Réessayez la synchronisation depuis l’application.'
          });
        }
      }
    }

    return syncRequestMatchesAccount ? garminSyncResult : null;
  });

  useEffect(() => {
    if (!canRefreshForAccount(authLoading, user?.id, profileRefreshReadyUserRef.current)) return;

    const pendingFcMaxRefresh = pendingGarminFcMaxRefreshRef.current;
    if (pendingFcMaxRefresh) {
      const profileKeyMatches = pendingFcMaxRefresh.nonFcProfileKey === nonFcProfileRefreshKey;
      if (
        profileKeyMatches &&
        pendingFcMaxRefresh.spectatorData === spectatorData &&
        pendingFcMaxRefresh.fcMax === profile?.fcMax
      ) {
        pendingGarminFcMaxRefreshRef.current = null;
        hasInitializedProfileRefreshRef.current = true;
        return;
      }
      pendingGarminFcMaxRefreshRef.current = null;
    }
    const refreshGarmin = !hasInitializedProfileRefreshRef.current;
    hasInitializedProfileRefreshRef.current = true;
    void autoRechargeAll({ refreshGarmin });
  }, [
    profile?.homeAddress,
    profile?.campusAddress,
    profile?.trailAddress,
    profile?.fcMax,
    profile?.raceName,
    profile?.raceDate,
    spectatorData,
    user?.id,
    authLoading
  ]);

  // Automatic sync on mobile app resume, tab visibility change, focus, and periodic interval
  useEffect(() => {
    return registerAutoRefreshTriggers(
      () => { void autoRechargeAll(); },
      { nativeApp: CapacitorApp, document, window }
    );
  }, []);


  const handleUpdateGarminState = (newState: GarminSyncState) => {
    setGarminState(newState);
    saveGarminSyncState(newState);
  };

  const handleActivitiesSynced = (newActivities: GarminActivity[]) => {
    const mergedActivities = mergeGarminActivities(appStateRef.current.garminActivities, newActivities);
    appStateRef.current.garminActivities = mergedActivities;
    setGarminActivities(mergedActivities);
    saveGarminActivities(mergedActivities);
    if (user?.id) {
      void enqueueCloudMutation('activities', () => syncActivitiesToCloud(user.id, mergedActivities));
      void enqueueCloudMutation('activityFeedback', () => syncActivityFeedbackToCloud(user.id, mergedActivities));
    }
  };

  const handleSaveActivityFeedback = (activityId: string, feedback: ActivityFeedback) => {
    const updated = appStateRef.current.garminActivities.map(activity =>
      activity.activityId === activityId
        ? { ...activity, manualFeedback: sanitizeManualFeedback(feedback) }
        : activity
    );
    appStateRef.current.garminActivities = updated;
    setGarminActivities(updated);
    saveGarminActivities(updated);
    if (user?.id) {
      void enqueueCloudMutation('activityFeedback', () => syncActivityFeedbackToCloud(user.id, updated));
    }
  };

  const handleManualPair = (planId: string, garminActivityId: string) => {
    const updated = { ...appStateRef.current.manualPairs, [planId]: garminActivityId };
    appStateRef.current.manualPairs = updated;
    setManualPairs(updated);
    saveManualPairs(updated);
    const updatedAt = markLocalSyncUpdated('manualPairs');
    if (user?.id) {
      void enqueueCloudMutation('manualPairs', () => syncPairsToCloud(user.id, updated, updatedAt));
    }
  };

  const handleManualUnpair = (planId: string) => {
    const updated = { ...appStateRef.current.manualPairs };
    delete updated[planId];
    appStateRef.current.manualPairs = updated;
    setManualPairs(updated);
    saveManualPairs(updated);
    const updatedAt = markLocalSyncUpdated('manualPairs');
    if (user?.id) {
      void enqueueCloudMutation('manualPairs', () => syncPairsToCloud(user.id, updated, updatedAt));
    }
  };

  const handlePostponeWorkout = (
    eventId: string,
    originalDate: string,
    targetDate: string,
    reason?: string,
    targetStartTime?: string
  ) => {
    const currentWorkout = allEvents.find(event => event.id === eventId && event.category === 'sport');
    const currentDate = currentWorkout ? formatDateKey(new Date(currentWorkout.startDate)) : originalDate;
    const originalWorkout = baseCalendarRef.current.allEvents.find(event =>
      event.id === eventId && event.category === 'sport' && formatDateKey(new Date(event.startDate)) === originalDate
    );
    if (!originalWorkout) {
      setSyncError({
        title: 'Séance introuvable',
        message: 'Cette séance a changé depuis son affichage. Actualise le calendrier avant de la reporter.'
      });
      return false;
    }
    if (targetDate === currentDate) return false;
    const targetRuns = allEvents.filter(event => event.category === 'sport' &&
      !event.metadata?.isPostponedPlaceholder && isTrailOrRunning(event) &&
      formatDateKey(new Date(event.startDate)) === targetDate && event.id !== eventId);
    if (isTrailOrRunning(currentWorkout || originalWorkout) && targetRuns.length > 1) {
      setSyncError({ title: 'Échange ambigu', message: 'Plusieurs courses sont prévues ce jour. Choisis une autre date ou ajuste le planning avant de déplacer cette séance.' });
      return false;
    }
    // Moving a run onto another run exchanges their days in one calendar update.
    // This prevents the temporary two-run day that Garmin cannot synchronize.
    const other = isTrailOrRunning(currentWorkout || originalWorkout) ? targetRuns[0] : undefined;
    const otherOriginalDate = other?.metadata?.originalDate || targetDate;
    const otherOriginal = other && baseCalendarRef.current.allEvents.find(event =>
      event.id === other.id && event.category === 'sport' && formatDateKey(new Date(event.startDate)) === otherOriginalDate
    );
    if (other && !otherOriginal) {
      setSyncError({ title: 'Séance introuvable', message: 'La séance à échanger a changé. Actualise le calendrier avant de recommencer.' });
      return false;
    }
    const move = (overrides: typeof postponeOverrides, workout: CalendarEvent, from: string, to: string, time?: string) =>
      to === from
        ? cancelPostponeWorkout(overrides, workout.id)
        : postponeWorkout(overrides, workout.id, from, to, reason, time, workout);
    let updated = move(appStateRef.current.postponeOverrides, originalWorkout, originalDate, targetDate, targetStartTime);
    if (otherOriginal) {
      updated = move(updated, otherOriginal, otherOriginalDate, currentDate);
    }
    const previousPostpones = appStateRef.current.postponeOverrides;
    appStateRef.current.postponeOverrides = updated;
    setPostponeOverrides(updated);
    savePostponeOverrides(updated);
    const updatedAt = markLocalSyncUpdated('postponeOverrides');
    const changedEventIds = new Set<string>([eventId]);
    for (const id of new Set([...Object.keys(previousPostpones), ...Object.keys(updated)])) {
      if (previousPostpones[id] !== updated[id]) changedEventIds.add(id);
    }
    const reconciled = reconcilePostponedAdaptiveOverrides(
      buildEffectiveCalendar(baseCalendarRef.current, updated, appStateRef.current.adaptiveOverrides).allEvents,
      appStateRef.current.adaptiveOverrides
    );
    if (reconciled.removedEventIds.size > 0) {
      const decisions = appStateRef.current.weeklyDecisions;
      appStateRef.current.adaptiveOverrides = reconciled.overrides;
      setAdaptiveOverrides(reconciled.overrides);
      saveAdaptivePlanState({ overrides: reconciled.overrides, weeklyDecisions: decisions });
      const adaptiveUpdatedAt = markLocalSyncUpdated('adaptiveOverrides');
      for (const id of reconciled.removedEventIds) changedEventIds.add(id);
      if (user?.id) {
        void enqueueCloudMutation('adaptiveOverrides', () => syncOverridesToCloud(user.id, {
          adaptiveOverrides: adaptivePlanPayload(reconciled.overrides, decisions),
          adaptiveUpdatedAt
        }));
      }
    }
    void syncEditedWorkouts([...changedEventIds]);
    if (user?.id) {
      void enqueueCloudMutation('postponeOverrides', () => syncOverridesToCloud(user.id, {
        postponeOverrides: updated,
        postponeUpdatedAt: updatedAt
      }));
    }
    return true;
  };

  const handleCancelPostpone = (eventId: string) => {
    const previous = appStateRef.current.postponeOverrides;
    const updated = cancelPostponeWorkout(previous, eventId);
    const changedEventIds = Object.keys(previous).filter(id => previous[id] !== updated[id]);
    appStateRef.current.postponeOverrides = updated;
    setPostponeOverrides(updated);
    savePostponeOverrides(updated);
    const updatedAt = markLocalSyncUpdated('postponeOverrides');
    void syncEditedWorkouts(changedEventIds);
    if (user?.id) {
      void enqueueCloudMutation('postponeOverrides', () => syncOverridesToCloud(user.id, {
        postponeOverrides: updated,
        postponeUpdatedAt: updatedAt
      }));
    }
  };

  const handleApplyAdaptivePlan = (actions: AdaptiveWorkoutAction[]) => {
    const currentMonday = getMondayOfWeek(referenceDate);
    const weekStart = formatDateKey(currentMonday);
    if (appStateRef.current.weeklyDecisions[weekStart]) return;
    const activeWeekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentMonday);
      d.setDate(d.getDate() + i);
      activeWeekDates.push(formatDateKey(d));
    }

    const now = new Date();
    const protectedIds = new Set(allEvents
      .filter(event => new Date(event.startDate).getTime() <= now.getTime())
      .map(event => event.id));
    for (const comparison of comparisons) {
      if (comparison.actualActivity && comparison.plannedEvent) protectedIds.add(comparison.plannedEvent.id);
    }
    const overrides = buildOverridesFromActions(
      actions,
      appStateRef.current.adaptiveOverrides,
      formatDateKey(referenceDate),
      activeWeekDates,
      protectedIds,
      getPriorWeekPostponedEventIds(allEvents, activeWeekDates)
    );
    const changedEventIds = new Set<string>();
    for (const id of new Set([...Object.keys(appStateRef.current.adaptiveOverrides), ...Object.keys(overrides)])) {
      if (appStateRef.current.adaptiveOverrides[id] !== overrides[id]) changedEventIds.add(id);
    }
    const decisions = {
      ...appStateRef.current.weeklyDecisions,
      [weekStart]: { weekStart, decidedAt: now.toISOString() }
    };
    appStateRef.current.adaptiveOverrides = overrides;
    appStateRef.current.weeklyDecisions = decisions;
    setAdaptiveOverrides(overrides);
    setWeeklyDecisions(decisions);
    saveAdaptivePlanState({ overrides, weeklyDecisions: decisions });
    const updatedAt = markLocalSyncUpdated('adaptiveOverrides');
    if (changedEventIds.size > 0) void syncEditedWorkouts([...changedEventIds]);
    if (user?.id) {
      void enqueueCloudMutation('adaptiveOverrides', () => syncOverridesToCloud(user.id, {
        adaptiveOverrides: adaptivePlanPayload(overrides, decisions),
        adaptiveUpdatedAt: updatedAt
      }));
    }
  };

  const week = useMemo(() => summarizeCurrentRunWeek(garminActivities, allEvents, referenceDate),
    [garminActivities, allEvents, referenceDate]);
  const navigateTo = (tab: AppTab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    window.scrollTo(0, 0);
  };

  return (
    <div className="app-shell">
      {/* Desktop Left Sidebar */}
      <Sidebar
        raceName={appConfig.RACE_NAME}
        raceDate={appConfig.RACE_DATE}
        currentTab={activeTab}
        onChangeTab={navigateTo}
        daysToRace={currentPeriodContext.daysToRace}
        onOpenAccountModal={handleOpenAccountModal}
        onRefreshAll={() => autoRechargeAll({ manual: true })}
        isRecharging={isRecharging}
        lastSyncTime={garminState.lastSyncTime}
        userDisplayName={profile?.displayName}
      />

      {/* Main Content Area */}
      <div className="app-main-content">
        {/* Spectator Mode Banner if accessing via public friend link */}
        {spectatorData && (
          <div
            style={{
              background: 'var(--bg-surface)',
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
              <strong>Vue spectateur</strong> · Préparation de{' '}
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
          raceName={appConfig.RACE_NAME}
          currentTab={activeTab}
          periodContext={currentPeriodContext}
          week={week}
          onOpenAccountModal={handleOpenAccountModal}
          onRefreshAll={() => autoRechargeAll({ manual: true })}
          isRecharging={isRecharging}
          lastSyncTime={garminState.lastSyncTime}
          onOpenProgression={() => navigateTo('stats')}
        />

      {cloudSyncIssues.size > 0 && (
        <div role="status" style={{ margin: '8px 16px', padding: '10px 12px', borderRadius: 8, background: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span>La sauvegarde en ligne de certaines données n’est pas confirmée. Elles restent sur cet appareil.</span>
          <button type="button" className="btn-secondary" onClick={() => void retryCloudSync()} disabled={isRetryingCloud || !user?.id}>
            {isRetryingCloud ? 'Nouvel essai…' : 'Réessayer'}
          </button>
        </div>
      )}
      {workoutEditSyncStatus && (
        <div
          role={workoutEditSyncStatus.phase === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          style={{
            margin: '8px 16px',
            padding: '10px 12px',
            borderRadius: 8,
            background: workoutEditSyncStatus.phase === 'error' ? 'rgba(239, 68, 68, 0.12)' :
              workoutEditSyncStatus.phase === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)',
            color: workoutEditSyncStatus.phase === 'error' ? '#fca5a5' :
              workoutEditSyncStatus.phase === 'success' ? '#6ee7b7' : '#93c5fd',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12
          }}
        >
          <span>{workoutEditSyncStatus.message}</span>
          {workoutEditSyncStatus.phase === 'error' && (
            <button type="button" className="btn-secondary" onClick={() => void syncEditedWorkouts([], true)}>
              Réessayer Garmin
            </button>
          )}
        </div>
      )}

      <main className="app-page">
      <React.Suspense fallback={<div role="status" style={{ padding: 24 }}>Chargement de la vue…</div>}>
      {activeTab === 'calendar' && (
        <CalendarView
          schedules={schedules}
          referenceDateStr={formatDateKey(referenceDate)}
          referenceDate={referenceDate}
          onPostponeWorkout={handlePostponeWorkout}
          onCancelPostponeWorkout={handleCancelPostpone}
          comparisons={comparisons}
          garminActivities={garminActivities}
          athlete={athleteVitals}
          onSaveActivityFeedback={!shareSlug ? handleSaveActivityFeedback : undefined}
          adaptiveOverrides={adaptiveOverrides}
          weeklyDecisions={weeklyDecisions}
          adaptivePlanReady={baseCalendar.schedules.length > 0 && !isRecharging && (!user?.id || hydratedAdaptiveUserId === user.id)}
          onApplyAdaptivePlan={handleApplyAdaptivePlan}
        />
      )}

      {activeTab === 'compare' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <ComparisonDashboard
            comparisons={comparisons}
            onOpenGarminSync={() => handleOpenAccountModal('garmin')}
            availableGarminActivities={garminActivities}
            manualPairs={manualPairs}
            onManualPair={handleManualPair}
            onManualUnpair={handleManualUnpair}
            onPostponeWorkout={handlePostponeWorkout}
            referenceDateStr={formatDateKey(referenceDate)}
            athlete={athleteVitals}
          />
        </div>
      )}

      {activeTab === 'stats' && (
        <StatsDashboard
          garminActivities={garminActivities}
          onSaveActivityFeedback={!shareSlug ? handleSaveActivityFeedback : undefined}
          comparisons={comparisons}
          allEvents={allEvents}
          referenceDate={referenceDate}
          wellness={shareSlug ? undefined : getLatestWellnessData() ?? undefined}
        />
      )}

      {activeTab === 'periodization' && (
        <PeriodizationTab
          currentContext={currentPeriodContext}
          activities={garminActivities}
          referenceDate={referenceDate}
        />
      )}
      </React.Suspense>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <MobileNav
        currentTab={activeTab}
        onChangeTab={navigateTo}
      />

        {/* Unified Athlete Hub Modal */}
        <AccountModal
          isOpen={accountModal.isOpen}
          onClose={() => setAccountModal(prev => ({ ...prev, isOpen: false }))}
          initialTab={accountModal.tab}
          garminState={garminState}
          garminActivities={garminActivities}
          onUpdateGarminState={handleUpdateGarminState}
          onActivitiesSynced={handleActivitiesSynced}
          onRequestGarminSync={requestGarminActivitySync}
          onRefreshAll={() => autoRechargeAll({ manual: true })}
        />

        {/* Global Garmin Sync Error Modal */}
        <SyncErrorModal
          error={syncError}
          onClose={() => setSyncError(null)}
          onRetry={() => autoRechargeAll({ manual: true, retryGarminWorkoutSync: true })}
          onOpenGarminSettings={() => {
            setSyncError(null);
            handleOpenAccountModal('garmin');
          }}
          isRetrying={isRecharging}
        />
      </div>
    </div>
  );
};
