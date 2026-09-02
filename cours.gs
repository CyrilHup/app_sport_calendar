// ==========================================
// FICHIER : 1_Cours.gs
// ==========================================

function syncETSCalendar(forceSync = false) {
  Logger.log("🔄 Vérification de l'emploi du temps ÉTS...");

  const icsResponse = UrlFetchApp.fetch(GLOBAL_CONFIG.ICAL_URL);
  if (icsResponse.getResponseCode() !== 200) {
    Logger.log("❌ Erreur lors de la récupération du fichier iCal ÉTS.");
    return false;
  }
  
  const icsText = icsResponse.getContentText();
  const currentHash = computeMD5Hash(icsText);
  const props = PropertiesService.getScriptProperties();
  const lastHash = props.getProperty("LAST_ICAL_HASH");

  if (!forceSync && currentHash === lastHash) {
    Logger.log("⚡ Aucun changement dans l'iCal ÉTS (hash identique).");
    return false;
  }

  Logger.log("📥 Analyse et mise à jour des cours ÉTS...");

  const calendar = getOrCreateCalendar(GLOBAL_CONFIG.SCHOOL_CAL_NAME);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const futureLimit = new Date(today.getTime() + GLOBAL_CONFIG.SCHOOL_SYNC_DAYS * 24 * 60 * 60 * 1000);
  const existingGCalEvents = calendar.getEvents(today, futureLimit);

  const gCalMap = new Map();
  existingGCalEvents.forEach(gEv => {
    const desc = gEv.getDescription() || "";
    const match = desc.match(/🆔 UID ÉTS : (.*)/);
    if (match) {
      gCalMap.set(match[1].trim(), gEv);
    }
  });

  const newICalEvents = parseICS(icsText).filter(ev => ev.startDate >= today && ev.startDate <= futureLimit);
  const newICalMap = new Map();
  const processedCourses = [];

  let addedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;

  function applyClassReminders(ev) {
    ev.removeAllReminders();
    GLOBAL_CONFIG.REMINDERS.COURS_LOCAL.forEach(min => ev.addPopupReminder(min));
  }

  newICalEvents.forEach(ev => {
    const uid = ev.uid;
    newICalMap.set(uid, true);

    const meta = analyzeETSEvent(ev);
    const customTitle = `${meta.emoji} ${meta.courseCode} ${meta.typePrefix} - ${meta.cleanTitle}`;
    const customDescription = [
      `📚 Cours : ${meta.courseCode}`,
      `📌 Type : ${meta.activityType}`,
      `📍 Lieu : ${meta.location}`,
      `ℹ️ Description ÉTS : ${meta.description}`,
      `🆔 UID ÉTS : ${uid}`
    ].join("\n");

    const existingCourseEv = gCalMap.get(uid);

    if (!existingCourseEv) {
      addedCount++;
      Logger.log(`  ➕ [COURS AJOUTÉ] ${meta.courseCode} ${meta.typePrefix} (${formatDate(ev.startDate)})`);
      const newEv = calendar.createEvent(customTitle, ev.startDate, ev.endDate, {
        location: meta.location,
        description: customDescription
      });
      newEv.setColor(meta.colorId);
      applyClassReminders(newEv);
      gCalMap.set(uid, newEv);
    } else {
      const timeChanged = existingCourseEv.getStartTime().getTime() !== ev.startDate.getTime() ||
                          existingCourseEv.getEndTime().getTime() !== ev.endDate.getTime();
      const locChanged = existingCourseEv.getLocation() !== meta.location;
      const titleChanged = existingCourseEv.getTitle() !== customTitle;

      if (timeChanged || locChanged || titleChanged) {
        updatedCount++;
        Logger.log(`  ✏️ [COURS MODIFIÉ] ${meta.courseCode} (${formatDate(ev.startDate)})`);
        existingCourseEv.setTitle(customTitle);
        existingCourseEv.setTime(ev.startDate, ev.endDate);
        existingCourseEv.setLocation(meta.location);
        existingCourseEv.setDescription(customDescription);
        existingCourseEv.setColor(meta.colorId);
      } else {
        unchangedCount++;
      }
      
      applyClassReminders(existingCourseEv);
    }

    if (!meta.isDistanciel) {
      processedCourses.push({ ev, meta, uid });
    }
  });

  let deletedCount = 0;
  gCalMap.forEach((gEv, uid) => {
    if (!uid.startsWith("TRAVEL_") && !newICalMap.has(uid)) {
      deletedCount++;
      Logger.log(`  🗑️ [COURS SUPPRIMÉ] ${gEv.getTitle()}`);
      gEv.deleteEvent();
    }
  });

  syncSmartTransits_(calendar, gCalMap, processedCourses);

  props.setProperty("LAST_ICAL_HASH", currentHash);
  Logger.log(`✅ Cours ÉTS synchronisés (+${addedCount} ajoutés, ~${updatedCount} modifiés, -${deletedCount} supprimés, =${unchangedCount} inchangés).\n`);
  return true;
}

