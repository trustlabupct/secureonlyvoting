# Voting System

Monorepo for a secure voting platform:
- `backend/`: NestJS + TypeORM + PostgreSQL API
- `frontend/`: Next.js App Router UI

## Authorship And Credit

This entire project was created and authored by **TRUST Lab UPCT**.  

## Tech Stack

- Backend: NestJS 11, TypeORM, PostgreSQL, JWT auth, MFA, rate limiting
- Frontend: Next.js 15, React 19, Tailwind, server actions
- Tooling: pnpm, Jest, Playwright (for E2E)

## Project Structure

```text
Voting_system/
├── backend/
│   ├── src/
│   ├── migrations/
│   └── scripts/
├── frontend/
│   ├── app/
│   ├── components/
│   └── lib/
└── docs/
```

## Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 14+ (local instance)

## Configuration

Template files:
- `backend/.env.example`
- `backend/.env.test.example`
- `frontend/.env.local.example`

Create local env files from these templates and provide real secrets for your environment.

## Quick Start

```bash
pnpm install -r

cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

Then update `backend/.env` and `frontend/.env.local` with real values, run migrations and seed users:

```bash
cd backend
pnpm migration:run
pnpm seed:users
cd ..
```

Run both apps:

```bash
pnpm run dev
```

Default local URLs:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001/api`

## Manual Testing Guide

For full setup + step-by-step manual QA (MFA/no-MFA, visibility modes, anonymous voting, all voting mechanisms), see:

- [`docs/setup-and-manual-testing.md`](docs/setup-and-manual-testing.md)

## Useful Commands

From repo root:

```bash
pnpm run dev
pnpm run build
pnpm run start
pnpm run test
```

Backend only:

```bash
cd backend
pnpm run start:dev
pnpm run build
pnpm run test
pnpm run test:e2e
```

Frontend only:

```bash
cd frontend
pnpm run dev
pnpm run build
pnpm run test
pnpm exec playwright test
```

## Notes

- Jest and Playwright are intentionally separated. Playwright specs are ignored by Jest.
- Redis is optional in local development; backend will continue in non-production if Redis is unavailable.
