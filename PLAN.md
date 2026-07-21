# PLAN — Recruitmenttool

Recruitment-tool voor werving- en selectiebureaus: vacature-import, CV-parsing,
matching, frontsheet- en mailgeneratie, tot slot een dashboard. Zie README.md
voor projectomschrijving en installatie.

## Werkafspraken

- Lees dit bestand aan het begin van elke sessie.
- Werk aan **één fase tegelijk**; vraag bevestiging voordat je aan de
  volgende fase begint.
- Werk dit bestand bij na afronding van een fase: zet de Status op
  **Klaar** en vul "Geleerd" (max 5 regels).
- Compacte antwoorden en code; geen speculatieve features die niet in dit
  document staan.
- Elke fase is onafhankelijk testbaar via een CLI-script in `scripts/` — het
  dashboard (fase 6) komt pas als alles daarvoor werkt.

## Statusoverzicht

| Fase | Onderdeel                          | Status        |
| ---- | ----------------------------------- | ------------- |
| 1    | Adzuna-import + ontdubbeling        | Klaar |
| 2    | CV-upload + parsing                 | Klaar |
| 3    | Matching-engine                     | Nog niet gestart |
| 4    | Frontsheet + PDF-generatie          | Nog niet gestart |
| 5    | Stijlprofiel + mailgeneratie        | Nog niet gestart |
| 6    | Dashboard                           | Nog niet gestart |
| 7    | Multi-user (stub)                   | Nog niet gestart |

---

## Fase 1 — Adzuna-import + ontdubbeling + opslag

**Doel:** dagelijks vacatures ophalen via de Adzuna API voor het ingestelde
domein en de ingestelde regio's (twee aparte API-calls), ontdubbelen en
opslaan.

**Bestanden:**
- `src/types/vacancy.ts` — uniform `Vacancy`-type
- `src/lib/sources/types.ts` — `JobSourceAdapter`-interface
- `src/lib/sources/adzuna.ts` — Adzuna-implementatie van `JobSourceAdapter`
- `src/lib/validation/adzuna.ts` — Zod-schema's voor Adzuna-responses
- `src/config/import.ts` — zoekterm-varianten, regio's, paginering (standaardconfig)
- `src/lib/dedupe.ts` — normalisatie + ontdubbeling (binnen run én tegen bestaande data)
- `src/lib/db/prisma.ts` — Prisma client singleton
- `prisma/seed.ts` — seed van default `User` + `Market` (front-end development / Noord-Holland, Zuid-Holland)
- `scripts/import.ts` — CLI: `npm run import`
- `tests/dedupe.test.ts` — Vitest voor normalisatie- en ontdubbelingslogica

**Definition of done:**
- `npm run import` haalt vacatures op voor beide regio's, dedupliceert op
  genormaliseerde bedrijfsnaam + functietitel + plaats, en slaat nieuwe
  vacatures op in `Vacancy`.
- Draait twee keer achter elkaar: de tweede keer 0 nieuwe records, bestaande
  rijen krijgen alleen een bijgewerkte `lastSeenAt`.
- `tests/dedupe.test.ts` slaagt.

> Vacature-analyse (skills/must-haves/senioriteit via `analyseVacature`) zit
> **niet** in fase 1 — dat gebeurt in fase 3, vlak vóór de match-berekening.

**Status/Geleerd:** Klaar. Geverifieerd met een echte importrun (11 vacatures
Noord-/Zuid-Holland) + herhaalde run (0 nieuw, `lastSeenAt` bijgewerkt) +
groene tests. Supabase's directe host (`db.*.supabase.co`) is IPv6-only —
zonder IPv6 op de machine moet je de Supavisor-pooler gebruiken (transaction
6543 voor `DATABASE_URL`, session 5432 voor `DIRECT_URL`). Dedupe-hash is
databasebreed uniek → ontdubbeling moet globaal over alle regio's samen,
niet per regio apart, anders crasht een vacature die in twee regio's opduikt.

---

## Fase 2 — CV-upload + parsing

**Doel:** CV (PDF/DOCX) uploaden en via Claude parsen naar gestructureerde
kandidaatdata. Ontbrekende gegevens worden `null`, nooit verzonnen.

