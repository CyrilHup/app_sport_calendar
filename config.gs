// ==========================================
// FICHIER : 0_Config.gs
// ==========================================

const _props = typeof PropertiesService !== 'undefined' ? PropertiesService.getScriptProperties() : null;

const GLOBAL_CONFIG = {
  // Configurable addresses (set via Project Settings > Script Properties)
  HOME_ADDRESS: (_props && _props.getProperty('HOME_ADDRESS')) || "123 Main Street, City, Country",
  ETS_ADDRESS: (_props && _props.getProperty('CAMPUS_ADDRESS')) || "University Campus, City, Country",
  MOUNT_ROYAL_ADDRESS: (_props && _props.getProperty('TRAIL_ADDRESS')) || "Mountain Trail Park, City, Country",
  
  // Academic iCal URL (set via Script Properties: ICAL_URL)
  ICAL_URL: (_props && _props.getProperty('ICAL_URL')) || "https://example.university.edu/calendar.ics",
  
  // Noms des agendas Google
  SCHOOL_CAL_NAME: "ÉTS - Cours",
  SPORTS_CAL_NAME: "Sports",
  
  // Réglages Cours ÉTS
  SCHOOL_SYNC_DAYS: 90,
  BUFFER_BEFORE_CLASS_MIN: 10,             // Arriver 10 min avant le début du cours
  BUFFER_AFTER_CLASS_MIN: 10,              // 10 min de battement pour sortir avant de prendre le bus/métro
  BUFFER_BETWEEN_CLASS_AND_SPORT_MIN: 10,  // 10 min pour aller aux vestiaires et se changer
  GENERATE_SCHOOL_ALLER: true,
  GENERATE_SCHOOL_RETOUR: true,

  // Réglages Programme Sportif
  SPORT_START_DATE: "2026-09-01",
  SPORTS_SYNC_DAYS: 120,
  TARGET_HOME_RETURN_HOUR: 13,    // Retour à la maison à 13h00 les matins
  TARGET_HOME_RETURN_MIN: 0,
  
  // Périodisation QMT-80 2027
  PLAN_START_DATE: "2027-01-11",
  RACE_DATE: "2027-07-03",
  
  // Transports
  TRANSIT_MODE: typeof Maps !== "undefined" ? Maps.DirectionFinder.Mode.TRANSIT : "TRANSIT",
  DEFAULT_TRANSIT_MIN: 35,
  TIMEZONE: "America/Toronto",

  // --- NOTIFICATIONS OPÉRATIONNELLES (en minutes avant l'événement) ---
  REMINDERS: {
    DEPART_TRAJET: [15],   // 15 min avant le départ du bus/métro
    COURS_LOCAL: [10],     // 10 min avant le cours (check du local)
    FOOTING_MAISON: [10],  // 10 min avant de partir courir depuis le domicile
    CHAINED_SPORT: [5],    // 5 min avant la fin du cours (pour transition gym direct)
    MOBILITE_SOIR: [10]    // 10 min avant la routine du soir (21h50)
  }
};

const CONFIG_RULES = {
  TYPES: {
    EXAM:        { emoji: "📝", prefix: "[EXAMEN]",     colorId: "11" },
    LAB_TP:      { emoji: "🔬", prefix: "[TP/LAB]",      colorId: "2"  },
    COURS_PRES:  { emoji: "🏛️", prefix: "[COURS]",      colorId: "9"  },
    COURS_DIST:  { emoji: "💻", prefix: "[DISTANCIEL]", colorId: "3"  },
    TRAJET:      { emoji: "🚌", prefix: "[TRAJET]",     colorId: "8"  },
    AUTRE:       { emoji: "📅", prefix: "[ÉTS]",        colorId: "8"  }
  },
  SPORTS: {
    TRAIL_LONG:    { emoji: "🏔️", colorId: "6" },
    TRAIL_INTENSE: { emoji: "⚡", colorId: "11" },
    RUN_EASY:      { emoji: "🏃", colorId: "5" },
    CALISTHENICS:  { emoji: "🤸", colorId: "7" },
    GYM_FORCE:     { emoji: "🏋️", colorId: "10" },
    MOBILITY:      { emoji: "🧘", colorId: "3" },
    TRAVEL:        { emoji: "🚶‍♂️", colorId: "8" },
    RACE_DAY:      { emoji: "🏁", colorId: "11" }
  }
};