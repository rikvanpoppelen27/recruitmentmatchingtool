/**
 * De 12 Nederlandse provincies, als vaste bron van waarheid voor
 * zoekprofielen (fase 6B) — geen provincienamen los in de codebase.
 */
export interface Province {
  /** Stabiele code, gebruikt in SearchProfile.provinces. */
  code: string;
  /** Weergavenaam in de UI. */
  name: string;
  /** Exacte `where`-waarde die de Adzuna API verwacht. */
  adzunaWhere: string;
}

export const PROVINCES: Province[] = [
  { code: "GR", name: "Groningen", adzunaWhere: "Groningen" },
  { code: "FR", name: "Friesland", adzunaWhere: "Friesland" },
  { code: "DR", name: "Drenthe", adzunaWhere: "Drenthe" },
  { code: "OV", name: "Overijssel", adzunaWhere: "Overijssel" },
  { code: "FL", name: "Flevoland", adzunaWhere: "Flevoland" },
  { code: "GE", name: "Gelderland", adzunaWhere: "Gelderland" },
  { code: "UT", name: "Utrecht", adzunaWhere: "Utrecht" },
  { code: "NH", name: "Noord-Holland", adzunaWhere: "Noord-Holland" },
  { code: "ZH", name: "Zuid-Holland", adzunaWhere: "Zuid-Holland" },
  { code: "ZE", name: "Zeeland", adzunaWhere: "Zeeland" },
  { code: "NB", name: "Noord-Brabant", adzunaWhere: "Noord-Brabant" },
  { code: "LI", name: "Limburg", adzunaWhere: "Limburg" },
];

const PROVINCE_BY_CODE = new Map(PROVINCES.map((p) => [p.code, p]));

export function getProvinceByCode(code: string): Province | undefined {
  return PROVINCE_BY_CODE.get(code);
}

export function isValidProvinceCode(code: string): boolean {
  return PROVINCE_BY_CODE.has(code);
}