**Bestanden:**
- `src/lib/cv/extract.ts` — tekstextractie (pdf-parse / mammoth), magic-byte-detectie, gescand-PDF-check
- `src/lib/cv/normalizePhone.ts` — E.164-normalisatie (libphonenumber-js), los en testbaar
- `src/lib/storage/supabase.ts` — Supabase Storage client (upload + bucket-aanmaak)
- `src/lib/ai/parse-cv.ts` — CV-tekst → naam, contactgegevens, skills, ervaring, opleidingen, talen, regio, beschikbaarheid
- `src/lib/validation/cv.ts` — Zod-schema voor parse-cv-output
- `scripts/parse-cv.ts` — CLI: `npm run parse-cv -- <bestand-of-map>`
- `tests/parse-cv.test.ts` — Vitest voor telefoonnormalisatie + Zod-schema
- `test-cvs/` — twee gegenereerde voorbeeld-CV's (met/zonder telefoonnummer) voor een echte testrun

**Definition of done:**
- `npm run parse-cv -- ./test-cvs/jan-jansen.pdf` uploadt het CV naar Supabase
  Storage, extraheert tekst, parset via Claude en slaat een `Candidate` +
  `Education[]`/`WorkExperience[]`-records op.
- Een CV zonder telefoonnummer geeft `phone: null` en een duidelijke
  waarschuwing, geen verzonnen nummer.
- Twee keer hetzelfde CV parsen (hash-vergelijking) levert één kandidaat op.
- Retry (max 2) bij ongeldige JSON; bij blijvende fout stopt het script met
  een duidelijke foutmelding — geen halve/verzonnen data wordt opgeslagen.
- `tests/parse-cv.test.ts` slaagt.

**Status/Geleerd:** Klaar. Echte parse-run geverifieerd: telefoon correct naar
E.164, CV zonder telefoon → `null` + waarschuwing (geen verzonnen nummer),
zelfde CV twee keer → 1 kandidaat (hash-dedupe, bucket-bestand overschreven).
`yearsExperience` bleef terecht `null` i.p.v. berekend uit datums. Tests
groen (20/20). pdf-lib's PDF-output bleek onleesbaar voor pdf-parse's oudere
pdf.js — testfixtures daarom met Playwright/Chromium gerenderd.

---

## Fase 3 — Matching-engine + kalibratiescript

**Doel:** elke actieve kandidaat matchen tegen elke nieuwe vacature; score
0-100 met onderbouwing, gemarkeerd als "kansrijk" boven de drempel van de
`Market` (start 90).

**Bestanden:**
- `src/lib/ai/analyseVacature.ts` — vacaturetekst → skills/must-haves/nice-to-haves/senioriteit (verplaatst uit fase 1)
- `src/lib/ai/berekenMatch.ts` — skill-overlap (gewogen op must-haves) + semantische vergelijking → score + onderbouwing
- `src/lib/validation/ai.ts` — Zod-schema voor vacature-analyse en match-output
- `scripts/match.ts` — CLI: `npm run match` (matcht + kalibratiemodus om drempel/gewichten te testen tegen bekende voorbeelden)
- `tests/matching.test.ts` — Vitest voor de score-berekening (kernlogica, geen 100% coverage-doel)

**Definition of done:**
- `npm run match` analyseert eerst nog niet-geanalyseerde vacatures
  (`analyzedAt IS NULL`) en maakt daarna voor elke (actieve kandidaat, nieuwe
  vacature)-combinatie een `Match` aan met score, `matchedSkills`/
  `missingSkills`, `rationale` en `isPromising` (score >= `Market.threshold`).
- Draait idempotent: bestaande matches worden herberekend, niet gedupliceerd
  (`@@unique([candidateId, vacancyId])`).
- `tests/matching.test.ts` slaagt en dekt in elk geval: volledige match,
  gedeeltelijke match, ontbrekende must-have skill.

**Status/Geleerd:** _(nog niet gestart)_

---

## Fase 4 — Frontsheet-template + PDF-generatie + samenvoegen

**Doel:** per kansrijke match een frontsheet genereren (samenvatting
kandidaat, waarom deze match, relevante ervaring) op basis van een vast
template, als PDF, samengevoegd met het originele CV (frontsheet eerst).

