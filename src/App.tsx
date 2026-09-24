import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarEvent, DailySchedule, PeriodizationContext, WorkoutPostponeOverride, AdaptiveWorkoutOverride, AdaptiveWorkoutAction } from './types/calendar';
import { GarminActivity, GarminSyncState } from './types/garmin';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { AccountModal, AccountModalTab } from './components/AccountModal';
import { MobileNav } from './components/MobileNav';
import { buildCompleteCalendar, parseICSString, RawIcsEvent } from './services/icsParser';
import { resolveIcsCourses } from './services/icsCacheService';
import { formatDateKey, getMondayOfWeek, parseLocalDate } from './services/dateUtils';
import { createAppConfig, getPeriodizationContext } from './services/periodizationEngine';
import { clearGarminCredentials, getDynamicAthleteProfile, loadGarminCredentials, loadGarminCredentialsAsync, loadGarminSyncState, loadStoredGarminActivities, saveGarminActivities, saveGarminSyncState, syncWithGarminAPI } from './services/garminService';
import type { GarminActivitySyncMode, GarminActivitySyncResult, GarminCredentials } from './services/garminService';
import { App as CapacitorApp } from '@capacitor/app';
import { compareWorkoutsWithGarmin, computeWeeklyTelemetry } from './services/comparisonEngine';
import { cancelPostponeWorkout, loadPostponeOverrides, postponeWorkout, savePostponeOverrides } from './services/postponeService';
import { buildOverridesFromActions, getPriorWeekPostponedEventIds, isAutoAdaptEnabled, loadAdaptivePlanState, saveAdaptivePlanState } from './services/adaptivePlanEngine';
import { parseAdaptivePlanState, serializeAdaptivePlanState, WeeklyDecision } from './services/adaptivePlanStore';
import { buildEffectiveCalendar } from './services/calendarPipeline';
import { DEFAULT_WEEKLY_TARGETS } from './services/trainingDefaults';
import { isTrailOrRunning } from './services/activityClassifier';
import { Activity, BarChart3, Calendar, TrendingUp } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { syncActivitiesToCloud, fetchActivitiesFromCloud, syncWellnessToCloud, fetchWellnessFromCloud, syncPairsToCloud, fetchPairsFromCloud, fetchPublicSharedData, syncOverridesToCloud, fetchOverridesFromCloud, getSupabaseAccessToken } from './services/supabaseClient';
import { saveWellnessData, loadWellnessHistory, getBaselineRestingHeartRate } from './services/readinessEngine';
import { getApiUrl } from './services/apiConfig';
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
  const [activeTab, setActiveTab] = useState<'calendar' | 'compare' | 'periodization' | 'stats'>('calendar');
  const [isRecharging, setIsRecharging] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toISOString());
  const [syncError, setSyncError] = useState<SyncErrorInfo | null>(null);
  const [cloudSyncIssues, setCloudSyncIssues] = useState<Set<CloudMutationDomain>>(() => new Set());
  const [isRetryingCloud, setIsRetryingCloud] = useState(false);
  const [accountModal, setAccountModal] = useState<{ isOpen: boolean; tab: AccountModalTab }>({
    isOpen: false,
    tab: 'profile'
  });
  const [spectatorData, setSpectatorData] = useState<{ profile: any; activities: GarminActivity[] } | null>(null);
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
  useEffect(() => {
    if (authLoading) return;
    if (user?.id) {
      previousSignedInUserRef.current = user.id;
      return;
    }
    if (!previousSignedInUserRef.current) return;
    previousSignedInUserRef.current = null;
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
  const pendingGarminFcMaxRefreshRef = useRef<{
    fcMax: number;
    nonFcProfileKey: string;
    spectatorData: typeof spectatorData;
  } | null>(null);
  const nonFcProfileRefreshKey = JSON.stringify([
    profile?.icalUrl,
    profile?.homeAddress,
    profile?.campusAddress,
    profile?.trailAddress,
    profile?.raceName,
    profile?.raceDate
  ]);

  const adaptivePlanPayload = (overrides: Record<string, AdaptiveWorkoutOverride>, decisions: Record<string, WeeklyDecision>) =>
    JSON.parse(serializeAdaptivePlanState({ overrides, weeklyDecisions: decisions })) as Record<string, unknown>;

  const refreshCoordinatorRef = useRef<LatestRerunCoordinator | null>(null);
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
    return refreshCoordinatorRef.current!.run(request);
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
    vitalsOverride?: { fcMax: number; fcRest: number }
  ) => {
    const accountId = appStateRef.current.user?.id;
    const weekStart = formatDateKey(getMondayOfWeek(syncDate));
    if ((accountId && adaptiveCloudLoadedUserRef.current !== accountId) ||
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
      completedEventIds: [...completedEventIds]
    });
  }, [appConfig]);

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
      if (ensureLocalAccountOwner(user.id)) {
        // Never merge another account's device-local Garmin data or credentials.
        clearGarminCredentials();
        const emptyGarminState = loadGarminSyncState();
        appStateRef.current.garminActivities = [];
        appStateRef.current.garminState = emptyGarminState;
        appStateRef.current.manualPairs = {};
        appStateRef.current.postponeOverrides = {};
        appStateRef.current.adaptiveOverrides = {};
        appStateRef.current.weeklyDecisions = {};
        adaptiveCloudLoadedUserRef.current = null;
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
        const cloudActs = await fetchActivitiesFromCloud(user.id);
        if (cancelled) return;
        // The cloud snapshot is fetched after local hydration, so its defined
        // fields win while local-only metrics are preserved.
        const mergedActs = mergeGarminActivities(localActs || [], cloudActs || []);

        if (mergedActs.length > 0) {
          appStateRef.current.garminActivities = mergedActs;
          setGarminActivities(mergedActs);
          saveGarminActivities(mergedActs);
          // Push any merged activities that weren't yet on cloud
          await enqueueCloudMutation('activities', () => syncActivitiesToCloud(user.id, mergedActs));
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

        // Immediate full recharge: ÉTS calendar + Garmin Connect live sync
        if (!cancelled) {
          await autoRechargeAll();
          if (!cancelled) setHydratedAdaptiveUserId(user.id);
        }
      })().catch(error => {
        if (!cancelled) console.warn('Could not hydrate account data:', error);
      });
    }
    return () => { cancelled = true; };
  }, [user?.id, shareSlug]);

  const currentPeriodContext = getPeriodizationContext(referenceDate, appConfig);

  // Function to recharge both ÉTS iCal and Garmin Connect (Mobile & Web)
  refreshCoordinatorRef.current.setWorker(async ({
    manual: isManualTrigger,
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
    let rawCourses: RawIcsEvent[] = [];

    // 1. Fetch ÉTS iCal feed via proxy (custom profile URL or default proxy)
    if (!shareSlug) {
      const customIcalUrl = profile?.icalUrl || '';
      const feedSource = `${user?.id || 'guest'}:${customIcalUrl ? `custom:${customIcalUrl}` : 'default:ets'}`;
      let fetchedIcs: string | null = null;
      try {
        const customUrlParam = customIcalUrl ? `?url=${encodeURIComponent(customIcalUrl)}` : '';
        const endpoint = getApiUrl(`/api/ets-ical${customUrlParam}`);
        const accessToken = await getSupabaseAccessToken();
        const res = await fetch(endpoint, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
        });
        if (res.ok) {
          fetchedIcs = await res.text();
        }
      } catch (err) {
        console.warn("Could not fetch ÉTS iCal from proxy, checking local cache", err);
      }
      rawCourses = resolveIcsCourses(feedSource, fetchedIcs, parseICSString);
    }
    if (!stillCurrentAccount()) return null;

    // 2. Synchronisation Incrémentielle Garmin Connect
    let loadedActivities = shareSlug ? garminActivities : mergeGarminActivities(garminActivities, loadStoredGarminActivities());
    const creds = shareSlug ? null : (requestedCredentials ?? await loadGarminCredentialsAsync());
    if (!stillCurrentAccount()) return null;

    let garminSyncResult: GarminActivitySyncResult | null = null;
    const missingGarminCredentials = !creds?.email || !creds?.password;
    if (refreshGarmin && !shareSlug && missingGarminCredentials && !requestedSyncMode) {
      // Si aucun identifiant n'est renseigné et que l'utilisateur a cliqué sur Synchro
      if (isManualTrigger && (garminSyncMode === undefined || syncRequestMatchesAccount)) {
        setSyncError({
          title: 'Compte Garmin non configuré',
          message: 'Aucun identifiant Garmin Connect n\'a été détecté sur cet appareil.',
          details: 'Veuillez saisir votre adresse email et mot de passe Garmin dans l\'onglet Garmin pour synchroniser vos sorties réelles et vos données de forme.',
          isMissingCreds: true
        });
      }
    } else if (refreshGarmin && !shareSlug && (!missingGarminCredentials || requestedSyncMode)) {
      try {
        // Both manual history retrieval and automatic incrementals use this one refresh pipeline.
        const result = await syncWithGarminAPI(creds || undefined, { mode: requestedSyncMode ?? 'incremental' });
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
            message: 'La synchronisation incrémentielle avec Garmin Connect a rencontré une erreur.',
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
          syncMode: requestedSyncMode ?? 'incremental'
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
    const { schedules: builtSchedules, allEvents: builtEvents } = buildCompleteCalendar(
      rawCourses,
      calendarWindow.startMonday,
      calendarWindow.daysCount,
      refreshedConfig
    );
    const freshBaseCalendar = { schedules: builtSchedules, allEvents: builtEvents };
    baseCalendarRef.current = freshBaseCalendar;
    setBaseCalendar(freshBaseCalendar);

    // Automatically persist fresh activities and wellness to Supabase cloud if authenticated
    if (!shareSlug && user?.id && loadedActivities.length > 0) {
      await enqueueCloudMutation('activities', () => syncActivitiesToCloud(user.id, loadedActivities));
      try {
        const localWellness = Object.values(loadWellnessHistory());
        if (localWellness.length > 0) {
          await enqueueCloudMutation('wellness', () => syncWellnessToCloud(user.id, localWellness));
        }
      } catch {}
    }

    const nowIso = new Date().toISOString();
    setLastSyncTime(nowIso);

    const isGarminConnected = loadedActivities.length > 0 || Boolean(creds?.email);
    setGarminState(previousState => {
      const updatedState: GarminSyncState = {
        ...previousState,
        connected: isGarminConnected,
        accountEmail: creds?.email || previousState.accountEmail || (user ? 'Compte Garmin lié' : 'Compte Garmin'),
        lastSyncTime: loadedActivities.length > 0 ? nowIso : (previousState.lastSyncTime || nowIso),
        activitiesCount: loadedActivities.length,
        isSyncing: false
      };
      saveGarminSyncState(updatedState);
      return updatedState;
    });

    const currentWeekStart = formatDateKey(getMondayOfWeek(referenceDate));
    const adaptiveDataReady = !user?.id || adaptiveCloudLoadedUserRef.current === user.id;
    const weekPlanReady = !isAutoAdaptEnabled() || Boolean(appStateRef.current.weeklyDecisions[currentWeekStart]);
    if (!shareSlug && adaptiveDataReady && weekPlanReady) {
      // Ensure current week workouts are really created AND scheduled before marking them synced.
      const workoutSyncResult = await syncPlannedWorkouts(referenceDate, {
        fcMax: refreshedConfig.ATHLETE_FC_MAX,
        fcRest: refreshedConfig.ATHLETE_FC_REST
      });
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

  const hasInitializedProfileRefreshRef = useRef(false);
  useEffect(() => {
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
    profile?.icalUrl,
    profile?.homeAddress,
    profile?.campusAddress,
    profile?.trailAddress,
    profile?.fcMax,
    profile?.raceName,
    profile?.raceDate,
    spectatorData
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

  const syncTransformedCalendar = () => {
    if (baseCalendarRef.current.schedules.length === 0) return;
    // Rebuild the canonical calendar after a transform before publishing it to
    // Garmin. A direct push can race a refresh and replace the new plan with
    // an older base-calendar snapshot.
    void autoRechargeAll({ refreshGarmin: false });
  };

  const handlePostponeWorkout = (
    eventId: string,
    originalDate: string,
    targetDate: string,
    reason?: string,
    targetStartTime?: string
  ) => {
    const originalWorkout = baseCalendarRef.current.allEvents.find(event =>
      event.id === eventId && event.category === 'sport' && formatDateKey(new Date(event.startDate)) === originalDate
    );
    if (!originalWorkout) {
      setSyncError({
        title: 'Séance introuvable',
        message: 'Cette séance a changé depuis son affichage. Actualise le calendrier avant de la reporter.'
      });
      return;
    }
    const updated = postponeWorkout(
      appStateRef.current.postponeOverrides,
      eventId,
      originalDate,
      targetDate,
      reason,
      targetStartTime,
      originalWorkout
    );
    appStateRef.current.postponeOverrides = updated;
    setPostponeOverrides(updated);
    savePostponeOverrides(updated);
    const updatedAt = markLocalSyncUpdated('postponeOverrides');
    syncTransformedCalendar();
    if (user?.id) {
      void enqueueCloudMutation('postponeOverrides', () => syncOverridesToCloud(user.id, {
        postponeOverrides: updated,
        postponeUpdatedAt: updatedAt
      }));
    }
  };

  const handleCancelPostpone = (eventId: string) => {
    const updated = cancelPostponeWorkout(appStateRef.current.postponeOverrides, eventId);
    appStateRef.current.postponeOverrides = updated;
    setPostponeOverrides(updated);
    savePostponeOverrides(updated);
    const updatedAt = markLocalSyncUpdated('postponeOverrides');
    syncTransformedCalendar();
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
    syncTransformedCalendar();
    if (user?.id) {
      void enqueueCloudMutation('adaptiveOverrides', () => syncOverridesToCloud(user.id, {
        adaptiveOverrides: adaptivePlanPayload(overrides, decisions),
        adaptiveUpdatedAt: updatedAt
      }));
    }
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
    },
    athleteVitals
  );

  return (
    <div className="app-shell">
      {/* Desktop Left Sidebar */}
      <Sidebar
        raceName={appConfig.RACE_NAME}
        raceDate={appConfig.RACE_DATE}
        currentTab={activeTab}
        onChangeTab={(tab) => setActiveTab(tab)}
        periodContext={currentPeriodContext}
        garminState={garminState}
        weeklyStats={weeklyStats}
        comparisons={comparisons}
        garminActivities={garminActivities}
        referenceDate={referenceDate}
        onOpenAccountModal={handleOpenAccountModal}
        onRefreshAll={() => autoRechargeAll({ manual: true })}
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
              👁️ <strong>Mode Spectateur :</strong> Vous suivez la préparation de{' '}
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
          garminState={garminState}
          weeklyStats={weeklyStats}
          comparisons={comparisons}
          onOpenAccountModal={handleOpenAccountModal}
          onRefreshAll={() => autoRechargeAll({ manual: true })}
          isRecharging={isRecharging}
          lastSyncTime={lastSyncTime}
          onSelectPeriodizationTab={() => setActiveTab('periodization')}
          userDisplayName={profile?.displayName}
          userAvatarUrl={profile?.avatarUrl || user?.user_metadata?.avatar_url || user?.user_metadata?.picture}
          isLoggedIn={Boolean(user)}
        />

      {cloudSyncIssues.size > 0 && (
        <div role="status" style={{ margin: '8px 16px', padding: '10px 12px', borderRadius: 8, background: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span>La sauvegarde en ligne de certaines données n’est pas confirmée. Elles restent sur cet appareil.</span>
          <button type="button" className="btn-secondary" onClick={() => void retryCloudSync()} disabled={isRetryingCloud || !user?.id}>
            {isRetryingCloud ? 'Nouvel essai…' : 'Réessayer'}
          </button>
        </div>
      )}

      {/* Main Tab Content */}
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
            garminState={garminState}
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
          comparisons={comparisons}
          allEvents={allEvents}
          referenceDate={referenceDate}
          config={appConfig}
        />
      )}

      {activeTab === 'periodization' && (
        <PeriodizationTab
          currentContext={currentPeriodContext}
          activities={garminActivities}
          comparisons={comparisons}
          events={allEvents}
          referenceDate={referenceDate}
          fcMax={appConfig.ATHLETE_FC_MAX}
        />
      )}
      </React.Suspense>

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
          garminActivities={garminActivities}
          onUpdateGarminState={handleUpdateGarminState}
          onActivitiesSynced={handleActivitiesSynced}
          onRequestGarminSync={requestGarminActivitySync}
          calendarEvents={allEvents}
          onRefreshAll={() => autoRechargeAll({ manual: true })}
          isRecharging={isRecharging}
          lastSyncTime={lastSyncTime}
        />

        {/* Global Garmin Sync Error Modal */}
        <SyncErrorModal
          error={syncError}
          onClose={() => setSyncError(null)}
          onRetry={() => autoRechargeAll({ manual: true })}
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
