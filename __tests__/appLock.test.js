jest.mock('expo-local-authentication', () => ({
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_STRONG: 3 },
  getEnrolledLevelAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

import * as mockAuth from 'expo-local-authentication';
import { authenticate, getLockAvailability } from '../src/services/AppLock';

describe('getLockAvailability', () => {
  it('needs some kind of screen lock on the phone', async () => {
    mockAuth.getEnrolledLevelAsync.mockResolvedValueOnce(0);
    expect((await getLockAvailability()).available).toBe(false);
    mockAuth.getEnrolledLevelAsync.mockResolvedValueOnce(1);
    expect((await getLockAvailability()).available).toBe(true);
  });
});

describe('authenticate', () => {
  it('allows the phone PIN as a fallback', async () => {
    mockAuth.authenticateAsync.mockResolvedValueOnce({ success: true });
    expect(await authenticate('Unlock')).toEqual({ success: true, message: '' });
    expect(mockAuth.authenticateAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ disableDeviceFallback: false }),
    );
  });

  it('explains what to do when the phone lock was removed', async () => {
    mockAuth.authenticateAsync.mockResolvedValueOnce({ success: false, error: 'not_enrolled' });
    expect((await authenticate('Unlock')).message).toMatch(/password/);
  });
});
