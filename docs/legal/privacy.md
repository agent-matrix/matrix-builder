# Privacy Policy

_Last updated: 13 June 2026_

Matrix Builder is an open‑source project. We keep data collection to the minimum needed to run
the service, and we **never sell your data**.

## What we collect
- **Account:** your email address, and (if you sign in with Google) your name and profile photo.
- **Your work:** the ideas you describe and the Matrix Bundles you generate.
- **Basic logs:** standard request/error logs to operate and secure the service.

## How we use it
Only to provide the service: authenticate you, save and show your bundles, send account emails
(verification, password reset), and keep the service secure. That's it.

## Where it lives (sub‑processors)
- **Google** — "Sign in with Google" (only if you choose it). See Google's Privacy Policy.
- **Resend** — sends account emails (verification, password reset).
- **Aiven (PostgreSQL)** — stores your account and bundles.
- **Hugging Face / Vercel** — host the application.

We share data with these providers only as needed to run the service.

## Storage in your browser
A sign‑in token is stored in your browser's `localStorage` to keep you signed in. We don't use
advertising or tracking cookies.

## Security
Passwords are hashed (PBKDF2‑HMAC‑SHA256, never stored in plain text), connections use TLS, and
**per‑user row‑level security** isolates each user's data in the database.

## Your choices
- Want your account and data deleted? Email **contact@ruslanmv.com** and we'll remove it.
- Prefer full control? Matrix Builder is open source — **self‑host it** and own your data end to
  end.

## Children
The service is not directed to children under 13.

## Changes
We may update this policy; material changes are reflected in the "last updated" date.

## Contact
**contact@ruslanmv.com** · [GitHub](https://github.com/agent-matrix/matrix-builder)
