import { CalendarEvent, DailySchedule } from '../types/calendar';
import { COLOR_MAP, GLOBAL_APP_CONFIG, getDailyWorkoutPlan, getPeriodizationContext } from './periodizationEngine';

export interface RawIcsEvent {
  uid: string;
  summary: string;
  location: string;
  description: string;
  startDate: Date;
  endDate: Date;
}

export function parseICSString(icsContent: string): RawIcsEvent[] {
  const unfolded = icsContent.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);
  const events: RawIcsEvent[] = [];
  let currentEvent: Partial<RawIcsEvent> | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "BEGIN:VEVENT") {
      currentEvent = {};
    } else if (line === "END:VEVENT" && currentEvent) {
      if (currentEvent.startDate && currentEvent.endDate && currentEvent.summary) {
        events.push(currentEvent as RawIcsEvent);
      }
      currentEvent = null;
    } else if (currentEvent && line.includes(":")) {
      const idx = line.indexOf(":");
      const key = line.substring(0, idx).split(";")[0];
      const value = line.substring(idx + 1);

      switch (key) {
        case "SUMMARY":
          currentEvent.summary = unescapeICS(value);
          break;
        case "LOCATION":
          currentEvent.location = unescapeICS(value);
          break;
        case "DESCRIPTION":
          currentEvent.description = unescapeICS(value);
          break;
        case "UID":
          currentEvent.uid = value;
          break;
        case "DTSTART":
          currentEvent.startDate = parseICSDate(value);
          break;
        case "DTEND":
          currentEvent.endDate = parseICSDate(value);
          break;
      }
    }
  }

  return events;
}

function parseICSDate(dateStr: string): Date {
  const y = parseInt(dateStr.substring(0, 4), 10);
  const m = parseInt(dateStr.substring(4, 6), 10) - 1;
  const d = parseInt(dateStr.substring(6, 8), 10);
  const h = parseInt(dateStr.substring(9, 11), 10) || 0;
  const min = parseInt(dateStr.substring(11, 13), 10) || 0;
  const s = parseInt(dateStr.substring(13, 15), 10) || 0;

  if (dateStr.endsWith("Z")) {
    return new Date(Date.UTC(y, m, d, h, min, s));
  }
  // Local Montreal date
  return new Date(y, m, d, h, min, s);
}

function unescapeICS(str: string): string {
  return str
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .replace(/\\[nN]/g, "\n");
}

