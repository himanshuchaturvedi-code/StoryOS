# Deploy StoryOS API on Render (Option B)

I can’t click inside your Render account; these are the exact steps that match this repo (`Dockerfile` + Prisma migrations).

## 1. Prerequisites

- Repo on GitHub (StoryOS): includes root `Dockerfile` and optional `render.yaml`.
- Postgres URL: **Render Postgres** (same project) or **Neon** (paste `DATABASE_URL`).

## 2. Postgres

In Render Dashboard: **New** → **PostgreSQL** (or use Neon dashboard).  
Copy **`DATABASE_URL`** (Internal URL works if API is on Render in the **same region/project**).

## 3. Web service (API)

**New** → **Web Service** → connect repo **StoryOS**.

| Setting | Value |
|--------|--------|
| **Branch** | `main` (or your default branch) |
| **Region** | Same as Postgres if using Render Postgres |
| **Environment** | **Docker** |
| **Dockerfile path** | `./Dockerfile` |
| **Instance type** | Free or Starter |

**Important:** Render sets **`PORT`** automatically. Nest reads `process.env.PORT` → **do not** override `PORT` in the dashboard unless you know you need it.

### Environment variables (Web Service → Environment)

| Key | Value |
|-----|--------|
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | Random string, **≥32 characters** |
| `NODE_ENV` | `production` |
| `ALLOWED_ORIGINS` | Your Vercel origin(s), comma-separated — e.g. `https://your-app.vercel.app` |

Deploy. Wait until the service is **Live**.

## 4. Health check

Open in a browser:

`https://YOUR-RENDER-SERVICE.onrender.com/api/health`

Expect: `{"ok":true}`

## 5. Run migrations (once per database)

From your laptop (easiest):

```bash
cd /path/to/StoryOS
export DATABASE_URL='postgresql://...'   # production URL
npm run db:deploy:railway
```

(Script name ends in `railway` for history; it’s `prisma migrate deploy` against `DATABASE_URL`.)

Alternatively use Render **Shell** (if available on your plan) with the same command after `DATABASE_URL` is set.

Then **seed** if you need demo users (optional):

```bash
# Only if seed is safe on this DB — uses dotenv with local .env by default)
# Prefer: run seed locally once pointed at prod DBonly if OK for your data policy
npm run db:seed --workspace=packages/database
```

(Uses `packages/database` dotenv; for prod-only runs, use a disposable DB or Neon branch first.)

## 6. Wire Vercel (frontend)

Vercel → Project → **Settings** → **Environment Variables**:

| Key | Value |
|-----|--------|
| `NEXT_PUBLIC_API_URL` | `https://YOUR-SERVICE.onrender.com` (**no** `/api` suffix) |

Redeploy the frontend (**Production** redeploy triggers rebuild so `NEXT_PUBLIC_*` applies).

## 7. Troubleshooting

| Symptom | Likely fix |
|---------|-------------|
| CORS errors in browser | Add exact Vercel URL to `ALLOWED_ORIGINS` (including `https://`). |
| 502 / service unhealthy | Logs on Render → DB connection (`DATABASE_URL`, SSL)? |
| Login 401 / DB errors | Migrations not run → run **`db:deploy:railway`**. |
