export const SESSION_COOKIE = 'flagflagflag_session';
export const SESSION_TTL_MS = 60 * 60 * 1000;

export const jwtSecret =
  process.env.JWT_SECRET ?? 'flagflagflag-local-dev-secret';