export function analyzeETSEvent(ev: RawIcsEvent) {
  const summary = ev.summary || "";
  const rawLoc = (ev.location || "").trim();
  const desc = ev.description || "";

  const courseMatch = summary.match(/([A-Z]{3,4}\d{3})/i);
  const courseCode = courseMatch ? courseMatch[1].toUpperCase() : "";

  // At ÉTS: courses with section -50/-55 (e.g. MTR801-55), distance mention, or no room assigned are online (at home)
  const isDistanciel =
    rawLoc.toLowerCase().includes("distance") ||
    desc.toLowerCase().includes("distance") ||
    summary.includes("-55") ||
    summary.includes("-50") ||
    courseCode === "MTR801" ||
    !rawLoc ||
    rawLoc.toLowerCase() === "non spécifié" ||
    rawLoc.toLowerCase() === "unspecified";

  const cleanLocation = isDistanciel ? "Online (Home)" : (rawLoc || "ÉTS Campus");
  const isExam = summary.toLowerCase().includes("exam") || desc.toLowerCase().includes("examen") || summary.includes("(E)");
  const isTP = summary.includes("(TP)") || summary.includes("(LAB)") || desc.toLowerCase().includes("travaux pratiques");

  let typePrefix = "[CLASS]";
  let emoji = "🏛️";
  let color = COLOR_MAP.COURSE;

  if (isExam) {
    typePrefix = "[EXAM]";
    emoji = "📝";
    color = COLOR_MAP.EXAM;
  } else if (isTP) {
    typePrefix = "[LAB]";
    emoji = "🔬";
    color = COLOR_MAP.TP;
  } else if (isDistanciel) {
    typePrefix = "[ONLINE]";
    emoji = "💻";
    color = { emoji: "💻", colorHex: "#60a5fa", colorId: "3", bgGlow: "rgba(96, 165, 250, 0.2)" };
  }

  let cleanTitle = summary;
  if (desc) {
    const parts = desc.split(" - ");
    if (parts.length > 1) cleanTitle = parts[1].trim();
  }

  return {
    courseCode,
    isDistanciel,
    isExam,
    isTP,
    typePrefix,
    emoji,
    color,
    cleanTitle,
    room: cleanLocation
  };
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function buildCompleteCalendar(
  rawCourses: RawIcsEvent[],
  startDate: Date,
  daysCount: number = 60
): { schedules: DailySchedule[]; allEvents: CalendarEvent[] } {
  // Index courses by date key
  const coursesByDate = new Map<string, RawIcsEvent[]>();

  for (const course of rawCourses) {
    const key = formatDateKey(course.startDate);
    if (!coursesByDate.has(key)) coursesByDate.set(key, []);
    coursesByDate.get(key)!.push(course);
  }

  const schedules: DailySchedule[] = [];
  const allEvents: CalendarEvent[] = [];

  for (let i = 0; i < daysCount; i++) {
    const currentDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dateKey = formatDateKey(currentDate);
    const dayOfWeek = (currentDate.getDay() + 6) % 7; // 0=Lundi, ..., 6=Dimanche
    const periodContext = getPeriodizationContext(currentDate);

    const dayCourses = coursesByDate.get(dateKey) || [];
    dayCourses.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    // Check course attributes
    const hasCourse = dayCourses.length > 0;
    const presentialCourses = dayCourses.filter(c => {
      const meta = analyzeETSEvent(c);
      return !meta.isDistanciel;
    });

    // Saturday intensive check
    const satDate = new Date(currentDate);
    if (dayOfWeek === 6) satDate.setDate(satDate.getDate() - 1);
    const satKey = formatDateKey(satDate);
    const satCourses = coursesByDate.get(satKey) || [];
    const saturdayHasIntensive = satCourses.some(c => {
      const dur = (c.endDate.getTime() - c.startDate.getTime()) / (3600 * 1000);
      return dur >= 3.5 || c.summary.includes("MTR801");
    });

    // Chained class detection
    let chainedCourse: RawIcsEvent | null = null;
    if (dayOfWeek === 4) { // Friday
      chainedCourse = presentialCourses.find(c => {
        const endH = c.endDate.getHours();
        return endH >= 15 && endH <= 19;
      }) || null;
    } else if (dayOfWeek === 5) { // Saturday
      chainedCourse = presentialCourses.find(c => {
        const dur = (c.endDate.getTime() - c.startDate.getTime()) / (3600 * 1000);
        return dur >= 3.5 || c.summary.includes("MTR801");
      }) || null;
    }

    // Workout session
    const workoutTemplate = getDailyWorkoutPlan(
      dayOfWeek,
      Boolean(chainedCourse),
      saturdayHasIntensive,
      periodContext,
      currentDate
    );

    const dayEvents: CalendarEvent[] = [];

    // Add Course events
    for (const raw of dayCourses) {
      const meta = analyzeETSEvent(raw);
      const dur = Math.round((raw.endDate.getTime() - raw.startDate.getTime()) / 60000);

      const isFirstPresential = presentialCourses[0]?.uid === raw.uid;
      const isLastPresential = presentialCourses[presentialCourses.length - 1]?.uid === raw.uid;
      const transitMin = GLOBAL_APP_CONFIG.TRANSIT_TIMES.HOME_TO_ETS;

      const commuteAller = (!meta.isDistanciel && isFirstPresential) ? {
        departureTime: new Date(raw.startDate.getTime() - (GLOBAL_APP_CONFIG.BUFFER_BEFORE_CLASS_MIN + transitMin) * 60000).toISOString(),
        arrivalTime: new Date(raw.startDate.getTime() - GLOBAL_APP_CONFIG.BUFFER_BEFORE_CLASS_MIN * 60000).toISOString(),
        durationMinutes: transitMin
      } : undefined;

      const isReturnHandledByGym = Boolean(chainedCourse && workoutTemplate.chainedAfterCourse);
      const commuteRetour = (!meta.isDistanciel && isLastPresential && !isReturnHandledByGym) ? {
        departureTime: new Date(raw.endDate.getTime() + GLOBAL_APP_CONFIG.BUFFER_AFTER_CLASS_MIN * 60000).toISOString(),
        arrivalTime: new Date(raw.endDate.getTime() + (GLOBAL_APP_CONFIG.BUFFER_AFTER_CLASS_MIN + transitMin) * 60000).toISOString(),
        durationMinutes: transitMin
      } : undefined;

      const courseEv: CalendarEvent = {
        id: `COURSE_${raw.uid}`,
        category: 'course',
        title: `${meta.emoji} ${meta.courseCode || ''} ${meta.typePrefix} - ${meta.cleanTitle}`,
        startDate: raw.startDate.toISOString(),
        endDate: raw.endDate.toISOString(),
        location: meta.room,
        description: raw.description,
        emoji: meta.emoji,
        colorId: meta.color.colorId,
        colorHex: meta.color.colorHex,
        durationMinutes: dur,
        metadata: {
          courseCode: meta.courseCode,
          room: meta.room,
          isDistanciel: meta.isDistanciel,
          isExam: meta.isExam,
          commuteAller,
          commuteRetour
        }
      };
      dayEvents.push(courseEv);
    }

    // Commute To ÉTS (if in-person class)
    if (presentialCourses.length > 0) {
      const firstCourse = presentialCourses[0];
      const targetArrival = new Date(firstCourse.startDate.getTime() - GLOBAL_APP_CONFIG.BUFFER_BEFORE_CLASS_MIN * 60000);
      const transitMin = GLOBAL_APP_CONFIG.TRANSIT_TIMES.HOME_TO_ETS;
      const departTime = new Date(targetArrival.getTime() - transitMin * 60000);

      dayEvents.push({
        id: `TRAJET_ALLER_${dateKey}`,
        category: 'trajet',
        sportType: 'TRAVEL',
        title: `🚌 Commute To: Home ➔ ÉTS`,
        startDate: departTime.toISOString(),
        endDate: targetArrival.toISOString(),
        location: `${GLOBAL_APP_CONFIG.HOME_ADDRESS} ➔ ${GLOBAL_APP_CONFIG.ETS_ADDRESS}`,
        description: `Bus/Metro to ÉTS (~${transitMin} min). Planned arrival 10 min before class.`,
        emoji: "🚌",
        colorId: COLOR_MAP.TRAVEL.colorId,
        colorHex: COLOR_MAP.TRAVEL.colorHex,
        durationMinutes: transitMin,
        metadata: {
          transitFrom: GLOBAL_APP_CONFIG.HOME_ADDRESS,
          transitTo: GLOBAL_APP_CONFIG.ETS_ADDRESS
        }
      });

      // Commute back (only if not chained directly after class for gym)
      const lastCourse = presentialCourses[presentialCourses.length - 1];
      const isReturnHandledByGym = Boolean(chainedCourse && workoutTemplate.chainedAfterCourse);

      if (!isReturnHandledByGym) {
        const departRetour = new Date(lastCourse.endDate.getTime() + GLOBAL_APP_CONFIG.BUFFER_AFTER_CLASS_MIN * 60000);
        const arrivalRetour = new Date(departRetour.getTime() + transitMin * 60000);

        dayEvents.push({
          id: `TRAJET_RETOUR_${dateKey}`,
          category: 'trajet',
          sportType: 'TRAVEL',
          title: `🚌 Commute Back: ÉTS ➔ Home`,
          startDate: departRetour.toISOString(),
          endDate: arrivalRetour.toISOString(),
          location: `${GLOBAL_APP_CONFIG.ETS_ADDRESS} ➔ ${GLOBAL_APP_CONFIG.HOME_ADDRESS}`,
          description: `Bus/Metro return home (~${transitMin} min).`,
          emoji: "🚌",
          colorId: COLOR_MAP.TRAVEL.colorId,
          colorHex: COLOR_MAP.TRAVEL.colorHex,
          durationMinutes: transitMin,
          metadata: {
            transitFrom: GLOBAL_APP_CONFIG.ETS_ADDRESS,
            transitTo: GLOBAL_APP_CONFIG.HOME_ADDRESS
          }
        });
      }
    }

    // Sport Workout Event
    let sportEvent: CalendarEvent | undefined = undefined;

    if (workoutTemplate.duration > 0 && workoutTemplate.address) {
      let workoutStart: Date;
      let workoutEnd: Date;
      let transitAllerMinutes = 0;
      let transitRetourMinutes = 0;

      let conflictRescheduled = false;
      let conflictReason: string | undefined = undefined;

      if (workoutTemplate.chainedAfterCourse && chainedCourse) {
        const transitionMs = GLOBAL_APP_CONFIG.BUFFER_BETWEEN_CLASS_AND_SPORT_MIN * 60000;
        workoutStart = new Date(chainedCourse.endDate.getTime() + transitionMs);
        workoutEnd = new Date(workoutStart.getTime() + workoutTemplate.duration * 60000);
        transitAllerMinutes = 0;
        transitRetourMinutes = GLOBAL_APP_CONFIG.TRANSIT_TIMES.ETS_TO_HOME;
      } else {
        const targetHomeReturn = new Date(currentDate);
        targetHomeReturn.setHours(GLOBAL_APP_CONFIG.TARGET_HOME_RETURN_HOUR, GLOBAL_APP_CONFIG.TARGET_HOME_RETURN_MIN, 0, 0);

        const isHomeActivity = (workoutTemplate.address === GLOBAL_APP_CONFIG.HOME_ADDRESS || workoutTemplate.locName.includes("Maisonneuve") || workoutTemplate.locName.includes("Home") || workoutTemplate.locName.includes("Maison"));

        if (workoutTemplate.address === GLOBAL_APP_CONFIG.MOUNT_ROYAL_ADDRESS) {
          transitAllerMinutes = GLOBAL_APP_CONFIG.TRANSIT_TIMES.HOME_TO_MONT_ROYAL;
          transitRetourMinutes = GLOBAL_APP_CONFIG.TRANSIT_TIMES.MONT_ROYAL_TO_HOME;
        } else if (workoutTemplate.address === GLOBAL_APP_CONFIG.ETS_ADDRESS) {
          transitAllerMinutes = GLOBAL_APP_CONFIG.TRANSIT_TIMES.HOME_TO_ETS;
          transitRetourMinutes = GLOBAL_APP_CONFIG.TRANSIT_TIMES.ETS_TO_HOME;
        }

        if (isHomeActivity) {
          transitAllerMinutes = 0;
          transitRetourMinutes = 0;
        }

        // Default morning target window
        const tentativeWorkoutEnd = new Date(targetHomeReturn.getTime() - transitRetourMinutes * 60000);
        const tentativeWorkoutStart = new Date(tentativeWorkoutEnd.getTime() - workoutTemplate.duration * 60000);
        const tentativeTravelStart = new Date(tentativeWorkoutStart.getTime() - transitAllerMinutes * 60000);
        const tentativeTravelEnd = new Date(tentativeWorkoutEnd.getTime() + transitRetourMinutes * 60000);

        // Check if morning target window conflicts with any class or class transit on that day
        const conflictingCourse = dayCourses.find(c => {
          const cMeta = analyzeETSEvent(c);
          const cTransit = !cMeta.isDistanciel ? GLOBAL_APP_CONFIG.TRANSIT_TIMES.HOME_TO_ETS : 0;
          const cBuffer = !cMeta.isDistanciel ? GLOBAL_APP_CONFIG.BUFFER_BEFORE_CLASS_MIN : 0;
          const cBufferAfter = !cMeta.isDistanciel ? GLOBAL_APP_CONFIG.BUFFER_AFTER_CLASS_MIN : 0;
          const cStartBusy = c.startDate.getTime() - (cTransit + cBuffer) * 60000;
          const cEndBusy = c.endDate.getTime() + (cTransit + cBufferAfter) * 60000;

          return tentativeTravelStart.getTime() < cEndBusy && tentativeTravelEnd.getTime() > cStartBusy;
        });

        if (conflictingCourse) {
          conflictRescheduled = true;
          const cMeta = analyzeETSEvent(conflictingCourse);

          // If workout is at ÉTS Gym and conflicting course is at ÉTS, chain directly after the course
          if (workoutTemplate.address === GLOBAL_APP_CONFIG.ETS_ADDRESS && !cMeta.isDistanciel) {
            workoutStart = new Date(conflictingCourse.endDate.getTime() + GLOBAL_APP_CONFIG.BUFFER_BETWEEN_CLASS_AND_SPORT_MIN * 60000);
            workoutEnd = new Date(workoutStart.getTime() + workoutTemplate.duration * 60000);
            transitAllerMinutes = 0;
            transitRetourMinutes = GLOBAL_APP_CONFIG.TRANSIT_TIMES.ETS_TO_HOME;
            conflictReason = `Chained directly post-class at ÉTS Gym after ${conflictingCourse.summary} to optimize schedule.`;
          } else {
            // Reschedule after all day classes finish (late afternoon / early evening)
            const latestCourseEnd = Math.max(...dayCourses.map(c => {
              const m = analyzeETSEvent(c);
              const t = !m.isDistanciel ? (GLOBAL_APP_CONFIG.TRANSIT_TIMES.ETS_TO_HOME + GLOBAL_APP_CONFIG.BUFFER_AFTER_CLASS_MIN) : 0;
              return c.endDate.getTime() + t * 60000;
            }));

            const earliestSafeStart = new Date(latestCourseEnd + 20 * 60000);
            const standardAfternoon = new Date(currentDate);
            standardAfternoon.setHours(17, 0, 0, 0);

            workoutStart = earliestSafeStart.getTime() > standardAfternoon.getTime() ? earliestSafeStart : standardAfternoon;
            workoutEnd = new Date(workoutStart.getTime() + workoutTemplate.duration * 60000);
            const startStr = workoutStart.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            conflictReason = `Rescheduled to afternoon (${startStr}) to prevent overlap with ${conflictingCourse.summary}.`;
          }
        } else {
          workoutStart = tentativeWorkoutStart;
          workoutEnd = tentativeWorkoutEnd;
        }
      }

      // Sport Aller transit if needed
      if (transitAllerMinutes > 0) {
        const travelStart = new Date(workoutStart.getTime() - transitAllerMinutes * 60000);
        dayEvents.push({
          id: `SPORT_TRAVEL_ALLER_${dateKey}`,
          category: 'trajet',
          sportType: 'TRAVEL',
          title: `🚶‍♂️ Commute to ${workoutTemplate.locName}`,
          startDate: travelStart.toISOString(),
          endDate: workoutStart.toISOString(),
          location: `${GLOBAL_APP_CONFIG.HOME_ADDRESS} ➔ ${workoutTemplate.address}`,
          description: `Estimated commute: ~${transitAllerMinutes} min`,
          emoji: "🚶‍♂️",
          colorId: COLOR_MAP.TRAVEL.colorId,
          colorHex: COLOR_MAP.TRAVEL.colorHex,
          durationMinutes: transitAllerMinutes
        });
      }

      // Workout itself
      sportEvent = {
        id: `SPORT_WORKOUT_${dateKey}`,
        category: 'sport',
        sportType: workoutTemplate.sportType,
        title: `${workoutTemplate.emoji} ${workoutTemplate.title}`,
        startDate: workoutStart.toISOString(),
        endDate: workoutEnd.toISOString(),
        location: workoutTemplate.locName,
        description: workoutTemplate.description,
        emoji: workoutTemplate.emoji,
        colorId: workoutTemplate.colorId,
        colorHex: workoutTemplate.colorHex,
        durationMinutes: workoutTemplate.duration,
        metadata: {
          targetHeartRate: workoutTemplate.targetHeartRate,
          targetHeartRateRange: workoutTemplate.targetHeartRateRange,
          targetCadence: workoutTemplate.targetCadence,
          targetElevationM: workoutTemplate.targetElevationM,
          nutritionAdvice: workoutTemplate.nutritionAdvice,
          chainedAfterCourse: workoutTemplate.chainedAfterCourse,
          commuteAller: transitAllerMinutes > 0 ? {
            departureTime: new Date(workoutStart.getTime() - transitAllerMinutes * 60000).toISOString(),
            arrivalTime: workoutStart.toISOString(),
            durationMinutes: transitAllerMinutes
          } : undefined,
          commuteRetour: transitRetourMinutes > 0 ? {
            departureTime: workoutEnd.toISOString(),
            arrivalTime: new Date(workoutEnd.getTime() + transitRetourMinutes * 60000).toISOString(),
            durationMinutes: transitRetourMinutes
          } : undefined,
          conflictRescheduled,
          conflictReason
        }
      };
      dayEvents.push(sportEvent);

      // Sport Retour transit if needed
      if (transitRetourMinutes > 0) {
        const travelEnd = new Date(workoutEnd.getTime() + transitRetourMinutes * 60000);
        dayEvents.push({
          id: `SPORT_TRAVEL_RETOUR_${dateKey}`,
          category: 'trajet',
          sportType: 'TRAVEL',
          title: `🚶‍♂️ Commute Back (${workoutTemplate.locName})`,
          startDate: workoutEnd.toISOString(),
          endDate: travelEnd.toISOString(),
          location: `${workoutTemplate.address} ➔ ${GLOBAL_APP_CONFIG.HOME_ADDRESS}`,
          description: `Commute back home: ~${transitRetourMinutes} min`,
          emoji: "🚶‍♂️",
          colorId: COLOR_MAP.TRAVEL.colorId,
          colorHex: COLOR_MAP.TRAVEL.colorHex,
          durationMinutes: transitRetourMinutes
        });
      }
    }

    // Evening Mobility & Stretch session (22:00)
    const stretchStart = new Date(currentDate);
    stretchStart.setHours(22, 0, 0, 0);
    const stretchEnd = new Date(stretchStart.getTime() + 20 * 60000);

    dayEvents.push({
      id: `SPORT_STRETCH_${dateKey}`,
      category: 'mobility',
      sportType: 'MOBILITY',
      title: `🧘 Evening Mobility & Stretching`,
      startDate: stretchStart.toISOString(),
      endDate: stretchEnd.toISOString(),
      location: "Home (Mat)",
      description: "Pike/straddle stretch, seated leg lifts, Jefferson curls, couch stretch to release hip flexors.",
      emoji: "🧘",
      colorId: COLOR_MAP.MOBILITY.colorId,
      colorHex: COLOR_MAP.MOBILITY.colorHex,
      durationMinutes: 20
    });

    // Sort day events by start date
    dayEvents.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    allEvents.push(...dayEvents);

    schedules.push({
      date: dateKey,
      dayOfWeek,
      periodContext,
      events: dayEvents,
      sportSession: sportEvent,
      hasCourse,
      hasIntensiveCourse: saturdayHasIntensive
    });
  }

  return { schedules, allEvents };
}
