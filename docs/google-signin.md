# Sign in (Google + passwordless email) + production PostgreSQL (Aiven)

How "Sign in with Google" works in Matrix Builder, exactly what to put in the Google Cloud
Console, and the environment variables to set on the Hugging Face Space (and Vercel) to wire
the production Aiven PostgreSQL.

## How sign-in works (no redirect URIs needed)

We use the **Google Identity Services token flow** — the browser gets a Google **ID token**,
not an OAuth `code`:

```
Browser (Sign in)  ──▶  Google returns an ID token (JWT)
   │  POST /api/v1/auth/google { credential }
   ▼
Matrix Builder API  ──▶  verifies the ID token (RS256, aud = our client id, iss = google)
   │                     and mints the SAME HS256 session JWT the API already uses
   ▼
Browser stores it as the bearer token  →  every API call is now scoped to that user (RLS)
```

Because the browser receives the token directly (no server-side `code` exchange), the OAuth
client needs **only Authorized JavaScript origins** — **redirect URIs are not required**.

## Google Cloud Console — OAuth client "matrixhub"

**APIs & Services → Credentials → Create OAuth client ID → Web application.**

### Authorized JavaScript origins
```
https://builder.matrixhub.io
https://www.matrixhub.io
https://matrixhub.io
https://ruslanmv-matrix-builder.hf.space
http://localhost:3000
http://localhost:7860
http://localhost:8000
```

### Authorized redirect URIs
Leave **empty** — our token flow does not use them. (Only add the entries below if you later
switch to a server-side authorization-code flow; not needed today.)
```
https://builder.matrixhub.io/api/builder/auth/google/callback
https://ruslanmv-matrix-builder.hf.space/api/builder/auth/google/callback
http://localhost:7860/api/builder/auth/google/callback
```

Copy the generated **Client ID** (looks like `xx␣.apps.googleusercontent.com`). It is public.
Settings can take 5 minutes to a few hours to propagate.

## Environment variables

### Backend — Hugging Face Space (Settings → Variables and secrets)

| Key | Type | Value |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Variable | the OAuth **Client ID** (public). Enables sign-in everywhere — the frontend reads it from `/api/v1/auth/status` at runtime, so **no rebuild** is needed. |
| `MB_JWT_SECRET` | Secret | ≥32-byte random (already set). Signs the session JWT. |
| `MB_JWT_AUDIENCE` | Variable | `authenticated` (default; optional) |
| `DATABASE_URL` | Secret | app role (least-privilege `matrix_app`) — see below |
| `MIGRATION_DATABASE_URL` | Secret | privileged `avnadmin` role, used only by migrations |
| `DB_POOL_SIZE` | Variable | `5` (Aiven plan connection limit is 20) |
| `DB_MAX_OVERFLOW` | Variable | `2` |

### Aiven PostgreSQL DSNs (service `pg-3113274d`, port `23188`, `sslmode=require`)

Use the SQLAlchemy + psycopg3 scheme `postgresql+psycopg://`:

```bash
# App connection — NON-superuser role so per-user row-level security applies (ADR 0002):
DATABASE_URL=postgresql+psycopg://matrix_app:APP_PASSWORD@pg-3113274d-matrix-builder.a.aivencloud.com:23188/defaultdb?sslmode=require

# Migrations only (owns the schema):
MIGRATION_DATABASE_URL=postgresql+psycopg://avnadmin:AVNADMIN_PASSWORD@pg-3113274d-matrix-builder.a.aivencloud.com:23188/defaultdb?sslmode=require
```

Before first use:
1. **Power the service on** in the Aiven console (it shows *Powered off*). Consider the
   $5/month upgrade to prevent automatic power-off during inactivity.
2. Create the `matrix_app` role + tables + RLS, then run migrations as `avnadmin`
   (`make migrate` with `MIGRATION_DATABASE_URL` set). Full steps: [aiven.md](aiven.md).
3. With `DATABASE_URL` unset the app stays in in-memory demo mode; setting it switches to
   real persistence (saved bundles, build timeline per signed-in user).

### Frontend — Vercel (optional)

The UI discovers the client id from the backend at runtime, so nothing is required. To inline
it at build time instead (one less request), set **`NEXT_PUBLIC_GOOGLE_CLIENT_ID`** in the
Vercel project. For the HF image you can pass `--build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID=…`.

## Passwordless email sign-in (Resend) — and "password recovery"

Matrix Builder has **no passwords**. The sign-in modal offers **Continue with Google** *and*
**Continue with email**. The email path is a magic link:

```
Enter email  →  POST /api/v1/auth/email/request
   → backend mints a 15-min signed token, emails a confirm link via Resend
User clicks link  →  /auth/verify?token=…  →  POST /api/v1/auth/email/verify
   → backend verifies the token, mints the session JWT  →  signed in
```

**There is nothing to "recover".** Because access is proven by your inbox, the recovery flow
*is* the sign-in flow: if you can't get in, request a new link. No password store, no reset
form, no password hashes to leak — the modern, more secure pattern.

### Where to put the Resend API key on Hugging Face

**Space → Settings → Variables and secrets:**

| Key | Type | Value |
|---|---|---|
| `RESEND_API_KEY` | **Secret** | your Resend key, e.g. `re_xxxxxxxx` (unset = dev mode: the link is only logged, not sent) |
| `EMAIL_FROM` | Variable | a **verified** Resend sender, e.g. `Matrix Builder <noreply@matrixhub.io>` (or `onboarding@resend.dev` while testing) |
| `PUBLIC_APP_URL` | Variable | the public origin the magic link points to — `https://ruslanmv-matrix-builder.hf.space` (HF) or `https://builder.matrixhub.io` (Vercel) |

Get the key at **resend.com → API Keys → Create**. To send from `@matrixhub.io`, verify the
domain in Resend (Domains → Add) — your DNS already has the `resend._domainkey` + SPF records
for `matrixhub.io`, so that part is done; point `EMAIL_FROM` at an address on the verified
domain. The backend calls Resend's REST API with stdlib only (no extra dependency).

## What's implemented

- Backend: `POST /api/v1/auth/google` (Google ID token) and `POST /api/v1/auth/email/request`
  + `POST /api/v1/auth/email/verify` (magic link) both mint the same session JWT;
  `GET /api/v1/auth/status` reports `google_client_id` + `email_enabled`.
  (`app/core/google_auth.py`, `app/core/email_auth.py`)
- Frontend: a **Sign in** button (top bar) opens the "Save your Matrix Bundle" modal with
  **Continue with Google** + **Continue with email**; the email link lands on `/auth/verify`,
  stores the session, and returns to the app. The user chip + **Sign out** then appear.
