# Bibliarium — Visual taste board

Paste any URL into the sticky header: the link appears on a **Pinterest-style masonry board** with the best available preview (embed, oEmbed, Open Graph, image, fallback). Each save is also turned into a **structured, AI-readable profile** (topics, mood heuristics, `vector_ready_text`) so an external LLM can understand taste from **one export URL** — without crawling every original link.

## Stack

- **Next.js 14** (App Router) + **React** + **TypeScript**
- **Supabase Auth** — magic link + Google OAuth (`@supabase/ssr` + secure cookies)
- **Tailwind CSS** + **next-themes**
- **Framer Motion**
- **Balanced masonry columns** (greedy packing by estimated card height)
- **Prisma 5** + **SQLite** by default (`file:./dev.db`) — switch `provider` to `postgresql` for production
- **Cheerio** — HTML preview + cheap main-text extraction for `article` / `web` links
- **Zod** — API validation

## What’s implemented vs roadmap

| Area | MVP | Next steps |
| --- | --- | --- |
| Rich previews | YouTube, X/Twitter oEmbed, OG, images | Self-hosted **Iframely**, **metascraper** plugins |
| Article text | Cheerio body strip | **@mozilla/readability** or **article-extractor** |
| YouTube transcript | — | **youtube-transcript** (unofficial; add retries) |
| Screenshot fallback | — | **Playwright** capture job |
| AI summaries | Heuristic topics / mood / aesthetics | **OpenAI** / **Anthropic** batch job writing the same JSON shape |
| Queue / retries | Synchronous on `POST` | **BullMQ** + Redis, or Supabase Edge + cron |
| Embeddings | `vector_ready_text` field only | pgvector / hosted embeddings API |
| Auth | **Supabase** magic link + Google, per-user data, middleware | Passkeys, orgs |

## Prerequisites

- Node.js 18+
- A **Supabase** project (free tier is fine) for authentication

## Setup

1. **Install**

   ```bash
   npm install
   ```

2. **Environment**

   ```bash
   cp .env.example .env
   ```

   - `DATABASE_URL="file:./dev.db"` for local SQLite.
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Supabase → **Project Settings → API** (required for sign-in).
   - Optional: `NEXT_PUBLIC_APP_URL=https://your-domain.com` — used on `/u/[slug]/ai-profile` so JSON/Markdown URLs are absolute for LLM copy-paste when `Host` is missing.

3. **Supabase Auth configuration**

   In the Supabase dashboard:

   - **Authentication → URL configuration**
     - **Site URL**: `http://127.0.0.1:3333` for local dev (or your production origin).
     - **Redirect URLs** (add every origin you use):
       - `http://127.0.0.1:3333/auth/callback`
       - `http://127.0.0.1:3333/auth/confirm`
       - Production: `https://YOUR_DOMAIN/auth/callback` and `https://YOUR_DOMAIN/auth/confirm`
   - **Authentication → Providers → Google**: enable and add Web client ID / secret from Google Cloud Console.
   - **Authentication → Email**: enable email provider. Configure **SMTP** (or Supabase’s built-in mailer on hosted projects) so magic links are delivered.
   - **Authentication → Email templates** (recommended):
     - Magic link / sign-up confirmation should send users to your app using the same host as Site URL. For token-based links, set confirmation URL to include `/auth/confirm` if you use the OTP route (see `src/app/auth/confirm/route.ts`).
   - **Automatic identity linking** (optional but recommended): enable linking when a Google account shares an email with an existing magic-link user (Supabase dashboard → Auth settings), so one Prisma `User` row stays consistent.

4. **Database**

   ```bash
   npx prisma db push
   ```

5. **Seed** (optional — creates profile `slug=demo` with sample cards and public AI profile for smoke tests)

   ```bash
   npm run db:seed
   ```

   Seeded data lives under a fixed app user id in SQLite; **your real account after sign-in is separate** and starts with an empty board unless you add links.

