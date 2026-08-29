# Authentication

The server uses NestJS's standard authentication stack: `@nestjs/jwt` for
token signing/verification and a global `AuthGuard` registered with
`APP_GUARD`. Routes are protected by default; `@AllowAnonymous()` opts out.

Authentication uses username/password credentials with JWT bearer sessions.
Auth routes live below `/api/auth`.

## Configuration

### SQLite

SQLite is the default database:

```text
./flagflagflag.sqlite
```

Set a different SQLite path with:

```bash
SQLITE_DATABASE=./data/flagflagflag.sqlite
```

### PostgreSQL

Set `DATABASE_URL` to a PostgreSQL connection string:

```bash
DATABASE_URL=postgres://user:password@localhost:5432/flagflagflag
```

The application selects PostgreSQL when `DATABASE_URL` starts with `postgres`.
Otherwise it uses SQLite.

Set a strong signing secret outside local development:

```bash
JWT_SECRET=<random-secret>
```

## Default user

A default user is created during application startup if it does not already
exist:

```text
Username: flag3
Password: flag3
Email:    flag3@localhost.test
```

These credentials are intentionally simple for the early local iteration. They
must be changed before exposing the service outside local development.

## Login

Log in with the username endpoint:

```bash
curl -i \
  -X POST http://localhost:3000/api/auth/sign-in/username \
  -H 'Content-Type: application/json' \
  -d '{"username":"flag3","password":"flag3"}'
```

The response contains only the session token and its expiration time:

```json
{
  "token": "...",
  "expiresAt": "2026-08-29T06:35:00.022Z"
}
```

The response also sets the `flagflagflag_session` cookie. The cookie is the
normal authentication mechanism for subsequent requests; a
`Authorization: Bearer <token>` header works as well.

## Creating users

Create a user with the email signup endpoint:

```bash
curl -i \
  -X POST http://localhost:3000/api/auth/sign-up/email \
  -H 'Content-Type: application/json' \
  -d '{
    "username":"alice",
    "email":"alice@example.com",
    "name":"Alice",
    "password":"a-secure-password"
  }'
```

The configured minimum password length is five characters. Use a substantially
longer password in real deployments.

Signup is public in this early iteration. There is not yet an admin-only user
creation flow.

## Changing a password

The request must include the authenticated session cookie:

```bash
curl -i -b cookies.txt \
  -X POST http://localhost:3000/api/auth/change-password \
  -H 'Content-Type: application/json' \
  -d '{
    "currentPassword":"a-secure-password",
    "newPassword":"a-new-secure-password"
  }'
```

A successful response is:

```json
{
  "status": true
}
```

## Sessions and protected routes

The global `AuthGuard` registered via `APP_GUARD` protects routes by default.
The root health-style response and feature flag evaluation endpoints are
explicitly wrapped with `@AllowAnonymous()` so the SDK stays contract-stable.

Authenticated requests send the JWT saved from login either as
`Authorization: Bearer <token>` or via the `flagflagflag_session` cookie.

## Database schema

The JWT-auth user schema lives in:

```text
migrations/2026-08-29T06-15-30.000Z-app-user.sql
```

The user table `app_user` stores:

- `id`
- `username`
- `email`
- `name`
- `passwordHash` (scrypt)

Authentication changes are persisted there; sessions are opaque bearer JWTs
signed with `JWT_SECRET` and require no server-side storage.
