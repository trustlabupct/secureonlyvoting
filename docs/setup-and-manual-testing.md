# Setup And Manual Testing Runbook

## Authorship And Credit

This entire project was created and authored by **Volodymyr Dubetskyy**.  
All project credit for the architecture, implementation, and product direction belongs to **Volodymyr Dubetskyy**.

## Purpose

This runbook covers:
- local setup
- database bootstrap
- starting frontend + backend
- full manual QA for auth, MFA, poll visibility, anonymous voting, and all supported voting mechanisms

## Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 14+

## 1) Configure Environment

From repository root:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

Set `backend/.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_postgres_password
DB_DATABASE=voting_system

JWT_SECRET=your_long_random_secret
JWT_REFRESH_SECRET=your_long_random_refresh_secret
JWT_EXPIRATION_TIME=3600s
NODE_ENV=development
```

Set `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
JWT_SECRET=the_same_value_as_backend_jwt_secret
```

Notes:
- Keep frontend `JWT_SECRET` equal to backend `JWT_SECRET`.
- Do not use `NODE_ENV=test` for normal manual app testing.

## 2) Create Database

If database does not exist yet:

```bash
psql -U postgres -h localhost -c "CREATE DATABASE voting_system;"
```

## 3) Install Dependencies

From repository root:

```bash
pnpm install -r
```

## 4) Apply Migrations And Seed Users

```bash
cd backend
pnpm migration:run
pnpm seed:users
cd ..
```

Seeded test credentials:
- `admin@certificates.local / admin123` (admin)
- `hr@example.com / admin123` (admin)
- `user@example.com / user123` (regular user)

## 5) Start The System

From repository root:

```bash
pnpm dev
```

Local URLs:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001/api`

## 6) Manual QA Checklist

### A. Authentication And Roles

1. Open `http://localhost:3000/login`.
2. Login as `user@example.com`.
3. Confirm regular user can access dashboard and non-admin pages.
4. Logout, login as `hr@example.com` or `admin@certificates.local`.
5. Confirm admin-only pages are available (`/admin/dashboard`, poll creation controls).

### B. MFA / No-MFA Flow

1. Login with a user that has MFA disabled.
2. Open MFA security page (`/account/security/mfa`), enable MFA, scan QR in authenticator app.
3. Logout and login again; confirm MFA challenge is required.
4. Verify login using TOTP code.
5. Generate and copy recovery codes.
6. Logout and verify recovery-code login works.
7. Confirm reused recovery code is rejected.
8. Disable MFA and verify login returns to no-MFA path.

### C. Poll Visibility Rules

Create one poll of each visibility mode and verify with admin + regular account:

1. `everyone`:
   - regular user can view poll details.
2. `admin-only`:
   - regular user is denied;
   - admin can view.
3. `specific-groups`:
   - regular user without matching group is denied;
   - admin can view.

### D. Voting Mechanisms

Create and submit votes for:

1. `yes-no`
2. `multiple-choice`
3. `multiple-selection`
4. `ranking`
5. `rating`
6. `text-response`

For each mechanism, verify:
- valid payload is accepted
- invalid payload is rejected (mechanism-specific validation)
- duplicate vote behavior matches rules

### E. Result Visibility Behavior

1. As non-admin user, confirm results are hidden before voting when policy requires voter participation.
2. Vote in the poll and confirm results become visible when expected.
3. As admin, confirm results access behavior is available as expected.

### F. Anonymous Voting / Blind Token

1. Use `/anonymous-vote`.
2. Select anonymous-enabled poll.
3. Authenticate to request blind token.
4. Submit anonymous vote with blind token.
5. Attempt to reuse the same blind token and confirm rejection.

## 7) Optional Verification Commands

Backend e2e:

```bash
cd backend
pnpm test:e2e
```

Backend build:

```bash
cd backend
pnpm build
```

Frontend tests:

```bash
cd frontend
pnpm test
```
