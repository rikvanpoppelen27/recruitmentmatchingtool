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
| 3    | Matching-engine                     | Klaar |
| 4    | Frontsheet + PDF-generatie          | Klaar |
| 5    | Stijlprofiel + mailgeneratie        | Klaar |
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

**Doel:** hybride matching in twee lagen — laag 1 deterministische
skill-matching (code, gratis), laag 2 semantische AI-beoordeling — gewogen
samengevoegd tot één eindscore 0-100 met onderbouwing en een `kansrijk`-vlag
(eindscore ≥ `MATCH_THRESHOLD` uit env).

**Bestanden:**
- `src/config/skill-aliases.ts` — onderhoudbare synoniemenmap (react.js = react, js = javascript, ...)
- `src/config/match.ts` — gewichten laag1/laag2, must-have/nice-to-have-weging, knock-out-cap, AI-voordrempel
- `src/lib/match/skills.ts` — laag 1: deterministische skill-vergelijking
- `src/lib/match/score.ts` — combineert laag 1 + laag 2 tot eindscore, past knock-out toe
- `src/lib/ai/analyseVacature.ts` — vacaturetekst → must-haves/nice-to-haves/senioriteit
- `src/lib/ai/match.ts` (`berekenMatch`) — laag 2: semantische beoordeling (senioriteit, domein, transferable skills, regio)
- `src/lib/ai/callClaudeJson.ts` — gedeelde retry-met-Zod-validatie-helper (alleen voor fase 3's nieuwe AI-functies)
- `src/lib/validation/ai.ts` — Zod-schema's voor vacature-analyse en semantische match-output
- `scripts/match.ts` — CLI: `npm run match`
- `scripts/calibrate.ts` + `calibration/golden-set.json` — CLI: `npm run calibrate`
- `tests/matching.test.ts` — Vitest voor skill-normalisatie/aliassen, knock-out-regel, score-combinatie

**Definition of done:**
- `npm run match` analyseert eerst nog niet-geanalyseerde vacatures
  (`analyzedAt IS NULL`), matcht daarna elke actieve kandidaat tegen elke
  vacature die nog geen `Match`-record heeft (`@@unique([candidateId,
  vacancyId])` voorkomt duplicaten), en print een samenvatting gesorteerd op
  eindscore met kansrijke matches bovenaan.
- Laag 2 (AI) wordt alleen aangeroepen als laag 1's must-have-dekking de
  voordrempel haalt — aantal overgeslagen AI-calls wordt gelogd.
- Een kandidaat die een must-have mist komt niet boven de knock-out-cap uit,
  ongeacht de semantische score.
- `npm run calibrate` draait over `calibration/golden-set.json` en toont
  labels naast berekende scores, gemiddelde per label, en false positives.
- `tests/matching.test.ts` slaagt.

**Status/Geleerd:** Klaar. Echte match-run: 22 matches, 14 AI-calls + 8
overgeslagen op de voordrempel. Kalibratie (illustratieve golden set) gaf
sterk=70.0 > twijfel=58.5 > zwak=35.5 — juiste richting, 0 false positives,
maar nog geen sterk-paar boven drempel 90: tuning-werk voor Rik. Veel Adzuna-
omschrijvingen missen expliciete must-haves (terecht lege lijst i.p.v.
gegokt), dus laag 2 draagt daar het meeste gewicht.

---

## Fase 4 — Frontsheet-template + PDF-generatie + samenvoegen

**Doel:** per kansrijke match een frontsheet genereren (samenvatting
kandidaat, waarom deze match, relevante ervaring) op basis van een vast
template, als PDF, samengevoegd met het originele CV (frontsheet eerst).

**Bestanden:**
- `templates/frontsheet.html` — A4-printtemplate met `{{placeholder}}`'s (zie comment bovenin)
- `src/config/branding.ts` — bureaunaam/logo/kleur/voettekst + `anonymizeCV`-vlag
- `src/lib/pdf/template.ts` — placeholder-vervanging + escaping (puur, testbaar)
- `src/lib/ai/frontsheet.ts` (`genereerFrontsheet`) — match + kandidaat + vacature → invulvelden, met woordlimieten in code
- `src/lib/pdf/render.ts` — HTML → PDF via Playwright, één hergebruikte browser-instantie
- `src/lib/pdf/merge.ts` — CV ophalen, DOCX→PDF (LibreOffice), optionele anonimisering, samenvoegen (pdf-lib)
- `src/lib/storage/supabase.ts` — additief uitgebreid met generieke download/upload/ensureBucket (fase 2 ongewijzigd)
- `scripts/frontsheet.ts` — CLI: `npm run frontsheet -- <matchId>` of `-- --all-kansrijk`
- `tests/frontsheet.test.ts` — template-invulling, lengtebegrenzing, merge-volgorde

**Definition of done:**
- `npm run frontsheet -- <matchId>` genereert de frontsheet-inhoud, rendert
  deze naar PDF, voegt 'm samen met het CV (frontsheet eerst) en uploadt het
  resultaat naar de presentations-bucket; `Frontsheet`-record wordt bijgewerkt.
- `anonymizeCV` in `config/branding.ts` verwijdert contactgegevens betrouwbaar
  bij DOCX-bronnen (tekstvervanging vóór PDF-conversie); bij PDF-bronnen wordt
  expliciet gewaarschuwd i.p.v. een onbetrouwbare visuele overlay te doen.
- Presentatie-PDF gecontroleerd: frontsheet-pagina('s) eerst, daarna het CV.

**Status/Geleerd:** Klaar. Echte run geverifieerd (Jan Jansen × Yellowtail
Conclusion, 2 pagina's, geüpload + pad opgeslagen). Handmatige inhoudscontrole
ving een verzonnen "vier à vijf jaar ervaring" (opgeteld uit periodes) —
expliciet verbod hierop toegevoegd aan de systeemprompt, opgelost. DOCX→PDF
(LibreOffice) is gebouwd maar niet live getest: ontbreekt op deze machine en
beide testkandidaten hebben een PDF-CV.

---

## Fase 5 — Stijlprofiel + mailgeneratie

**Doel:** per kansrijke match een concept-introductiemail genereren in de
schrijfstijl van de recruiter. Mails worden nooit automatisch verstuurd.

**Bestanden:**
- `mail-examples/` — voorbeeldmails (.txt, één per bestand, `Onderwerp:` als eerste regel)
- `src/lib/mail/import-examples.ts` — inlezen/parsen, waarschuwing bij <5 voorbeelden, best-effort contactgegevens-detectie + maskering (`--mask`)
- `src/lib/ai/style-profile.ts` (`bouwStijlprofiel`) — voorbeeldmails → gestructureerd stijlprofiel (JSON) + AI wijst 3 meest representatieve voorbeelden aan
- `src/lib/ai/mail.ts` (`genereerMail`) — match + kandidaat/vacatureprofiel + stijlprofiel + 3 voorbeelden → onderwerp + body, met variant-parameter (standaard/korter/formeler/informeler)
- `src/lib/validation/mail.ts` — Zod-schema's (stijlprofiel, dynamische representatieve-indices-validatie, mailinhoud)
- `scripts/style-profile.ts` — CLI: `npm run style-profile [-- --mask]`
- `scripts/mail.ts` — CLI: `npm run mail -- <matchId> [--variant=...]` of `-- --all-kansrijk`
- `tests/mail.test.ts` — parsing, <5-waarschuwing, contactgegevens-detectie/maskering, Zod-schema's
- Prisma: `StyleProfile.content` nu `Json` (was tekst); `EmailDraft` kreeg `variant` (`EmailVariant`-enum) en `status`, en verloor zijn `@unique` op `matchId` zodat elke generatie een nieuw record wordt i.p.v. een overschrijving

**Definition of done:**
- `npm run style-profile` bouwt/vernieuwt het stijlprofiel uit `mail-examples/`
  en print het leesbaar; slaat profiel + 3 representatieve voorbeelden op.
- `npm run mail -- <matchId>` genereert een `EmailDraft` (status altijd
  `concept`) in de stijl van het profiel, gebaseerd op kandidaat + vacature +
  match — geen verzonnen feiten, geen contactgegevens van de kandidaat.
- `--variant=korter|formeler|informeler` genereert een alternatief als apart
  record; niets wordt overschreven.
- Geen enkel pad in de code verstuurt een e-mail — alleen concept-opslag.

**Status/Geleerd:** Klaar. Echte run: stijlprofiel gebouwd uit 6 voorbeeldmails
(`--mask`), concept + "korter"-variant gegenereerd voor een echte match — beide
correct als los record opgeslagen, inhoud eerlijk (noemt zelf het senioriteits-
verschil i.p.v. het te verbloemen), geen contactgegevens. `MailInput` bevat
structureel geen candidate-email/telefoon (niet alleen een promptregel, maar
domeinen die simpelweg niet meegegeven worden). Eén voorbeeldmail bevatte
bewust een telefoonnummer/e-mailadres om de waarschuwing + `--mask` echt te
verifiëren — werkte in één keer goed.

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
