import type { Vacancy } from "../../types/vacancy";

export interface JobSearchParams {
  /** Zoekterm, bv. "front-end developer". */
  what: string;
  /** Regio, bv. "Noord-Holland". */
  where: string;
}

/**
 * Contract voor een vacature-bron. Elke bron (Adzuna, later eventueel
 * Jobfeed) implementeert dit interface en mapt zijn eigen responsevorm naar
 * het uniforme Vacancy-type, zodat de rest van de applicatie
 * bron-onafhankelijk blijft.
 */
export interface JobSourceAdapter {
  readonly source: Vacancy["source"];
  fetchVacancies(params: JobSearchParams): Promise<Vacancy[]>;
}
