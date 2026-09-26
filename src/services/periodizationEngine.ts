import { CalendarEvent, PeriodizationContext, SportType } from '../types/calendar';
import { calculateHeartRateZones } from './heartRateZones';

const getEnvVal = (key: string, fallback: string = ''): string => {
  return (import.meta as any).env?.[key] || (globalThis as any).process?.env?.[key] || fallback;
};

const getHeartRateEnv = (key: string, fallback: number, min: number, max: number): number => {
  const value = Number(getEnvVal(key, String(fallback)));
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
};

export interface AppConfig {
  HOME_ADDRESS: string;
  ETS_ADDRESS: string;
  MOUNT_ROYAL_ADDRESS: string;
  TRAIL_LOCATION: string;
  SPORT_START_DATE: string;
  PLAN_START_DATE: string;
  RACE_NAME: string;
  RACE_DATE: string;
  ATHLETE_FC_MAX: number;
  ATHLETE_FC_REST: number;
  TARGET_HOME_RETURN_HOUR: number;
  TARGET_HOME_RETURN_MIN: number;
  BUFFER_BEFORE_CLASS_MIN: number;
  BUFFER_AFTER_CLASS_MIN: number;
  BUFFER_BETWEEN_CLASS_AND_SPORT_MIN: number;
  BUFFER_AFTER_CONFLICT_MIN: number;
  TRANSIT_TIMES: Readonly<{
    HOME_TO_ETS: number;
    ETS_TO_HOME: number;
    HOME_TO_MONT_ROYAL: number;
    MONT_ROYAL_TO_HOME: number;
    ETS_TO_MONT_ROYAL: number;
    MONT_ROYAL_TO_ETS: number;
    DEFAULT: number;
  }>;
}

const DEFAULT_APP_CONFIG: AppConfig = {
  HOME_ADDRESS: getEnvVal('VITE_HOME_ADDRESS', 'Domicile'),
  ETS_ADDRESS: getEnvVal('VITE_CAMPUS_ADDRESS', 'Campus ÉTS'),
  MOUNT_ROYAL_ADDRESS: getEnvVal('VITE_TRAIL_ADDRESS', 'Parc du Mont-Royal'),
  TRAIL_LOCATION: getEnvVal('VITE_TRAIL_LOCATION', 'Mont-Royal'),
  SPORT_START_DATE: getEnvVal('VITE_SPORT_START_DATE', '2026-09-01'),
  PLAN_START_DATE: getEnvVal('VITE_PLAN_START_DATE', '2027-01-11'),
  RACE_NAME: getEnvVal('VITE_TARGET_RACE_NAME', 'Québec Mega Trail 80 km (QMT-80)'),
  RACE_DATE: getEnvVal('VITE_TARGET_RACE_DATE', '2027-07-03'),
  ATHLETE_FC_MAX: getHeartRateEnv('VITE_ATHLETE_FC_MAX', 203, 140, 240),
  ATHLETE_FC_REST: getHeartRateEnv('VITE_ATHLETE_FC_REST', 48, 30, 120),
  TARGET_HOME_RETURN_HOUR: 13,
  TARGET_HOME_RETURN_MIN: 0,
  BUFFER_BEFORE_CLASS_MIN: 10,
  BUFFER_AFTER_CLASS_MIN: 10,
  BUFFER_BETWEEN_CLASS_AND_SPORT_MIN: 10,
  BUFFER_AFTER_CONFLICT_MIN: 20,
  TRANSIT_TIMES: {
    HOME_TO_ETS: 35,
    ETS_TO_HOME: 35,
    HOME_TO_MONT_ROYAL: 45,
    MONT_ROYAL_TO_HOME: 45,
    ETS_TO_MONT_ROYAL: 25,
    MONT_ROYAL_TO_ETS: 25,
    DEFAULT: 35
  }
};

export const GLOBAL_APP_CONFIG: Readonly<AppConfig> = Object.freeze({
  ...DEFAULT_APP_CONFIG,
  TRANSIT_TIMES: Object.freeze({ ...DEFAULT_APP_CONFIG.TRANSIT_TIMES })
});

