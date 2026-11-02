jest.mock('expo-crypto', () => {
  const nodeCrypto = require('crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digestStringAsync: async (_algorithm, data) => nodeCrypto.createHash('sha256').update(data).digest('hex'),
    randomUUID: () => nodeCrypto.randomUUID(),
  };
});

import { hashPassword, verifyPassword } from '../src/utils/helpers';

describe('password hashing', () => {
  it('never stores the plain password', async () => {
    const stored = await hashPassword('testpass123');
    expect(stored.passwordHash).not.toContain('testpass123');
    expect(stored.passwordSalt).toBeTruthy();
  });

  it('uses a fresh salt for each hash', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a.passwordSalt).not.toBe(b.passwordSalt);
    expect(a.passwordHash).not.toBe(b.passwordHash);
  });

  it('verifies the right password and rejects the wrong one', async () => {
    const stored = await hashPassword('testpass123');
    await expect(verifyPassword('testpass123', stored)).resolves.toBe(true);
    await expect(verifyPassword('wrong', stored)).resolves.toBe(false);
  });

  it('still accepts legacy plain-text records so they can be upgraded', async () => {
    await expect(verifyPassword('old-pass', { password: 'old-pass' })).resolves.toBe(true);
    await expect(verifyPassword('nope', { password: 'old-pass' })).resolves.toBe(false);
  });

  it('rejects records with no credentials', async () => {
    await expect(verifyPassword('anything', {})).resolves.toBe(false);
  });
});
