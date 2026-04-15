# Деплой полного Bibliarium (Vercel + Postgres)

GitHub Pages отдаёт только статику из `docs/`. Полное приложение (Next.js, API, Prisma, Supabase Auth) нужно хостить на **Vercel** с **PostgreSQL**.

## 1. База: Supabase Postgres или Neon

**Supabase (один проект: Auth + Postgres)** — в Dashboard **Connect** → **ORM** → **Prisma** скопируй две строки:

- **`DATABASE_URL`** — connection pooling (порт **6543**, в URI есть `?pgbouncer=true`).
- **`DIRECT_URL`** — direct / session (порт **5432**), для `prisma migrate deploy`. Подставь тот же пароль БД, что при создании проекта.

Локально без пулера в `.env` задай **`DIRECT_URL`** = тому же значению, что **`DATABASE_URL`** (см. `.env.example`).

**Neon** (только Postgres): pooled URL в `DATABASE_URL`, direct (non-pooled) в `DIRECT_URL` — из панели Neon **Connect**.

## 2. Supabase

В **Authentication → URL configuration** добавь:

- **Site URL**: `https://<твой-проект>.vercel.app`
- **Redirect URLs**:  
  `https://<твой-проект>.vercel.app/auth/callback`  
  `https://<твой-проект>.vercel.app/auth/confirm`

## 3. Vercel

1. [vercel.com](https://vercel.com) → **Add New… → Project** → импорт репозитория GitHub.
2. **Environment Variables** (обязательно для того окружения, с которого открываешь сайт: для **Production** — если заходишь на основной домен Vercel; для **Preview** — отдельно, если тестируешь ссылку деплоя ветки):

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Postgres **pooled** (Supabase Connect → Prisma, или Neon pooled) |
| `DIRECT_URL` | Postgres **direct** для миграций (Supabase вторая строка из Connect, или Neon direct) |
| `NEXT_PUBLIC_SUPABASE_URL` | из Supabase → API (URL проекта) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon **public** key |
| `NEXT_PUBLIC_APP_URL` | `https://<твой-проект>.vercel.app` |

Опционально вместо пары `NEXT_PUBLIC_*` можно задать **`SUPABASE_URL`** и **`SUPABASE_ANON_KEY`** (те же значения): они читаются на сервере в рантайме и пробрасываются в страницу — удобно, если менял ключи без полной пересборки клиента.

После первого добавления переменных нажми **Redeploy** (иначе старый клиентский бандл может остаться без ключей).

3. **Build** уже задан в `vercel.json`: `prisma generate && prisma migrate deploy && next build` — при первом деплое применится миграция `20260414120000_init`.

4. После деплоя вручную один раз (или через Vercel CLI / SQL editor Neon) выполни сид демо-данных, если нужны:

   ```bash
   DATABASE_URL="…pooled…" DIRECT_URL="…direct…" npx tsx prisma/seed.ts
   ```

   Либо зайди на сайт, зарегистрируйся и пользуйся пустой доской.

## 4. Автодеплой из GitHub (опционально)

В репозитории: **Settings → Secrets → Actions** добавь:

- `VERCEL_TOKEN` — [Vercel → Account → Tokens](https://vercel.com/account/tokens)
- `VERCEL_ORG_ID` и `VERCEL_PROJECT_ID` — из **Project → Settings → General**

Workflow `.github/workflows/vercel-deploy.yml` при пуше в `main` выкатывает **production**.

## 5. Локальная разработка с Postgres

```bash
docker compose up -d
cp .env.example .env
# при необходимости поправь DATABASE_URL
npx prisma migrate deploy
npm run db:seed
npm run dev
```

## Расширение браузера

В **options** расширения укажи **Base URL** продакшена (`https://….vercel.app`) и выдай **HTTPS** через кнопку «Request HTTPS access», затем снова открой `/extension/connect` на проде и вставь JSON сессии.
