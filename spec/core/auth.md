# Authentication

## Overview

Two-cookie session model: user session and admin session. Each uses a separate cookie with distinct path scope.

## Cookie Design

| Cookie           | Path   | Purpose                    |
|------------------|--------|----------------------------|
| `__session`      | `/`     | User session (signed-in)   |
| `__admin_session`| `/admin`| Admin session (admin panel)|

Both cookies store the raw token (not hashed). The database stores the token hash (SHA-256).

## Session Flow

1. **Signup/Signin**: Auth endpoint validates credentials, creates session row, returns `setCookie` header string
2. **RR action**: Form action calls auth API, receives `setCookie`, redirects with `headers: { "Set-Cookie": res.setCookie }`
3. **Loader**: `requireUser` / `requireAdmin` parses cookie, calls `/auth/session` or `/admin/auth/session` with token, gets claims

## Endpoints

### User Auth

- `POST /auth/signup` - Create account, issue user session
- `POST /auth/signin` - Validate credentials, issue user session
- `POST /auth/signout` - Clear user cookie
- `POST /auth/session` - Validate token, return claims (userId, email, name, role, kind)

### Admin Auth

- `POST /admin/auth/signin` - Validate credentials + role=admin, issue admin session
- `POST /admin/auth/signout` - Clear admin cookie
- `POST /admin/auth/session` - Validate token, return claims (admin only)

## Password Hashing

- **Algorithm**: Argon2id
- **Library**: `argon2`

## Session Storage

- **Table**: `sessions` (id, user_id, kind, token_hash, expires_at, created_at, revoked_at)
- **TTL**: 14 days
- **Token**: 32 bytes base64url, hashed with SHA-256 for storage

## Bootstrap Admin

First admin creation options:

1. **Env var**: `BOOTSTRAP_ADMIN_EMAIL` - if signup email matches, set role to admin
2. **CLI script**: `node scripts/make-admin.ts email@example.com` - one-time promotion