function syncSmartTransits_(calendar, gCalMap, processedCourses) {
  const byDay = new Map();
  processedCourses.forEach(item => {
    const dayKey = formatDateOnly(item.ev.startDate);
    if (!byDay.has(dayKey)) byDay.set(dayKey, []);
    byDay.get(dayKey).push(item);
  });

  const neededTravelUids = new Set();

  byDay.forEach((dayEvents, dayKey) => {
    dayEvents.sort((a, b) => a.ev.startDate.getTime() - b.ev.startDate.getTime());

    const blocks = [];
    let currentBlock = [dayEvents[0]];

    for (let i = 1; i < dayEvents.length; i++) {
      const lastInBlock = currentBlock[currentBlock.length - 1];
      const gapMinutes = (dayEvents[i].ev.startDate.getTime() - lastInBlock.ev.endDate.getTime()) / (60 * 1000);
      
      if (gapMinutes < 120) {
        currentBlock.push(dayEvents[i]);
      } else {
        blocks.push(currentBlock);
        currentBlock = [dayEvents[i]];
      }
    }
    blocks.push(currentBlock);

    blocks.forEach(block => {
      const first = block[0];
      const last = block[block.length - 1];

      // Trajet Aller
      if (GLOBAL_CONFIG.GENERATE_SCHOOL_ALLER) {
        const allerUid = `TRAVEL_ALLER_${first.uid}`;
        neededTravelUids.add(allerUid);
        createOrUpdateAller_(calendar, gCalMap, first.ev, first.meta, allerUid);
      }

      // Trajet Retour (Délégué au sport si séance enchaînée à l'ÉTS)
      if (GLOBAL_CONFIG.GENERATE_SCHOOL_RETOUR) {
        const retourUid = `TRAVEL_RETOUR_${last.uid}`;
        if (!isReturnHandledBySport_(last.ev)) {
          neededTravelUids.add(retourUid);
          createOrUpdateRetour_(calendar, gCalMap, last.ev, last.meta, retourUid);
        }
      }
    });
  });

  gCalMap.forEach((gEv, uid) => {
    if (uid.startsWith("TRAVEL_") && !neededTravelUids.has(uid)) {
      Logger.log(`  🗑️ [TRAJET SUPPRIMÉ] ${gEv.getTitle()}`);
      gEv.deleteEvent();
    }
  });
}

function isReturnHandledBySport_(ev) {
  const start = ev.startDate;
  const minStartDate = new Date(GLOBAL_CONFIG.SPORT_START_DATE + "T00:00:00");
  if (start < minStartDate) return false;

  const dayOfWeek = (start.getDay() + 6) % 7;
  const endH = ev.endDate.getHours();
  const durHours = (ev.endDate.getTime() - ev.startDate.getTime()) / (3600 * 1000);
  const isMTR = (ev.summary || "").toUpperCase().includes("MTR801") || (ev.description || "").toUpperCase().includes("MTR801");

  if (dayOfWeek === 4 && endH >= 15 && endH <= 19) {
    return true;
  }

  if (dayOfWeek === 5 && (durHours >= 3.5 || isMTR)) {
    return true;
  }

  return false;
}

