/** Whether account-scoped data is safe to use for the currently signed-in user. */
export function canUseHydratedAccountData(
  userId: string | null | undefined,
  hydratedUserId: string | null
): boolean {
  return !userId || hydratedUserId === userId;
}

/** Keep profile-triggered refreshes behind auth and current-account hydration. */
export function canRefreshForAccount(
  authLoading: boolean,
  userId: string | null | undefined,
  refreshReadyUserId: string | null
): boolean {
  return !authLoading && (!userId || refreshReadyUserId === userId);
}
