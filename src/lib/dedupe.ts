import { createHash } from "node:crypto";

// Unicode-blok "Combining Diacritical Marks" (0x0300 t/m 0x036F) — dit zijn
// de losse accenttekens die overblijven na String.prototype.normalize("NFD"),
// bv. het "combining acute accent" achter de "e" van een NFD-ontlede "é".
const COMBINING_DIACRITICS_START = 0x0300;
const COMBINING_DIACRITICS_END = 0x036f;

function stripDiacritics(value: string): string {
  return Array.from(value)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code < COMBINING_DIACRITICS_START || code > COMBINING_DIACRITICS_END;
    })
    .join("");
}

/**
 * Normaliseert een tekstveld voor ontdubbeling: diakrieten weg, lowercase,
 * punten/komma's/koppeltekens zonder spatie verwijderd (zodat "B.V." ~ "BV"
 * en "Front-end" ~ "Frontend" gelijk normaliseren), overige leestekens naar
 * spatie, meervoudige spaties samengevoegd.
 */
export function normalize(value: string): string {
  return stripDiacritics(value.normalize("NFD"))
    .toLowerCase()
    .replace(/[.,-]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Ontdubbelingssleutel: genormaliseerde bedrijfsnaam + titel + plaats. */
export function buildDedupeKey(companyName: string, title: string, location: string): string {
  return [normalize(companyName), normalize(title), normalize(location)].join("|");
}

/** Hasht de dedupe-sleutel naar een vaste-lengte string voor de unique-kolom. */
export function hashDedupeKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function computeDedupeHash(companyName: string, title: string, location: string): string {
  return hashDedupeKey(buildDedupeKey(companyName, title, location));
}

export interface DedupeCandidate {
  companyName: string;
  title: string;
  location: string;
}

export interface DedupeWithinRunResult<T extends DedupeCandidate> {
  /** Eerste voorkomen per dedupeHash, met de hash erbij. */
  unique: (T & { dedupeHash: string })[];
  duplicatesWithinRun: number;
}

/** Ontdubbelt binnen één importrun: houdt het eerste voorkomen per hash. */
export function dedupeWithinRun<T extends DedupeCandidate>(items: T[]): DedupeWithinRunResult<T> {
  const seen = new Map<string, T & { dedupeHash: string }>();
  let duplicatesWithinRun = 0;

  for (const item of items) {
    const dedupeHash = computeDedupeHash(item.companyName, item.title, item.location);
    if (seen.has(dedupeHash)) {
      duplicatesWithinRun += 1;
      continue;
    }
    seen.set(dedupeHash, { ...item, dedupeHash });
  }

  return { unique: Array.from(seen.values()), duplicatesWithinRun };
}

export interface DedupeAgainstExistingResult<T> {
  toInsert: T[];
  /** Items die al bestonden — hiervoor alleen lastSeenAt bijwerken. */
  toTouch: T[];
}

/**
 * Splitst de binnen-run-unieke vacatures in nieuw op te slaan records en
 * bestaande records die al bekend zijn (alleen lastSeenAt bijwerken).
 */
export function dedupeAgainstExisting<T extends { dedupeHash: string }>(
  items: T[],
  existingHashes: Set<string>,
): DedupeAgainstExistingResult<T> {
  const toInsert: T[] = [];
  const toTouch: T[] = [];

  for (const item of items) {
    if (existingHashes.has(item.dedupeHash)) {
      toTouch.push(item);
    } else {
      toInsert.push(item);
    }
  }

  return { toInsert, toTouch };
}