function createOrUpdateAller_(calendar, gCalMap, ev, meta, allerUid) {
  const existing = gCalMap.get(allerUid);
  const targetArrival = new Date(ev.startDate.getTime() - GLOBAL_CONFIG.BUFFER_BEFORE_CLASS_MIN * 60 * 1000);

  function applyAllerReminders(evt) {
    evt.removeAllReminders();
    GLOBAL_CONFIG.REMINDERS.DEPART_TRAJET.forEach(min => evt.addPopupReminder(min));
  }

  if (existing && Math.abs(existing.getEndTime().getTime() - targetArrival.getTime()) < 60000) {
    applyAllerReminders(existing);
    return;
  }

  const allerSchedule = getTransitScheduleForArrival(GLOBAL_CONFIG.HOME_ADDRESS, GLOBAL_CONFIG.ETS_ADDRESS, targetArrival);
  const allerTitle = `${CONFIG_RULES.TYPES.TRAJET.emoji} Trajet Aller : Maison ➔ ÉTS (${meta.courseCode})`;
  const allerDesc = `🚌 Départ : ${formatTime(allerSchedule.startTime)} ➔ Arrivée : ${formatTime(allerSchedule.endTime)}\n📍 Local : ${meta.location}\n🆔 UID ÉTS : ${allerUid}`;

  if (existing) {
    Logger.log(`  ✏️ [TRAJET ALLER MODIFIÉ] ${meta.courseCode} (${formatDate(allerSchedule.startTime)})`);
    existing.setTitle(allerTitle);
    existing.setTime(allerSchedule.startTime, allerSchedule.endTime);
    existing.setDescription(allerDesc);
    existing.setColor(CONFIG_RULES.TYPES.TRAJET.colorId);
    applyAllerReminders(existing);
  } else {
    Logger.log(`  ➕ [TRAJET ALLER AJOUTÉ] ${meta.courseCode} (${formatDate(allerSchedule.startTime)})`);
    const newEv = calendar.createEvent(allerTitle, allerSchedule.startTime, allerSchedule.endTime, {
      location: `${GLOBAL_CONFIG.HOME_ADDRESS} ➔ ${GLOBAL_CONFIG.ETS_ADDRESS}`,
      description: allerDesc
    });
    newEv.setColor(CONFIG_RULES.TYPES.TRAJET.colorId);
    applyAllerReminders(newEv);
    gCalMap.set(allerUid, newEv);
  }
}

function createOrUpdateRetour_(calendar, gCalMap, ev, meta, retourUid) {
  const existing = gCalMap.get(retourUid);
  
  // DÉPART DÉCALÉ : 10 min après la fin du cours pour avoir le temps de sortir
  const earliestDeparture = new Date(ev.endDate.getTime() + (GLOBAL_CONFIG.BUFFER_AFTER_CLASS_MIN || 10) * 60 * 1000);

  function applyRetourReminders(evt) {
    evt.removeAllReminders();
    GLOBAL_CONFIG.REMINDERS.DEPART_TRAJET.forEach(min => evt.addPopupReminder(min));
  }

  const retourSchedule = getTransitScheduleForDeparture(GLOBAL_CONFIG.ETS_ADDRESS, GLOBAL_CONFIG.HOME_ADDRESS, earliestDeparture);
  const retourTitle = `${CONFIG_RULES.TYPES.TRAJET.emoji} Trajet Retour : ÉTS ➔ Maison (${meta.courseCode})`;
  const retourDesc = `🚌 Départ : ${formatTime(retourSchedule.startTime)} ➔ Arrivée : ${formatTime(retourSchedule.endTime)}\n🆔 UID ÉTS : ${retourUid}`;

  if (existing) {
    const timeChanged = existing.getStartTime().getTime() !== retourSchedule.startTime.getTime() ||
                        existing.getEndTime().getTime() !== retourSchedule.endTime.getTime();

    if (timeChanged) {
      Logger.log(`  ✏️ [TRAJET RETOUR MODIFIÉ] ${meta.courseCode} (${formatDate(retourSchedule.startTime)})`);
      existing.setTitle(retourTitle);
      existing.setTime(retourSchedule.startTime, retourSchedule.endTime);
      existing.setDescription(retourDesc);
      existing.setColor(CONFIG_RULES.TYPES.TRAJET.colorId);
    }
    applyRetourReminders(existing);
  } else {
    Logger.log(`  ➕ [TRAJET RETOUR AJOUTÉ] ${meta.courseCode} (${formatDate(retourSchedule.startTime)})`);
    const newEv = calendar.createEvent(retourTitle, retourSchedule.startTime, retourSchedule.endTime, {
      location: `${GLOBAL_CONFIG.ETS_ADDRESS} ➔ ${GLOBAL_CONFIG.HOME_ADDRESS}`,
      description: retourDesc
    });
    newEv.setColor(CONFIG_RULES.TYPES.TRAJET.colorId);
    applyRetourReminders(newEv);
    gCalMap.set(retourUid, newEv);
  }
}