export function createAppConfig(overrides: {
  homeAddress?: string;
  campusAddress?: string;
  trailAddress?: string;
  fcMax?: number;
  fcRest?: number;
  raceName?: string;
  raceDate?: string;
} = {}): Readonly<AppConfig> {
  const fcMax = typeof overrides.fcMax === 'number' && overrides.fcMax >= 140 && overrides.fcMax <= 240
    ? overrides.fcMax : GLOBAL_APP_CONFIG.ATHLETE_FC_MAX;
  const fcRest = typeof overrides.fcRest === 'number' && overrides.fcRest >= 30 && overrides.fcRest <= 120 && overrides.fcRest < fcMax
    ? overrides.fcRest : GLOBAL_APP_CONFIG.ATHLETE_FC_REST;
  return Object.freeze({
    ...GLOBAL_APP_CONFIG,
    HOME_ADDRESS: overrides.homeAddress || GLOBAL_APP_CONFIG.HOME_ADDRESS,
    ETS_ADDRESS: overrides.campusAddress || GLOBAL_APP_CONFIG.ETS_ADDRESS,
    MOUNT_ROYAL_ADDRESS: overrides.trailAddress || GLOBAL_APP_CONFIG.MOUNT_ROYAL_ADDRESS,
    ATHLETE_FC_MAX: fcMax,
    ATHLETE_FC_REST: fcRest,
    RACE_NAME: overrides.raceName || GLOBAL_APP_CONFIG.RACE_NAME,
    RACE_DATE: overrides.raceDate || GLOBAL_APP_CONFIG.RACE_DATE,
    TRANSIT_TIMES: GLOBAL_APP_CONFIG.TRANSIT_TIMES
  });
}

export const COLOR_MAP = {
  TRAIL_LONG: { emoji: "🏔️", colorHex: "#ff6b35", colorId: "6" },
  TRAIL_INTENSE: { emoji: "⚡", colorHex: "#f72585", colorId: "11" },
  RUN_EASY: { emoji: "🏃", colorHex: "#4cc9f0", colorId: "5" },
  CALISTHENICS: { emoji: "🤸", colorHex: "#7209b7", colorId: "7" },
  GYM_FORCE: { emoji: "🏋️", colorHex: "#4361ee", colorId: "10" },
  MOBILITY: { emoji: "🧘", colorHex: "#06d6a0", colorId: "3" },
  TRAVEL: { emoji: "🚌", colorHex: "#94a3b8", colorId: "8" },
  RACE_DAY: { emoji: "🏁", colorHex: "#e63946", colorId: "11" },
  COURSE: { emoji: "🏛️", colorHex: "#3b82f6", colorId: "9" },
  TP: { emoji: "🔬", colorHex: "#10b981", colorId: "2" },
  EXAM: { emoji: "📝", colorHex: "#ef4444", colorId: "11" }
};

function localCalendarDayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

