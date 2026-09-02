// ==========================================
// FICHIER : Utils.gs
// ==========================================

const STATIC_SPORT_TRANSIT = {
  "HOME_TO_ETS": 35,
  "ETS_TO_HOME": 35,
  "HOME_TO_MONT_ROYAL": 45,
  "MONT_ROYAL_TO_HOME": 45,
  "ETS_TO_MONT_ROYAL": 25,
  "MONT_ROYAL_TO_ETS": 25
};

function getMapsTravelMinutesCached(origin, destination, departureTime) {
  if (!origin || !destination || origin === destination) return 0;

  const isHomeOrigin = origin === GLOBAL_CONFIG.HOME_ADDRESS;
  const isHomeDest   = destination === GLOBAL_CONFIG.HOME_ADDRESS;
  const isEtsOrigin  = origin === GLOBAL_CONFIG.ETS_ADDRESS;
  const isEtsDest    = destination === GLOBAL_CONFIG.ETS_ADDRESS;
  const isMrOrigin   = origin === GLOBAL_CONFIG.MOUNT_ROYAL_ADDRESS;
  const isMrDest     = destination === GLOBAL_CONFIG.MOUNT_ROYAL_ADDRESS;

  if (isHomeOrigin && isEtsDest) return STATIC_SPORT_TRANSIT.HOME_TO_ETS;
  if (isEtsOrigin && isHomeDest) return STATIC_SPORT_TRANSIT.ETS_TO_HOME;
  if (isHomeOrigin && isMrDest) return STATIC_SPORT_TRANSIT.HOME_TO_MONT_ROYAL;
  if (isMrOrigin && isHomeDest) return STATIC_SPORT_TRANSIT.MONT_ROYAL_TO_HOME;
  if (isEtsOrigin && isMrDest) return STATIC_SPORT_TRANSIT.ETS_TO_MONT_ROYAL;
  if (isMrOrigin && isEtsDest) return STATIC_SPORT_TRANSIT.MONT_ROYAL_TO_ETS;

  return GLOBAL_CONFIG.DEFAULT_TRANSIT_MIN || 35;
}

let _mapsCircuitOpen = false;

function getValidGTFSSampleDate(futureDate) {
  const now = new Date();
  const dayOfWeek = futureDate.getDay();
  const currentDay = now.getDay();
  let daysToAdd = (dayOfWeek - currentDay + 7) % 7;
  if (daysToAdd === 0) daysToAdd = 7;

  const sampleDate = new Date(now);
  sampleDate.setDate(now.getDate() + daysToAdd);
  sampleDate.setHours(futureDate.getHours(), futureDate.getMinutes(), 0, 0);
  return sampleDate;
}

