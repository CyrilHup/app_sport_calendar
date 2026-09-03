import { CalendarEvent, PeriodizationContext, SportType } from '../types/calendar';

const getEnvVal = (key: string, fallback: string = ''): string => {
  return (import.meta as any).env?.[key] || (globalThis as any).process?.env?.[key] || fallback;
};

export const GLOBAL_APP_CONFIG = {
  HOME_ADDRESS: getEnvVal('VITE_HOME_ADDRESS', 'Home'),
  ETS_ADDRESS: getEnvVal('VITE_CAMPUS_ADDRESS', 'Campus'),
  MOUNT_ROYAL_ADDRESS: getEnvVal('VITE_TRAIL_ADDRESS', 'Trail Park'),
  ICAL_URL: getEnvVal('VITE_ICAL_FEED_URL', ''),
  SPORT_START_DATE: getEnvVal('VITE_SPORT_START_DATE', '2026-09-01'),
  PLAN_START_DATE: getEnvVal('VITE_PLAN_START_DATE', '2027-01-11'),
  RACE_DATE: getEnvVal('VITE_TARGET_RACE_DATE', '2027-07-03'),
  TIMEZONE: "America/Toronto",
  TARGET_HOME_RETURN_HOUR: 13,
  TARGET_HOME_RETURN_MIN: 0,
  BUFFER_BEFORE_CLASS_MIN: 10,
  BUFFER_AFTER_CLASS_MIN: 10,
  BUFFER_BETWEEN_CLASS_AND_SPORT_MIN: 10,
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

export const COLOR_MAP = {
  TRAIL_LONG: { emoji: "🏔️", colorHex: "#ff6b35", colorId: "6", bgGlow: "rgba(255, 107, 53, 0.2)" },
  TRAIL_INTENSE: { emoji: "⚡", colorHex: "#f72585", colorId: "11", bgGlow: "rgba(247, 37, 133, 0.2)" },
  RUN_EASY: { emoji: "🏃", colorHex: "#4cc9f0", colorId: "5", bgGlow: "rgba(76, 201, 240, 0.2)" },
  CALISTHENICS: { emoji: "🤸", colorHex: "#7209b7", colorId: "7", bgGlow: "rgba(114, 9, 183, 0.2)" },
  GYM_FORCE: { emoji: "🏋️", colorHex: "#4361ee", colorId: "10", bgGlow: "rgba(67, 97, 238, 0.2)" },
  MOBILITY: { emoji: "🧘", colorHex: "#06d6a0", colorId: "3", bgGlow: "rgba(6, 214, 160, 0.2)" },
  TRAVEL: { emoji: "🚌", colorHex: "#94a3b8", colorId: "8", bgGlow: "rgba(148, 163, 184, 0.2)" },
  RACE_DAY: { emoji: "🏁", colorHex: "#e63946", colorId: "11", bgGlow: "rgba(230, 57, 70, 0.3)" },
  COURSE: { emoji: "🏛️", colorHex: "#3b82f6", colorId: "9", bgGlow: "rgba(59, 130, 246, 0.2)" },
  TP: { emoji: "🔬", colorHex: "#10b981", colorId: "2", bgGlow: "rgba(16, 185, 129, 0.2)" },
  EXAM: { emoji: "📝", colorHex: "#ef4444", colorId: "11", bgGlow: "rgba(239, 68, 68, 0.2)" }
};

export function getPeriodizationContext(date: Date): PeriodizationContext {
  const planStart = new Date(GLOBAL_APP_CONFIG.PLAN_START_DATE + "T00:00:00");
  const raceDay = new Date(GLOBAL_APP_CONFIG.RACE_DATE + "T00:00:00");

  const diffFromStartDays = Math.floor((date.getTime() - planStart.getTime()) / (24 * 3600 * 1000));
  const daysToRace = Math.floor((raceDay.getTime() - date.getTime()) / (24 * 3600 * 1000));

  // --- FALL 2026 (Foundation Phase & September Ramp-up) ---
  if (diffFromStartDays < 0) {
    const ramp1End = new Date("2026-09-07T00:00:00");
    const ramp2End = new Date("2026-09-14T00:00:00");
    const ramp3End = new Date("2026-09-21T00:00:00");

    if (date < ramp1End) {
      return {
        phase: "FONDATION_RAMP_1",
        weekNumber: 0,
        isDeload: false,
        volumeFactor: 0.55,
        label: "Foundation: Ramp-up W1 (~55%)",
        daysToRace,
        description: "Smooth progressive resumption post-rest. Zero excessive intensity; focus on aerobic base and tendon strengthening."
      };
    }
    if (date < ramp2End) {
      return {
        phase: "FONDATION_RAMP_2",
        weekNumber: 0,
        isDeload: false,
        volumeFactor: 0.75,
        label: "Foundation: Ramp-up W2 (~75%)",
        daysToRace,
        description: "Volume ramp-up. Introduction of controlled hill climb repeats."
      };
    }
    if (date < ramp3End) {
      return {
        phase: "FONDATION_RAMP_3",
        weekNumber: 0,
        isDeload: false,
        volumeFactor: 0.90,
        label: "Foundation: Ramp-up W3 (~90%)",
        daysToRace,
        description: "Consolidation of full autumn volume. Weekend long runs stabilized."
      };
    }
    return {
      phase: "FONDATION",
      weekNumber: 0,
      isDeload: false,
      volumeFactor: 0.85,
      label: "Foundation Phase (Autumn 2026)",
      daysToRace,
      description: "Solid aerobic engine, calisthenics upper body strength and regular Mont-Royal elevation gain."
    };
  }

  // --- QMT-80 2027 SPECIFIC TRAINING BLOCKS ---
  if (daysToRace <= 6 && daysToRace >= 0) {
    return {
      phase: "RACE_WEEK",
      weekNumber: 24,
      isDeload: true,
      volumeFactor: 0.30,
      label: "Race Week — QMT-80 🏁",
      daysToRace,
      description: "Active recovery, peak freshness, high carb loading protocol and mandatory gear check."
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
      label: `W${weekNumber} [Winter Power & Hills] - ${isDeload ? '⚠️ Deload' : `Build (${weekInBlock}/3)`}`,
      daysToRace,
      description: "Winter block: incline treadmill hill repeats (ÉTS Gym) and posterior chain eccentric quad bulletproofing."
    };
  }

  if (weekNumber <= 16) {
    return {
      phase: "VOLUME_WEC_1",
      weekNumber,
      isDeload,
      volumeFactor: isDeload ? 0.75 : (0.95 + weekInBlock * 0.05),
      label: `W${weekNumber} [Volume & Back-to-Back] - ${isDeload ? '⚠️ Deload' : `Build (${weekInBlock}/3)`}`,
      daysToRace,
      description: "Back-to-back weekend shocks (WEC) to condition neuromuscular tolerance to ultra-trail fatigue."
    };
  }

  if (weekNumber <= 21) {
    return {
      phase: "SPECIFIQUE_PIC",
      weekNumber,
      isDeload,
      volumeFactor: isDeload ? 0.75 : (1.10 + weekInBlock * 0.05),
      label: `W${weekNumber} [Mestachibo Peak] - ${isDeload ? '⚠️ Deload' : `Build (${weekInBlock}/3)`}`,
      daysToRace,
      description: "Specific race simulations: technical boulder scrambling (Mestachibo simulation), running with poles stowed on 5L vest, 60g carbs/h race fueling."
    };
  }

  return {
    phase: "AFFUTAGE",
    weekNumber,
    isDeload: true,
    volumeFactor: weekNumber === 22 ? 0.65 : 0.45,
    label: `W${weekNumber} [Tapering D-${daysToRace}]`,
    daysToRace,
    description: "Drastic 50% volume drop while maintaining sharp neuromuscular turnover for maximum glycogen storage."
  };
}

export interface WorkoutTemplate {
  title: string;
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
  date: Date
): WorkoutTemplate {
  const isDeload = ctx.isDeload;
  const setsNote = isDeload ? "(Deload: 2 maintenance sets, 0 failure)" : "(Build: 4 working sets)";
  const month = date.getMonth();
  const isWinter = (month === 0 || month === 1 || month === 2);

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
    durationTuesday = 50;
    durationThursday = 40;
    durationSaturdayLong = 95;  // 1h35
    durationSunday = 40;
  } else if (ctx.phase === "FONDATION_RAMP_3") {
    durationTuesday = 55;
    durationThursday = 45;
    durationSaturdayLong = 110; // 1h50
    durationSunday = 50;
  } else if (ctx.phase === "FONDATION") {
    durationTuesday = 60;
    durationThursday = 50;
    durationSaturdayLong = 120; // 2h00
    durationSunday = 65;
  }

  const renfoTuesdayMin = ctx.phase === "FONDATION_RAMP_1" ? 15 : 20;

  switch (dayOfWeek) {
    case 0: // Monday
      return {
        title: "Calisthenics 1 (Push & Core)",
        duration: isDeload ? 45 : 65,
        locName: "ÉTS Gym",
        address: GLOBAL_APP_CONFIG.ETS_ADDRESS,
        chainedAfterCourse: false,
        sportType: "CALISTHENICS",
        emoji: COLOR_MAP.CALISTHENICS.emoji,
        colorHex: COLOR_MAP.CALISTHENICS.colorHex,
        colorId: COLOR_MAP.CALISTHENICS.colorId,
        description: `• Dips: ${isDeload ? '2x6' : '4x6-8'}\n• Pike Push-ups / HSPU prog: ${isDeload ? '2x6' : '4x6'}\n• Gymnastic rings push-ups: ${isDeload ? '2x10' : '3x12'}\n• Core: Hollow body hold (3x45s), Hanging leg raises.\n\n📌 ${setsNote}`,
        targetHeartRate: "Zone 1-2 (Neuromuscular recovery)"
      };

    case 1: // Tuesday (Hills D+ & Leg Strengthening)
      if (isWinter) {
        return {
          title: "Winter Indoor Trail: Incline Treadmill D+ (ÉTS Gym)",
          duration: durationTuesday + renfoTuesdayMin,
          locName: "ÉTS Gym (Treadmill D+ & Weight Room)",
          address: GLOBAL_APP_CONFIG.ETS_ADDRESS,
          chainedAfterCourse: false,
          sportType: "TRAIL_INTENSE",
          emoji: COLOR_MAP.TRAIL_INTENSE.emoji,
          colorHex: COLOR_MAP.TRAIL_INTENSE.colorHex,
          colorId: COLOR_MAP.TRAIL_INTENSE.colorId,
          description: `❄️ WINTER SAFETY (Incline treadmill):\n• 15' flat warm-up\n• Hill intervals 12-15% incline (5.5 - 6.5 km/h) — Target HR: 172-190 bpm (Zone 4/5)\n• Post-hill leg strength (${renfoTuesdayMin} min):\n  - Tempo squats (3s descent): ${isDeload ? '2x8' : '4x8'}\n  - Bulgarian split squats: ${isDeload ? '2x8' : '3x10'}\n  - Unilateral calf raises: ${isDeload ? '2x12' : '4x15'}`,
          targetHeartRate: "172 - 190 bpm (Zone 4/5)",
          targetHeartRateRange: [172, 190],
          targetElevationM: 400
        };
      }
      return {
        title: "Trail: Hill Repeats D+ (Mont-Royal) + Leg Strength",
        duration: durationTuesday + renfoTuesdayMin,
        locName: "Mont Royal",
        address: GLOBAL_APP_CONFIG.MOUNT_ROYAL_ADDRESS,
        chainedAfterCourse: false,
        sportType: "TRAIL_INTENSE",
        emoji: COLOR_MAP.TRAIL_INTENSE.emoji,
        colorHex: COLOR_MAP.TRAIL_INTENSE.colorHex,
        colorId: COLOR_MAP.TRAIL_INTENSE.colorId,
        description: `• 15' warm-up + ${isDeload ? '1 set of 5x 1\' hill' : '2 sets of (5x 1\' hill, easy jog descent)'} + 10' cool-down.\n• Uphill target: HR 172-190 bpm (Zone 4/5).\n• Post-hill leg strength (${renfoTuesdayMin} min): Bulgarian split squats, tempo squats and calf raises for eccentric quad resistance.`,
        targetHeartRate: "172 - 190 bpm (Zone 4/5)",
        targetHeartRateRange: [172, 190],
        targetElevationM: 380
      };

    case 2: // Wednesday
      return {
        title: "Calisthenics 2 (Pull & Core - Zero Leg Impact)",
        duration: isDeload ? 45 : 65,
        locName: "ÉTS Gym",
        address: GLOBAL_APP_CONFIG.ETS_ADDRESS,
        chainedAfterCourse: false,
        sportType: "GYM_FORCE",
        emoji: COLOR_MAP.GYM_FORCE.emoji,
        colorHex: COLOR_MAP.GYM_FORCE.colorHex,
        colorId: COLOR_MAP.GYM_FORCE.colorId,
        description: `• Strict pull-ups: ${isDeload ? '2x6' : '4x6-8'}\n• Muscle-up / progression: ${isDeload ? '2x3' : '4x3-5'}\n• Horizontal rows / Front lever prog: ${isDeload ? '2x8' : '3x10'}\n• L-sit hold: 4x20s\n\n🛡️ Zero leg impact (Post-hill recovery).`,
        targetHeartRate: "Zone 1 (Pure strength)"
      };

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
        description: `• ${durationThursday} min strictly in conversational aerobic pace.\n• Cardio target: HR < 148 bpm (optimal 138-145 bpm, 100% nasal breathing possible).\n• Biomechanics cue: Keep high cadence (170-175 spm) with light, short steps right under the hips.`,
        targetHeartRate: "< 148 bpm (Zone 1/2 easy)",
        targetHeartRateRange: [130, 148],
        targetCadence: "170 - 175 spm"
      };

    case 4: // Friday
      if (hasChainedClass) {
        return {
          title: "Calisthenics 3: Skills & Mobility (Direct ÉTS Gym)",
          duration: 45,
          locName: "ÉTS Gym",
          address: GLOBAL_APP_CONFIG.ETS_ADDRESS,
          chainedAfterCourse: true,
          sportType: "CALISTHENICS",
          emoji: COLOR_MAP.CALISTHENICS.emoji,
          colorHex: COLOR_MAP.CALISTHENICS.colorHex,
          colorId: COLOR_MAP.CALISTHENICS.colorId,
          description: "• Straight to gym post-class.\n• Handstand hold, shoulder mobility and core stability.",
          targetHeartRate: "Zone 1-2 (Mobility & Technique)"
        };
      }
      return {
        title: "Calisthenics 3 (Handstand & Skills)",
        duration: isDeload ? 40 : 60,
        locName: "ÉTS Gym",
        address: GLOBAL_APP_CONFIG.ETS_ADDRESS,
        chainedAfterCourse: false,
        sportType: "CALISTHENICS",
        emoji: COLOR_MAP.CALISTHENICS.emoji,
        colorHex: COLOR_MAP.CALISTHENICS.colorHex,
        colorId: COLOR_MAP.CALISTHENICS.colorId,
        description: `• Handstand hold & free balance (${isDeload ? '15 min' : '25 min'})\n• L-sit / V-sit: ${isDeload ? '2x15s' : '4x20s'}`,
        targetHeartRate: "Zone 1-2 (Balance & Core)"
      };

    case 5: // Saturday (Long Run D+)
      if (saturdayHasIntensiveClass) {
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
          description: "• 30-35 min light flush on treadmill at ÉTS gym right after class (Zone 1 easy, HR < 142 bpm).",
          targetHeartRate: "< 142 bpm (Zone 1 recovery)"
        };
      }
      return {
        title: `Trail: Long Run D+ (${Math.floor(durationSaturdayLong / 60)}h${(durationSaturdayLong % 60).toString().padStart(2, '0')})`,
        duration: durationSaturdayLong,
        locName: isWinter ? "Maisonneuve Park / Plowed Trails" : "Mont Royal",
        address: isWinter ? GLOBAL_APP_CONFIG.HOME_ADDRESS : GLOBAL_APP_CONFIG.MOUNT_ROYAL_ADDRESS,
        chainedAfterCourse: false,
        sportType: "TRAIL_LONG",
        emoji: COLOR_MAP.TRAIL_LONG.emoji,
        colorHex: COLOR_MAP.TRAIL_LONG.colorHex,
        colorId: COLOR_MAP.TRAIL_LONG.colorId,
        description: `• Core pillar workout for QMT-80.\n• Cardio Target: HR < 155 bpm (Zone 2 Endurance).\n• Cue: Run-hike technique (power hike as soon as slope exceeds 8-10% to protect cardio).\n• Fueling: 50-60g carbs/h + 500 mL water with electrolytes/h.`,
        targetHeartRate: "< 155 bpm (Zone 2 Endurance)",
        targetHeartRateRange: [135, 155],
        targetElevationM: Math.round(durationSaturdayLong * 5.5),
        nutritionAdvice: "50-60g carbs/h + 500 mL water with electrolytes/h"
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
          title: `Trail: Long Run D+ (${Math.floor(durationSaturdayLong / 60)}h${(durationSaturdayLong % 60).toString().padStart(2, '0')})`,
          duration: durationSaturdayLong,
          locName: isWinter ? "Maisonneuve Park / Plowed Paths" : "Mont Royal",
          address: isWinter ? GLOBAL_APP_CONFIG.HOME_ADDRESS : GLOBAL_APP_CONFIG.MOUNT_ROYAL_ADDRESS,
          chainedAfterCourse: false,
          sportType: "TRAIL_LONG",
          emoji: COLOR_MAP.TRAIL_LONG.emoji,
          colorHex: COLOR_MAP.TRAIL_LONG.colorHex,
          colorId: COLOR_MAP.TRAIL_LONG.colorId,
          description: `• Long run shifted to Sunday following Saturday's intensive class (home return by 1:00 PM).\n• Target: HR < 155 bpm + nutrition 50-60g carbs/h.`,
          targetHeartRate: "< 155 bpm (Zone 2 Endurance)",
          targetHeartRateRange: [135, 155],
          targetElevationM: Math.round(durationSaturdayLong * 5.5),
          nutritionAdvice: "50-60g carbs/h + 500 mL electrolytes/h"
        };
      }
      return {
        title: `Trail: Fatigued / Rolling Run (${durationSunday} min)`,
        duration: durationSunday,
        locName: isWinter ? "Neighborhood" : "Mont Royal / Neighborhood",
        address: isWinter ? GLOBAL_APP_CONFIG.HOME_ADDRESS : GLOBAL_APP_CONFIG.MOUNT_ROYAL_ADDRESS,
        chainedAfterCourse: false,
        sportType: "RUN_EASY",
        emoji: COLOR_MAP.RUN_EASY.emoji,
        colorHex: COLOR_MAP.RUN_EASY.colorHex,
        colorId: COLOR_MAP.RUN_EASY.colorId,
        description: `• ${durationSunday} min aerobic endurance on fatigue from previous day (Back-to-back effect).\n• Cardio Target: HR < 148 bpm strict. Dynamic cadence 170-175 spm.`,
        targetHeartRate: "< 148 bpm (Zone 2 strict)",
        targetHeartRateRange: [130, 148],
        targetCadence: "170 - 175 spm"
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
