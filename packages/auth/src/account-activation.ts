import { createHmac, randomBytes } from 'node:crypto';
import { APIError, createAuthEndpoint } from 'better-auth/api';
import { expireCookie, setSessionCookie } from 'better-auth/cookies';
import { z } from 'zod';

/** Called only by the server after it atomically consumes an activation code.
 * No HTTP route is registered and no activation credential crosses a second request.
 */
export function accountActivation() {
  return {
    id: 'account-activation',
    endpoints: {
      completeAccountActivation: createAuthEndpoint.serverOnly({
        method: 'POST',
        body: z.object({ userId: z.string().min(1) })
      }, async (ctx) => {
        const user = await ctx.context.internalAdapter.findUserById(ctx.body.userId);
        if (!user?.emailVerified) throw new APIError('UNAUTHORIZED');

        // Session creation runs the application's active-user database hook.
        const session = await ctx.context.internalAdapter.createSession(user.id);
        if (!session) throw new APIError('UNAUTHORIZED');
        const identifier = `trust-device-${randomBytes(24).toString('base64url')}`;
        try {
          // Better Auth 1.7's two-factor plugin validates this signed, revocable
          // record/cookie pair. Keep the compatibility tests when upgrading it.
          const maxAge = 30 * 24 * 60 * 60;
          const cookie = ctx.context.createAuthCookie('trust_device', { maxAge });
          const token = createHmac('sha256', ctx.context.secret)
            .update(`${user.id}!${identifier}`).digest('base64url');
          await ctx.context.internalAdapter.createVerificationValue({
            identifier, value: user.id, expiresAt: new Date(Date.now() + maxAge * 1000)
          });
          await ctx.setSignedCookie(cookie.name, `${token}!${identifier}`, ctx.context.secret, cookie.attributes);
          await setSessionCookie(ctx, { session, user });
          expireCookie(ctx, ctx.context.createAuthCookie('two_factor'));
          expireCookie(ctx, ctx.context.authCookies.dontRememberToken);
          return { user: { id: user.id, email: user.email, name: user.name } };
        } catch (error) {
          await ctx.context.internalAdapter.deleteSession(session.token);
          await ctx.context.internalAdapter.deleteVerificationByIdentifier(identifier);
          throw error;
        }
      })
    }
  };
}