function getTransitScheduleForArrival(origin, destination, targetArrivalTime) {
  if (_mapsCircuitOpen) return buildFallbackArrival_(targetArrivalTime);

  const now = new Date();
  const daysDiff = (targetArrivalTime.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
  const queryTime = (daysDiff > 10) ? getValidGTFSSampleDate(targetArrivalTime) : targetArrivalTime;

  try {
    const directions = Maps.newDirectionFinder()
      .setOrigin(origin)
      .setDestination(destination)
      .setMode(GLOBAL_CONFIG.TRANSIT_MODE)
      .setArrive(queryTime)
      .getDirections();
    
    if (directions.routes && directions.routes.length > 0 && directions.routes[0].legs[0]) {
      const leg = directions.routes[0].legs[0];
      if (leg.departure_time && leg.arrival_time) {
        if (daysDiff > 10) {
          const durationMs = (leg.arrival_time.value - leg.departure_time.value) * 1000;
          const realEndTime = new Date(targetArrivalTime.getTime());
          const realStartTime = new Date(realEndTime.getTime() - durationMs);
          return { startTime: realStartTime, endTime: realEndTime };
        }
        return {
          startTime: new Date(leg.departure_time.value * 1000),
          endTime: new Date(leg.arrival_time.value * 1000)
        };
      }
    }
  } catch (e) {
    _mapsCircuitOpen = true;
  }

  return buildFallbackArrival_(targetArrivalTime);
}

function buildFallbackArrival_(targetArrivalTime) {
  const fallbackEnd = new Date(targetArrivalTime.getTime());
  const fallbackStart = new Date(fallbackEnd.getTime() - GLOBAL_CONFIG.DEFAULT_TRANSIT_MIN * 60 * 1000);
  return { startTime: fallbackStart, endTime: fallbackEnd };
}

function getTransitScheduleForDeparture(origin, destination, departureTime) {
  if (_mapsCircuitOpen) return buildFallbackDeparture_(departureTime);

  const now = new Date();
  const daysDiff = (departureTime.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
  const queryTime = (daysDiff > 10) ? getValidGTFSSampleDate(departureTime) : departureTime;

  try {
    const directions = Maps.newDirectionFinder()
      .setOrigin(origin)
      .setDestination(destination)
      .setMode(GLOBAL_CONFIG.TRANSIT_MODE)
      .setDepart(queryTime)
      .getDirections();
    
    if (directions.routes && directions.routes.length > 0 && directions.routes[0].legs[0]) {
      const leg = directions.routes[0].legs[0];
      if (leg.departure_time && leg.arrival_time) {
        if (daysDiff > 10) {
          const durationMs = (leg.arrival_time.value - leg.departure_time.value) * 1000;
          const realStartTime = new Date(departureTime.getTime());
          const realEndTime = new Date(realStartTime.getTime() + durationMs);
          return { startTime: realStartTime, endTime: realEndTime };
        }
        return {
          startTime: new Date(leg.departure_time.value * 1000),
          endTime: new Date(leg.arrival_time.value * 1000)
        };
      }
    }
  } catch (e) {
    _mapsCircuitOpen = true;
  }

  return buildFallbackDeparture_(departureTime);
}

function buildFallbackDeparture_(departureTime) {
  const fallbackStart = new Date(departureTime.getTime());
  const fallbackEnd = new Date(fallbackStart.getTime() + GLOBAL_CONFIG.DEFAULT_TRANSIT_MIN * 60 * 1000);
  return { startTime: fallbackStart, endTime: fallbackEnd };
}

function computeMD5Hash(text) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, text, Utilities.Charset.UTF_8);
  return digest.map(byte => (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, '0')).join('');
}

function formatTime(date) {
  return Utilities.formatDate(date, GLOBAL_CONFIG.TIMEZONE, "HH:mm");
}

