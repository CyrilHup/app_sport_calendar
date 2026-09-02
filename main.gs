// ==========================================
// FICHIER : Main.gs
// ==========================================

function syncAll() {
  Logger.log("=== DÉMARRAGE DE LA SYNCHRONISATION GLOBALE ===");
  syncETSCalendar(false);
  syncSportsCalendarWithTransit();
  Logger.log("=== SYNCHRONISATION GLOBALE TERMINÉE ===");
}

function forceSyncAll() {
  Logger.log("=== SYNCHRONISATION MANUELLE FORCÉE ===");
  syncETSCalendar(true);
  syncSportsCalendarWithTransit();
  Logger.log("=== SYNCHRONISATION FORCÉE TERMINÉE ===");
}

function setupAutomatedTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger("syncAll")
    .timeBased()
    .everyHours(4)
    .create();

  Logger.log("✅ Déclencheur automatique configuré (toutes les 4 heures).");
}