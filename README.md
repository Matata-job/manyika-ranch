# Manyika Ranch — Livestock Management System

Web + PWA livestock management for multi-camp ranch operations in Singida, Tanzania.

## Features

- Multi-camp management with role-based access (Owner, Manager, Supervisor, Vet, Clerk, External Owner, Viewer)
- Animal registry: eartag, photo, breed, sex, DOB, age, owner, sire/dam pedigree
- Health, vaccinations, treatments, weights
- Camp movements with audit trail
- Breeding / calving
- Death & culling records + insurance claim fields
- Cattle event timeline (auto + manual)
- Offline-capable PWA with sync queue
- Reports: camp inventory, vaccination due, mortality, CSV import
- Swahili translation keys ready for field staff

## Tech stack

- Next.js 15, TypeScript, Tailwind CSS
- PostgreSQL + Prisma
- Auth.js (NextAuth v5) with RBAC
- Serwist PWA + Dexie offline queue
- Supabase Storage for animal photos (local fallback in development)

## Quick start (local)

```bash
npm install
cp .env.example .env
# Start PostgreSQL, then:
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Demo logins

| Email | Password | Role |
|-------|----------|------|
| owner@manyikaranch.co.tz | admin123 | Owner |
| manager@manyikaranch.co.tz | admin123 | Farm Manager |
| supervisor@manyikaranch.co.tz | admin123 | Camp Supervisor (Alpha + Beta only) |
| vet@manyikaranch.co.tz | admin123 | Veterinarian |
| investor@example.com | admin123 | External Owner |

## Production deploy

**Full guide:** see [DEPLOY.md](./DEPLOY.md)

Summary: **Vercel** (app) + **Neon** (Postgres) + **Supabase** (photos).

```bash
# After creating Supabase project and putting keys in .env:
npm run storage:setup
# Push to GitHub → Import on Vercel → set env vars → Deploy
# Then seed once:
DATABASE_URL="your-neon-url" npm run db:seed
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Local development |
| `npm run build` | Generate Prisma client, migrate DB, build Next.js |
| `npm run db:migrate:deploy` | Apply migrations (production / CI) |
| `npm run db:seed` | Seed demo ranch data |
| `npm run storage:setup` | Create Supabase `animal-photos` bucket |

## Project structure

```
src/
├── app/           # Pages + API routes
├── components/    # UI
├── lib/
│   ├── auth/      # RBAC + API guards
│   ├── db/        # Prisma
│   ├── storage.ts # Supabase / local uploads
│   ├── sync/      # Offline queue
│   └── services/  # Domain logic
prisma/
├── schema.prisma
├── migrations/
└── seed.ts
```

## License

Private — Manyika Ranch
