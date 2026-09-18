import { describe, expect, it, vi } from 'vitest';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { twoFactor } from 'better-auth/plugins';
import { accountActivation } from './account-activation.js';

async function fixture(active = true, emailVerified = true) {
  const sendOTP = vi.fn();
  const auth = betterAuth({
    baseURL: 'http://localhost:3000',
    secret: 'synthetic-test-secret-at-least-thirty-two-characters',
    database: memoryAdapter({ user: [], session: [], account: [], verification: [], twoFactor: [] }),
    emailAndPassword: { enabled: true },
    advanced: { defaultCookieAttributes: { sameSite: 'strict' } },
    databaseHooks: { session: { create: { before: async () => active ? undefined : false } } },
    plugins: [twoFactor({ otpOptions: { sendOTP } }), accountActivation()]
  });
  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser({
    email: 'synthetic@example.com', name: 'Synthetic', emailVerified, twoFactorEnabled: true
  });
  await ctx.internalAdapter.linkAccount({
    userId: user.id, accountId: user.id, providerId: 'credential',
    password: await ctx.password.hash('synthetic-password-123')
  });
  return { auth, user, sendOTP };
}

describe('account activation: actual Better Auth compatibility', () => {
  it('creates a working session and recognizes only the activating browser on later login', async () => {
    const { auth, user, sendOTP } = await fixture();
    const result = await auth.api.completeAccountActivation({ body: { userId: user.id }, returnHeaders: true });
    const cookies = result.headers.getSetCookie();
    const cookieHeader = cookies.map(value => value.split(';')[0]).join('; ');
    const session = await auth.api.getSession({ headers: new Headers({ cookie: cookieHeader }) });
    expect(session?.user.id).toBe(user.id);
    expect(cookies.find(value => value.includes('session_token='))).toMatch(/HttpOnly/i);
    expect(cookies.find(value => value.includes('trust_device='))).toMatch(/SameSite=Strict/i);
    expect(sendOTP).not.toHaveBeenCalled();

    const trustCookie = cookies.find(value => value.includes('trust_device='))!.split(';')[0]!;
    const recognized = await auth.api.signInEmail({
      body: { email: user.email, password: 'synthetic-password-123' },
      headers: new Headers({ cookie: trustCookie })
    });
    expect(recognized).not.toHaveProperty('twoFactorRedirect', true);
    const unknown = await auth.api.signInEmail({ body: { email: user.email, password: 'synthetic-password-123' } });
    expect(unknown).toHaveProperty('twoFactorRedirect', true);
  });

  it.each([[false, true], [true, false]])('rejects blocked session creation or unverified email (%s, %s)', async (active, verified) => {
    const { auth, user } = await fixture(active, verified);
    await expect(auth.api.completeAccountActivation({ body: { userId: user.id } })).rejects.toThrow();
  });

  it('does not expose the activation endpoint over HTTP', async () => {
    const { auth, user } = await fixture();
    for (const path of ['complete-account-activation', 'completeAccountActivation', 'account-activation']) {
      const response = await auth.handler(new Request(`http://localhost:3000/api/auth/${path}`, {
        method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify({ userId: user.id })
      }));
      expect(response.status).toBe(404);
      expect(response.headers.get('set-cookie')).toBeNull();
    }
  });

  it('rejects a tampered or expired remembered-browser cookie', async () => {
    const { auth, user } = await fixture();
    const result = await auth.api.completeAccountActivation({ body: { userId: user.id }, returnHeaders: true });
    const cookie = result.headers.getSetCookie().find(value => value.includes('trust_device='))!.split(';')[0]!;
    const tampered = await auth.api.signInEmail({
      body: { email: user.email, password: 'synthetic-password-123' },
      headers: new Headers({ cookie: `${cookie}tampered` })
    });
    expect(tampered).toHaveProperty('twoFactorRedirect', true);
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(Date.now() + 31 * 24 * 60 * 60 * 1000);
      const expired = await auth.api.signInEmail({
        body: { email: user.email, password: 'synthetic-password-123' }, headers: new Headers({ cookie })
      });
      expect(expired).toHaveProperty('twoFactorRedirect', true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('removes a newly created session when trusted-device persistence fails', async () => {
    const { auth, user } = await fixture();
    const ctx = await auth.$context;
    vi.spyOn(ctx.internalAdapter, 'createVerificationValue').mockRejectedValueOnce(new Error('test storage failure'));
    await expect(auth.api.completeAccountActivation({ body: { userId: user.id } })).rejects.toThrow('test storage failure');
    expect(await ctx.internalAdapter.listSessions(user.id)).toEqual([]);
  });

  it('does not recognize another account using the activating account\'s browser cookie', async () => {
    const { auth, user } = await fixture();
    const result = await auth.api.completeAccountActivation({ body: { userId: user.id }, returnHeaders: true });
    const cookie = result.headers.getSetCookie().find(value => value.includes('trust_device='))!.split(';')[0]!;
    const ctx = await auth.$context;
    const other = await ctx.internalAdapter.createUser({
      email: 'another-synthetic@example.com', name: 'Another', emailVerified: true, twoFactorEnabled: true
    });
    await ctx.internalAdapter.linkAccount({
      userId: other.id, accountId: other.id, providerId: 'credential', password: await ctx.password.hash('another-password-123')
    });
    const login = await auth.api.signInEmail({
      body: { email: other.email, password: 'another-password-123' }, headers: new Headers({ cookie })
    });
    expect(login).toHaveProperty('twoFactorRedirect', true);
  });
});
