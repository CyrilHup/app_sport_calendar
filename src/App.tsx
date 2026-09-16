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
import { loadGarminCredentials, loadGarminCredentialsAsync, loadGarminSyncState, loadStoredGarminActivities, saveGarminActivities, saveGarminCredentials, saveGarminSyncState, syncWithGarminAPI } from './services/garminService';
import { App as CapacitorApp } from '@capacitor/app';
import { compareWorkoutsWithGarmin, computeWeeklyTelemetry } from './services/comparisonEngine';
import { applyPostponements, cancelPostponeWorkout, loadPostponeOverrides, postponeWorkout, savePostponeOverrides } from './services/postponeService';
import { applyAdaptiveModifications, buildOverridesFromActions, clearAdaptiveOverrides, loadAdaptiveOverrides, saveAdaptiveOverrides } from './services/adaptivePlanEngine';
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

function transformCalendar(
  baseCalendar: { schedules: DailySchedule[]; allEvents: CalendarEvent[] },
  postpones: Record<string, WorkoutPostponeOverride>,
  adaptations: Record<string, AdaptiveWorkoutOverride>
): { schedules: DailySchedule[]; allEvents: CalendarEvent[] } {
  const postponed = applyPostponements(
    baseCalendar.schedules,
    baseCalendar.allEvents,
    postpones
  );
  return applyAdaptiveModifications(
    postponed.schedules,
    postponed.allEvents,
    adaptations
  );
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
  const [manualPairs, setManualPairs] = useState<Record<string, string>>(loadManualPairs());
  const [activeTab, setActiveTab] = useState<'calendar' | 'compare' | 'periodization' | 'stats'>('calendar');
  const [isRecharging, setIsRecharging] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toISOString());
  const [syncError, setSyncError] = useState<SyncErrorInfo | null>(null);
  const [accountModal, setAccountModal] = useState<{ isOpen: boolean; tab: AccountModalTab }>({
    isOpen: false,
    tab: 'profile'
  });
  const [spectatorData, setSpectatorData] = useState<{ profile: any; activities: GarminActivity[] } | null>(null);
  const referenceDateKey = formatDateKey(new Date());
  const referenceDate = useMemo(() => parseLocalDate(referenceDateKey), [referenceDateKey]);
  const { schedules, allEvents } = useMemo(
    () => transformCalendar(baseCalendar, postponeOverrides, adaptiveOverrides),
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
    fcMax: effectiveProfile?.fcMax,
    fcRest: baselineFcRest,
    raceName: effectiveProfile?.raceName,
    raceDate: effectiveProfile?.raceDate
  }), [effectiveProfile, baselineFcRest]);
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
  const cloudMutationQueueRef = useRef<Promise<void>>(Promise.resolve());

  const enqueueCloudMutation = useCallback((mutation: () => Promise<unknown>): Promise<void> => {
    const queued = cloudMutationQueueRef.current
      .catch(() => undefined)
      .then(async () => { await mutation(); });
    cloudMutationQueueRef.current = queued.catch(error => {
      console.warn('[Cloud Mutation Error]', error);
    });
    return cloudMutationQueueRef.current;
  }, []);

  const autoRechargeAll = useCallback((isManualTrigger = false): Promise<void> => {
    return refreshCoordinatorRef.current!.run(isManualTrigger);
  }, []);

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
        const mergedActs = mergeGarminActivities(cloudActs || [], localActs || []);

        if (mergedActs.length > 0) {
          appStateRef.current.garminActivities = mergedActs;
          setGarminActivities(mergedActs);
          saveGarminActivities(mergedActs);
          // Push any merged activities that weren't yet on cloud
          await enqueueCloudMutation(() => syncActivitiesToCloud(user.id, mergedActs));
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
            await enqueueCloudMutation(() => syncWellnessToCloud(user.id, localWellness));
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
          await enqueueCloudMutation(() => syncPairsToCloud(user.id, localPairs, updatedAt));
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
            await enqueueCloudMutation(() => syncOverridesToCloud(user.id, {
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
            await enqueueCloudMutation(() => syncOverridesToCloud(user.id, {
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

    // Start calendar on Monday of the training plan start week (2026-08-31)
    // to preserve Week 1 (from 1er sept.), past microcycles, history, and telemetry reconciliation
    const calendarWindow = getCalendarBuildWindow(referenceDate, appConfig.SPORT_START_DATE);
    const { schedules: builtSchedules, allEvents: builtEvents } = buildCompleteCalendar(
      rawCourses,
      calendarWindow.startMonday,
      calendarWindow.daysCount,
      appConfig
    );

    const freshBaseCalendar = { schedules: builtSchedules, allEvents: builtEvents };
    baseCalendarRef.current = freshBaseCalendar;
    setBaseCalendar(freshBaseCalendar);
    const { allEvents: transformedEvents } = transformCalendar(
      freshBaseCalendar,
      appStateRef.current.postponeOverrides,
      appStateRef.current.adaptiveOverrides
    );

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

    loadedActivities = mergeGarminActivities(loadedActivities, appStateRef.current.garminActivities);
    setBaselineFcRest(getBaselineRestingHeartRate());
    appStateRef.current.garminActivities = loadedActivities;
    setGarminActivities(loadedActivities);

    // Automatically persist fresh activities and wellness to Supabase cloud if authenticated
    if (!shareSlug && user?.id && loadedActivities.length > 0) {
      await enqueueCloudMutation(() => syncActivitiesToCloud(user.id, loadedActivities));
      try {
        const localWellness = Object.values(loadWellnessHistory());
        if (localWellness.length > 0) {
          await enqueueCloudMutation(() => syncWellnessToCloud(user.id, localWellness));
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
      const workoutSyncResult = await syncCurrentWeekWorkoutsToGarmin(transformedEvents, referenceDate);
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
  }, [profile?.icalUrl, appConfig, spectatorData]);

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
    const mergedActivities = mergeGarminActivities(appStateRef.current.garminActivities, newActivities);
    appStateRef.current.garminActivities = mergedActivities;
    setGarminActivities(mergedActivities);
    saveGarminActivities(mergedActivities);
    if (user?.id) {
      void enqueueCloudMutation(() => syncActivitiesToCloud(user.id, mergedActivities));
    }
  };

  const handleManualPair = (planId: string, garminActivityId: string) => {
    const updated = { ...appStateRef.current.manualPairs, [planId]: garminActivityId };
    appStateRef.current.manualPairs = updated;
    setManualPairs(updated);
    saveManualPairs(updated);
    const updatedAt = markLocalSyncUpdated('manualPairs');
    if (user?.id) {
      void enqueueCloudMutation(() => syncPairsToCloud(user.id, updated, updatedAt));
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
      void enqueueCloudMutation(() => syncPairsToCloud(user.id, updated, updatedAt));
    }
  };

  const syncTransformedCalendar = (
    postpones: Record<string, WorkoutPostponeOverride>,
    adaptations: Record<string, AdaptiveWorkoutOverride>
  ) => {
    if (baseCalendarRef.current.schedules.length === 0) return;
    const { allEvents: newEvents } = transformCalendar(
      baseCalendarRef.current,
      postpones,
      adaptations
    );
    void syncCurrentWeekWorkoutsToGarmin(newEvents, referenceDate);
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
    syncTransformedCalendar(updated, appStateRef.current.adaptiveOverrides);
    if (user?.id) {
      void enqueueCloudMutation(() => syncOverridesToCloud(user.id, {
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
    syncTransformedCalendar(updated, appStateRef.current.adaptiveOverrides);
    if (user?.id) {
      void enqueueCloudMutation(() => syncOverridesToCloud(user.id, {
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
    syncTransformedCalendar(appStateRef.current.postponeOverrides, overrides);
    if (user?.id) {
      void enqueueCloudMutation(() => syncOverridesToCloud(user.id, {
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
    syncTransformedCalendar(appStateRef.current.postponeOverrides, {});
    if (user?.id) {
      void enqueueCloudMutation(() => syncOverridesToCloud(user.id, {
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

      {/* Main Tab Content */}
      <React.Suspense fallback={<div role="status" style={{ padding: 24 }}>Chargement de la vue…</div>}>
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
          athlete={athleteVitals}
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
          onOpenGarminSync={() => handleOpenAccountModal('garmin')}
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
