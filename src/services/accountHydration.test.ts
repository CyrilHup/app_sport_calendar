import { describe, expect, it } from 'vitest';
import { canRefreshForAccount, canUseHydratedAccountData } from './accountHydration';

describe('account hydration gates', () => {
  it('blocks account-scoped sync until the current account is hydrated', () => {
    expect(canUseHydratedAccountData('account-a', null)).toBe(false);
    expect(canUseHydratedAccountData('account-a', 'account-b')).toBe(false);
    expect(canUseHydratedAccountData('account-a', 'account-a')).toBe(true);
  });

  it('does not treat the same account as ready after its readiness marker is reset', () => {
    expect(canUseHydratedAccountData('account-a', null)).toBe(false);
    expect(canRefreshForAccount(false, 'account-a', null)).toBe(false);
  });

  it('blocks profile refresh during auth loading and until the signed-in user is ready', () => {
    expect(canRefreshForAccount(true, null, null)).toBe(false);
    expect(canRefreshForAccount(false, 'account-a', null)).toBe(false);
    expect(canRefreshForAccount(false, 'account-a', 'account-a')).toBe(true);
  });

  it('allows guest refreshes only after auth loading settles', () => {
    expect(canUseHydratedAccountData(null, null)).toBe(true);
    expect(canRefreshForAccount(true, null, null)).toBe(false);
    expect(canRefreshForAccount(false, null, null)).toBe(true);
  });
});