6. **Dev**

   ```bash
   npm run dev
   ```

   If the app **crashes** or the console shows **`Cannot find module './xxx.js'`** under `.next/server`, the dev cache is stale — run **`npm run dev:clean`**.

   - Landing: [http://127.0.0.1:3333/](http://127.0.0.1:3333/) (port **3333** is fixed in `package.json`)
   - Board (signed in): [http://127.0.0.1:3333/board](http://127.0.0.1:3333/board)
   - Sign in: [http://127.0.0.1:3333/auth/signin](http://127.0.0.1:3333/auth/signin)
   - Analysis: [http://127.0.0.1:3333/analysis](http://127.0.0.1:3333/analysis)
   - After seed, public demo LLM page: [http://127.0.0.1:3333/u/demo/ai-profile](http://127.0.0.1:3333/u/demo/ai-profile)

## Auth flow (summary)

- **Landing `/`**: marketing + sign-in; signed-in users are redirected to `/board` by middleware.
- **Magic link**: user enters email on `/auth/signin` → Supabase sends link → browser hits `/auth/callback?code=…` (PKCE) or `/auth/confirm?token_hash=…&type=…` → session cookies set → redirect to safe `next` path (default `/board`).
- **Google**: OAuth redirect returns to `/auth/callback` with `next` preserved (only same-origin paths allowed — see `src/lib/auth/safe-next.ts`).
- **APIs**: `GET/POST /api/links`, collections, reorder, taste export (private slug), and `PATCH /api/user` require a valid Supabase session; Prisma rows are scoped by `userId`.
- **Sharing**: each link has `isPublic`; `/l/[id]` is readable without login only when `isPublic` is true. Master AI page + JSON/Markdown exports for a slug require `User.aiProfilePublic` **or** the signed-in owner.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint |
| `npm run verify` | Lint + production build (CI smoke) |
| `npm run db:seed` | Seed demo data |
| `npm run db:push` | Push schema |

## API (high level)

| Route | Purpose |
| --- | --- |
| `GET /api/auth/me` | Current session user (or `null`) |
| `PATCH /api/user` | Update `aiProfilePublic` for the signed-in user |
| `GET/POST /api/links` | List / add links for the current user |
| `GET/PATCH/DELETE /api/links/[id]` | Read (public or owner), update, delete |
| `PUT /api/links/reorder` | Persist sort order for current user’s ids |
| `GET /api/taste/export?slug=…&format=json\|md` | Export (owner always; others only if profile is public) |
| `GET/POST /api/collections` | List / create collections for current user |

## Product routes

- **`/`** — Landing + sign-in entry.
- **`/board`** — Masonry board (auth required).
- **`/l/[id]`** — Card overlay; public if `isPublic`, otherwise owner only.
- **`/analysis`** — Aggregate taste view + export links for **your** slug (auth required).
- **`/u/[slug]/ai-profile`** — LLM-oriented landing; visible if `aiProfilePublic` or you are the owner.

## GitHub Pages

This repo ships a **small static site** from the `docs/` folder (project overview + links to GitHub). The **full Next.js app** (API routes, middleware, Supabase, Prisma) cannot run on static GitHub Pages — use **Vercel**, **Railway**, **Fly.io**, or similar for production.

1. Push the repository to GitHub.
2. **Settings → Pages → Build and deployment**: set **Source** to **GitHub Actions** (not “Deploy from branch”).
3. Merge or push to `main`; the workflow **Deploy GitHub Pages** (`.github/workflows/github-pages.yml`) publishes `docs/` to Pages.
4. After the first run, open the site URL from the **Actions** / **Pages** environment (typically `https://<user>.github.io/<repo>/`).

## Security

- Server-side fetches use guarded redirects (`src/lib/url-security.ts`).
- OAuth/magic-link `next` parameter is validated to stay on the same origin path (`safe-next.ts`).
- Do not expose `DATABASE_URL` or Supabase **service role** keys to the browser; client only uses the **anon** key.
- `GET /api/links/[id]` returns **404** for non-public cards when the caller is not the owner (no id leakage).

## License

Private / your choice.
