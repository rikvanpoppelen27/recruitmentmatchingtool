export type DetectedVacancySource = "LINKEDIN" | "INDEED" | "MANUAL" | "OTHER";

export interface SourceDetectionResult {
  source: DetectedVacancySource;
  /** Mensleesbaar label voor de UI (bronbadge op /vacatures). */
  label: string;
}

interface DomainSourceMapping {
  /** Fragment dat in de hostnaam moet voorkomen, bv. "indeed." matcht indeed.com, indeed.nl, indeed.co.uk. */
  fragment: string;
  source: DetectedVacancySource;
  label: string;
}

/**
 * Uitbreidbare domein→bron-map. Nieuwe vacaturesites toevoegen = hier een
 * regel toevoegen, geen wijziging elders nodig.
 */
const DOMAIN_SOURCE_MAP: DomainSourceMapping[] = [
  { fragment: "linkedin.com", source: "LINKEDIN", label: "LinkedIn" },
  { fragment: "indeed.", source: "INDEED", label: "Indeed" },
  { fragment: "nationalevacaturebank.nl", source: "OTHER", label: "Nationale Vacaturebank" },
  { fragment: "werkzoeken.nl", source: "OTHER", label: "Werkzoeken.nl" },
  { fragment: "monsterboard.nl", source: "OTHER", label: "Monsterboard" },
  { fragment: "werk.nl", source: "OTHER", label: "Werk.nl" },
];

/**
 * Herkent de bron van een handmatig ingevoerde vacature op basis van het
 * domein in de meegegeven URL. Geen URL -> "manual". Onbekend domein ->
 * "other". Een ongeldige URL-string wordt hetzelfde behandeld als een
 * onbekend domein (other), niet als een fout — bronherkenning is een
 * hulpmiddel, geen validatie-eis.
 */
export function detectSource(url: string | null | undefined): SourceDetectionResult {
  const trimmed = url?.trim();
  if (!trimmed) {
    return { source: "MANUAL", label: "Handmatig" };
  }

  let hostname: string;
  try {
    hostname = new URL(trimmed).hostname.toLowerCase();
  } catch {
    return { source: "OTHER", label: "Overig" };
  }

  for (const mapping of DOMAIN_SOURCE_MAP) {
    if (hostname.includes(mapping.fragment)) {
      return { source: mapping.source, label: mapping.label };
    }
  }

  return { source: "OTHER", label: "Overig" };
}
