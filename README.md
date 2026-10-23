# UpgradeHub

AI Study Coach + Academic Campus & Rewards. Next.js 15, React 19, TypeScript, Tailwind, Supabase Auth, Gemini.

## Local run

```bash
npm install
cp .env.example .env.local     # keys bharo
npm run dev                    # http://localhost:3000
```

## Environment variables

| Variable | Kahan | Note |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | public, RLS se secure |
| `GEMINI_API_KEY` | **sirf server** | secret, `NEXT_PUBLIC_` kabhi nahi |
| `GEMINI_MODEL` | sirf server | default `gemini-flash-latest` |

## Security model

- `/api/ai/coach` sirf logged-in Supabase users ke liye hai (Bearer token server par verify hota hai).
- Per-user rate limit (10 req/min), body size limit, input whitelist/sanitize, Gemini key header mein (URL mein nahi).
- Database access Row Level Security se: `supabase/migrations/001_init.sql`.
- `service_role` key is project mein kahin use nahi hoti. Kabhi client code mein mat daalna.

## Deploy

Steps ke liye project ke saath diye gaye deploy guide dekho (GitHub push, Supabase SQL + Auth URL, Vercel env vars).
