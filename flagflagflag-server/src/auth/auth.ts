import { betterAuth, type Auth, type BetterAuthOptions } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { username } from 'better-auth/plugins';
import { database } from '../database.js';

const baseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';

const authOptions: BetterAuthOptions = {
  baseURL,
  database,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 5,
  },
  plugins: [username()],
  trustedOrigins: [baseURL],
  hooks: {
    after: createAuthMiddleware(async (context) => {
      if (context.path !== '/sign-in/username' || !context.context.newSession) {
        return;
      }

      const { session } = context.context.newSession;
      return context.json({
        token: session.token,
        expiresAt: session.expiresAt,
      });
    }),
  },
};
export const auth: Auth<BetterAuthOptions> = betterAuth(authOptions);

