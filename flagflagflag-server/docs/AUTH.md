# Authentication

The server uses [Better Auth](https://better-auth.com/) through
`@thallesp/nestjs-better-auth`.

Authentication uses username/password credentials and database-backed sessions.
Better Auth routes are mounted below `/api/auth`.

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

Set the Better Auth URL when running somewhere other than local development:

```bash
BETTER_AUTH_URL=https://flags.example.com
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
curl -i -c cookies.txt \
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

The response also sets the Better Auth session cookie. The cookie is the
normal authentication mechanism for subsequent requests.

## Creating users

Create a user with the email signup endpoint. The username plugin allows the
new account to be used with username login:

```bash
curl -i -c new-user-cookies.txt \
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

The request must include the authenticated Better Auth session cookie:

```bash
curl -i -b new-user-cookies.txt \
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

The NestJS Better Auth integration registers a global authentication guard.
Routes are protected by default. The root health-style response and feature
flag evaluation endpoint are explicitly anonymous so the current SDK can use
them.

Authenticated requests send the session cookie saved during login:

```bash
curl -b cookies.txt http://localhost:3000/some-protected-route
```

Better Auth also provides its standard session and sign-out endpoints below
`/api/auth`.

## Database schema

The Better Auth schema is checked in under:

```text
migrations/2026-08-29T05-34-40.649Z.sql
```

The application reads and executes the migration files on startup to initialize
the required tables. Projects own environments, and feature flags belong to an
environment. Environment names are database values rather than an enum, so each
project can define its own environments.

Feature flag evaluation accepts required `projectId` and `environment` query
parameters. Create projects with `POST /projects`, environments with
`POST /projects/:projectId/environments`, and flags with `POST /feature-flags`.

The schemas use Better Auth's standard `user`, `session`, `account`, and
`verification` tables and are designed to work with both SQLite and PostgreSQL.
