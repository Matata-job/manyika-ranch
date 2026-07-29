# Deploy Manyika Ranch (Vercel + Neon + Supabase)

Recommended production stack:

| Layer | Service |
|-------|---------|
| App | [Vercel](https://vercel.com) |
| Database | [Neon](https://neon.tech) Postgres |
| Photos | [Supabase](https://supabase.com) Storage |

---

## 1. Create Neon database

1. Sign up at [neon.tech](https://neon.tech) → **New Project**
2. Copy the connection string (use the **pooled** URL for Vercel):
   `postgresql://...@...neon.tech/neondb?sslmode=require`
3. Keep it for `DATABASE_URL` below

---

## 2. Create Supabase Storage (photos)

1. Sign up at [supabase.com](https://supabase.com) → **New Project**
2. Go to **Project Settings → API** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server only — never put in browser code)
3. Create a **public** bucket named `animal-photos`:

### Option A — Dashboard

Storage → New bucket → name `animal-photos` → **Public bucket** → Create

### Option B — Script (from this repo)

```bash
# put Supabase vars in .env first
npm run storage:setup
```

4. (Optional) Storage → Policies: allow public **read**; uploads go through the Next.js API with the service role key.

---

## 3. Push code to GitHub

```bash
cd "/Users/john/Documents/App Ya Buu"
git init
git add .
git commit -m "Manyika Ranch livestock management — ready for deploy"
# Create a private repo on GitHub, then:
git remote add origin https://github.com/YOUR_USER/manyika-ranch.git
git branch -M main
git push -u origin main
```

---

## 4. Deploy on Vercel

1. [vercel.com/new](https://vercel.com/new) → Import the GitHub repo  
2. Framework: **Next.js** (auto)  
3. Add environment variables:

| Name | Value |
|------|--------|
| `DATABASE_URL` | Neon **pooled** connection string (`-pooler` in hostname) |
| `DIRECT_URL` | Neon **direct** connection string (no `-pooler`) — required for migrations |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_SECRET` | same as `AUTH_SECRET` |
| `AUTH_URL` | `https://YOUR_PROJECT.vercel.app` (update after first deploy if needed) |
| `NEXTAUTH_URL` | same as `AUTH_URL` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_URL` | same |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `SUPABASE_STORAGE_BUCKET` | `animal-photos` |

4. Click **Deploy**

`vercel.json` runs `prisma migrate deploy` during build so tables are created automatically.

---

## 5. Seed demo data (once)

From your laptop (with Neon `DATABASE_URL` in `.env`):

```bash
npm run db:seed
```

Or temporarily:

```bash
DATABASE_URL="postgresql://..." npm run db:seed
```

Then log in:

- Email: `owner@manyikaranch.co.tz`
- Password: `admin123`

**Change this password** after first login (or create real users under Users).

---

## 6. Custom domain (optional)

Vercel → Project → Settings → Domains → add `ranch.yourdomain.com`  
Then update `AUTH_URL` and `NEXTAUTH_URL` to that domain and redeploy.

---

## 7. Verify on phones (Singida camps)

1. Open the live URL in Chrome/Safari  
2. Sign in as supervisor  
3. **Add to Home Screen** (PWA)  
4. Register an animal with a photo (should upload to Supabase)  
5. Toggle airplane mode briefly — sync badge should show Offline / Pending  

---

## Local development reminder

```bash
cp .env.example .env
# start Postgres (Homebrew or docker compose)
npm run db:migrate:deploy   # or npm run db:push
npm run db:seed
npm run dev
```

Without Supabase vars, photos save to `public/uploads` (fine for local only).

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails on `migrate deploy` | Add `DIRECT_URL` (Neon direct, not pooled). Avoid running `migrate deploy` locally while Vercel is building. |
| Advisory lock timeout | Use `DIRECT_URL` for migrations; wait for in-progress Vercel deploy to finish, then redeploy |
| Login redirects loop | `AUTH_URL` / `NEXTAUTH_URL` must match the live HTTPS URL exactly |
| Photo upload fails | Bucket missing or wrong service role key; run `npm run storage:setup` |
| PWA not updating | Hard refresh; Serwist is enabled in production builds only |

---

## Cost (typical small ranch)

- Vercel Hobby: free for starting  
- Neon free tier: enough for early use  
- Supabase free tier: storage + API  

Upgrade when you have many staff online at once or large photo libraries.