function formatDate(date) {
  return Utilities.formatDate(date, GLOBAL_CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm");
}

function formatDateOnly(date) {
  return Utilities.formatDate(date, GLOBAL_CONFIG.TIMEZONE, "yyyy-MM-dd");
}

function analyzeETSEvent(ev) {
  const summary = ev.summary || "";
  const rawLoc = (ev.location || "").trim();
  const desc = ev.description || "";
  
  const courseMatch = summary.match(/([A-Z]{3,4}\d{3})/i);
  const courseCode = courseMatch ? courseMatch[1].toUpperCase() : "";
  
  // À l'ÉTS : cours avec section -50/-55 (ex. MTR801-55), mention distance, ou sans local assigné sont à distance (à la maison)
  const isDistanciel =
    rawLoc.toLowerCase().includes("distance") ||
    desc.toLowerCase().includes("distance") ||
    summary.includes("-55") ||
    summary.includes("-50") ||
    courseCode === "MTR801" ||
    !rawLoc ||
    rawLoc.toLowerCase() === "non spécifié";

  const cleanLocation = isDistanciel ? "À distance (Maison)" : (rawLoc || "ÉTS Campus");
  let isExam = summary.toLowerCase().includes("exam") || desc.toLowerCase().includes("examen") || summary.includes("(E)");
  let isTP = summary.includes("(TP)") || summary.includes("(LAB)") || desc.toLowerCase().includes("travaux pratiques");
  let isCours = summary.includes("(C)") || desc.toLowerCase().includes("activité de cours") || isDistanciel;

  let rule = CONFIG_RULES.TYPES.AUTRE;
  let activityType = "Activité";

  if (isExam) {
    rule = CONFIG_RULES.TYPES.EXAM;
    activityType = "Examen";
  } else if (isTP) {
    rule = CONFIG_RULES.TYPES.LAB_TP;
    activityType = "TP / Laboratoire";
  } else if (isCours) {
    if (isDistanciel) {
      rule = CONFIG_RULES.TYPES.COURS_DIST;
      activityType = "Cours à distance";
    } else {
      rule = CONFIG_RULES.TYPES.COURS_PRES;
      activityType = "Cours présentiel";
    }
  }

  let cleanTitle = summary;
  if (desc) {
    const parts = desc.split(" - ");
    if (parts.length > 1) cleanTitle = parts[1].trim();
  }

  return {
    courseCode: courseCode,
    activityType: activityType,
    typePrefix: rule.prefix,
    emoji: rule.emoji,
    colorId: rule.colorId,
    location: cleanLocation,
    cleanTitle: cleanTitle,
    description: desc,
    isDistanciel: isDistanciel
  };
}

function parseICS(icsContent) {
  const unfolded = icsContent.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);
  const events = [];
  let currentEvent = null;

  lines.forEach(line => {
    line = line.trim();
    if (line === "BEGIN:VEVENT") {
      currentEvent = {};
    } else if (line === "END:VEVENT" && currentEvent) {
      if (currentEvent.startDate && currentEvent.endDate) events.push(currentEvent);
      currentEvent = null;
    } else if (currentEvent && line.includes(":")) {
      const idx = line.indexOf(":");
      const key = line.substring(0, idx).split(";")[0];
      const value = line.substring(idx + 1);

      switch (key) {
        case "SUMMARY": currentEvent.summary = unescapeICS(value); break;
        case "LOCATION": currentEvent.location = unescapeICS(value); break;
        case "DESCRIPTION": currentEvent.description = unescapeICS(value); break;
        case "UID": currentEvent.uid = value; break;
        case "DTSTART": currentEvent.startDate = parseICSDate(value); break;
        case "DTEND": currentEvent.endDate = parseICSDate(value); break;
      }
    }
  });

  return events;
}

function parseICSDate(dateStr) {
  const y = parseInt(dateStr.substring(0, 4), 10);
  const m = parseInt(dateStr.substring(4, 6), 10) - 1;
  const d = parseInt(dateStr.substring(6, 8), 10);
  const h = parseInt(dateStr.substring(9, 11), 10) || 0;
  const min = parseInt(dateStr.substring(11, 13), 10) || 0;
  const s = parseInt(dateStr.substring(13, 15), 10) || 0;

  if (dateStr.endsWith("Z")) {
    return new Date(Date.UTC(y, m, d, h, min, s));
  }
  // Parsing avec verrouillage du fuseau local de Montréal
  if (typeof Utilities !== "undefined" && Utilities.formatDate) {
    const formattedIso = Utilities.formatDate(new Date(y, m, d, h, min, s), GLOBAL_CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
    return new Date(formattedIso);
  }
  return new Date(y, m, d, h, min, s);
}

function unescapeICS(str) {
  return str
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .replace(/\\[nN]/g, "\n");
}

function getOrCreateCalendar(name) {
  const cals = CalendarApp.getCalendarsByName(name);
  if (cals.length > 0) return cals[0];
  return CalendarApp.createCalendar(name);
}

function groupEventsByDate_(events) {
  const map = new Map();
  events.forEach(ev => {
    if (ev.isAllDayEvent()) return;
    const dateKey = formatDateOnly(ev.getStartTime());
    if (!map.has(dateKey)) map.set(dateKey, []);
    map.get(dateKey).push(ev);
  });
  return map;
}