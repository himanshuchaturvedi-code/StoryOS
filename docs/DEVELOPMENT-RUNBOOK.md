# StoryOS Development Runbook

This runbook gets the application into a testable local development state.

## Prerequisites

- Node.js >= 20
- Docker (for Postgres)
- npm

## Step-by-Step Setup

### 1. Start the database

```bash
docker compose up -d
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run migrations

```bash
npm run db:migrate
```

### 4. Seed data

```bash
npm run db:seed
```

This seeds:
- Participant role types (CAVCO positions)
- **Dev user**: `dev@storyos.local` / `password123`
- **Organization**: StoryOS Dev
- **Project**: Dev Feature Film
- **Budget**: Production Budget with locked version
- **Program**: Dev Tax Credit Program (EXPENDITURE_THRESHOLD)
- **Submission**: Ready for evaluation

### 5. Build (required before first dev run)

```bash
npm run build
```

This builds `@storyos/types`, `@storyos/database`, and `@storyos/api`. The API must be built before `npm run dev` can start it.

### 6. Start API and Web

```bash
npm run dev
```

This starts both apps via Turbo:
- **API**: http://localhost:3001
- **Web**: http://localhost:3000

### 7. Login

1. Open http://localhost:3000
2. You will be redirected to the login page
3. Sign in with:
   - **Email**: `dev@storyos.local`
   - **Password**: `password123`
4. After login, the app redirects to the dashboard. The organization "StoryOS Dev" is auto-selected.

### 8. Test evaluation

1. Go to **Projects** → **Dev Feature Film**
2. Open the **Programs** tab
3. You should see the **Dev Tax Credit Program** enrollment with a submission
4. Click **Evaluate**
5. The calculator runs (EXPENDITURE_THRESHOLD). With $1.8M in eligible expenses and a $1M minimum, the result should be **PASS**.

## Environment Configuration

- Use **only** the root `.env` file at the project root
- Do **not** create `packages/database/.env` — it causes conflicts
- Prisma commands load env from root via `dotenv-cli`

## Quick Setup (one-liner)

```bash
docker compose up -d && npm install && npm run build && npm run dev:setup && npm run dev
```

Then open http://localhost:3000 and login with `dev@storyos.local` / `password123`.

## Import Telefilm Budget Template

To import the Telefilm documentary budget template:

```bash
npx ts-node scripts/import-telefilm-template.ts
```

Or via npm script:

```bash
npm run import:telefilm
```

Requires: `npm run build` first, `.env` with `DATABASE_URL`, and at least one organization (run `npm run db:seed` if needed).

The template appears at **Settings → Budget Templates → Telefilm Documentary Budget**.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Prisma can't connect | Ensure `.env` exists at root with `DATABASE_URL` |
| "Select an organization" | Login first; seed creates org + membership |
| No projects | Run `npm run db:seed` |
| Login fails | Check API is running on port 3001; verify CORS allows localhost:3000 |
