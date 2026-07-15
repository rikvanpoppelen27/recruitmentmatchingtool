# Recruitmenttool

Recruitment-tool voor werving- en selectiebureaus. Haalt dagelijks vacatures
op (Adzuna), parst kandidaat-CV's, matcht kandidaten tegen vacatures met een
score + onderbouwing, en genereert voor kansrijke matches automatisch een
presentatie-PDF (frontsheet + CV) en een concept-introductiemail in de stijl
van de recruiter. Mails worden nooit automatisch verstuurd.

Zie [`PLAN.md`](./PLAN.md) voor de fase-indeling, status per fase en de
werkafspraken voor vervolgsessies.

## Tech stack

- Next.js 15 (App Router) + TypeScript
- PostgreSQL via Supabase (lokaal: Docker Postgres)
- Prisma (ORM)
- Zod (validatie op alle externe input)
- `@anthropic-ai/sdk` — alle Claude-calls gebundeld in `src/lib/ai/`
- `pdf-parse` / `mammoth` — CV-tekstextractie
- Playwright — frontsheet-HTML → PDF
- `pdf-lib` — frontsheet + CV samenvoegen
- Supabase Storage — CV's en gegenereerde PDF's
- Vitest — tests voor matching- en ontdubbelingslogica

## Installatie

1. **Dependencies installeren**
   ```bash
   npm install
   npx playwright install chromium
   ```

2. **Environment variabelen**
   ```bash
   cp .env.example .env
   ```
   Vul in elk geval `ANTHROPIC_API_KEY` in. Voor Adzuna-import (fase 1) ook
   `ADZUNA_APP_ID` / `ADZUNA_APP_KEY`. Voor Supabase Storage (fase 2+) de
   `SUPABASE_*`-variabelen.

3. **Lokale database (optioneel — of gebruik een Supabase-project)**
   ```bash
   docker compose up -d
   ```
   Gebruik je in plaats daarvan een Supabase-project: de directe host
   (`db.<project-ref>.supabase.co`) is IPv6-only. Geen IPv6? Gebruik dan de
   Supavisor-pooler-connectiestring uit het Supabase dashboard (zie
   `.env.example` voor het formaat).

4. **Database schema + seed**
   ```bash
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```
   De seed maakt één default `User` + `Market` aan (front-end development /
   Noord-Holland, Zuid-Holland) — er is nog geen login (zie fase 7 in
   `PLAN.md`).

## Gebruik per fase

Elke fase is los te draaien en te testen via een CLI-script; het dashboard
komt pas in fase 6.

```bash
npm run import                    # fase 1 — vacatures ophalen + ontdubbelen
npm run parse-cv -- <bestand>     # fase 2 — CV uploaden + parsen
npm run match                     # fase 3 — kandidaten matchen tegen vacatures
npm run frontsheet -- <matchId>   # fase 4 — frontsheet + presentatie-PDF genereren
npm run mail -- <matchId>         # fase 5 — mailconcept genereren
npm run dev                       # fase 6 — dashboard
npm test                          # Vitest (matching + ontdubbeling)
```

## Projectstructuur

```
prisma/            datamodel (schema.prisma) + seed-script
src/lib/ai/         alle Claude-calls, één bestand per functie + gedeelde client
src/lib/jobs/       JobSourceAdapter-interface + Adzuna-implementatie
src/lib/db/         Prisma client
src/lib/storage/    Supabase Storage client
src/lib/pdf/        PDF-generatie (Playwright) + samenvoegen (pdf-lib)
src/lib/cv/         CV-tekstextractie (PDF/DOCX)
src/lib/validation/ Zod-schema's voor externe input
src/app/            Next.js dashboard (fase 6)
scripts/            CLI-entrypoints per fase
templates/          vast frontsheet-HTML-template
tests/              Vitest — kernlogica matching + ontdubbeling
```