**Bestanden:**
- `templates/frontsheet.html` — vast HTML-document-template
- `src/lib/ai/genereerFrontsheet.ts` — match + kandidaat + vacature → invulvelden voor het template
- `src/lib/pdf/generateFrontsheetPdf.ts` — HTML → PDF via Playwright (headless Chromium)
- `src/lib/pdf/mergePdf.ts` — frontsheet-PDF + CV → presentatie-PDF via pdf-lib
- `scripts/frontsheet.ts` — CLI: `npm run frontsheet -- <matchId>`

**Definition of done:**
- `npm run frontsheet -- <matchId>` genereert de frontsheet-inhoud, rendert
  deze naar PDF, voegt 'm samen met het CV (frontsheet eerst) en slaat beide
  PDF's op in Supabase Storage; `Frontsheet`-record wordt bijgewerkt.
- Als `Candidate.userId` se `User.anonymizeCandidateInPdf` aanstaat, worden
  contactgegevens in het CV vóór samenvoegen geanonimiseerd.
- Presentatie-PDF is visueel gecontroleerd: frontsheet-pagina('s) eerst,
  daarna het originele CV.

**Status/Geleerd:** _(nog niet gestart)_

---

## Fase 5 — Stijlprofiel + mailgeneratie

**Doel:** per kansrijke match een concept-introductiemail genereren in de
schrijfstijl van de recruiter. Mails worden nooit automatisch verstuurd.

**Bestanden:**
- `src/lib/ai/bouwStijlprofiel.ts` — 5-10 voorbeeldmails → tekstueel stijlprofiel (eenmalig per gebruiker)
- `src/lib/ai/genereerMail.ts` — match + stijlprofiel + voorbeeldmails → onderwerpsregel + mailtekst
- `scripts/mail.ts` — CLI: `npm run mail -- <matchId>`

**Definition of done:**
- Eenmalig: stijlprofiel opgebouwd uit 2-3+ voorbeeldmails en opgeslagen in
  `StyleProfile` + `ExampleEmail[]`.
- `npm run mail -- <matchId>` genereert een `EmailDraft` (onderwerp + body)
  die de stijl van het profiel volgt.
- Geen enkel pad in de code verstuurt een e-mail — alleen concept-opslag.

**Status/Geleerd:** _(nog niet gestart)_

---

## Fase 6 — Dashboard

**Doel:** overzicht van vacatures, kandidaten, kansrijke matches; downloadknop
voor de presentatie-PDF; mailconcept met kopieerknop.

**Bestanden:**
- `src/app/` — Next.js pagina's: vacatures, kandidaten, matches, match-detail
- `src/app/api/` — API routes die de fase 1-5 lib-functies aanroepen (geen
  nieuwe business-logica, alleen ontsluiting voor de UI)
- Tailwind CSS + shadcn/ui componenten (nu pas toevoegen — niet vooruitlopen
  in eerdere fases)

**Definition of done:**
- Vacature-overzicht, kandidaat-overzicht en kansrijke-matches-overzicht
  werken tegen de bestaande database.
- Match-detailpagina toont score, onderbouwing, downloadknop voor de
  presentatie-PDF en het mailconcept met kopieerknop.
- Geen directe Anthropic/Adzuna-calls vanuit de browser — alles via API
  routes server-side.

**Status/Geleerd:** _(nog niet gestart)_

---

## Fase 7 — Multi-user (stub)

**Doel:** dit is bij aanvang **alleen een stub-beschrijving**, geen
implementatie. Het datamodel (`User`, `Market`, `StyleProfile`,
`FrontsheetTemplate`) ondersteunt dit al vanaf fase 1 — fase 7 voegt echte
authenticatie en onboarding toe.

**Voorziene aanpak (niet bouwen vóór expliciete opdracht):**
- Supabase Auth voor login/registratie; `User.id` koppelen aan
  `auth.users.id`.
- Onboarding-flow: nieuwe gebruiker maakt eigen `Market` (domein + regio's),
  `StyleProfile` (voorbeeldmails) en `FrontsheetTemplate` aan.
- Rijen die nu aan de geseede default user hangen, blijven ongewijzigd — er
  is geen migratie nodig omdat `userId`/`marketId` al overal aanwezig zijn.
- Autorisatie: elke query scopen op de ingelogde `userId` (Prisma-laag of
  Postgres RLS — keuze maken zodra dit fase actief wordt).

**Status/Geleerd:** _(stub — nog niet gestart)_
