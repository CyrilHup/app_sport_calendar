import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarEvent, DailySchedule, PeriodizationContext, WorkoutPostponeOverride, AdaptiveWorkoutOverride, AdaptiveWorkoutAction } from './types/calendar';
import { GarminActivity, GarminSyncState } from './types/garmin';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { AccountModal, AccountModalTab } from './components/AccountModal';
import { MobileNav } from './components/MobileNav';
import { buildCompleteCalendar, parseICSString, RawIcsEvent } from './services/icsParser';
import { formatDateKey, getMondayOfWeek, parseLocalDate } from './services/dateUtils';
import { createAppConfig, getPeriodizationContext } from './services/periodizationEngine';
import { getDynamicAthleteProfile, loadGarminCredentials, loadGarminCredentialsAsync, loadGarminSyncState, loadStoredGarminActivities, saveGarminActivities, saveGarminCredentials, saveGarminSyncState, syncWithGarminAPI } from './services/garminService';
import { App as CapacitorApp } from '@capacitor/app';
import { compareWorkoutsWithGarmin, computeWeeklyTelemetry } from './services/comparisonEngine';
import { cancelPostponeWorkout, loadPostponeOverrides, postponeWorkout, savePostponeOverrides } from './services/postponeService';
import { buildOverridesFromActions, clearAdaptiveOverrides, loadAdaptiveOverrides, saveAdaptiveOverrides } from './services/adaptivePlanEngine';
import { buildEffectiveCalendar, selectCalendarEventsById } from './services/calendarPipeline';
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
import { STORAGE_KEYS, storageGet, storageSet, storageGetRaw, storageSetRaw } from './services/storageService';
import { SyncErrorModal, SyncErrorInfo } from './components/SyncErrorModal';
import { createLatestRerunCoordinator, LatestRerunCoordinator } from './services/asyncCoordinator';
import { createCloudMutationQueue, type CloudMutationDomain } from './services/cloudMutationQueue';
import { registerAutoRefreshTriggers } from './services/autoRefreshTriggers';

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
  const [adaptiveOverrides, setAdaptiveOverrides] = useState<Record<string, AdaptiveWorkoutOverride>>(loadAdaptiveOverrides());
  const [garminActivities, setGarminActivities] = useState<GarminActivity[]>([]);
  const [garminState, setGarminState] = useState<GarminSyncState>(loadGarminSyncState());
  const [baselineFcRest, setBaselineFcRest] = useState(getBaselineRestingHeartRate());
  const [detectedFcMax, setDetectedFcMax] = useState<number | undefined>(() => {
    const value = Number(storageGetRaw(STORAGE_KEYS.ATHLETE_FC_MAX));
    return value > 140 && value < 240 ? value : undefined;
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

  const { user, profile, saveCloudGarminCredentials } = useAuth();
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
    adaptiveOverrides
  });
  appStateRef.current = {
    user,
    profile,
    garminActivities,
    garminState,
    manualPairs,
    postponeOverrides,
    adaptiveOverrides
  };

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

  const autoRechargeAll = useCallback((isManualTrigger = false): Promise<void> => {
    return refreshCoordinatorRef.current!.run(isManualTrigger);
  }, []);

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
            adaptiveOverrides: appStateRef.current.adaptiveOverrides,
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
    eventIds?: string[],
    vitalsOverride?: { fcMax: number; fcRest: number }
  ) => {
    const { allEvents: currentEvents } = buildEffectiveCalendar(
      baseCalendarRef.current,
      appStateRef.current.postponeOverrides,
      appStateRef.current.adaptiveOverrides
    );
    const { events, missingIds } = selectCalendarEventsById(currentEvents, eventIds);
    if (missingIds.length > 0) {
      return Promise.resolve({
        success: false,
        pushedCount: 0,
        totalWeekWorkouts: 0,
        alreadyUpToDate: false,
        results: [],
        reason: 'ERROR' as const,
        error: 'La séance sélectionnée ne figure plus dans le calendrier actuel. Actualisez puis réessayez.'
      });
    }
    const athleteProfile = getDynamicAthleteProfile(appStateRef.current.garminActivities, {
      fcMax: vitalsOverride?.fcMax ?? appConfig.ATHLETE_FC_MAX,
      fcRest: vitalsOverride?.fcRest ?? appConfig.ATHLETE_FC_REST
    });
    return syncCurrentWeekWorkoutsToGarmin(events, syncDate, { athleteProfile });
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
          const localAdaptive = loadAdaptiveOverrides();
          const localPostpones = loadPostponeOverrides();
          const localAdaptiveUpdatedAt = getLocalSyncTimestamp('adaptiveOverrides');
          const localPostponeUpdatedAt = getLocalSyncTimestamp('postponeOverrides');

          if (cloudOverrides && shouldAdoptCloudValue(cloudOverrides.adaptiveOverrides.updatedAt, localAdaptiveUpdatedAt)) {
            const value = cloudOverrides.adaptiveOverrides.value as Record<string, AdaptiveWorkoutOverride>;
            appStateRef.current.adaptiveOverrides = value;
            setAdaptiveOverrides(value);
            saveAdaptiveOverrides(value);
            if (cloudOverrides.adaptiveOverrides.updatedAt) {
              setLocalSyncTimestamp('adaptiveOverrides', cloudOverrides.adaptiveOverrides.updatedAt);
            }
          } else if (Object.keys(localAdaptive).length > 0 || localAdaptiveUpdatedAt) {
            const updatedAt = localAdaptiveUpdatedAt || markLocalSyncUpdated('adaptiveOverrides');
            await enqueueCloudMutation('adaptiveOverrides', () => syncOverridesToCloud(user.id, {
              adaptiveOverrides: localAdaptive,
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

        // Immediate full recharge: ÉTS calendar + Garmin Connect live sync
        if (!cancelled) await autoRechargeAll();
      })().catch(error => {
        if (!cancelled) console.warn('Could not hydrate account data:', error);
      });
    }
    return () => { cancelled = true; };
  }, [user?.id, shareSlug]);

  const currentPeriodContext = getPeriodizationContext(referenceDate, appConfig);

  // Function to recharge both ÉTS iCal and Garmin Connect (Mobile & Web)
  refreshCoordinatorRef.current.setWorker(async (isManualTrigger = false) => {
    const snapshot = appStateRef.current;
    const referenceDate = new Date();
    const { user, profile, garminActivities } = snapshot;
    let rawCourses: RawIcsEvent[] = [];

    // 1. Fetch ÉTS iCal feed via proxy (custom profile URL or default proxy)
    if (!shareSlug) {
      try {
        const customUrlParam = profile?.icalUrl ? `?url=${encodeURIComponent(profile.icalUrl)}` : '';
        const endpoint = getApiUrl(`/api/ets-ical${customUrlParam}`);
        const accessToken = await getSupabaseAccessToken();
        const res = await fetch(endpoint, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
        });
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
    }

    // Offline / Network fallback for calendar courses
    if (!shareSlug && rawCourses.length === 0) {
      const cachedIcs = storageGetRaw(STORAGE_KEYS.CACHED_ETS_ICS, '');
      if (cachedIcs) {
        try {
          rawCourses = parseICSString(cachedIcs);
        } catch {}
      }
    }

    // 2. Synchronisation Incrémentielle Garmin Connect
    let loadedActivities = shareSlug ? garminActivities : mergeGarminActivities(garminActivities, loadStoredGarminActivities());
    const creds = shareSlug ? null : await loadGarminCredentialsAsync();

    if (creds?.email && creds?.password) {
      saveGarminCredentials(creds);
    }

    if (!shareSlug && (!creds?.email || !creds?.password)) {
      // Si aucun identifiant n'est renseigné et que l'utilisateur a cliqué sur Synchro
      if (isManualTrigger) {
        setSyncError({
          title: 'Compte Garmin non configuré',
          message: 'Aucun identifiant Garmin Connect n\'a été détecté sur cet appareil.',
          details: 'Veuillez saisir votre adresse email et mot de passe Garmin dans l\'onglet Garmin pour synchroniser vos sorties réelles et vos données de forme.',
          isMissingCreds: true
        });
      }
    } else if (!shareSlug) {
      try {
        // Synchronisation incrémentielle systématique des activités récentes et wellness
        const result = await syncWithGarminAPI(creds || undefined, { mode: 'incremental' });
        if (result.activities.length > 0) {
          loadedActivities = mergeGarminActivities(loadedActivities, result.activities);
        }
        if (result.success) {
          // Succès : effacement d'un éventuel message d'erreur antérieur
          setSyncError(null);
        } else {
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
        setSyncError({
          title: 'Erreur de connexion Garmin',
          message: 'Impossible de contacter le serveur de synchronisation Garmin Connect.',
          details: syncErr?.message || 'Vérifiez votre connexion Internet et réessayez.'
        });
      }
    }

    // Préserver les activités existantes si la synchro échoue pour ne pas vider l'application
    if (loadedActivities.length === 0 && garminActivities.length > 0) {
      loadedActivities = garminActivities;
    }

    loadedActivities = mergeGarminActivities(appStateRef.current.garminActivities, loadedActivities);
    const refreshedFcRest = getBaselineRestingHeartRate();
    setBaselineFcRest(refreshedFcRest);
    const cachedFcMax = Number(storageGetRaw(STORAGE_KEYS.ATHLETE_FC_MAX));
    const validCachedFcMax = cachedFcMax > 140 && cachedFcMax < 240 ? cachedFcMax : undefined;
    setDetectedFcMax(validCachedFcMax);
    const refreshedFcMax = appStateRef.current.profile?.fcMax ?? validCachedFcMax ?? appConfig.ATHLETE_FC_MAX;
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

    if (!shareSlug) {
      // Ensure current week workouts are really created AND scheduled before marking them synced.
      const workoutSyncResult = await syncPlannedWorkouts(referenceDate, undefined, {
        fcMax: refreshedConfig.ATHLETE_FC_MAX,
        fcRest: refreshedConfig.ATHLETE_FC_REST
      });
      if (!workoutSyncResult.success && workoutSyncResult.reason === 'ERROR') {
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

  });

  useEffect(() => {
    autoRechargeAll();
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
    void syncPlannedWorkouts(referenceDate);
  };

  const handlePostponeWorkout = (
    eventId: string,
    originalDate: string,
    targetDate: string,
    reason?: string,
    targetStartTime?: string
  ) => {
    const updated = postponeWorkout(appStateRef.current.postponeOverrides, eventId, originalDate, targetDate, reason, targetStartTime);
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
    const activeWeekDates: string[] = [];
    // Couvre l'ensemble de l'horizon actif de 14 jours (semaine courante + semaine suivante)
    for (let i = 0; i < 14; i++) {
      const d = new Date(currentMonday);
      d.setDate(d.getDate() + i);
      activeWeekDates.push(formatDateKey(d));
    }

    const overrides = buildOverridesFromActions(
      actions,
      appStateRef.current.adaptiveOverrides,
      formatDateKey(referenceDate),
      activeWeekDates
    );
    appStateRef.current.adaptiveOverrides = overrides;
    setAdaptiveOverrides(overrides);
    saveAdaptiveOverrides(overrides);
    const updatedAt = markLocalSyncUpdated('adaptiveOverrides');
    syncTransformedCalendar();
    if (user?.id) {
      void enqueueCloudMutation('adaptiveOverrides', () => syncOverridesToCloud(user.id, {
        adaptiveOverrides: overrides,
        adaptiveUpdatedAt: updatedAt
      }));
    }
  };

  const handleRevertAdaptivePlan = () => {
    appStateRef.current.adaptiveOverrides = {};
    setAdaptiveOverrides({});
    clearAdaptiveOverrides();
    const updatedAt = markLocalSyncUpdated('adaptiveOverrides');
    syncTransformedCalendar();
    if (user?.id) {
      void enqueueCloudMutation('adaptiveOverrides', () => syncOverridesToCloud(user.id, {
        adaptiveOverrides: {},
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
        onRefreshAll={() => autoRechargeAll(true)}
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
          onRefreshAll={() => autoRechargeAll(true)}
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
          onApplyAdaptivePlan={handleApplyAdaptivePlan}
          onRevertAdaptivePlan={handleRevertAdaptivePlan}
          onOpenGarminSync={() => handleOpenAccountModal('garmin')}
          onSyncGarminWorkouts={syncPlannedWorkouts}
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
          calendarEvents={allEvents}
          onRefreshAll={() => autoRechargeAll(true)}
          isRecharging={isRecharging}
          lastSyncTime={lastSyncTime}
        />

        {/* Global Garmin Sync Error Modal */}
        <SyncErrorModal
          error={syncError}
          onClose={() => setSyncError(null)}
          onRetry={() => autoRechargeAll(true)}
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