export function getPeriodizationContext(
  date: Date,
  config: Readonly<AppConfig> = GLOBAL_APP_CONFIG
): PeriodizationContext {
  const planStart = new Date(config.PLAN_START_DATE + "T00:00:00");
  const raceDay = new Date(config.RACE_DATE + "T00:00:00");
  const sportStart = new Date(config.SPORT_START_DATE + "T00:00:00");

  const diffFromStartDays = localCalendarDayNumber(date) - localCalendarDayNumber(planStart);
  const daysToRace = localCalendarDayNumber(raceDay) - localCalendarDayNumber(date);

  // --- Foundation phase and three-week ramp-up derived from SPORT_START_DATE ---
  if (diffFromStartDays < 0) {
    const foundationWeekStart = Number.isNaN(sportStart.getTime()) ? new Date(date) : new Date(sportStart);
    const weekdayFromMonday = (foundationWeekStart.getDay() + 6) % 7;
    foundationWeekStart.setDate(foundationWeekStart.getDate() - weekdayFromMonday);
    const ramp1End = new Date(foundationWeekStart);
    const ramp2End = new Date(foundationWeekStart);
    const ramp3End = new Date(foundationWeekStart);
    ramp1End.setDate(ramp1End.getDate() + 7);
    ramp2End.setDate(ramp2End.getDate() + 14);
    ramp3End.setDate(ramp3End.getDate() + 21);

    if (date < ramp1End) {
      return {
        phase: "FONDATION_RAMP_1",
        weekNumber: 0,
        isDeload: false,
        volumeFactor: 0.55,
        label: "Fondations : Reprise S1 (~55%)",
        daysToRace,
        description: "Reprise progressive post-coupure. Zéro intensité excessive ; priorité à l'endurance de base et au renforcement tendineux."
      };
    }
    if (date < ramp2End) {
      return {
        phase: "FONDATION_RAMP_2",
        weekNumber: 0,
        isDeload: false,
        volumeFactor: 0.75,
        label: "Fondations : Progression S2 (~75%)",
        daysToRace,
        description: "Montée en charge progressive du volume. Introduction des répétitions de côtes contrôlées."
      };
    }
    if (date < ramp3End) {
      return {
        phase: "FONDATION_RAMP_3",
        weekNumber: 0,
        isDeload: false,
        volumeFactor: 0.90,
        label: "Fondations : Stabilisation S3 (~90%)",
        daysToRace,
        description: "Consolidation du volume automnal. Sorties longues du weekend bien stabilisées."
      };
    }
    return {
      phase: "FONDATION",
      weekNumber: 0,
      isDeload: false,
      volumeFactor: 0.85,
      label: `Phase Fondations (${sportStart.getFullYear() || date.getFullYear()})`,
      daysToRace,
      description: "Moteur aérobie solide, calisthénie au Gym ÉTS et dénivelé régulier au Mont-Royal."
    };
  }

  // --- QMT-80 2027 SPECIFIC TRAINING BLOCKS ---
  if (daysToRace <= 6 && daysToRace >= 0) {
    return {
      phase: "RACE_WEEK",
      weekNumber: Math.floor(diffFromStartDays / 7) + 1,
      isDeload: true,
      volumeFactor: 0.30,
      label: `Semaine de Course — ${config.RACE_NAME} 🏁`,
      daysToRace,
      description: "Récupération active, pic de fraîcheur, recharge glucidique et validation finale du sac de course."
    };
  }

  const weekNumber = Math.floor(diffFromStartDays / 7) + 1;
  const weekInBlock = ((weekNumber - 1) % 4) + 1;
  const isDeload = (weekInBlock === 4);

  if (weekNumber <= 6) {
    return {
      phase: "PUISSANCE_HIVERNALE",
      weekNumber,
      isDeload,
      volumeFactor: isDeload ? 0.70 : (0.80 + weekInBlock * 0.05),
      label: `S${weekNumber} [Puissance Hivernale] - ${isDeload ? '⚠️ Décharge' : `Charge (${weekInBlock}/3)`}`,
      daysToRace,
      description: "Bloc hivernal : intervalles sur tapis incliné (Gym ÉTS) et renforcement excentrique des quadriceps pour la descente."
    };
  }

  if (weekNumber <= 16) {
    return {
      phase: "VOLUME_WEC_1",
      weekNumber,
      isDeload,
      volumeFactor: isDeload ? 0.75 : (0.95 + weekInBlock * 0.05),
      label: `S${weekNumber} [Volume & Chocs WEC] - ${isDeload ? '⚠️ Décharge' : `Charge (${weekInBlock}/3)`}`,
      daysToRace,
      description: "Week-ends chocs (WEC) consécutifs pour développer la résistance neuromusculaire à la fatigue de l'ultra-trail."
    };
  }

  if (weekNumber <= 21) {
    return {
      phase: "SPECIFIQUE_PIC",
      weekNumber,
      isDeload,
      volumeFactor: isDeload ? 0.75 : (1.10 + weekInBlock * 0.05),
      label: `S${weekNumber} [Pic Mestachibo] - ${isDeload ? '⚠️ Décharge' : `Charge (${weekInBlock}/3)`}`,
      daysToRace,
      description: "Simulations de course : franchissement de blocs rocheux (simulation Mestachibo), portage des bâtons pliés sur sac 5L et nutrition à 60g glucides/h."
    };
  }

  return {
    phase: "AFFUTAGE",
    weekNumber,
    isDeload: true,
    volumeFactor: weekNumber === 22 ? 0.65 : 0.45,
    label: `S${weekNumber} [Affûtage J-${daysToRace}]`,
    daysToRace,
    description: "Baisse drastique de 50% du volume tout en maintenant la tonicité neuromusculaire pour maximiser les réserves de glycogène."
  };
}

export interface WorkoutTemplate {
  title: string;
  optional?: boolean;
  duration: number; // minutes
  locName: string;
  address: string | null;
  chainedAfterCourse: boolean;
  sportType: SportType;
  emoji: string;
  colorHex: string;
  colorId: string;
  description: string;
  targetHeartRate?: string;
  targetHeartRateRange?: [number, number];
  targetCadence?: string;
  targetElevationM?: number;
  nutritionAdvice?: string;
}

export function getDailyWorkoutPlan(
  dayOfWeek: number, // 0=Monday, ..., 6=Sunday
  hasChainedClass: boolean,
  saturdayHasIntensiveClass: boolean,
  ctx: PeriodizationContext,
  date: Date,
  options?: {
    hasPresentialClass?: boolean;
    hasOnlineClass?: boolean;
  },
  config: Readonly<AppConfig> = GLOBAL_APP_CONFIG
): WorkoutTemplate {
  const GLOBAL_APP_CONFIG = config;
  const isDeload = ctx.isDeload;
  const month = date.getMonth();
  const isWinter = (month === 0 || month === 1 || month === 2);
  const heartRateZones = calculateHeartRateZones(config.ATHLETE_FC_MAX, config.ATHLETE_FC_REST);
  const easyRange = heartRateZones.zone2;
  const hillRange: [number, number] = [heartRateZones.zone4[0], heartRateZones.zone5[0]];
  const recoveryCeiling = heartRateZones.zone2[0] + 1;

  let durationTuesday = Math.round(55 + (ctx.weekNumber * 1.5) * ctx.volumeFactor);
  let durationThursday = Math.round(45 * ctx.volumeFactor);
  let durationSaturdayLong = Math.round((105 + (ctx.weekNumber * 4.5)) * ctx.volumeFactor);
  let durationSunday = Math.round((60 + (ctx.weekNumber * 1.2)) * ctx.volumeFactor);

  if (ctx.phase === "FONDATION_RAMP_1") {
    durationTuesday = 45;
    durationThursday = 35;
    durationSaturdayLong = 75;  // 1h15
    durationSunday = 0;         // Full rest on W1
  } else if (ctx.phase === "FONDATION_RAMP_2") {
    durationTuesday = 45;       // Montée de charge lissée (+15-20% max vs S1)
    durationThursday = 35;
    durationSaturdayLong = 85;  // 1h25
    durationSunday = 30;        // Reprise douce du dimanche (recup active)
  } else if (ctx.phase === "FONDATION_RAMP_3") {
    durationTuesday = 50;
    durationThursday = 40;
    durationSaturdayLong = 100; // 1h40
    durationSunday = 35;
  } else if (ctx.phase === "FONDATION") {
    durationTuesday = 55;
    durationThursday = 45;
    durationSaturdayLong = 115; // 1h55
    durationSunday = 45;
  }

  // Ratio vertical progressif : D+ modéré en reprise et dense en phase spécifique
  let elevationFactor = 5.0;
  if (ctx.phase === "FONDATION_RAMP_1") elevationFactor = 4.0;
  else if (ctx.phase === "FONDATION_RAMP_2") elevationFactor = 4.2;
  else if (ctx.phase === "FONDATION_RAMP_3") elevationFactor = 4.5;
  else if (ctx.phase === "FONDATION") elevationFactor = 4.8;
  else if (ctx.phase === "VOLUME_WEC_1" || ctx.phase === "SPECIFIQUE_PIC") elevationFactor = 5.5;

  const targetElevationSaturday = Math.round(durationSaturdayLong * elevationFactor);

  // This template reserves no fixed strength appointment. The calendar adds
  // separate, movable strength recommendations around classes and key runs.
  const flexibleStrengthDay: WorkoutTemplate = {
    title: "Renforcement flexible (créneau à choisir)",
    duration: 0,
    locName: "Lieu au choix",
    address: null,
    chainedAfterCourse: false,
    sportType: "MOBILITY",
    emoji: "🧘",
    colorHex: COLOR_MAP.MOBILITY.colorHex,
    colorId: COLOR_MAP.MOBILITY.colorId,
    description: "Objectif hebdomadaire : 3 séances de renforcement, une 4e facultative selon la récupération. Choisir les jours et consigner les séances réalisées.",
  };

  switch (dayOfWeek) {
    case 0: // Monday: no fixed strength appointment
      return flexibleStrengthDay;

    case 1: // Tuesday (Hills D+)
      if (isWinter) {
        return {
          title: "Winter Indoor Trail: Incline Treadmill D+ (ÉTS Gym)",
          duration: durationTuesday,
          locName: "ÉTS Gym (Treadmill D+)",
          address: GLOBAL_APP_CONFIG.ETS_ADDRESS,
          chainedAfterCourse: false,
          sportType: "TRAIL_INTENSE",
          emoji: COLOR_MAP.TRAIL_INTENSE.emoji,
          colorHex: COLOR_MAP.TRAIL_INTENSE.colorHex,
          colorId: COLOR_MAP.TRAIL_INTENSE.colorId,
          description: `• Tapis incliné : 15 min d'échauffement progressif, puis répétitions en pente selon l'aisance et la technique ; retour au calme.\n• Ajuster pente et vitesse à l'effort perçu, sans imposer une vitesse ou une FC absolue.\n• Le renforcement des jambes est une séance flexible distincte, à placer selon la récupération.`,
          targetHeartRate: "Effort tonique en côte (Zone 4/5)",
          targetHeartRateRange: hillRange,
          // Indoor elevation depends on actual speed and incline; do not invent it.
          targetElevationM: undefined
        };
      }
      return {
        title: "Trail: Hill Repeats D+ (Mont-Royal)",
        duration: durationTuesday,
        locName: "Mont Royal",
        address: GLOBAL_APP_CONFIG.MOUNT_ROYAL_ADDRESS,
        chainedAfterCourse: false,
        sportType: "TRAIL_INTENSE",
        emoji: COLOR_MAP.TRAIL_INTENSE.emoji,
        colorHex: COLOR_MAP.TRAIL_INTENSE.colorHex,
        colorId: COLOR_MAP.TRAIL_INTENSE.colorId,
        description: `• 15 min d'échauffement + ${isDeload ? '1 série de 5 × 1 min en côte' : 'jusqu’à 2 séries de 5 × 1 min en côte'} avec récupérations faciles + 10 min de retour au calme.\n• Effort contrôlé ; réduire la séance si la récupération ou la technique se dégrade.\n• Le renforcement des jambes reste une séance flexible distincte.`,
        targetHeartRate: "Effort tonique en côte (Zone 4/5)",
        targetHeartRateRange: hillRange,
        targetElevationM: 380
      };

    case 2: // Wednesday: no fixed strength appointment
      return flexibleStrengthDay;

    case 3: // Thursday (Easy Aerobic Base Run)
      return {
        title: "Running: Easy Aerobic Base Run Z2",
        duration: durationThursday,
        locName: "Neighborhood / Maisonneuve Park",
        address: GLOBAL_APP_CONFIG.HOME_ADDRESS,
        chainedAfterCourse: false,
        sportType: "RUN_EASY",
        emoji: COLOR_MAP.RUN_EASY.emoji,
        colorHex: COLOR_MAP.RUN_EASY.colorHex,
        colorId: COLOR_MAP.RUN_EASY.colorId,
        description: `• ${durationThursday} min en aisance respiratoire ; ralentir ou alterner marche et course si nécessaire.\n• Option tapis à pente faible si les conditions extérieures sont défavorables.\n• Le vélo facile peut remplacer ponctuellement ce footing pour varier la contrainte mécanique, sans équivalence garantie avec la course.`,
        targetHeartRate: "Endurance fondamentale (Zone 2)",
        targetHeartRateRange: easyRange,
        targetCadence: undefined
      };

    case 4: // Friday: no fixed strength appointment
      return flexibleStrengthDay;

    case 5: // Saturday (Long Run D+)
      if (saturdayHasIntensiveClass) {
        if (hasChainedClass) {
          return {
            title: "Running: Active Recovery Treadmill (Direct ÉTS)",
            duration: 35,
            locName: "ÉTS Gym (Treadmill)",
            address: GLOBAL_APP_CONFIG.ETS_ADDRESS,
            chainedAfterCourse: true,
            sportType: "RUN_EASY",
            emoji: COLOR_MAP.RUN_EASY.emoji,
            colorHex: COLOR_MAP.RUN_EASY.colorHex,
            colorId: COLOR_MAP.RUN_EASY.colorId,
            description: `• 30-35 min light flush on treadmill at ÉTS gym right after class (Zone 1 easy, HR < ${recoveryCeiling} bpm).`,
            targetHeartRate: `< ${recoveryCeiling} bpm (Zone 1 recovery)`
          };
        }
        return {
          title: "Running: Active Recovery (Neighborhood / Maisonneuve)",
          duration: 35,
          locName: "Neighborhood / Maisonneuve Park",
          address: GLOBAL_APP_CONFIG.HOME_ADDRESS,
          chainedAfterCourse: false,
          sportType: "RUN_EASY",
          emoji: COLOR_MAP.RUN_EASY.emoji,
          colorHex: COLOR_MAP.RUN_EASY.colorHex,
          colorId: COLOR_MAP.RUN_EASY.colorId,
          description: `• 30-35 min light recovery jog in conversational pace starting from home post-class (Zone 1 easy, HR < ${recoveryCeiling} bpm).`,
          targetHeartRate: `< ${recoveryCeiling} bpm (Zone 1 recovery)`
        };
      }
      return {
        title: `${isWinter ? 'Sortie longue hivernale' : 'Trail: Rando-Course D+'} (${Math.floor(durationSaturdayLong / 60)}h${(durationSaturdayLong % 60).toString().padStart(2, '0')})`,
        duration: durationSaturdayLong,
        locName: isWinter ? "Maisonneuve Park / Plowed Paths" : "Mont Royal",
        address: isWinter ? GLOBAL_APP_CONFIG.HOME_ADDRESS : GLOBAL_APP_CONFIG.MOUNT_ROYAL_ADDRESS,
        chainedAfterCourse: false,
        sportType: "TRAIL_LONG",
        emoji: COLOR_MAP.TRAIL_LONG.emoji,
        colorHex: COLOR_MAP.TRAIL_LONG.colorHex,
        colorId: COLOR_MAP.TRAIL_LONG.colorId,
        description: isWinter
          ? `• Sortie longue facile sur parcours déneigé et non glissant ; adapter l'effort aux conditions réelles.\n• Maintenir une aisance respiratoire et vérifier l'état des appuis.\n• Tester l'alimentation et la boisson selon la durée, la température et la tolérance personnelle.`
          : `• Rando-course QMT : alterner marche active en montée et course souple quand l'appui le permet.\n• Descendre de façon contrôlée ; réduire le dénivelé si courbatures ou technique dégradée.\n• Cible : endurance confortable (zone 2 indicative).\n• Tester l'alimentation et l'hydratation en conditions proches de la course selon la tolérance individuelle.`,
        targetHeartRate: "Zone 2 Rando-Course",
        targetHeartRateRange: easyRange,
        targetElevationM: isWinter ? 0 : targetElevationSaturday,
        nutritionAdvice: "Tester progressivement glucides et hydratation selon durée, chaleur et tolérance"
      };

    case 6: // Sunday (Back-to-Back or Rest W1)
      if (ctx.phase === "FONDATION_RAMP_1") {
        return {
          title: "Rest & Active Recovery (Ramp-up W1)",
          duration: 0,
          locName: "Home",
          address: null,
          chainedAfterCourse: false,
          sportType: "MOBILITY",
          emoji: "🛌",
          colorHex: "#64748b",
          colorId: "8",
          description: "Full rest in adaptation week 1. Hydration and recovery sleep.",
          targetHeartRate: "Rest"
        };
      }
      if (saturdayHasIntensiveClass) {
        return {
          title: `${isWinter ? 'Sortie longue hivernale reportée' : 'Trail: Rando-Course D+ reportée'} (${Math.floor(durationSaturdayLong / 60)}h${(durationSaturdayLong % 60).toString().padStart(2, '0')})`,
          duration: durationSaturdayLong,
          locName: isWinter ? "Maisonneuve Park / Plowed Paths" : "Mont Royal",
          address: isWinter ? GLOBAL_APP_CONFIG.HOME_ADDRESS : GLOBAL_APP_CONFIG.MOUNT_ROYAL_ADDRESS,
          chainedAfterCourse: false,
          sportType: "TRAIL_LONG",
          emoji: COLOR_MAP.TRAIL_LONG.emoji,
          colorHex: COLOR_MAP.TRAIL_LONG.colorHex,
          colorId: COLOR_MAP.TRAIL_LONG.colorId,
          description: `• Sortie longue décalée au dimanche suite aux cours intensifs du samedi.\n• ${isWinter ? 'Choisir un parcours déneigé, stable et facile.' : 'Marcher activement en montée et maîtriser les descentes.'}\n• Garder une aisance respiratoire et tester l'alimentation selon la tolérance.`,
          targetHeartRate: "Zone 2 Rando-Course",
          targetHeartRateRange: easyRange,
          targetElevationM: isWinter ? 0 : targetElevationSaturday,
          nutritionAdvice: "Tester progressivement glucides et hydratation selon les conditions"
        };
      }
      const optionalSunday = true;
      return {
        title: `${optionalSunday ? 'Optionnel : ' : ''}Trail: Fatigued / Rolling Run (${durationSunday} min)`,
        optional: optionalSunday,
        duration: durationSunday,
        locName: isWinter ? "Neighborhood" : "Mont Royal / Neighborhood",
        address: isWinter ? GLOBAL_APP_CONFIG.HOME_ADDRESS : GLOBAL_APP_CONFIG.MOUNT_ROYAL_ADDRESS,
        chainedAfterCourse: false,
        sportType: "RUN_EASY",
        emoji: COLOR_MAP.RUN_EASY.emoji,
        colorHex: COLOR_MAP.RUN_EASY.colorHex,
        colorId: COLOR_MAP.RUN_EASY.colorId,
        description: `• ${durationSunday} min d'endurance facile. ${optionalSunday ? 'Séance facultative : à omettre si la récupération, la douleur ou le temps disponible ne le permet pas.' : 'Deuxième sortie de week-end spécifique, à revoir selon récupération.'}\n• Cible cardio : aisance respiratoire complète.`,
        targetHeartRate: "Endurance fondamentale (Zone 2)",
        targetHeartRateRange: easyRange,
        targetElevationM: Math.round(durationSunday * 2.5),
        targetCadence: undefined
      };

    default:
      return {
        title: "Rest",
        duration: 0,
        locName: "Home",
        address: null,
        chainedAfterCourse: false,
        sportType: "MOBILITY",
        emoji: "🛌",
        colorHex: "#64748b",
        colorId: "8",
        description: "Rest and recovery day."
      };
  }
}
